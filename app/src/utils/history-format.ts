// Presentation helpers for the History module — pure, DOM-free formatting.
// Shared by the list rows and the detail view so labels never drift.

import type { AnalysisRecord } from '../services/types';

/** Format an ISO timestamp as a readable local date + time. */
export function formatTimestamp(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleString([], {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

/** Short relative label, e.g. "2h ago" / "just now". */
export function relativeTime(iso: string, now: number): string {
  const t = new Date(iso).getTime();
  if (Number.isNaN(t)) return '';
  const diff = Math.max(0, now - t);
  const min = Math.floor(diff / 60000);
  if (min < 1) return 'just now';
  if (min < 60) return `${min}m ago`;
  const hr = Math.floor(min / 60);
  if (hr < 24) return `${hr}h ago`;
  const day = Math.floor(hr / 24);
  return `${day}d ago`;
}

/** Loan status label (falls back to a dash when the tool wasn't run). */
export function loanStatusLabel(r: AnalysisRecord): string {
  return r.loanEligibilityResult?.statusLabel ?? '—';
}

/** Credit rating label with score, e.g. "742 · Very Good". */
export function creditRatingLabel(r: AnalysisRecord): string {
  const c = r.creditAnalysis;
  if (!c) return '—';
  return `${c.score} · ${c.rating}`;
}

/** Traffic-light tone for a record, driven by loan status then credit. */
export function recordTone(r: AnalysisRecord): 'green' | 'yellow' | 'red' | 'none' {
  if (r.loanEligibilityResult) return r.loanEligibilityResult.tone;
  if (r.creditAnalysis) return r.creditAnalysis.tone;
  return 'none';
}

/** One-line quick summary of what the record contains. */
export function quickSummary(r: AnalysisRecord): string {
  if (r.aiAdviceSummary) return r.aiAdviceSummary;
  const parts: string[] = [];
  if (r.loanEligibilityResult) parts.push(`Loan: ${r.loanEligibilityResult.statusLabel}`);
  if (r.creditAnalysis) parts.push(`Credit ${r.creditAnalysis.score}`);
  if (r.emiCalculation) parts.push(`EMI ready`);
  return parts.join(' · ') || 'Analysis snapshot';
}

/** Which tools contributed to this record, as short chips. */
export function toolTags(r: AnalysisRecord): string[] {
  const tags: string[] = [];
  if (r.loanEligibilityResult) tags.push('Loan');
  if (r.creditAnalysis) tags.push('Credit');
  if (r.emiCalculation) tags.push('EMI');
  if (r.aiAdviceSummary) tags.push('AI');
  return tags;
}
