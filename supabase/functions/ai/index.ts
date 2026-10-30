// Supabase Edge Function: ai
// Serves: explain, quiz, mock, flashcards, presentation, chat
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { corsHeaders } from '../_shared/cors.ts';
import {
  getExplainPrompt,
  getQuizPrompt,
  getFlashcardPrompt,
  getPresentationPrompt,
  getChatSystemPrompt,
} from './prompts.ts';
import { callLLMText, cleanJsonString, ProviderConfig } from './providers.ts';

// In-memory rate limiting map: userId -> [timestamp1, timestamp2, ...]
const rateLimitMap = new Map<string, number[]>();
const RATE_LIMIT_MAX = 30; // 30 calls
const RATE_LIMIT_WINDOW_MS = 60 * 60 * 1000; // 1 hour
const MAX_INPUT_CHARS = 40000;

function checkRateLimit(userId: string): boolean {
  const now = Date.now();
  const timestamps = rateLimitMap.get(userId) || [];
  const valid = timestamps.filter((t) => now - t < RATE_LIMIT_WINDOW_MS);
  if (valid.length >= RATE_LIMIT_MAX) {
    return false;
  }
  valid.push(now);
  rateLimitMap.set(userId, valid);
  return true;
}

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get('Authorization') || '';
    // Optional JWT verification or fallback for testing
    let userId = 'anon-user';
    if (authHeader.startsWith('Bearer ')) {
      const token = authHeader.replace('Bearer ', '');
      try {
        const payloadBase64 = token.split('.')[1];
        if (payloadBase64) {
          const decoded = JSON.parse(atob(payloadBase64));
          if (decoded?.sub) userId = decoded.sub;
        }
      } catch (_) {
        // Ignored
      }
    }

    if (!checkRateLimit(userId)) {
      return new Response(
        JSON.stringify({ error: { code: 'rate_limited', message: 'Too many requests. Please wait a moment.' } }),
        { status: 429, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const body = await req.json();
    const { task, topic = '', content = '', options = {}, messages = [] } = body;

    // Check prompt size cap
    const totalInputSize = (topic?.length || 0) + (content?.length || 0) + JSON.stringify(messages).length;
    if (totalInputSize > MAX_INPUT_CHARS) {
      return new Response(
        JSON.stringify({ error: { code: 'prompt_too_large', message: 'Input material is too large. Please use a shorter excerpt.' } }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Provider config from environment or fallback
    const config: ProviderConfig = {
      provider: (Deno.env.get('AI_PROVIDER') as any) || 'gemini',
      apiKey: Deno.env.get('AI_API_KEY') || Deno.env.get('GEMINI_API_KEY') || '',
      model: Deno.env.get('AI_MODEL') || 'gemini-1.5-flash',
    };

    if (!config.apiKey) {
      return new Response(
        JSON.stringify({ error: { code: 'sampling_disabled', message: 'AI API key not configured on server.' } }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Handle Chat task
    if (task === 'chat') {
      const systemPrompt = getChatSystemPrompt(topic, content);
      let prompt = '';
      if (messages.length > 0) {
        const lastMsg = messages[messages.length - 1];
        prompt = lastMsg.content;
      } else {
        prompt = `Hello! Please help me study: ${topic}`;
      }

      const reply = await callLLMText(prompt, config, systemPrompt);
      return new Response(
        JSON.stringify({ data: { role: 'assistant', content: reply } }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Determine prompt based on task
    let promptText = '';
    if (task === 'explain') {
      promptText = getExplainPrompt(topic, content, options.level || 'simple');
    } else if (task === 'quiz') {
      promptText = getQuizPrompt(topic, content, options.count || 5, options.difficulty || 'medium');
    } else if (task === 'mock') {
      promptText = getQuizPrompt(topic, content, options.count || 10, options.difficulty || 'medium');
    } else if (task === 'flashcards') {
      promptText = getFlashcardPrompt(topic, content, options.count || 10);
    } else if (task === 'presentation') {
      promptText = getPresentationPrompt(topic, content, options.slideCount || 6);
    } else {
      return new Response(
        JSON.stringify({ error: { code: 'invalid_task', message: `Unknown task: ${task}` } }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Call LLM with 1 automatic retry on JSON parse failure (matching prototype's callJsonWithRetry)
    let parsedData: any = null;
    let lastError: any = null;

    for (let attempt = 0; attempt < 2; attempt++) {
      try {
        const rawOutput = await callLLMText(promptText, config);
        const cleaned = cleanJsonString(rawOutput);
        parsedData = JSON.parse(cleaned);
        if (parsedData) break;
      } catch (err: any) {
        lastError = err;
        if (attempt === 1) {
          return new Response(
            JSON.stringify({
              error: {
                code: 'invalid_json',
                message: 'Could not parse structured response from AI. Please try again.',
                details: err.message,
              },
            }),
            { status: 502, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }
      }
    }

    return new Response(
      JSON.stringify({ data: parsedData }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (err: any) {
    const code = err.code || 'unknown_error';
    return new Response(
      JSON.stringify({ error: { code, message: err.message || 'An unexpected error occurred.' } }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});

