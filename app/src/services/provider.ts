// Provider selector — the single switch point for AI providers.
//
// This is the ONLY file you edit to change AI providers. Point `activeProvider`
// at a different implementation of the AiProvider contract (e.g. a future
// services/claude.ts or services/openai.ts) and the entire app follows.
//
// ai.ts and everything above it depend on this abstraction, never on Groq.

import type { AiProvider } from '../types/advisor';
import { groqProvider } from './groq';

/**
 * The active AI provider for the whole application.
 *
 * To switch to Claude or OpenAI later:
 *   1. Add services/claude.ts exporting a `claudeProvider: AiProvider`.
 *   2. Change the line below to `export const activeProvider = claudeProvider;`
 * No other file needs to change.
 */
export const activeProvider: AiProvider = groqProvider;
