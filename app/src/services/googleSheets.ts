// Google Sheets service — the ONLY module that talks to the Apps Script backend.
//
// SERVER-SIDE ONLY. It reads GOOGLE_SCRIPT_URL from the environment and is
// imported exclusively by the /api/history endpoint. The browser never sees the
// URL: it calls our own /api/history, which delegates here. This keeps the
// Apps Script endpoint out of the client bundle entirely.
//
// SECURITY: every outgoing record is validated and sanitized (types coerced,
// strings length-capped, unknown fields dropped) so we never forward arbitrary
// client data to the sheet.

import type { AnalysisRecord, SaveOutcome, AnalysisSource } from './types';
import { RECORD_VERSION } from './types';

const VALID_SOURCES: AnalysisSource[] = ['loan', 'credit', 'emi', 'advisor'];

/** Thrown when the backend is not configured — callers treat this as "offline". */
export class SheetsNotConfigured extends Error {}

interface SheetsConfig {
  url: string;
  /** Optional shared secret, forwarded to Apps Script for later auth. */
  token?: string;
}

function readConfig(): SheetsConfig {
  const env = (globalThis as { process?: { env?: Record<string, string | undefined> } })
    .process?.env;
  const url = import.meta.env.GOOGLE_SCRIPT_URL ?? env?.GOOGLE_SCRIPT_URL;
  if (!url) {
    throw new SheetsNotConfigured(
      'GOOGLE_SCRIPT_URL is not set. Records are stored locally until it is configured.'
    );
  }
  const token = import.meta.env.GOOGLE_SCRIPT_TOKEN ?? env?.GOOGLE_SCRIPT_TOKEN;
  return { url, token };
}

/** True when a backend URL is configured (without throwing). */
export function isConfigured(): boolean {
  try {
    readConfig();
    return true;
  } catch {
    return false;
  }
}

// ---- Sanitization -----------------------------------------------------------

const MAX_STRING = 2000;
const MAX_ADVICE = 8000;

/**
 * Drop ASCII control characters (keeping tab and newline) and cap length.
 * Implemented as a codepoint filter to avoid embedding control literals.
 */
function cleanString(value: unknown, max = MAX_STRING): string {
  if (typeof value !== 'string') return '';
  let out = '';
  for (const ch of value) {
    const code = ch.codePointAt(0) ?? 0;
    const isControl = (code < 0x20 && code !== 0x09 && code !== 0x0a) || code === 0x7f;
    if (!isControl) out += ch;
  }
  return out.trim().slice(0, max);
}

function cleanNumber(value: unknown): number | null {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value === 'string' && value.trim() !== '') {
    const n = Number(value);
    if (Number.isFinite(n)) return n;
  }
  return null;
}

/** Keep nested result objects only if they are plain JSON-serializable objects. */
function cleanJson<T>(value: unknown): T | null {
  if (value === null || typeof value !== 'object') return null;
  try {
    return JSON.parse(JSON.stringify(value)) as T;
  } catch {
    return null;
  }
}

/**
 * Validate and sanitize an untrusted record from the client into a safe,
 * fully-typed AnalysisRecord. Throws if the record is unusable (no id).
 */
export function sanitizeRecord(input: unknown): AnalysisRecord {
  if (!input || typeof input !== 'object') {
    throw new Error('Record must be an object.');
  }
  const r = input as Record<string, unknown>;

  const id = cleanString(r.id, 64);
  if (!id) throw new Error('Record id is required.');

  return {
    id,
    timestamp: cleanString(r.timestamp, 40) || new Date().toISOString(),
    name: cleanString(r.name, 120),
    age: cleanNumber(r.age),
    employment: cleanString(r.employment, 60),
    income: cleanNumber(r.income),
    loanAmount: cleanNumber(r.loanAmount),
    loanPurpose: cleanString(r.loanPurpose, 60),
    creditScore: cleanNumber(r.creditScore),
    monthlyEMI: cleanNumber(r.monthlyEMI),
    loanEligibilityResult: cleanJson(r.loanEligibilityResult),
    creditAnalysis: cleanJson(r.creditAnalysis),
    emiCalculation: cleanJson(r.emiCalculation),
    aiAdviceSummary: cleanString(r.aiAdviceSummary, MAX_ADVICE),
    source: VALID_SOURCES.includes(r.source as AnalysisSource) ? (r.source as AnalysisSource) : 'loan',
    device: cleanString(r.device, 200),
    version: cleanString(r.version, 20) || RECORD_VERSION,
  };
}

// ---- Transport --------------------------------------------------------------

const REQUEST_TIMEOUT_MS = 10_000;

async function callAppsScript(
  method: 'GET' | 'POST',
  body?: unknown
): Promise<Response> {
  const { url, token } = readConfig();
  const target = new URL(url);
  if (token) target.searchParams.set('token', token);

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  try {
    return await fetch(target.toString(), {
      method,
      // Apps Script web apps accept text/plain to avoid a CORS preflight.
      headers: body ? { 'Content-Type': 'text/plain;charset=utf-8' } : undefined,
      body: body ? JSON.stringify(body) : undefined,
      redirect: 'follow',
      signal: controller.signal,
    });
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Persist a record to the sheet (upsert by id, handled by Apps Script).
 * Returns a structured outcome; transient failures are marked retriable.
 */
export async function saveRecord(input: unknown): Promise<SaveOutcome> {
  let record: AnalysisRecord;
  try {
    record = sanitizeRecord(input);
  } catch (err) {
    return { ok: false, retriable: false, error: (err as Error).message };
  }

  try {
    const res = await callAppsScript('POST', { action: 'save', record });
    if (!res.ok) {
      return {
        ok: false,
        retriable: res.status >= 500 || res.status === 429,
        error: `Backend responded ${res.status}.`,
      };
    }
    return { ok: true, retriable: false };
  } catch (err) {
    if (err instanceof SheetsNotConfigured) {
      return { ok: false, retriable: true, error: err.message };
    }
    // Network error / timeout — worth retrying later.
    return { ok: false, retriable: true, error: (err as Error).message };
  }
}

/** Fetch all records from the sheet, newest first. Returns [] on soft failure. */
export async function listRecords(): Promise<AnalysisRecord[]> {
  const res = await callAppsScript('GET');
  if (!res.ok) throw new Error(`Backend responded ${res.status}.`);

  const data = (await res.json()) as { records?: unknown };
  const raw = Array.isArray(data.records) ? data.records : [];

  const records = raw
    .map((r) => {
      try {
        return sanitizeRecord(r);
      } catch {
        return null;
      }
    })
    .filter((r): r is AnalysisRecord => r !== null);

  // Newest first.
  records.sort((a, b) => b.timestamp.localeCompare(a.timestamp));
  return records;
}
