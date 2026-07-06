// AI service — the single public entry point for Generative AI in FinWise.
//
// The rest of the app (specifically the /api/advice endpoint) calls ONLY this
// module. It exposes exactly one function, generateFinancialAdvice(), and hides
// every provider detail behind provider.ts. The UI never imports this and never
// talks to any AI provider directly.

import type { FinancialContext } from '../types/advisor';
import { activeProvider } from './provider';
import { buildMessages, MAX_QUESTION_LENGTH } from './advisor-prompt';

export interface GenerateAdviceOptions {
  question: string;
  context: FinancialContext;
  /** Abort signal wired to the HTTP request, so a disconnect stops the stream. */
  signal?: AbortSignal;
}

/** Thrown for bad input so the endpoint can return a 400 rather than a 500. */
export class InvalidAdviceRequest extends Error {}

function validateQuestion(question: unknown): string {
  if (typeof question !== 'string') {
    throw new InvalidAdviceRequest('A question is required.');
  }
  const trimmed = question.trim();
  if (trimmed.length === 0) {
    throw new InvalidAdviceRequest('Your question cannot be empty.');
  }
  if (trimmed.length > MAX_QUESTION_LENGTH) {
    throw new InvalidAdviceRequest(
      `Your question is too long (max ${MAX_QUESTION_LENGTH} characters).`
    );
  }
  return trimmed;
}

/**
 * Generate personalized financial advice as a stream of Markdown text chunks.
 *
 * This is the ONE function the application exposes for AI. It:
 *   1. Validates the question.
 *   2. Builds provider-agnostic prompt messages from the local results.
 *   3. Delegates streaming to whichever provider provider.ts has selected.
 *
 * @returns an async iterable of Markdown text chunks.
 */
export function generateFinancialAdvice(
  options: GenerateAdviceOptions
): AsyncIterable<string> {
  const question = validateQuestion(options.question);
  const context = options.context ?? {};
  const messages = buildMessages(question, context);
  return activeProvider.streamChat(messages, options.signal);
}

/** The active provider's display name — handy for the UI footer/badge. */
export const providerName = activeProvider.name;
