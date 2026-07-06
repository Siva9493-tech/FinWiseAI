// Types for the Credit Score Analyzer module.
// Pure data contracts shared between the calculation layer and the UI.
// Structured so a future Groq-powered "AI Credit Analysis" can consume the
// full result without recomputation.

import type { ResultTone } from './loan';
export type { ResultTone };

export type CreditRating = 'Poor' | 'Fair' | 'Good' | 'Very Good' | 'Excellent';

export type CreditRiskLevel = 'very-low' | 'low' | 'medium' | 'high' | 'very-high';

/** Validated inputs from the credit analysis form. */
export interface CreditProfile {
  creditScore: number;
  monthlyIncome: number;
  existingEmi: number;
  activeLoans: number;
  /** Credit card utilization as a percentage (0–100). */
  creditUtilization: number;
  /** Number of loan/credit enquiries in the last 6 months. */
  recentEnquiries: number;
}

export interface CreditFactor {
  label: string;
  detail: string;
}

export interface CreditAnalysis {
  score: number;
  rating: CreditRating;
  tone: ResultTone;
  riskLevel: CreditRiskLevel;
  riskLabel: string;
  /** 0–100 composite financial-health score. */
  financialHealth: number;
  healthLabel: string;
  /** Loan approval probability as a percentage (0–100). */
  approvalProbability: number;
  estimatedTimeToImprove: string;
  improvementTips: string[];
  positiveFactors: CreditFactor[];
  negativeFactors: CreditFactor[];
}
