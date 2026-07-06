// Loan Eligibility — local, deterministic financial logic.
//
// This module contains NO UI and NO AI. Every value here is computed with
// standard financial formulas so results are reproducible and auditable.
// The output shape (EligibilityResult) is intentionally rich so a future
// Groq-powered advisor can consume it without recomputation.

import type {
  EligibilityResult,
  LoanApplication,
  LoanPurpose,
  RiskLevel,
} from '../types/loan';

// ---- Policy constants -------------------------------------------------------

export const LOAN_POLICY = {
  minAge: 21,
  maxAge: 60,
  minMonthlyIncome: 20_000,
  minCreditScore: 300,
  maxCreditScore: 900,
  /** Fixed Obligation to Income Ratio ceiling — max share of income for EMIs. */
  maxFoir: 0.5,
  /** DTI at or below this (after the new loan) is considered comfortable. */
  comfortableDti: 0.45,
  minTenureMonths: 6,
  maxTenureMonths: 360,
} as const;

/** Base annual interest rate (%) per loan purpose. */
const BASE_RATE: Record<LoanPurpose, number> = {
  home: 8.5,
  vehicle: 9.5,
  education: 10.5,
  personal: 13,
  business: 14,
};

/** Interest rate adjustment (%) by credit risk band. */
const RATE_ADJUSTMENT: Record<RiskLevel, number> = {
  low: -1,
  medium: 0,
  borderline: 1.5,
  high: 3,
};

const RISK_LABEL: Record<RiskLevel, string> = {
  low: 'Low Risk',
  medium: 'Medium Risk',
  borderline: 'Borderline',
  high: 'High Risk',
};

// ---- Pure helpers -----------------------------------------------------------

/** Classify credit score into a risk band. */
export function getRiskLevel(creditScore: number): RiskLevel {
  if (creditScore >= 750) return 'low';
  if (creditScore >= 700) return 'medium';
  if (creditScore >= 650) return 'borderline';
  return 'high';
}

/** Effective annual interest rate (%) for a purpose + risk band. */
export function getInterestRate(purpose: LoanPurpose, risk: RiskLevel): number {
  const rate = BASE_RATE[purpose] + RATE_ADJUSTMENT[risk];
  return Math.max(8, Math.round(rate * 100) / 100);
}

/**
 * Standard reducing-balance EMI.
 * EMI = P·r·(1+r)^n / ((1+r)^n − 1), where r is the monthly rate.
 */
export function calculateEmi(
  principal: number,
  annualRatePct: number,
  tenureMonths: number
): number {
  if (principal <= 0 || tenureMonths <= 0) return 0;
  const r = annualRatePct / 12 / 100;
  if (r === 0) return Math.round(principal / tenureMonths);
  const factor = Math.pow(1 + r, tenureMonths);
  return Math.round((principal * r * factor) / (factor - 1));
}

/** Invert the EMI formula: the largest principal serviceable by a given EMI. */
export function principalFromEmi(
  emi: number,
  annualRatePct: number,
  tenureMonths: number
): number {
  if (emi <= 0 || tenureMonths <= 0) return 0;
  const r = annualRatePct / 12 / 100;
  if (r === 0) return Math.round(emi * tenureMonths);
  const factor = Math.pow(1 + r, tenureMonths);
  return Math.round((emi * (factor - 1)) / (r * factor));
}

// ---- Eligibility decision ---------------------------------------------------

/**
 * Evaluate a fully-validated application against local policy.
 * Assumes inputs are already validated (see validateApplication).
 */
export function evaluateEligibility(app: LoanApplication): EligibilityResult {
  const risk = getRiskLevel(app.creditScore);
  const interestRate = getInterestRate(app.loanPurpose, risk);
  const estimatedEmi = calculateEmi(app.loanAmount, interestRate, app.loanTenureMonths);

  // Room for a new EMI after honoring existing obligations.
  const emiBudget = app.monthlyIncome * LOAN_POLICY.maxFoir - app.existingEmi;
  const eligibleAmount = Math.max(
    0,
    principalFromEmi(emiBudget, interestRate, app.loanTenureMonths)
  );

  const debtToIncome =
    app.monthlyIncome > 0
      ? (app.existingEmi + estimatedEmi) / app.monthlyIncome
      : 1;

  const reasons: string[] = [];
  let status: EligibilityResult['status'];
  let nextAction: string;

  // --- Hard rejections -------------------------------------------------------
  if (app.age < LOAN_POLICY.minAge || app.age > LOAN_POLICY.maxAge) {
    status = 'rejected';
    reasons.push(
      `Applicant age must be between ${LOAN_POLICY.minAge} and ${LOAN_POLICY.maxAge} years.`
    );
    nextAction = 'Applications are only accepted for ages 21–60.';
  } else if (app.monthlyIncome < LOAN_POLICY.minMonthlyIncome) {
    status = 'rejected';
    reasons.push(
      `Monthly income is below the required minimum of ${formatInr(LOAN_POLICY.minMonthlyIncome)}.`
    );
    nextAction = `Increase monthly income to at least ${formatInr(LOAN_POLICY.minMonthlyIncome)}.`;
  } else if (risk === 'high') {
    status = 'rejected';
    reasons.push('Credit score below 650 is classified as High Risk.');
    nextAction = 'Improve your credit score above 650 and reapply.';
  } else if (emiBudget <= 0 || eligibleAmount <= 0) {
    status = 'rejected';
    reasons.push('Existing EMIs already consume your available income capacity.');
    nextAction = 'Reduce or close existing EMIs before applying for a new loan.';
  } else if (app.loanAmount <= eligibleAmount && risk === 'low' && debtToIncome <= LOAN_POLICY.comfortableDti) {
    // --- Clean approval ------------------------------------------------------
    status = 'eligible';
    reasons.push('Strong credit profile and healthy debt-to-income ratio.');
    reasons.push(`Requested amount is within your eligible limit of ${formatInr(eligibleAmount)}.`);
    nextAction = 'You can proceed with your loan application.';
  } else {
    // --- Conditional approval ------------------------------------------------
    status = 'conditional';

    if (app.loanAmount > eligibleAmount) {
      reasons.push(
        `Requested ${formatInr(app.loanAmount)} exceeds your eligible limit of ${formatInr(eligibleAmount)}.`
      );
      nextAction = `Consider reducing your loan amount to ${formatInr(eligibleAmount)}.`;
    } else if (debtToIncome > LOAN_POLICY.comfortableDti) {
      reasons.push(
        `Debt-to-income ratio of ${(debtToIncome * 100).toFixed(0)}% is on the higher side.`
      );
      nextAction = 'Lowering existing EMIs will improve your approval terms.';
    } else {
      reasons.push('Approved with conditions due to your current credit band.');
      nextAction = 'Improve your credit score above 750 to unlock the best rates.';
    }

    if (risk === 'borderline') {
      reasons.push('Credit score is in the borderline range (650–699).');
    } else if (risk === 'medium') {
      reasons.push('Credit score is in the medium range (700–749).');
    }
  }

  const tone =
    status === 'eligible' ? 'green' : status === 'conditional' ? 'yellow' : 'red';
  const statusLabel =
    status === 'eligible'
      ? 'Eligible'
      : status === 'conditional'
        ? 'Eligible with Conditions'
        : 'Not Eligible';

  return {
    status,
    tone,
    statusLabel,
    riskLevel: risk,
    riskLabel: RISK_LABEL[risk],
    eligibleAmount,
    estimatedEmi,
    interestRate,
    debtToIncome,
    reasons,
    nextAction,
  };
}

// ---- Formatting -------------------------------------------------------------

/** Format a number as Indian Rupees with grouping, no decimals. */
export function formatInr(value: number): string {
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 0,
  }).format(Math.round(value));
}
