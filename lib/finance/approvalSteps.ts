import type { ApprovalStep } from '@/app/finance/types';

/** Hint chain for the new-request form; null when the BE sent no (or only one) step so callers keep the single-step text. */
export function stepChainText(steps: ApprovalStep[] | null | undefined): string | null {
  if (!steps || steps.length < 2) return null;
  return steps.map(s => `ขั้น ${s.step}: ${s.label}`).join(' → ');
}

/** "ขั้น 1/2" badge text; null when the item carries no step info (old BE). */
export function stepBadge(step: number | null | undefined, total: number | null | undefined): string | null {
  if (!step || !total) return null;
  return `ขั้น ${step}/${total}`;
}
