/**
 * ตัวช่วยล้วนของหน้าอนุมัติเงินสดย่อย (อนุมัติเบิก = เจ้าของเงินสด · อนุมัติเคลียร์ = หัวหน้า)
 * — ไม่มี React ไม่มี fetch · โครงแถบ/การ์ดลอกหน้าอนุมัติ Advance (app/finance/approvals/page.tsx)
 */
import type { PettyClaim, PettyRound, PettySpec } from '@/app/finance/types-petty';
import { needsDebtDoc } from '@/lib/finance/petty-debt';
import { isHolderAttachment } from '@/lib/finance/petty-spec';
import { formatDate } from '@/lib/finance/status';

export type HolderView = 'pending' | 'clear' | 'history';
/** claims = ใบรอหัวหน้าอนุมัติ (flow v3) · pending = รอบรออนุมัติเคลียร์ · history = ที่ตัดสินไปแล้ว */
export type HeadView = 'claims' | 'pending' | 'history';
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
  if (tab === 'history') return 'history';
  if (tab === 'pending' || tab === 'clear' || tab === 'rounds') return 'pending';
  return 'claims';
}

/** ตัวเลขในแถบโชว์เมื่อมีของ — แบบ "รออนุมัติเคลียร์ (1)" ของ Advance */
export function tabLabel(label: string, count?: number | null): string {
  return count ? `${label} (${count})` : label;
}

const ofFund = (claims: readonly PettyClaim[], fundId: number | null) =>
  fundId === null ? [] : claims.filter(c => c.fund_id === fundId);

/** รออนุมัติจ่าย — ใหม่สุดก่อน (เหมือนตารางเดิม)
 *  + ใบที่ยังรอหัวหน้า แต่เจ้าของเงินสดเป็นหัวหน้าของผู้ขอเบิกด้วย (BE ส่ง can_head_approve) กดครั้งเดียวได้ทั้งสองขั้น */
export function pendingClaims(claims: readonly PettyClaim[], fundId: number | null): PettyClaim[] {
  return ofFund(claims, fundId)
    .filter(c => c.status === 'PENDING_APPROVAL' || (c.status === 'PENDING_HEAD' && c.can_head_approve === true))
    .sort((a, b) => b.id - a.id);
}

/** ใบที่กำลังมา — ยังรอหัวหน้าของผู้ขอเบิกอนุมัติ เจ้าของเงินสดยังกดจ่ายไม่ได้ (flow v3) */
export function waitingHeadClaims(claims: readonly PettyClaim[], fundId: number | null): PettyClaim[] {
  return ofFund(claims, fundId).filter(c => c.status === 'PENDING_HEAD' && c.can_head_approve !== true)
    .sort((a, b) => b.id - a.id);
}

/** ใบที่หัวหน้าคนนี้อนุมัติไปแล้ว — อนุมัติล่าสุดก่อน (แถบ อนุมัติ/ไม่อนุมัติแล้ว ของหัวหน้า) */
export function headDoneClaims(claims: readonly PettyClaim[], me: string | null | undefined): PettyClaim[] {
  if (!me) return [];
  return claims.filter(c => c.head_approved_by === me)
    .sort((a, b) => (b.head_approved_at ?? '').localeCompare(a.head_approved_at ?? '') || b.id - a.id);
}

/** อนุมัติจ่ายแล้ว รอส่งเคลียร์ — วันที่จ่ายเก่าสุดก่อน เพราะรวมรอบตามช่วงวันที่จ่าย */
export function clearableClaims(claims: readonly PettyClaim[], fundId: number | null): PettyClaim[] {
  return ofFund(claims, fundId).filter(c => c.status === 'APPROVED')
    .sort((a, b) => (a.transfer_date ?? '').localeCompare(b.transfer_date ?? '') || a.id - b.id);
}

/** ผ่านมือเจ้าของเงินสดแล้ว (อนุมัติจ่าย หรือ ตีกลับ) — ทำล่าสุดก่อน */
export function handledClaims(claims: readonly PettyClaim[], fundId: number | null): PettyClaim[] {
  // ตีกลับโดยหัวหน้า (ยังไม่มี head_approved_by) ไม่เคยถึงมือเจ้าของเงินสด จึงไม่นับ
  return ofFund(claims, fundId)
    .filter(c => c.status !== 'PENDING_APPROVAL' && c.status !== 'PENDING_HEAD')
    .filter(c => c.status !== 'RETURNED' || !!c.head_approved_by)
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

export type DocsState = {
  ready: boolean;
  /** ทุกอย่างที่ยังขาด (ชื่อหมวด) */
  missing: string[];
  /** ที่คนเปิดใบต้องแนบ */
  fromClerk: string[];
  /** ที่เจ้าของเงินสดแนบเองตอนอนุมัติจ่าย (สลิปโอน) */
  fromHolder: string[];
  /** หมวดที่ปุ่ม แนบสลิปโอน บนการ์ดอัปโหลดเข้า — null = สลิปมีแล้ว */
  slipFolder: string | null;
};

/**
 * เอกสารครบไหม — นับไฟล์ต่อหมวดเทียบ spec: หมวดที่ติ๊กบังคับ + กฎ require_attachment ก่อนอนุมัติที่เข้าเงื่อนไขของใบ
 * (เช่น จ่ายร้านเงินสดต้องมีสำเนาบัตร) · แยกว่าขาดจากคนเปิดใบ หรือขาดสลิปโอนของเจ้าของเงินสดเอง · ด่านจริงอยู่ที่ BE ตอนกด
 */
export function docsState(spec: PettySpec | null | undefined, counts: Record<string, number>, claim?: PettyClaim): DocsState {
  const keys = new Set((spec?.attachments ?? []).filter(a => a.required).map(a => a.key));
  if (claim) {
    for (const r of spec?.rules ?? []) {
      if (r.require_attachment && r.at === 'BEFORE_APPROVE' && ruleApplies(r.when, claim)) keys.add(r.require_attachment);
    }
  }
  const label = (key: string) => spec?.attachments?.find(a => a.key === key)?.label ?? key;
  const missingKeys = [...keys].filter(k => !(counts[k] > 0));
  const holderKeys = missingKeys.filter(isHolderAttachment);
  return {
    ready: missingKeys.length === 0,
    missing: missingKeys.map(label),
    fromClerk: missingKeys.filter(k => !isHolderAttachment(k)).map(label),
    fromHolder: holderKeys.map(label),
    slipFolder: holderKeys[0] ?? null,
  };
}

/**
 * บรรทัดเหนือปุ่มของการ์ดรออนุมัติจ่าย — null = ไม่ต้องบอกอะไร
 * ขาดของคนเปิดใบ: ให้คนเปิดใบแนบหรือตีกลับ (ยังไม่ควรจ่าย) · ขาดแค่สลิปโอน: เป็นงานของเจ้าของเงินสดเอง มีปุ่มแนบให้
 */
export function pendingHint(docs: DocsState | null): { text: string; attachFolder: string | null } | null {
  if (!docs || docs.ready) return null;
  if (docs.fromClerk.length > 0) {
    return { text: 'เอกสารยังไม่ครบ ให้คนเปิดใบแนบเพิ่มก่อน หรือกดตีกลับพร้อมบอกว่าขาดอะไร', attachFolder: null };
  }
  return { text: 'โอนเงินแล้วแนบสลิปโอนก่อน แล้วค่อยกดอนุมัติจ่าย', attachFolder: docs.slipFolder };
}

/** ช่อง "เอกสาร" บนการ์ด — ขาดแค่สลิปโอนของเจ้าของเงินสดไม่ใช่ความผิดของใบ จึงเป็นสีเตือน ไม่ใช่สีแดง */
export function docsLabel(docs: DocsState | null): { text: string; tone: 'muted' | 'ok' | 'warn' | 'bad' } {
  if (!docs) return { text: 'กำลังตรวจ…', tone: 'muted' };
  if (docs.ready) return { text: 'ครบ', tone: 'ok' };
  if (docs.fromClerk.length === 0) return { text: 'รอสลิปโอนจากคุณ', tone: 'warn' };
  return { text: `ไม่ครบ ขาด ${docs.missing.length} อย่าง`, tone: 'bad' };
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

/** ใบพิมพ์ในเมนูของใบนี้ — spec.prints ตัดใบที่ print_when ไม่เข้าเงื่อนไขออก (ค่าใช้จ่ายทั่วไป: ใบรับรองแทนใบเสร็จเฉพาะบิลสำเนา) */
export function printsFor(spec: PettySpec | null | undefined, claim: PettyClaim): string[] {
  const when = spec?.print_when ?? {};
  return (spec?.prints ?? ['PETTY_VOUCHER']).filter(kind => !when[kind] || ruleApplies(when[kind], claim));
}

/** ชื่อใบสรุปรายการในเมนูพิมพ์ — ประเภทที่ไม่บังคับรถ (ค่าใช้จ่ายทั่วไป) ไม่เขียนว่ารายคัน */
export function itemSummaryLabel(spec: PettySpec | null | undefined): string {
  if (spec?.item_based !== true) return 'ใบสรุปรายการ';
  const truckRequired = (spec.item_fields ?? []).some(f => f.type === 'truck' && f.required);
  return truckRequired ? 'ใบสรุปรายการ (รายคัน/รายวัน)' : 'ใบสรุปรายการ (รายบิล/รายวัน)';
}

/** BE บังคับ DD ตอนรวมรอบ (BEFORE_SUBMIT_TO_ACCOUNTING) เมื่อเงื่อนไขของประเภทเข้า */
export function ddRequired(claim: PettyClaim, spec: PettySpec | null | undefined): boolean {
  return (spec?.rules ?? []).some(r => r.require_field === 'dd_no' && r.at === 'BEFORE_SUBMIT_TO_ACCOUNTING' && ruleApplies(r.when, claim));
}

/** ใบมี พจร. แต่ยังไม่มีเลขรับสภาพหนี้ — ใส่หลังโอนเงินได้ แต่ BE ไม่รับเข้ารอบถ้ายังว่าง (ผู้ใช้สั่ง 29/10/2026) */
export function debtDocMissing(claim: PettyClaim): boolean {
  return needsDebtDoc(claim) && !claim.debt_doc_no?.trim();
}

/** ปุ่ม ใส่/แก้เลขรับสภาพหนี้ — เฉพาะใบที่อนุมัติจ่ายแล้วและต้องมีเลข (BE รับเฉพาะ APPROVED) · null = ไม่มีปุ่ม */
export function debtDocButton(claim: PettyClaim): string | null {
  if (claim.status !== 'APPROVED' || !needsDebtDoc(claim)) return null;
  return claim.debt_doc_no?.trim() ? 'แก้เลขรับสภาพหนี้' : 'ใส่เลขรับสภาพหนี้';
}

/** เหตุผลที่ติ๊กใบนี้เข้ารอบไม่ได้ — null = ติ๊กได้ */
export function roundBlocker(claim: PettyClaim, spec: PettySpec | null | undefined): string | null {
  const dd = ddRequired(claim, spec) && !claim.dd_no?.trim();
  const debt = debtDocMissing(claim);
  if (dd && debt) return 'ต้องใส่ DD และเลขรับสภาพหนี้ก่อนส่งเคลียร์';
  if (dd) return 'ต้องใส่ DD ก่อนส่งเคลียร์';
  if (debt) return 'ต้องใส่เลขรับสภาพหนี้ก่อนส่งเคลียร์';
  return null;
}

export function pickSummary(shown: readonly PettyClaim[], selected: readonly number[]): { picked: PettyClaim[]; sum: number } {
  const picked = shown.filter(c => selected.includes(c.id));
  const sum = Math.round(picked.reduce((s, c) => s + c.amount, 0) * 100) / 100;
  return { picked, sum };
}

/** รอฉันอนุมัติ / อนุมัติแทนได้ — ไม่มีธง (BE เก่า) นับเป็นของฉัน แบบ splitByTab ของ Advance */
export function splitByPrimary<T extends { is_primary?: boolean | null }>(rounds: readonly T[]): { mine: T[]; delegable: T[] } {
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
