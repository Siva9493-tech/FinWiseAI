// Prompt engineering for the AI Financial Advisor.
//
// Pure functions only — no provider, no network. This module turns the user's
// deterministic financial results plus their question into the system/user
// messages sent to the model. Keeping it isolated means the prompt can be
// tuned without touching the provider or the endpoint.

import type { ChatMessage, FinancialContext } from '../types/advisor';
import { formatInr } from '../utils/loan';

/** Hard cap on user question length to keep prompts bounded. */
export const MAX_QUESTION_LENGTH = 500;

const SYSTEM_PROMPT = `You are FinWise AI, a professional financial advisor for the Indian market.

You are given the user's financial results, which were calculated locally by deterministic formulas. Treat these numbers as authoritative facts — never recalculate, contradict, or invent them.

Respond in well-structured GitHub-flavored Markdown using EXACTLY these four second-level headings, in this order:

## Financial Advice
## Risks
## Suggestions
## Action Plan

Rules:
- Under "Financial Advice", give a concise, direct assessment tied to the user's numbers.
- Under "Risks", list concrete risks as bullet points.
- Under "Suggestions", give actionable, specific recommendations as bullet points.
- Under "Action Plan", give a short numbered list of next steps the user can take.
- Use ₹ for all money. Refer to the actual figures provided.
- Be encouraging but honest. Do not promise guaranteed outcomes.
- Keep the whole response under ~350 words. No preamble, no closing pleasantries — start directly with the first heading.
- You are an assistant providing general guidance, not a substitute for a certified financial professional.`;

/** Format the loan eligibility result as a compact fact block. */
function loanFacts(ctx: FinancialContext): string | null {
  const r = ctx.loan;
  if (!r) return null;
  return [
    '### Loan Eligibility Result',
    `- Status: ${r.statusLabel}`,
    `- Risk level: ${r.riskLabel}`,
    `- Eligible amount: ${formatInr(r.eligibleAmount)}`,
    `- Estimated EMI: ${formatInr(r.estimatedEmi)}/month`,
    `- Interest rate: ${r.interestRate}% p.a.`,
    `- Debt-to-income after loan: ${(r.debtToIncome * 100).toFixed(0)}%`,
  ].join('\n');
}

/** Format the credit analysis result as a compact fact block. */
function creditFacts(ctx: FinancialContext): string | null {
  const c = ctx.credit;
  if (!c) return null;
  return [
    '### Credit Score Result',
    `- Score: ${c.score} (${c.rating})`,
    `- Risk level: ${c.riskLabel}`,
    `- Financial health: ${c.financialHealth}/100 (${c.healthLabel})`,
    `- Loan approval probability: ${c.approvalProbability}%`,
    `- Estimated time to improve: ${c.estimatedTimeToImprove}`,
  ].join('\n');
}

/** Format the EMI breakdown as a compact fact block. */
function emiFacts(ctx: FinancialContext): string | null {
  const e = ctx.emi;
  if (!e) return null;
  return [
    '### EMI Result',
    `- Loan type: ${e.loanTypeLabel}`,
    `- Monthly EMI: ${formatInr(e.monthlyEmi)}`,
    `- Principal: ${formatInr(e.principal)}`,
    `- Total interest: ${formatInr(e.totalInterest)}`,
    `- Total payment: ${formatInr(e.totalPayment)}`,
    `- Tenure: ${e.tenureMonths} months at ${e.annualInterestRate.toFixed(2)}% p.a.`,
  ].join('\n');
}

/** True when the user has at least one deterministic result to reason over. */
export function hasFinancialContext(ctx: FinancialContext): boolean {
  return Boolean(ctx.loan || ctx.credit || ctx.emi);
}

/**
 * Build the provider-agnostic message list for a request.
 * The system prompt fixes the output contract; the user message carries the
 * factual context plus the question.
 */
export function buildMessages(
  question: string,
  context: FinancialContext
): ChatMessage[] {
  const blocks = [loanFacts(context), creditFacts(context), emiFacts(context)]
    .filter((b): b is string => b !== null);

  const contextSection = blocks.length
    ? blocks.join('\n\n')
    : 'The user has not run any calculators yet, so no financial results are available. Give general guidance and encourage them to use the Loan, Credit, and EMI tools for a tailored answer.';

  const userContent = [
    '## My Financial Results',
    contextSection,
    '',
    '## My Question',
    question.trim(),
  ].join('\n');

  return [
    { role: 'system', content: SYSTEM_PROMPT },
    { role: 'user', content: userContent },
  ];
}
