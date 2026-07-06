import type { APIRoute } from 'astro';
import {
  generateFinancialAdvice,
  InvalidAdviceRequest,
} from '../../services/ai';
import type { AdviceRequest } from '../../types/advisor';

// Runs on-demand on the server (never pre-rendered) so the Groq API key stays
// server-side. The browser talks only to this endpoint, never to Groq.
export const prerender = false;

export const POST: APIRoute = async ({ request }) => {
  let payload: AdviceRequest;
  try {
    payload = (await request.json()) as AdviceRequest;
  } catch {
    return jsonError('Invalid request body.', 400);
  }

  try {
    const chunks = generateFinancialAdvice({
      question: payload?.question,
      context: payload?.context ?? {},
      signal: request.signal,
    });

    // Re-emit the provider's text chunks as a plain streaming text response.
    const stream = new ReadableStream<Uint8Array>({
      async start(controller) {
        const encoder = new TextEncoder();
        try {
          for await (const chunk of chunks) {
            controller.enqueue(encoder.encode(chunk));
          }
        } catch (err) {
          // Stream already started; append a readable error marker instead of
          // throwing so the client sees a graceful message.
          controller.enqueue(
            encoder.encode(
              '\n\n> ⚠️ The AI response was interrupted. Please try again.'
            )
          );
          console.error('[advice] stream error:', errMessage(err));
        } finally {
          controller.close();
        }
      },
    });

    return new Response(stream, {
      status: 200,
      headers: {
        'Content-Type': 'text/plain; charset=utf-8',
        'Cache-Control': 'no-store',
        'X-Content-Type-Options': 'nosniff',
      },
    });
  } catch (err) {
    if (err instanceof InvalidAdviceRequest) {
      return jsonError(err.message, 400);
    }
    // Configuration / provider errors (e.g. missing key) — never leak details.
    console.error('[advice] error:', errMessage(err));
    return jsonError(
      'The AI advisor is temporarily unavailable. Please try again shortly.',
      503
    );
  }
};

function jsonError(message: string, status: number): Response {
  return new Response(JSON.stringify({ error: message }), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

function errMessage(err: unknown): string {
  return err instanceof Error ? err.message : String(err);
}
