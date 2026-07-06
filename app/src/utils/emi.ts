// EMI Calculator — local, deterministic financial logic.
//
// This module contains NO UI and NO AI. The core reducing-balance EMI formula
// lives in ./loan (calculateEmi) and is shared here rather than duplicated, so
// the Loan Eligibility and EMI Calculator modules can never disagree on a value.
// The output shape (EmiResult) is intentionally rich so a future Groq-powered
// "AI EMI Optimization" advisor can consume it without recomputation.

import { calculateEmi, formatInr } from './loan';
import type { EmiInput, EmiResult, LoanType, TenureUnit } from '../types/emi';

// Re-export the shared formatter so EMI UI imports from a single module.
export { calculateEmi, formatInr };

// ---- Policy constants -------------------------------------------------------

export const EMI_POLICY = {
  minAmount: 1_000,
  maxAmount: 500_000_000,
  minRate: 0.1,
  maxRate: 50,
  minTenureMonths: 1,
  maxTenureMonths: 480,
  minTenureYears: 1,
  maxTenureYears: 40,
} as const;

/** Display label per loan type. */
export const LOAN_TYPE_LABEL: Record<LoanType, string> = {
  personal: 'Personal Loan',
  home: 'Home Loan',
  vehicle: 'Vehicle Loan',
  education: 'Education Loan',
  business: 'Business Loan',
};

// ---- Pure helpers -----------------------------------------------------------

/** Convert a tenure expressed in months or years into whole months. */
export function toTenureMonths(tenure: number, unit: TenureUnit): number {
  return unit === 'years' ? Math.round(tenure * 12) : Math.round(tenure);
}

/** Human-readable tenure label, e.g. "20 years" or "18 months". */
export function formatDuration(tenure: number, unit: TenureUnit): string {
  const rounded = Math.round(tenure);
  const noun = unit === 'years' ? 'year' : 'month';
  return `${rounded} ${noun}${rounded === 1 ? '' : 's'}`;
}

// ---- EMI breakdown ----------------------------------------------------------

/**
 * Compute a full EMI breakdown from validated inputs.
 * Assumes inputs are already validated (see validateEmiInput).
 */
export function calculateEmiBreakdown(input: EmiInput): EmiResult {
  const tenureMonths = toTenureMonths(input.tenure, input.tenureUnit);
  const principal = input.loanAmount;

  const monthlyEmi = calculateEmi(principal, input.annualInterestRate, tenureMonths);
  const totalPayment = monthlyEmi * tenureMonths;
  const totalInterest = Math.max(0, totalPayment - principal);

  const interestPercentage =
    totalPayment > 0 ? (totalInterest / totalPayment) * 100 : 0;
  const principalPercentage = 100 - interestPercentage;

  return {
    monthlyEmi,
    totalInterest,
    totalPayment,
    principal,
    interestPercentage,
    principalPercentage,
    tenureMonths,
    annualInterestRate: input.annualInterestRate,
    loanType: input.loanType,
    loanTypeLabel: LOAN_TYPE_LABEL[input.loanType],
    durationLabel: formatDuration(input.tenure, input.tenureUnit),
    paymentFrequency: 'Monthly',
  };
}
