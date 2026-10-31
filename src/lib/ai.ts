import { z } from 'zod';
import { supabase } from './supabase';
import {
  getExplainPrompt,
  getQuizPrompt,
  getFlashcardPrompt,
  getPresentationPrompt,
  getChatSystemPrompt,
} from '../../supabase/functions/ai/prompts';
import { cleanJsonString } from '../../supabase/functions/ai/providers';

export interface AIError {
  code:
    | 'not_granted'
    | 'rate_limited'
    | 'sampling_disabled'
    | 'prompt_too_large'
    | 'invalid_json'
    | 'refused'
    | 'empty_completion'
    | 'unauthorized'
    | 'unknown_error';
  message?: string;
}

export function aiErrorMsg(e: any): string {
  if (!e) return 'Something went wrong. Try again.';
  const code = e.code || (typeof e === 'string' ? e : '');
  const map: Record<string, string> = {
    not_granted: 'AI access was declined — reload the page and allow AI access when prompted.',
    rate_limited: 'Too many requests right now — wait a moment and try again.',
    sampling_disabled: 'AI is not available for this account. Check your API key.',
    prompt_too_large: 'That material is too long — try a shorter excerpt.',
    invalid_json: 'The AI response could not be read — try again.',
    refused: 'The AI declined that request — try rephrasing.',
    empty_completion: 'The AI did not return anything — try again.',
    unauthorized: 'Authentication required. Please sign in.',
  };
  return map[code] || e.message || 'Something went wrong. Try again.';
}

export interface AIPayload {
  topic: string;
  content?: string;
  options?: Record<string, any>;
}

// Direct client fallback if Edge Function is not yet deployed on Supabase project
async function directGeminiFallback(prompt: string, systemPrompt?: string): Promise<string> {
  const apiKey = import.meta.env.VITE_GEMINI_API_KEY || import.meta.env.AI_API_KEY;
  if (!apiKey) {
    const err: any = new Error('No Gemini API key available');
    err.code = 'sampling_disabled';
    throw err;
  }

  const candidateModels = [
    import.meta.env.VITE_AI_MODEL || import.meta.env.AI_MODEL || 'gemini-3.5-flash',
    'gemini-3-flash-preview',
    'gemini-flash-latest',
  ];

  const contents: any[] = [];
  if (systemPrompt) {
    contents.push({ role: 'user', parts: [{ text: `SYSTEM INSTRUCTIONS:\n${systemPrompt}` }] });
    contents.push({ role: 'model', parts: [{ text: 'Understood.' }] });
  }
  contents.push({ role: 'user', parts: [{ text: prompt }] });

  let lastError: any = null;

  for (const model of candidateModels) {
    try {
      const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;
      const resp = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents,
          generationConfig: { temperature: 0.3, maxOutputTokens: 4096 },
        }),
      });

      if (!resp.ok) {
        if (resp.status === 404 && model !== candidateModels[candidateModels.length - 1]) {
          // Try next model if 404
          continue;
        }
        const errorData = await resp.json().catch(() => null);
        const msg = errorData?.error?.message || `API Error ${resp.status}`;
        const err: any = new Error(msg);
        if (resp.status === 429) err.code = 'rate_limited';
        else if (resp.status === 403 || resp.status === 401) err.code = 'sampling_disabled';
        throw err;
      }

      const data = await resp.json();
      const text = data.candidates?.[0]?.content?.parts?.map((p: any) => p.text).join('') || '';
      if (!text.trim()) {
        const err: any = new Error('Empty response');
        err.code = 'empty_completion';
        throw err;
      }
      return text;
    } catch (e: any) {
      lastError = e;
      if (e.code === 'rate_limited' || e.code === 'sampling_disabled') {
        throw e;
      }
    }
  }

  throw lastError || new Error('Could not connect to Gemini API');
}

export const ai = {
  async json<T>(
    task: 'explain' | 'quiz' | 'mock' | 'flashcards' | 'presentation',
    payload: AIPayload,
    schema?: z.ZodType<T, any, any>
  ): Promise<{ data?: T; error?: AIError }> {
    try {
      // 1. Try Supabase Edge Function first
      const { data: edgeData, error: edgeError } = await supabase.functions.invoke('ai', {
        body: { task, ...payload },
      });

      if (!edgeError && edgeData?.data) {
        let result = edgeData.data;
        if (schema) {
          const parsed = schema.safeParse(result);
          if (parsed.success) {
            return { data: parsed.data };
          }
        } else {
          return { data: result };
        }
      }

      // If Edge function is not deployed yet or returned 404/Function not found, fallback smoothly:
      let prompt = '';
      if (task === 'explain') {
        prompt = getExplainPrompt(payload.topic, payload.content, payload.options?.level);
      } else if (task === 'quiz' || task === 'mock') {
        prompt = getQuizPrompt(
          payload.topic,
          payload.content,
          payload.options?.count || 5,
          payload.options?.difficulty || 'medium'
        );
      } else if (task === 'flashcards') {
        prompt = getFlashcardPrompt(payload.topic, payload.content, payload.options?.count || 10);
      } else if (task === 'presentation') {
        prompt = getPresentationPrompt(payload.topic, payload.content, payload.options?.slideCount || 6);
      }

      // 1 retry loop for client fallback
      for (let attempt = 0; attempt < 2; attempt++) {
        try {
          const rawText = await directGeminiFallback(prompt);
          const cleaned = cleanJsonString(rawText);
          const parsed = JSON.parse(cleaned);
          if (schema) {
            const validation = schema.safeParse(parsed);
            if (validation.success) {
              return { data: validation.data };
            }
          } else {
            return { data: parsed };
          }
        } catch (err: any) {
          if (attempt === 1 || err.code === 'rate_limited' || err.code === 'sampling_disabled') {
            return { error: { code: err.code || 'invalid_json', message: err.message } };
          }
        }
      }

      return { error: { code: 'invalid_json', message: 'Could not validate AI response format.' } };
    } catch (e: any) {
      return { error: { code: e.code || 'unknown_error', message: e.message } };
    }
  },

  async chat(
    messages: { role: 'user' | 'assistant' | 'system'; content: string }[],
    context?: { topic?: string; content?: string }
  ): Promise<{ data?: string; error?: AIError }> {
    try {
      const { data: edgeData, error: edgeError } = await supabase.functions.invoke('ai', {
        body: { task: 'chat', messages, topic: context?.topic, content: context?.content },
      });

      if (!edgeError && edgeData?.data?.content) {
        return { data: edgeData.data.content };
      }

      // Fallback
      const lastMsg = messages[messages.length - 1];
      const systemPrompt = getChatSystemPrompt(context?.topic, context?.content);
      const text = await directGeminiFallback(lastMsg?.content || '', systemPrompt);
      return { data: text };
    } catch (e: any) {
      return { error: { code: e.code || 'unknown_error', message: e.message } };
    }
  },
};
