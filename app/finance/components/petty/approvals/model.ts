/**
 * ตัวช่วยล้วนของหน้าอนุมัติเงินสดย่อย (อนุมัติเบิก = เจ้าของเงินสด · อนุมัติเคลียร์ = หัวหน้า)
 * — ไม่มี React ไม่มี fetch · โครงแถบ/การ์ดลอกหน้าอนุมัติ Advance (app/finance/approvals/page.tsx)
 */
import type { PettyClaim, PettyRound, PettySpec } from '@/app/finance/types-petty';
import { formatDate } from '@/lib/finance/status';

export type HolderView = 'pending' | 'clear' | 'history';
export type HeadView = 'pending' | 'history';
export type SubTab = 'mine' | 'delegable';

/** รอบในคิวหัวหน้า · is_primary = คนที่ระบบส่งอีเมลหา (clear_notify) — BE ส่งมาหลังงาน lane A */
export type ClearRound = PettyRound & { is_primary?: boolean | null };

// คีย์แท็บของหน้าตารางเดิม (ลิงก์เก่า/บุ๊กมาร์ก) — ทุกขั้นหลังเจ้าของเงินสดไปอยู่แถบ อนุมัติแล้ว
const OLD_HISTORY_KEYS = new Set(['history', 'head', 'acc', 'sentback', 'returned', 'closed', 'all']);

export function parseHolderView(tab: string | null | undefined): HolderView {
  if (tab === 'clear') return 'clear';
  if (tab && OLD_HISTORY_KEYS.has(tab)) return 'history';
  return 'pending';
}

export function parseHeadView(tab: string | null | undefined): HeadView {
  return tab === 'history' ? 'history' : 'pending';
}

/** ตัวเลขในแถบโชว์เมื่อมีของ — แบบ "รออนุมัติเคลียร์ (1)" ของ Advance */
export function tabLabel(label: string, count?: number | null): string {
  return count ? `${label} (${count})` : label;
}

const ofFund = (claims: readonly PettyClaim[], fundId: number | null) =>
  fundId === null ? [] : claims.filter(c => c.fund_id === fundId);

/** รออนุมัติจ่าย — ใหม่สุดก่อน (เหมือนตารางเดิม) */
export function pendingClaims(claims: readonly PettyClaim[], fundId: number | null): PettyClaim[] {
  return ofFund(claims, fundId).filter(c => c.status === 'PENDING_APPROVAL').sort((a, b) => b.id - a.id);
}

/** อนุมัติจ่ายแล้ว รอส่งเคลียร์ — วันที่จ่ายเก่าสุดก่อน เพราะรวมรอบตามช่วงวันที่จ่าย */
export function clearableClaims(claims: readonly PettyClaim[], fundId: number | null): PettyClaim[] {
  return ofFund(claims, fundId).filter(c => c.status === 'APPROVED')
    .sort((a, b) => (a.transfer_date ?? '').localeCompare(b.transfer_date ?? '') || a.id - b.id);
}

/** ผ่านมือเจ้าของเงินสดแล้ว (อนุมัติจ่าย หรือ ตีกลับ) — ทำล่าสุดก่อน */
export function handledClaims(claims: readonly PettyClaim[], fundId: number | null): PettyClaim[] {
  return ofFund(claims, fundId).filter(c => c.status !== 'PENDING_APPROVAL')
    .sort((a, b) => (b.approved_at ?? '').localeCompare(a.approved_at ?? '') || b.id - a.id);
}

export function claimOutcome(claim: PettyClaim): 'approved' | 'returned' {
  return claim.status === 'RETURNED' ? 'returned' : 'approved';
}

export function claimPeriod(claim: Pick<PettyClaim, 'period_from' | 'period_to' | 'expense_date'>): string {
  const { period_from: from, period_to: to } = claim;
  if (from && to) return from === to ? formatDate(from) : `${formatDate(from)} – ${formatDate(to)}`;
  return formatDate(claim.expense_date);
}

/**
 * เอกสารครบไหม — นับไฟล์ต่อหมวดเทียบ spec: หมวดที่ติ๊กบังคับ + กฎ require_attachment ก่อนอนุมัติที่เข้าเงื่อนไขของใบ
 * (เช่น จ่ายร้านเงินสดต้องมีสำเนาบัตร) · ด่านจริงอยู่ที่ BE ตอนกด
 */
export function docsState(spec: PettySpec | null | undefined, counts: Record<string, number>, claim?: PettyClaim): { ready: boolean; missing: string[] } {
  const keys = new Set((spec?.attachments ?? []).filter(a => a.required).map(a => a.key));
  if (claim) {
    for (const r of spec?.rules ?? []) {
      if (r.require_attachment && r.at === 'BEFORE_APPROVE' && ruleApplies(r.when, claim)) keys.add(r.require_attachment);
    }
  }
  const label = (key: string) => spec?.attachments?.find(a => a.key === key)?.label ?? key;
  const missing = [...keys].filter(k => !(counts[k] > 0)).map(label);
  return { ready: missing.length === 0, missing };
}

/** ประเภทนี้มีเลข DD — ปุ่ม ใส่ DD / แก้ DD */
export function usesDd(spec: PettySpec | null | undefined): boolean {
  return (spec?.prints ?? []).includes('DD') || (spec?.rules ?? []).some(r => r.require_field === 'dd_no');
}

function fieldValue(claim: PettyClaim, key: string): unknown {
  const own = (claim as unknown as Record<string, unknown>)[key];
  if (own !== undefined && own !== null && own !== '') return own;
  return claim.detail?.[key];
}

/** เงื่อนไขกฎใน spec — ต้องอ่านเหมือน _rule_applies ใน BE (petty_validate.py) · อ่านไม่ออก = ไม่บังคับ */
export function ruleApplies(when: string | null | undefined, claim: PettyClaim): boolean {
  if (!when || when === 'always') return true;
  const amount = Number(claim.amount) || 0;
  if (when.startsWith('total >=')) return amount >= Number(when.split('>=')[1]);
  if (when.startsWith('total <')) return amount < Number(when.split('<')[1]);
  if (when.includes('==')) {
    return when.split('&&').every(clause => {
      const [key, wanted] = clause.split('==').map(s => s.trim());
      return !!key && !!wanted && String(fieldValue(claim, key) ?? '').trim() === wanted;
    });
  }
  return false;
}

/** BE บังคับ DD ตอนรวมรอบ (BEFORE_SUBMIT_TO_ACCOUNTING) เมื่อเงื่อนไขของประเภทเข้า */
export function ddRequired(claim: PettyClaim, spec: PettySpec | null | undefined): boolean {
  return (spec?.rules ?? []).some(r => r.require_field === 'dd_no' && r.at === 'BEFORE_SUBMIT_TO_ACCOUNTING' && ruleApplies(r.when, claim));
}

/** เหตุผลที่ติ๊กใบนี้เข้ารอบไม่ได้ — null = ติ๊กได้ */
export function roundBlocker(claim: PettyClaim, spec: PettySpec | null | undefined): string | null {
  return ddRequired(claim, spec) && !claim.dd_no?.trim() ? 'ต้องใส่ DD ก่อนส่งเคลียร์' : null;
}

export function pickSummary(shown: readonly PettyClaim[], selected: readonly number[]): { picked: PettyClaim[]; sum: number } {
  const picked = shown.filter(c => selected.includes(c.id));
  const sum = Math.round(picked.reduce((s, c) => s + c.amount, 0) * 100) / 100;
  return { picked, sum };
}

/** รอฉันอนุมัติ / อนุมัติแทนได้ — ไม่มีธง (BE เก่า) นับเป็นของฉัน แบบ splitByTab ของ Advance */
export function splitByPrimary<T extends ClearRound>(rounds: readonly T[]): { mine: T[]; delegable: T[] } {
  return {
    mine: rounds.filter(r => r.is_primary !== false),
    delegable: rounds.filter(r => r.is_primary === false),
  };
}

/** รอบที่ฉันอนุมัติ/ไม่อนุมัติไปแล้ว — BE เก็บคนกดทั้งสองแบบไว้ที่ clear_approved_by */
export function clearedByMe<T extends PettyRound>(rounds: readonly T[], me: string | null | undefined): T[] {
  if (!me) return [];
  return rounds.filter(r => r.status !== 'CLEAR_PENDING' && r.clear_approved_by === me)
    .sort((a, b) => (b.clear_approved_at ?? '').localeCompare(a.clear_approved_at ?? '') || b.id - a.id);
}

export function roundOutcome(round: PettyRound): 'approved' | 'rejected' {
  return round.status === 'CLEAR_REJECTED' ? 'rejected' : 'approved';
}

export type ClaimLocation = { view: HolderView; hit: boolean; notice?: string };

/** ลิงก์ ?doc=<เลขที่ใบ> — ใบอยู่แถบไหน ถ้าผ่านมือไปแล้วบอกว่าไปไหน (แบบ Advance) */
export function locateClaim(doc: string, lists: {
  pending: readonly PettyClaim[]; clearable: readonly PettyClaim[]; handled: readonly PettyClaim[];
}): ClaimLocation {
  if (lists.pending.some(c => c.form_id === doc)) return { view: 'pending', hit: true };
  if (lists.clearable.some(c => c.form_id === doc)) return { view: 'clear', hit: true };
  const done = lists.handled.find(c => c.form_id === doc);
  if (done) {
    return {
      view: 'history', hit: true,
      notice: claimOutcome(done) === 'returned'
        ? `ใบ ${doc} ตีกลับไปแล้ว รอคนเปิดใบแก้แล้วส่งมาใหม่`
        : `คุณอนุมัติจ่ายใบ ${doc} แล้ว เมื่อ ${formatDate(done.approved_at)}`,
    };
  }
  return { view: 'pending', hit: false, notice: `ใบ ${doc} ไม่อยู่ในคิวของคุณ อาจไม่ใช่ใบของวงเงินที่คุณถือ` };
}

/** ลิงก์ ?doc=<id หรือเลขรอบ> ในหน้าหัวหน้า */
export function locateRound(doc: string, rounds: readonly ClearRound[]): { id: number; sub: SubTab } | null {
  const hit = rounds.find(r => String(r.id) === doc || r.batch_no === doc);
  if (!hit) return null;
  return { id: hit.id, sub: hit.is_primary === false ? 'delegable' : 'mine' };
}
