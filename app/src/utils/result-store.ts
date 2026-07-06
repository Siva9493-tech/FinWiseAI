// Client-side result store — bridges the calculator pages and the AI Advisor.
//
// The Loan, Credit, and EMI tools each save their latest computed result here
// (localStorage). The AI Advisor reads them to build its Financial Summary and
// to feed the AI. Values are the SAME deterministic results shown on each tool
// page — the advisor never recomputes them.
//
// Runs in the browser only. All access is guarded so SSR/import never touches
// window.

import type { EligibilityResult } from '../types/loan';
import type { CreditAnalysis } from '../types/credit';
import type { EmiResult } from '../types/emi';
import type { FinancialContext } from '../types/advisor';

const KEYS = {
  loan: 'finwise:result:loan',
  credit: 'finwise:result:credit',
  emi: 'finwise:result:emi',
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

/** Read every available result into a single FinancialContext for the advisor. */
export function loadFinancialContext(): FinancialContext {
  return {
    loan: load<EligibilityResult>(KEYS.loan),
    credit: load<CreditAnalysis>(KEYS.credit),
    emi: load<EmiResult>(KEYS.emi),
  };
}
