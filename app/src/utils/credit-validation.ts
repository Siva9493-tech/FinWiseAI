// Field-level validation for the Credit Score Analyzer form.
// Separate from calculation and UI so it can be reused and tested.

import type { CreditProfile } from '../types/credit';
import { CREDIT_POLICY } from './credit';

export type CreditField = keyof CreditProfile;

export type CreditErrors = Partial<Record<CreditField, string>>;

export type RawCreditInput = Partial<Record<CreditField, string>>;

export interface CreditValidationOutcome {
  valid: boolean;
  errors: CreditErrors;
  value?: CreditProfile;
}

function toNumber(raw: string | undefined): number | null {
  if (raw === undefined) return null;
  const cleaned = raw.replace(/[,\s₹%]/g, '').trim();
  if (cleaned === '') return null;
  const n = Number(cleaned);
  return Number.isFinite(n) ? n : null;
}

export function validateCreditProfile(raw: RawCreditInput): CreditValidationOutcome {
  const errors: CreditErrors = {};

  const creditScore = toNumber(raw.creditScore);
  if (creditScore === null) {
    errors.creditScore = 'Credit score is required.';
  } else if (!Number.isInteger(creditScore)) {
    errors.creditScore = 'Credit score must be a whole number.';
  } else if (creditScore < CREDIT_POLICY.minScore || creditScore > CREDIT_POLICY.maxScore) {
    errors.creditScore = `Score must be between ${CREDIT_POLICY.minScore} and ${CREDIT_POLICY.maxScore}.`;
  }

  const monthlyIncome = toNumber(raw.monthlyIncome);
  if (monthlyIncome === null) {
    errors.monthlyIncome = 'Monthly income is required.';
  } else if (monthlyIncome <= 0) {
    errors.monthlyIncome = 'Income must be greater than zero.';
  } else if (monthlyIncome > 100_000_000) {
    errors.monthlyIncome = 'Please enter a realistic monthly income.';
  }

  const existingEmi = toNumber(raw.existingEmi);
  if (existingEmi === null) {
    errors.existingEmi = 'Enter 0 if you have no existing EMI.';
  } else if (existingEmi < 0) {
    errors.existingEmi = 'Existing EMI cannot be negative.';
  } else if (monthlyIncome !== null && existingEmi > monthlyIncome) {
    errors.existingEmi = 'Existing EMI cannot exceed your monthly income.';
  }

  const activeLoans = toNumber(raw.activeLoans);
  if (activeLoans === null) {
    errors.activeLoans = 'Enter the number of active loans (0 if none).';
  } else if (!Number.isInteger(activeLoans) || activeLoans < 0) {
    errors.activeLoans = 'Active loans must be a whole number of 0 or more.';
  } else if (activeLoans > 50) {
    errors.activeLoans = 'Please enter a realistic number of active loans.';
  }

  const creditUtilization = toNumber(raw.creditUtilization);
  if (creditUtilization === null) {
    errors.creditUtilization = 'Credit utilization is required.';
  } else if (creditUtilization < 0 || creditUtilization > 100) {
    errors.creditUtilization = 'Utilization must be between 0% and 100%.';
  }

  const recentEnquiries = toNumber(raw.recentEnquiries);
  if (recentEnquiries === null) {
    errors.recentEnquiries = 'Enter recent enquiries (0 if none).';
  } else if (!Number.isInteger(recentEnquiries) || recentEnquiries < 0) {
    errors.recentEnquiries = 'Enquiries must be a whole number of 0 or more.';
  } else if (recentEnquiries > 50) {
    errors.recentEnquiries = 'Please enter a realistic number of enquiries.';
  }

  const valid = Object.keys(errors).length === 0;
  if (!valid) return { valid, errors };

  return {
    valid,
    errors,
    value: {
      creditScore: creditScore as number,
      monthlyIncome: monthlyIncome as number,
      existingEmi: existingEmi as number,
      activeLoans: activeLoans as number,
      creditUtilization: creditUtilization as number,
      recentEnquiries: recentEnquiries as number,
    },
  };
}
