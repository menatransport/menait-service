import type { ApprovalStep } from '@/app/finance/types';

/** Hint chain for the new-request form; null when the BE sent no (or only one) step so callers keep the single-step text. */
export function stepChainText(steps: ApprovalStep[] | null | undefined): string | null {
  if (!steps || steps.length < 2) return null;
  return steps.map(s => `ขั้น ${s.step}: ${s.label}`).join(' → ');
}

/** "ขั้น 1/2" badge text; null when the item carries no step info (old BE) or there is only one step (TOA 21/10/2026). */
export function stepBadge(step: number | null | undefined, total: number | null | undefined): string | null {
  if (!step || !total || total < 2) return null;
  return `ขั้น ${step}/${total}`;
}

/** ข้อความสายอนุมัติใต้ช่องจำนวนเงิน · ระดับที่ต้องการสูงกว่าตาม TOA เพราะต้องสูงกว่าผู้เบิก ให้บอกเหตุผลด้วย */
export function approvalHintText(r: { required_level: number; clause: string; approver_label: string; steps?: ApprovalStep[] | null }): string {
  const chain = stepChainText(r.steps);
  if (chain) return chain;
  const m = r.approver_label?.match(/ระดับ\s*(\d+)/);
  const toaMin = m ? Number(m[1]) : null;
  const why = toaMin !== null && r.required_level > toaMin ? ' · ต้องสูงกว่าระดับผู้เบิก' : '';
  return `ต้องอนุมัติโดยระดับ ${r.required_level} ขึ้นไป (ข้อ ${r.clause} · ${r.approver_label}${why})`;
}
