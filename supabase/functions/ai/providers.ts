export interface ProviderConfig {
  provider: 'gemini' | 'openai' | 'claude';
  apiKey: string;
  model: string;
}

export async function callLLMText(prompt: string, config: ProviderConfig, systemPrompt?: string): Promise<string> {
  if (config.provider === 'gemini') {
    const model = config.model || 'gemini-3.5-flash';
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${config.apiKey}`;
    
    const contents: any[] = [];
    if (systemPrompt) {
      contents.push({ role: 'user', parts: [{ text: `SYSTEM INSTRUCTIONS:\n${systemPrompt}` }] });
      contents.push({ role: 'model', parts: [{ text: 'Understood. I will strictly adhere to these instructions.' }] });
    }
    contents.push({ role: 'user', parts: [{ text: prompt }] });

    const resp = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents,
        generationConfig: {
          temperature: 0.4,
          maxOutputTokens: 4096,
        },
      }),
    });

    if (!resp.ok) {
      const errText = await resp.text();
      throw new Error(`Gemini API error (${resp.status}): ${errText}`);
    }

    const data = await resp.json();
    const candidate = data.candidates?.[0];
    if (candidate?.finishReason === 'SAFETY' || candidate?.finishReason === 'RECITATION') {
      const error: any = new Error('Refused by safety filters');
      error.code = 'refused';
      throw error;
    }
    const text = candidate?.content?.parts?.map((p: any) => p.text).join('') || '';
    if (!text.trim()) {
      const error: any = new Error('Empty completion received');
      error.code = 'empty_completion';
      throw error;
    }
    return text;
  }

  if (config.provider === 'openai') {
    const model = config.model || 'gpt-4o-mini';
    const messages: any[] = [];
    if (systemPrompt) messages.push({ role: 'system', content: systemPrompt });
    messages.push({ role: 'user', content: prompt });

    const resp = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${config.apiKey}`,
      },
      body: JSON.stringify({
        model,
        messages,
        temperature: 0.4,
      }),
    });

    if (!resp.ok) {
      const errText = await resp.text();
      throw new Error(`OpenAI API error (${resp.status}): ${errText}`);
    }

    const data = await resp.json();
    const text = data.choices?.[0]?.message?.content || '';
    return text;
  }

  // Claude provider fallback
  const model = config.model || 'claude-3-5-sonnet-20241022';
  const resp = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': config.apiKey,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model,
      max_tokens: 4096,
      system: systemPrompt,
      messages: [{ role: 'user', content: prompt }],
    }),
  });

  if (!resp.ok) {
    const errText = await resp.text();
    throw new Error(`Anthropic API error (${resp.status}): ${errText}`);
  }

  const data = await resp.json();
  return data.content?.[0]?.text || '';
}

export function cleanJsonString(raw: string): string {
  let cleaned = raw.trim();
  // Strip Markdown code fencing if present (```json ... ``` or ``` ...)
  if (cleaned.startsWith('```')) {
    cleaned = cleaned.replace(/^```(?:json)?\s*/i, '');
    cleaned = cleaned.replace(/\s*```$/, '');
  }
  // Remove possible leading/trailing non-json chars
  const firstBrace = cleaned.indexOf('{');
  const firstBracket = cleaned.indexOf('[');
  if (firstBrace !== -1 && (firstBracket === -1 || firstBrace < firstBracket)) {
    const lastBrace = cleaned.lastIndexOf('}');
    if (lastBrace !== -1) {
      cleaned = cleaned.slice(firstBrace, lastBrace + 1);
    }
  } else if (firstBracket !== -1) {
    const lastBracket = cleaned.lastIndexOf(']');
    if (lastBracket !== -1) {
      cleaned = cleaned.slice(firstBracket, lastBracket + 1);
    }
  }
  return cleaned;
}

