// Field-level validation for the EMI calculator form.
// Kept separate from calculation logic and UI so it can be unit-tested and
// reused without pulling in the DOM.

import type { EmiInput, LoanType, TenureUnit } from '../types/emi';
import { EMI_POLICY } from './emi';

export type EmiField = keyof EmiInput;

export type EmiErrors = Partial<Record<EmiField, string>>;

export interface EmiValidationOutcome {
  valid: boolean;
  errors: EmiErrors;
  /** Populated only when valid. */
  value?: EmiInput;
}

const LOAN_TYPES: LoanType[] = [
  'personal',
  'home',
  'vehicle',
  'education',
  'business',
];

const TENURE_UNITS: TenureUnit[] = ['months', 'years'];

/** Raw string values as read from the form (all optional/loose). */
export type RawEmiInput = Partial<Record<EmiField, string>>;

import { toNumber } from './parse';

/**
 * Validate raw form input. Returns per-field messages and, when everything
 * passes, a strongly-typed EmiInput ready for calculateEmiBreakdown.
 */
export function validateEmiInput(raw: RawEmiInput): EmiValidationOutcome {
  const errors: EmiErrors = {};

  // Tenure unit — validated first so tenure bounds can reference it.
  const tenureUnit = raw.tenureUnit as TenureUnit | undefined;
  if (!tenureUnit || !TENURE_UNITS.includes(tenureUnit)) {
    errors.tenureUnit = 'Select a tenure unit.';
  }

  // Loan amount
  const loanAmount = toNumber(raw.loanAmount);
  if (loanAmount === null) {
    errors.loanAmount = 'Loan amount is required.';
  } else if (loanAmount < EMI_POLICY.minAmount) {
    errors.loanAmount = `Enter an amount of at least ${EMI_POLICY.minAmount.toLocaleString('en-IN')}.`;
  } else if (loanAmount > EMI_POLICY.maxAmount) {
    errors.loanAmount = 'Please enter a realistic loan amount.';
  }

  // Annual interest rate
  const annualInterestRate = toNumber(raw.annualInterestRate);
  if (annualInterestRate === null) {
    errors.annualInterestRate = 'Interest rate is required.';
  } else if (annualInterestRate < EMI_POLICY.minRate) {
    errors.annualInterestRate = `Rate must be at least ${EMI_POLICY.minRate}%.`;
  } else if (annualInterestRate > EMI_POLICY.maxRate) {
    errors.annualInterestRate = `Rate must be ${EMI_POLICY.maxRate}% or lower.`;
  }

  // Tenure — bounds depend on the selected unit.
  const tenure = toNumber(raw.tenure);
  const isYears = tenureUnit === 'years';
  const minTenure = isYears ? EMI_POLICY.minTenureYears : EMI_POLICY.minTenureMonths;
  const maxTenure = isYears ? EMI_POLICY.maxTenureYears : EMI_POLICY.maxTenureMonths;
  if (tenure === null) {
    errors.tenure = 'Loan tenure is required.';
  } else if (!Number.isInteger(tenure)) {
    errors.tenure = 'Tenure must be a whole number.';
  } else if (tenureUnit && (tenure < minTenure || tenure > maxTenure)) {
    const unitNoun = isYears ? 'years' : 'months';
    errors.tenure = `Tenure must be between ${minTenure} and ${maxTenure} ${unitNoun}.`;
  }

  // Loan type
  const loanType = raw.loanType as LoanType | undefined;
  if (!loanType) {
    errors.loanType = 'Select a loan type.';
  } else if (!LOAN_TYPES.includes(loanType)) {
    errors.loanType = 'Select a valid loan type.';
  }

  const valid = Object.keys(errors).length === 0;
  if (!valid) return { valid, errors };

  return {
    valid,
    errors,
    value: {
      loanAmount: loanAmount as number,
      annualInterestRate: annualInterestRate as number,
      tenure: tenure as number,
      tenureUnit: tenureUnit as TenureUnit,
      loanType: loanType as LoanType,
    },
  };
}
