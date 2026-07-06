// Suggested questions for the AI Financial Advisor.
// Static presentation data — kept out of the UI component so the list is easy
// to extend without touching markup.

import type { SuggestedQuestion } from '../types/advisor';

export const SUGGESTED_QUESTIONS: SuggestedQuestion[] = [
  { icon: 'trending-up', text: 'Can I improve my credit score?' },
  { icon: 'sliders', text: 'How can I reduce my EMI?' },
  { icon: 'landmark', text: 'Should I apply for this loan?' },
  { icon: 'wallet', text: 'How much loan should I take?' },
  { icon: 'gauge', text: 'How can I become financially healthier?' },
];
