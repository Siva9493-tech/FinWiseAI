// Types for the EMI Calculator module.
// Pure data contracts — shared between the calculation layer and the UI.
//
// LoanType intentionally reuses LoanPurpose from the loan module: both describe
// the same five financial products, so the union stays in one place and the two
// modules can never drift apart.

import type { LoanPurpose } from './loan';

/** The five supported loan products. Aliased to LoanPurpose to avoid duplication. */
export type LoanType = LoanPurpose;

/** How the user expressed the loan tenure. */
export type TenureUnit = 'months' | 'years';

/** Raw, validated inputs from the EMI calculator form. */
export interface EmiInput {
  loanAmount: number;
  annualInterestRate: number;
  tenure: number;
  tenureUnit: TenureUnit;
  loanType: LoanType;
}

/** Fully-computed EMI breakdown — rich enough for a future AI optimizer to consume. */
export interface EmiResult {
  /** Monthly instalment, in rupees. */
  monthlyEmi: number;
  /** Total interest paid over the full tenure, in rupees. */
  totalInterest: number;
  /** Principal + total interest, in rupees. */
  totalPayment: number;
  /** The borrowed principal, in rupees. */
  principal: number;
  /** Interest as a share of total payment, 0–100. */
  interestPercentage: number;
  /** Principal as a share of total payment, 0–100. */
  principalPercentage: number;
  /** Tenure normalised to whole months. */
  tenureMonths: number;
  /** Annual interest rate applied, as a percentage. */
  annualInterestRate: number;
  loanType: LoanType;
  loanTypeLabel: string;
  /** Human-readable tenure, e.g. "20 years" or "18 months". */
  durationLabel: string;
  /** Repayment cadence, always monthly for standard EMIs. */
  paymentFrequency: string;
}
