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

export type StepSigner<T> = { step: number; who: string | null | undefined; item: T };
export type SignatureSlots<T> = { unit_head?: T; manager?: T; approver?: T };

/**
 * ผู้อนุมัติตามขั้น → ช่องลายเซ็นในใบพิมพ์ (มี 3 ช่อง แต่ไล่ทุกขั้นตาม TOA ได้ถึง 5 ขั้น · ผู้ใช้สั่ง 26/10/2026)
 * คนเดียวกดหลายขั้นติดกัน (ข้ามขั้นตามระดับ) นับเป็นลายเซ็นเดียว · อนุมัติครบแล้ว: คนสุดท้าย = ผู้มีอำนาจอนุมัติ
 * คนแรก = หัวหน้าหน่วยงาน · คนถัดไป = ผู้จัดการ · คนอื่นตรงกลางไม่มีช่อง แต่ยังอยู่ในประวัติอนุมัติ
 */
export function signatureSlots<T>(signers: StepSigner<T>[], done: boolean): SignatureSlots<T> {
  const groups: StepSigner<T>[] = [];
  for (const s of [...signers].sort((a, b) => a.step - b.step)) {
    const last = groups[groups.length - 1];
    if (last && s.who && last.who === s.who) continue;
    groups.push(s);
  }
  const out: SignatureSlots<T> = {};
  const rest = done ? groups.slice(0, -1) : groups;
  if (done && groups.length) out.approver = groups[groups.length - 1].item;
  if (rest[0]) out.unit_head = rest[0].item;
  if (rest[1]) out.manager = rest[1].item;
  return out;
}

export type QueueTab = 'mine' | 'delegable';

/** แยกคิวรออนุมัติเป็น รอฉันอนุมัติ / อนุมัติแทนได้ — รายการที่ไม่มี tab (BE เก่า) นับเป็นของฉัน */
export function splitByTab<T extends { tab?: QueueTab }>(items: T[]): { mine: T[]; delegable: T[] } {
  return {
    mine: items.filter(i => i.tab !== 'delegable'),
    delegable: items.filter(i => i.tab === 'delegable'),
  };
}
