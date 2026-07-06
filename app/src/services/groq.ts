// Groq provider — the ONLY file that talks to the Groq API.
//
// It implements the provider-agnostic AiProvider contract (see types/advisor).
// Nothing else in the app imports this directly; everything goes through
// provider.ts → ai.ts. To add Claude/OpenAI later, write a sibling file with
// the same shape and switch the one reference in provider.ts.
//
// SECURITY: this module runs server-side only. It reads the API key from the
// environment and never returns it. It must never be imported into client code.

import type { AiProvider, ChatMessage } from '../types/advisor';

const GROQ_CHAT_URL = 'https://api.groq.com/openai/v1/chat/completions';

// Locked model per project rules (.ai/project_rules.md → Primary Model).
const GROQ_MODEL = 'llama-3.3-70b-versatile';

/**
 * Read the Groq API key from the server environment.
 * Never hardcoded, never shipped to the client, never logged.
 */
function readApiKey(): string {
  // import.meta.env is populated by Astro from the server environment (and .env
  // in dev). Fall back to globalThis.process.env for runtimes that expose it
  // there (e.g. some serverless targets) without needing @types/node.
  const runtimeEnv = (globalThis as { process?: { env?: Record<string, string | undefined> } })
    .process?.env;
  const key = import.meta.env.GROQ_API_KEY ?? runtimeEnv?.GROQ_API_KEY;
  if (!key) {
    throw new Error(
      'GROQ_API_KEY is not set. Add it to your .env file (see .env.example).'
    );
  }
  return key;
}

/**
 * Parse a Server-Sent-Events stream from Groq's OpenAI-compatible endpoint
 * and yield the incremental text deltas.
 */
async function* parseSseStream(
  body: ReadableStream<Uint8Array>,
  signal?: AbortSignal
): AsyncIterable<string> {
  const reader = body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';

  try {
    while (true) {
      if (signal?.aborted) break;
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });

      // SSE frames are separated by a blank line.
      const frames = buffer.split('\n\n');
      buffer = frames.pop() ?? '';

      for (const frame of frames) {
        const line = frame.split('\n').find((l) => l.startsWith('data:'));
        if (!line) continue;

        const data = line.slice(5).trim();
        if (data === '[DONE]') return;

        try {
          const json = JSON.parse(data);
          const delta: string | undefined = json.choices?.[0]?.delta?.content;
          if (delta) yield delta;
        } catch {
          // Ignore keep-alive or malformed frames; keep streaming.
        }
      }
    }
  } finally {
    reader.releaseLock();
  }
}

/** The Groq provider instance. */
export const groqProvider: AiProvider = {
  name: 'Groq',
  model: GROQ_MODEL,

  async *streamChat(
    messages: ChatMessage[],
    signal?: AbortSignal
  ): AsyncIterable<string> {
    const response = await fetch(GROQ_CHAT_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${readApiKey()}`,
      },
      body: JSON.stringify({
        model: GROQ_MODEL,
        messages,
        temperature: 0.6,
        max_tokens: 1400,
        stream: true,
      }),
      signal,
    });

    if (!response.ok || !response.body) {
      // Surface the status but never the key or full request.
      const detail = await response.text().catch(() => '');
      throw new Error(
        `Groq request failed (${response.status}). ${detail.slice(0, 200)}`
      );
    }

    yield* parseSseStream(response.body, signal);
  },
};
