// History service — CLIENT-SIDE orchestration for cloud persistence.
//
// The UI (tool pages + /history) talks ONLY to this module, never to Google
// Sheets directly. Responsibilities:
//   • build a clean snapshot record from cached results/inputs
//   • keep a local mirror in localStorage (offline-first, source of truth for UI)
//   • push records to the cloud via our own /api/history endpoint
//   • queue failed/offline saves and flush them automatically when back online
//
// Everything degrades gracefully: with no network (or no backend configured)
// records are still stored locally and shown in History, then synced later.

import type {
  AnalysisRecord,
  AnalysisInputs,
  AnalysisSource,
  StoredRecord,
  HistoryApiResponse,
} from './types';
import { RECORD_VERSION } from './types';
import type { FinancialContext } from '../types/advisor';
import { loadFinancialContext, loadAnalysisInputs, loadAdviceSummary } from '../utils/result-store';

const STORE_KEY = 'finwise:history:v1';
const MAX_LOCAL_RECORDS = 100;

// ---- Local mirror -----------------------------------------------------------

function readStore(): StoredRecord[] {
  try {
    if (typeof localStorage === 'undefined') return [];
    const raw = localStorage.getItem(STORE_KEY);
    return raw ? (JSON.parse(raw) as StoredRecord[]) : [];
  } catch {
    return [];
  }
}

function writeStore(records: StoredRecord[]): void {
  try {
    if (typeof localStorage === 'undefined') return;
    const trimmed = records.slice(0, MAX_LOCAL_RECORDS);
    localStorage.setItem(STORE_KEY, JSON.stringify(trimmed));
  } catch {
    // Quota / unavailable — nothing else we can do client-side.
  }
}

/** All locally-known records, newest first. */
export function getLocalRecords(): AnalysisRecord[] {
  return readStore()
    .map((s) => s.record)
    .sort((a, b) => b.timestamp.localeCompare(a.timestamp));
}

/** How many records are still waiting to reach the cloud. */
export function pendingCount(): number {
  return readStore().filter((s) => s.status !== 'synced').length;
}

function upsertLocal(record: AnalysisRecord, status: StoredRecord['status']): void {
  const store = readStore();
  const idx = store.findIndex((s) => s.record.id === record.id);
  const existing = idx >= 0 ? store[idx] : undefined;
  const entry: StoredRecord = {
    record,
    status,
    attempts: existing?.attempts ?? 0,
    lastAttempt: existing?.lastAttempt,
  };
  if (idx >= 0) store[idx] = entry;
  else store.unshift(entry);
  writeStore(store);
}

function markStatus(id: string, status: StoredRecord['status']): void {
  const store = readStore();
  const idx = store.findIndex((s) => s.record.id === id);
  if (idx < 0) return;
  store[idx].status = status;
  store[idx].attempts += status === 'error' ? 1 : 0;
  store[idx].lastAttempt = new Date().toISOString();
  writeStore(store);
}

// ---- Snapshot building ------------------------------------------------------

function deviceLabel(): string {
  if (typeof navigator === 'undefined') return 'server';
  const ua = navigator.userAgent;
  const platform = /Mobi|Android/i.test(ua) ? 'Mobile' : 'Desktop';
  return `${platform} · ${navigator.language || 'en'}`;
}

function makeId(): string {
  const rand =
    typeof crypto !== 'undefined' && 'randomUUID' in crypto
      ? crypto.randomUUID()
      : `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
  return `rec_${rand}`;
}

/** Condense the AI advice Markdown into a one-line plain-text summary. */
function summarizeAdvice(markdown: string | undefined): string {
  if (!markdown) return '';
  const firstProse = markdown
    .split('\n')
    .map((l) => l.trim())
    .find((l) => l && !l.startsWith('#') && !l.startsWith('>'));
  return (firstProse ?? '').replace(/[*`_]/g, '').slice(0, 240);
}

/**
 * Build a full snapshot record from everything cached so far. Pulls results
 * (FinancialContext), raw inputs, and the latest AI advice out of local
 * storage and denormalizes the summary columns.
 */
export function buildSnapshot(source: AnalysisSource): AnalysisRecord {
  const ctx: FinancialContext = loadFinancialContext();
  const inputs: AnalysisInputs = loadAnalysisInputs();
  const advice = loadAdviceSummary();

  return {
    id: makeId(),
    timestamp: new Date().toISOString(),
    name: inputs.loan?.fullName ?? '',
    age: inputs.loan?.age ?? null,
    employment: inputs.loan?.employmentType ?? '',
    income: inputs.loan?.monthlyIncome ?? inputs.credit?.monthlyIncome ?? null,
    loanAmount: inputs.loan?.loanAmount ?? inputs.emi?.loanAmount ?? null,
    loanPurpose: inputs.loan?.loanPurpose ?? inputs.emi?.loanType ?? '',
    creditScore: inputs.credit?.creditScore ?? inputs.loan?.creditScore ?? ctx.credit?.score ?? null,
    monthlyEMI: ctx.emi?.monthlyEmi ?? ctx.loan?.estimatedEmi ?? null,
    loanEligibilityResult: ctx.loan ?? null,
    creditAnalysis: ctx.credit ?? null,
    emiCalculation: ctx.emi ?? null,
    aiAdviceSummary: summarizeAdvice(advice),
    source,
    device: deviceLabel(),
    version: RECORD_VERSION,
  };
}

/** True when the record carries at least one completed result. */
function hasContent(r: AnalysisRecord): boolean {
  return Boolean(
    r.loanEligibilityResult || r.creditAnalysis || r.emiCalculation || r.aiAdviceSummary
  );
}

// ---- Cloud transport (via our own API) -------------------------------------

async function pushRecord(record: AnalysisRecord): Promise<boolean> {
  const res = await fetch('/api/history', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ record }),
  });
  if (!res.ok) return false;
  const data = (await res.json().catch(() => ({}))) as HistoryApiResponse;
  return data.ok === true;
}

// ---- Public API -------------------------------------------------------------

export interface SaveResult {
  /** Always true if the record was stored locally (never lose results). */
  savedLocally: boolean;
  /** True if it also reached the cloud this attempt. */
  synced: boolean;
}

/**
 * Auto-save the current snapshot. Called after any tool completes.
 * Stores locally first (so results are never lost), then tries the cloud;
 * on failure the record stays queued for a later flush.
 */
export async function autoSave(source: AnalysisSource): Promise<SaveResult> {
  const record = buildSnapshot(source);
  if (!hasContent(record)) {
    return { savedLocally: false, synced: false };
  }

  upsertLocal(record, 'pending');

  if (typeof navigator !== 'undefined' && navigator.onLine === false) {
    return { savedLocally: true, synced: false };
  }

  try {
    const ok = await pushRecord(record);
    markStatus(record.id, ok ? 'synced' : 'error');
    return { savedLocally: true, synced: ok };
  } catch {
    markStatus(record.id, 'error');
    return { savedLocally: true, synced: false };
  }
}

/**
 * Flush every pending/errored local record to the cloud.
 * Safe to call repeatedly; returns how many synced this run.
 */
export async function syncPending(): Promise<number> {
  if (typeof navigator !== 'undefined' && navigator.onLine === false) return 0;

  const pending = readStore().filter((s) => s.status !== 'synced');
  let synced = 0;
  for (const entry of pending) {
    try {
      const ok = await pushRecord(entry.record);
      markStatus(entry.record.id, ok ? 'synced' : 'error');
      if (ok) synced++;
    } catch {
      markStatus(entry.record.id, 'error');
    }
  }
  return synced;
}

/**
 * Load records for the History page. Prefers the cloud (source of record) and
 * merges in any local-only records that haven't synced yet, so the user always
 * sees their latest analyses. Falls back to purely local on any failure.
 */
export async function loadHistory(): Promise<AnalysisRecord[]> {
  const local = getLocalRecords();
  try {
    const res = await fetch('/api/history', { method: 'GET' });
    if (!res.ok) return local;
    const data = (await res.json()) as HistoryApiResponse;
    if (!data.ok || !data.records) return local;

    // Merge: cloud records win, local-only (pending) records are appended.
    const cloudIds = new Set(data.records.map((r) => r.id));
    const localOnly = local.filter((r) => !cloudIds.has(r.id));
    return [...data.records, ...localOnly].sort((a, b) =>
      b.timestamp.localeCompare(a.timestamp)
    );
  } catch {
    return local;
  }
}

/** Register automatic background sync when the browser regains connectivity. */
export function registerAutoSync(): void {
  if (typeof window === 'undefined') return;
  window.addEventListener('online', () => {
    void syncPending();
  });
  // Opportunistic flush shortly after load in case a prior session left a queue.
  window.setTimeout(() => {
    if (pendingCount() > 0) void syncPending();
  }, 1500);
}
