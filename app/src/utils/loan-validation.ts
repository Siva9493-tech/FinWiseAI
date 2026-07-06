// Field-level validation for the loan application form.
// Kept separate from calculation logic and UI so it can be unit-tested and
// reused (e.g. server-side) without pulling in the DOM.

import type {
  EmploymentType,
  LoanApplication,
  LoanPurpose,
} from '../types/loan';
import { LOAN_POLICY } from './loan';

export type LoanField = keyof LoanApplication;

export type LoanErrors = Partial<Record<LoanField, string>>;

export interface ValidationOutcome {
  valid: boolean;
  errors: LoanErrors;
  /** Populated only when valid. */
  value?: LoanApplication;
}

const EMPLOYMENT_TYPES: EmploymentType[] = [
  'salaried',
  'self-employed',
  'business',
  'freelancer',
];

const LOAN_PURPOSES: LoanPurpose[] = [
  'home',
  'personal',
  'vehicle',
  'education',
  'business',
];

/** Raw string values as read from the form (all optional/loose). */
export type RawLoanInput = Partial<Record<LoanField, string>>;

function toNumber(raw: string | undefined): number | null {
  if (raw === undefined) return null;
  const cleaned = raw.replace(/[,\s₹]/g, '').trim();
  if (cleaned === '') return null;
  const n = Number(cleaned);
  return Number.isFinite(n) ? n : null;
}

/**
 * Validate raw form input. Returns per-field messages and, when everything
 * passes, a strongly-typed LoanApplication ready for evaluateEligibility.
 */
export function validateApplication(raw: RawLoanInput): ValidationOutcome {
  const errors: LoanErrors = {};

  // Full name
  const fullName = (raw.fullName ?? '').trim();
  if (!fullName) {
    errors.fullName = 'Full name is required.';
  } else if (fullName.length < 2) {
    errors.fullName = 'Please enter your full name.';
  } else if (!/^[a-zA-Z][a-zA-Z .'-]*$/.test(fullName)) {
    errors.fullName = 'Name can only contain letters, spaces, and . - \' characters.';
  }

  // Age
  const age = toNumber(raw.age);
  if (age === null) {
    errors.age = 'Age is required.';
  } else if (!Number.isInteger(age)) {
    errors.age = 'Age must be a whole number.';
  } else if (age < 18 || age > 100) {
    errors.age = 'Enter a valid age between 18 and 100.';
  }

  // Employment type
  const employmentType = raw.employmentType as EmploymentType | undefined;
  if (!employmentType) {
    errors.employmentType = 'Select an employment type.';
  } else if (!EMPLOYMENT_TYPES.includes(employmentType)) {
    errors.employmentType = 'Select a valid employment type.';
  }

  // Monthly income
  const monthlyIncome = toNumber(raw.monthlyIncome);
  if (monthlyIncome === null) {
    errors.monthlyIncome = 'Monthly income is required.';
  } else if (monthlyIncome <= 0) {
    errors.monthlyIncome = 'Income must be greater than zero.';
  } else if (monthlyIncome > 100_000_000) {
    errors.monthlyIncome = 'Please enter a realistic monthly income.';
  }

  // Existing EMI
  const existingEmi = toNumber(raw.existingEmi);
  if (existingEmi === null) {
    errors.existingEmi = 'Enter 0 if you have no existing EMI.';
  } else if (existingEmi < 0) {
    errors.existingEmi = 'Existing EMI cannot be negative.';
  } else if (monthlyIncome !== null && existingEmi > monthlyIncome) {
    errors.existingEmi = 'Existing EMI cannot exceed your monthly income.';
  }

  // Credit score
  const creditScore = toNumber(raw.creditScore);
  if (creditScore === null) {
    errors.creditScore = 'Credit score is required.';
  } else if (creditScore < LOAN_POLICY.minCreditScore || creditScore > LOAN_POLICY.maxCreditScore) {
    errors.creditScore = `Credit score must be between ${LOAN_POLICY.minCreditScore} and ${LOAN_POLICY.maxCreditScore}.`;
  }

  // Loan amount
  const loanAmount = toNumber(raw.loanAmount);
  if (loanAmount === null) {
    errors.loanAmount = 'Loan amount is required.';
  } else if (loanAmount <= 0) {
    errors.loanAmount = 'Loan amount must be greater than zero.';
  } else if (loanAmount > 500_000_000) {
    errors.loanAmount = 'Please enter a realistic loan amount.';
  }

  // Tenure
  const loanTenureMonths = toNumber(raw.loanTenureMonths);
  if (loanTenureMonths === null) {
    errors.loanTenureMonths = 'Loan tenure is required.';
  } else if (!Number.isInteger(loanTenureMonths)) {
    errors.loanTenureMonths = 'Tenure must be a whole number of months.';
  } else if (
    loanTenureMonths < LOAN_POLICY.minTenureMonths ||
    loanTenureMonths > LOAN_POLICY.maxTenureMonths
  ) {
    errors.loanTenureMonths = `Tenure must be between ${LOAN_POLICY.minTenureMonths} and ${LOAN_POLICY.maxTenureMonths} months.`;
  }

  // Loan purpose
  const loanPurpose = raw.loanPurpose as LoanPurpose | undefined;
  if (!loanPurpose) {
    errors.loanPurpose = 'Select a loan purpose.';
  } else if (!LOAN_PURPOSES.includes(loanPurpose)) {
    errors.loanPurpose = 'Select a valid loan purpose.';
  }

  const valid = Object.keys(errors).length === 0;
  if (!valid) return { valid, errors };

  return {
    valid,
    errors,
    value: {
      fullName,
      age: age as number,
      employmentType: employmentType as EmploymentType,
      monthlyIncome: monthlyIncome as number,
      existingEmi: existingEmi as number,
      creditScore: creditScore as number,
      loanAmount: loanAmount as number,
      loanTenureMonths: loanTenureMonths as number,
      loanPurpose: loanPurpose as LoanPurpose,
    },
  };
}
