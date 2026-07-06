// Types for the Loan Eligibility Checker module.
// Pure data contracts — shared between the calculation layer and the UI.

export type EmploymentType =
  | 'salaried'
  | 'self-employed'
  | 'business'
  | 'freelancer';

export type LoanPurpose =
  | 'home'
  | 'personal'
  | 'vehicle'
  | 'education'
  | 'business';

/** Raw, validated numeric/string inputs from the loan application form. */
export interface LoanApplication {
  fullName: string;
  age: number;
  employmentType: EmploymentType;
  monthlyIncome: number;
  existingEmi: number;
  creditScore: number;
  loanAmount: number;
  loanTenureMonths: number;
  loanPurpose: LoanPurpose;
}

export type RiskLevel = 'low' | 'medium' | 'borderline' | 'high';

export type EligibilityStatus = 'eligible' | 'conditional' | 'rejected';

/** Traffic-light color mapped from the eligibility status. */
export type ResultTone = 'green' | 'yellow' | 'red';

export interface EligibilityResult {
  status: EligibilityStatus;
  tone: ResultTone;
  statusLabel: string;
  riskLevel: RiskLevel;
  riskLabel: string;
  /** Maximum loan the applicant qualifies for, in rupees. */
  eligibleAmount: number;
  /** EMI for the amount the applicant requested, in rupees/month. */
  estimatedEmi: number;
  /** Annual interest rate applied, as a percentage. */
  interestRate: number;
  /** Debt-to-income ratio after the new loan, as a fraction (0–1+). */
  debtToIncome: number;
  reasons: string[];
  nextAction: string;
}
