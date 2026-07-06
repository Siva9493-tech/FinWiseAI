// Client-side result store — bridges the calculator pages and the AI Advisor.
//
// The Loan, Credit, and EMI tools each save their latest computed result here
// (localStorage). The AI Advisor reads them to build its Financial Summary and
// to feed the AI. Values are the SAME deterministic results shown on each tool
// page — the advisor never recomputes them.
//
// Runs in the browser only. All access is guarded so SSR/import never touches
// window.

import type { EligibilityResult, LoanApplication } from '../types/loan';
import type { CreditAnalysis, CreditProfile } from '../types/credit';
import type { EmiResult, EmiInput } from '../types/emi';
import type { FinancialContext } from '../types/advisor';
import type { AnalysisInputs } from '../services/types';

const KEYS = {
  loan: 'finwise:result:loan',
  credit: 'finwise:result:credit',
  emi: 'finwise:result:emi',
  loanInput: 'finwise:input:loan',
  creditInput: 'finwise:input:credit',
  emiInput: 'finwise:input:emi',
  advice: 'finwise:result:advice',
} as const;

function save<T>(key: string, value: T): void {
  try {
    if (typeof localStorage === 'undefined') return;
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // Storage may be unavailable (private mode / quota) — degrade silently.
  }
}

function load<T>(key: string): T | undefined {
  try {
    if (typeof localStorage === 'undefined') return undefined;
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : undefined;
  } catch {
    return undefined;
  }
}

export const saveLoanResult = (r: EligibilityResult) => save(KEYS.loan, r);
export const saveCreditResult = (r: CreditAnalysis) => save(KEYS.credit, r);
export const saveEmiResult = (r: EmiResult) => save(KEYS.emi, r);

// Raw validated inputs — cached so a saved snapshot can denormalize the
// applicant's details (name, age, income…) without re-reading the form.
export const saveLoanInput = (i: LoanApplication) => save(KEYS.loanInput, i);
export const saveCreditInput = (i: CreditProfile) => save(KEYS.creditInput, i);
export const saveEmiInput = (i: EmiInput) => save(KEYS.emiInput, i);

/** Cache the latest AI advice (plain Markdown) for the snapshot summary. */
export const saveAdviceSummary = (text: string) => save(KEYS.advice, text);
export const loadAdviceSummary = (): string | undefined =>
  load<string>(KEYS.advice);

/** Read every cached raw input for snapshot denormalization. */
export function loadAnalysisInputs(): AnalysisInputs {
  return {
    loan: load<LoanApplication>(KEYS.loanInput),
    credit: load<CreditProfile>(KEYS.creditInput),
    emi: load<EmiInput>(KEYS.emiInput),
  };
}

/** Read every available result into a single FinancialContext for the advisor. */
export function loadFinancialContext(): FinancialContext {
  return {
    loan: load<EligibilityResult>(KEYS.loan),
    credit: load<CreditAnalysis>(KEYS.credit),
    emi: load<EmiResult>(KEYS.emi),
  };
}
