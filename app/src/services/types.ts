// Shared data contracts for the cloud-storage (Google Sheets) module.
//
// These types are the single source of truth for what an analysis record looks
// like everywhere: the client snapshot builder, the API endpoint, the Apps
// Script backend, and the History UI. Nothing provider-specific leaks here.

import type { EligibilityResult, LoanApplication } from '../types/loan';
import type { CreditAnalysis, CreditProfile } from '../types/credit';
import type { EmiResult, EmiInput } from '../types/emi';

/** App version stamped onto every record — bump on schema changes. */
export const RECORD_VERSION = '1.0.0';

/**
 * One persisted analysis snapshot.
 *
 * A record is built from whatever the user has completed so far — every result
 * field is optional because the tools can be run in any order. The flat
 * top-level fields (name, age, …) are denormalized for cheap listing/searching
 * in the sheet; the nested *Result objects hold the full detail for the detail
 * view, stored exactly as generated.
 */
export interface AnalysisRecord {
  /** Client-generated unique id (also the idempotency key for the sheet). */
  id: string;
  /** ISO-8601 creation timestamp. */
  timestamp: string;

  // ---- Denormalized summary columns (for the sheet + list view) ----
  name: string;
  age: number | null;
  employment: string;
  income: number | null;
  loanAmount: number | null;
  loanPurpose: string;
  creditScore: number | null;
  monthlyEMI: number | null;

  // ---- Full results, stored exactly as generated ----
  loanEligibilityResult: EligibilityResult | null;
  creditAnalysis: CreditAnalysis | null;
  emiCalculation: EmiResult | null;
  aiAdviceSummary: string;

  // ---- Provenance ----
  source: AnalysisSource;
  device: string;
  version: string;
}

/** The raw inputs cached client-side so a snapshot can denormalize them. */
export interface AnalysisInputs {
  loan?: LoanApplication;
  credit?: CreditProfile;
  emi?: EmiInput;
}

/** Which tool triggered the save — used only for local diagnostics/toasts. */
export type AnalysisSource = 'loan' | 'credit' | 'emi' | 'advisor';

/** Sync state of a locally-held record. */
export type SyncStatus = 'synced' | 'pending' | 'error';

/** A record plus its local sync bookkeeping (never sent to the sheet). */
export interface StoredRecord {
  record: AnalysisRecord;
  status: SyncStatus;
  /** Number of failed sync attempts so far. */
  attempts: number;
  /** ISO timestamp of the last sync attempt, if any. */
  lastAttempt?: string;
}

/** Uniform response shape from the /api/history endpoint. */
export interface HistoryApiResponse {
  ok: boolean;
  error?: string;
  records?: AnalysisRecord[];
}

/** Result of attempting to persist a record to the cloud. */
export interface SaveOutcome {
  ok: boolean;
  /** True when the failure is transient and worth retrying (network/5xx). */
  retriable: boolean;
  error?: string;
}
