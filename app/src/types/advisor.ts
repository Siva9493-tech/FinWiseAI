// Types for the AI Financial Advisor module.
// Pure data contracts shared between the AI service layer, the API endpoint,
// and the UI. No provider-specific shapes leak past this file.

import type { EligibilityResult } from './loan';
import type { CreditAnalysis } from './credit';
import type { EmiResult } from './emi';

/**
 * A snapshot of the user's deterministic financial results.
 *
 * Every field is optional: the advisor works even if the user has only run
 * one of the three tools (or none). The AI reasons over whatever is present.
 * These values are ALWAYS computed locally — the AI never recalculates them.
 */
export interface FinancialContext {
  loan?: EligibilityResult;
  credit?: CreditAnalysis;
  emi?: EmiResult;
}

/** A single suggested question shown as a clickable chip. */
export interface SuggestedQuestion {
  icon: string;
  text: string;
}

/** The request payload sent from the browser to the /api/advice endpoint. */
export interface AdviceRequest {
  question: string;
  context: FinancialContext;
}

/**
 * One turn in the current session's chat history.
 * Held in memory only (never persisted) — "History (Current Session)".
 */
export interface AdviceTurn {
  id: string;
  question: string;
  /** Markdown response text. */
  answer: string;
  /** Epoch milliseconds when the turn completed. */
  createdAt: number;
}

/** Roles for the messages sent to the underlying chat model. */
export type ChatRole = 'system' | 'user';

/** A provider-agnostic chat message. */
export interface ChatMessage {
  role: ChatRole;
  content: string;
}

/**
 * The minimal contract every AI provider must satisfy.
 *
 * Swapping Groq for Claude/OpenAI later means writing one new object of this
 * shape and pointing provider.ts at it — nothing else in the app changes.
 */
export interface AiProvider {
  /** Human-readable provider name, e.g. "Groq". */
  readonly name: string;
  /** The model id this provider is configured to use. */
  readonly model: string;
  /**
   * Stream a chat completion as text chunks.
   * Implementations yield partial content as it arrives.
   */
  streamChat(messages: ChatMessage[], signal?: AbortSignal): AsyncIterable<string>;
}
