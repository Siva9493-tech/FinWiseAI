// Credit Score Analyzer — local, deterministic scoring logic.
//
// No UI, no AI. Standard, explainable rules so results are reproducible.
// The rich CreditAnalysis output is designed to feed a future Groq advisor.

import type {
  CreditAnalysis,
  CreditFactor,
  CreditProfile,
  CreditRating,
  CreditRiskLevel,
} from '../types/credit';

export const CREDIT_POLICY = {
  minScore: 300,
  maxScore: 900,
  /** Credit-utilization ceiling considered healthy (%). */
  healthyUtilization: 30,
  /** Debt-to-income ceiling considered healthy (%). */
  healthyDti: 35,
  /** Recent enquiries above this start to hurt. */
  enquiryThreshold: 3,
  /** Active loans above this start to hurt. */
  activeLoanThreshold: 4,
} as const;

interface Band {
  rating: CreditRating;
  min: number;
  risk: CreditRiskLevel;
  riskLabel: string;
  baseApproval: number;
  timeToImprove: string;
}

// Ordered high → low for easy lookup.
const BANDS: Band[] = [
  { rating: 'Excellent', min: 800, risk: 'very-low', riskLabel: 'Very Low Risk', baseApproval: 95, timeToImprove: "You're in excellent shape — maintain your habits." },
  { rating: 'Very Good', min: 740, risk: 'low', riskLabel: 'Low Risk', baseApproval: 85, timeToImprove: '1–3 months to reach Excellent.' },
  { rating: 'Good', min: 670, risk: 'medium', riskLabel: 'Medium Risk', baseApproval: 68, timeToImprove: '3–6 months to reach Very Good.' },
  { rating: 'Fair', min: 580, risk: 'high', riskLabel: 'High Risk', baseApproval: 45, timeToImprove: '6–12 months of consistent repayments.' },
  { rating: 'Poor', min: 300, risk: 'very-high', riskLabel: 'Very High Risk', baseApproval: 22, timeToImprove: '12–18 months of disciplined credit habits.' },
];

/** Classify a raw credit score into its band. */
export function getBand(score: number): Band {
  return BANDS.find((b) => score >= b.min) ?? BANDS[BANDS.length - 1];
}

export function getRating(score: number): CreditRating {
  return getBand(score).rating;
}

/** Debt-to-income ratio as a percentage. */
export function getDtiPercent(existingEmi: number, monthlyIncome: number): number {
  if (monthlyIncome <= 0) return 100;
  return Math.round((existingEmi / monthlyIncome) * 100);
}

function clamp(value: number, min = 0, max = 100): number {
  return Math.max(min, Math.min(max, value));
}

/**
 * Composite 0–100 financial-health score.
 * Weighted blend of credit score, utilization, DTI, enquiries, active loans.
 */
export function getFinancialHealth(profile: CreditProfile): number {
  const scoreComponent = clamp(
    ((profile.creditScore - CREDIT_POLICY.minScore) /
      (CREDIT_POLICY.maxScore - CREDIT_POLICY.minScore)) *
      100
  );
  // 100 at ≤10% utilization, 0 at 100%.
  const utilComponent = clamp(100 - (profile.creditUtilization - 10) * (100 / 90));
  const dti = getDtiPercent(profile.existingEmi, profile.monthlyIncome);
  const dtiComponent = clamp(100 - (dti - 20) * (100 / 60));
  const enquiryComponent = clamp(100 - profile.recentEnquiries * 15);
  const loanComponent = clamp(100 - profile.activeLoans * 12);

  const health =
    scoreComponent * 0.5 +
    utilComponent * 0.2 +
    dtiComponent * 0.2 +
    enquiryComponent * 0.05 +
    loanComponent * 0.05;

  return Math.round(clamp(health));
}

export function getHealthLabel(health: number): string {
  if (health >= 80) return 'Excellent';
  if (health >= 65) return 'Strong';
  if (health >= 45) return 'Moderate';
  if (health >= 30) return 'Weak';
  return 'Critical';
}

/** Loan approval probability (%) from band base plus behavioural modifiers. */
export function getApprovalProbability(profile: CreditProfile, band: Band): number {
  let p = band.baseApproval;
  const dti = getDtiPercent(profile.existingEmi, profile.monthlyIncome);

  if (profile.creditUtilization > 50) p -= 10;
  else if (profile.creditUtilization <= CREDIT_POLICY.healthyUtilization) p += 4;

  if (dti > 50) p -= 12;
  else if (dti <= CREDIT_POLICY.healthyDti) p += 4;

  if (profile.recentEnquiries > CREDIT_POLICY.enquiryThreshold) p -= 8;
  if (profile.activeLoans > CREDIT_POLICY.activeLoanThreshold) p -= 6;

  return Math.round(clamp(p, 3, 98));
}

// ---- Factors & tips ---------------------------------------------------------

function buildFactors(profile: CreditProfile, band: Band) {
  const positives: CreditFactor[] = [];
  const negatives: CreditFactor[] = [];
  const tips: string[] = [];
  const dti = getDtiPercent(profile.existingEmi, profile.monthlyIncome);

  // Credit score band
  if (profile.creditScore >= 670) {
    positives.push({ label: 'Healthy credit score', detail: `${band.rating} band (${profile.creditScore}).` });
  } else {
    negatives.push({ label: 'Credit score needs improvement', detail: `Currently ${band.rating} (${profile.creditScore}).` });
    tips.push('Make all EMI and card payments on time to steadily raise your score.');
  }

  // Utilization
  if (profile.creditUtilization <= CREDIT_POLICY.healthyUtilization) {
    positives.push({ label: 'Low credit utilization', detail: `${profile.creditUtilization}% of available limit used.` });
  } else if (profile.creditUtilization > 50) {
    negatives.push({ label: 'High credit utilization', detail: `${profile.creditUtilization}% used — aim below 30%.` });
    tips.push('Reduce credit card utilization below 30% of your limit.');
  } else {
    negatives.push({ label: 'Elevated credit utilization', detail: `${profile.creditUtilization}% used.` });
    tips.push('Bring credit utilization down toward 30% for a quick score lift.');
  }

  // DTI
  if (dti <= CREDIT_POLICY.healthyDti) {
    positives.push({ label: 'Comfortable debt-to-income', detail: `EMIs are ${dti}% of income.` });
  } else if (dti > 50) {
    negatives.push({ label: 'High debt-to-income', detail: `EMIs consume ${dti}% of income.` });
    tips.push('Lower existing EMIs to improve your debt-to-income ratio.');
  }

  // Enquiries
  if (profile.recentEnquiries <= 1) {
    positives.push({ label: 'Few recent enquiries', detail: `${profile.recentEnquiries} in the last 6 months.` });
  } else if (profile.recentEnquiries > CREDIT_POLICY.enquiryThreshold) {
    negatives.push({ label: 'Many recent enquiries', detail: `${profile.recentEnquiries} in 6 months signals credit hunger.` });
    tips.push('Avoid new loan or card applications for the next 6 months.');
  }

  // Active loans
  if (profile.activeLoans <= 2) {
    positives.push({ label: 'Manageable active loans', detail: `${profile.activeLoans} active ${profile.activeLoans === 1 ? 'loan' : 'loans'}.` });
  } else if (profile.activeLoans > CREDIT_POLICY.activeLoanThreshold) {
    negatives.push({ label: 'Many active loans', detail: `${profile.activeLoans} active loans increase risk.` });
    tips.push('Consolidate or close some active loans to reduce obligations.');
  }

  if (tips.length === 0) {
    tips.push('Maintain your current habits to keep your score strong and stable.');
  }

  return { positives, negatives, tips };
}

// ---- Public entry point -----------------------------------------------------

/** Full analysis for a validated credit profile. */
export function analyzeCredit(profile: CreditProfile): CreditAnalysis {
  const band = getBand(profile.creditScore);
  const financialHealth = getFinancialHealth(profile);
  const approvalProbability = getApprovalProbability(profile, band);
  const { positives, negatives, tips } = buildFactors(profile, band);

  const tone: CreditAnalysis['tone'] =
    profile.creditScore >= 740 ? 'green' : profile.creditScore >= 580 ? 'yellow' : 'red';

  return {
    score: profile.creditScore,
    rating: band.rating,
    tone,
    riskLevel: band.risk,
    riskLabel: band.riskLabel,
    financialHealth,
    healthLabel: getHealthLabel(financialHealth),
    approvalProbability,
    estimatedTimeToImprove: band.timeToImprove,
    improvementTips: tips,
    positiveFactors: positives,
    negativeFactors: negatives,
  };
}
