/**
 * หน้า "งานเงินสดย่อย" (/finance/petty/accounting) ของบัญชีกับการเงิน — โครงเดียวกับ "งานเบิกเงิน Advance"
 * ตัวเลขสรุป → แถบตามสถานะ → ตารางเดียว → แผงด้านข้าง · ไฟล์นี้เป็นตัวช่วยล้วน (ไม่มี React ไม่มี fetch) เทสต์ได้ตรง ๆ
 *
 * แถวในแถบ รอบัญชีตรวจ / ส่งกลับแก้ไข = ใบ (บัญชีตรวจทีละใบ) · แถบที่เหลือ = รอบ (ตั้งเบิกและจ่ายทั้งรอบ)
 */
import type { PettyClaim, PettyExpenseType, PettyFund, PettyRound, PettyRoundLog } from '@/app/finance/types-petty';
import { parseNumberFilter } from './columnFilters';
import { PETTY_STATUS_LABELS, type PettyRoundStatus, type PettyStatus } from './petty-status';
import { formatBaht, formatDate, toBkkYM } from './status';

// ---------------------------------------------------------------- แถบ

export type WorklistKind = 'claim' | 'round';
export type WorklistTabKey = 'review' | 'sentback' | 'voucher' | 'pay' | 'closed' | 'all';
export type WorklistTab = {
  key: WorklistTabKey; label: string; kind: WorklistKind;
  claimStatuses?: PettyStatus[];
  /** ไม่ระบุ (แถบทั้งหมด) = ทุกรอบที่ถึงบัญชีแล้ว */
  roundStatuses?: PettyRoundStatus[];
};

/** รอบที่ถึงมือบัญชีแล้ว — รอบที่ยังอยู่กับหัวหน้า หรือหัวหน้าไม่อนุมัติ ยังไม่ใช่งานของหน้านี้ */
export const WORKLIST_ROUND_STATUSES: PettyRoundStatus[] = ['AWAITING_REVIEW', 'REVIEWED', 'VOUCHERED', 'CLOSED'];

export const WORKLIST_TABS: WorklistTab[] = [
  { key: 'review', label: 'รอบัญชีตรวจ', kind: 'claim', claimStatuses: ['AWAITING_REVIEW'] },
  { key: 'sentback', label: 'ส่งกลับแก้ไข', kind: 'claim', claimStatuses: ['SENT_BACK'] },
  { key: 'voucher', label: 'รอตั้งเบิก', kind: 'round', roundStatuses: ['REVIEWED'] },
  { key: 'pay', label: 'รอจ่าย', kind: 'round', roundStatuses: ['VOUCHERED'] },
  { key: 'closed', label: 'ปิดแล้ว', kind: 'round', roundStatuses: ['CLOSED'] },
  { key: 'all', label: 'ทั้งหมด', kind: 'round' },
];

const tabOf = (key: WorklistTabKey) => WORKLIST_TABS.find(t => t.key === key) ?? WORKLIST_TABS[0];

export function tabKind(key: WorklistTabKey): WorklistKind {
  return tabOf(key).kind;
}

/** ?tab= จากลิงก์ (เช่น /finance/petty/batches → ?tab=pay) — ค่าที่ไม่รู้จักใช้ค่าเริ่มต้น */
export function resolveTab(raw: string | null | undefined, fallback: WorklistTabKey): WorklistTabKey {
  return WORKLIST_TABS.some(t => t.key === raw) ? raw as WorklistTabKey : fallback;
}

/** บัญชี (และแอดมิน) เริ่มที่ รอบัญชีตรวจ · การเงินล้วนเริ่มที่ รอจ่าย */
export function defaultTab(perms: { review: boolean; voucher: boolean; pay: boolean }): WorklistTabKey {
  if (perms.review) return 'review';
  if (perms.pay) return 'pay';
  return perms.voucher ? 'voucher' : 'all';
}

export type WorklistRows = { kind: 'claim'; rows: PettyClaim[] } | { kind: 'round'; rows: PettyRound[] };

export function rowsForTab(key: WorklistTabKey, claims: readonly PettyClaim[], rounds: readonly PettyRound[]): WorklistRows {
  const tab = tabOf(key);
  if (tab.kind === 'claim') return { kind: 'claim', rows: claims.filter(c => tab.claimStatuses?.includes(c.status)) };
  const statuses = tab.roundStatuses ?? WORKLIST_ROUND_STATUSES;
  return { kind: 'round', rows: rounds.filter(r => statuses.includes(r.status)) };
}

export function worklistCounts(claims: readonly PettyClaim[], rounds: readonly PettyRound[]): Record<WorklistTabKey, number> {
  const out = {} as Record<WorklistTabKey, number>;
  for (const t of WORKLIST_TABS) out[t.key] = rowsForTab(t.key, claims, rounds).rows.length;
  return out;
}

// ---------------------------------------------------------------- ป้ายสถานะ (คำของ Advance ในขั้นที่เหมือนกัน)

export const ROUND_STATUS_LABELS: Record<PettyRoundStatus, string> = {
  CLEAR_PENDING: 'รออนุมัติเคลียร์',
  CLEAR_REJECTED: 'ไม่อนุมัติเคลียร์',
  AWAITING_REVIEW: 'รอบัญชีตรวจ',
  REVIEWED: 'รอตั้งเบิกทำจ่าย',
  VOUCHERED: 'รอจ่าย',
  CLOSED: 'ปิดแล้ว',
};

// สีชุดเดียวกับ STATUS_STYLES ของ Advance ในขั้นที่ตรงกัน
export const ROUND_STATUS_STYLES: Record<PettyRoundStatus, string> = {
  CLEAR_PENDING: 'bg-amber-50 text-amber-700 border-amber-200',
  CLEAR_REJECTED: 'bg-rose-50 text-rose-700 border-rose-200',
  AWAITING_REVIEW: 'bg-violet-50 text-violet-700 border-violet-200',
  REVIEWED: 'bg-aqua-50 text-aqua-700 border-aqua-200',
  VOUCHERED: 'bg-brand-50 text-brand-700 border-brand-200',
  CLOSED: 'bg-emerald-50 text-mint-700 border-emerald-200',
};

/** ป้ายใบในหน้างาน — ส่งกลับแก้ไขใช้คำของ Advance */
export const CLAIM_STATUS_LABELS: Record<PettyStatus, string> = { ...PETTY_STATUS_LABELS, SENT_BACK: 'ส่งกลับแก้ไข' };

// ---------------------------------------------------------------- ตัวเลขสรุป

export type WorklistStat = { label: string; value: string | number; hint?: string; alert?: boolean };

const sum = (xs: readonly number[]) => xs.reduce((s, n) => s + n, 0);

/** ใบประเภทนี้ต้องมีเลข DD ไหม (ประเภทที่พิมพ์ใบรับสินค้า) */
export function typeNeedsDd(types: readonly PettyExpenseType[], code: string): boolean {
  return (types.find(t => t.code === code)?.spec?.prints ?? []).includes('DD');
}

export function worklistStats(claims: readonly PettyClaim[], rounds: readonly PettyRound[], types: readonly PettyExpenseType[]): WorklistStat[] {
  const waiting = claims.filter(c => c.status === 'AWAITING_REVIEW');
  const toVoucher = rounds.filter(r => r.status === 'REVIEWED');
  const toPay = rounds.filter(r => r.status === 'VOUCHERED');
  const owed = rounds.filter(r => r.status === 'AWAITING_REVIEW' || r.status === 'REVIEWED' || r.status === 'VOUCHERED');
  const baht = (n: number) => `${formatBaht(n)} บาท`;
  return [
    { label: 'ยอดรอจ่ายคืน (บาท)', value: formatBaht(sum(owed.map(r => r.total_amount))), hint: `${owed.length} รอบ` },
    { label: 'รอบัญชีตรวจ', value: waiting.length, hint: baht(sum(waiting.map(c => c.amount))) },
    { label: 'ส่งกลับแก้ไข', value: claims.filter(c => c.status === 'SENT_BACK').length },
    { label: 'รอตั้งเบิก', value: toVoucher.length, hint: baht(sum(toVoucher.map(r => r.total_amount))) },
    { label: 'รอจ่าย', value: toPay.length, hint: baht(sum(toPay.map(r => r.total_amount))) },
    { label: 'ยังไม่มีเลข DD', value: waiting.filter(c => !c.dd_no && typeNeedsDd(types, c.expense_type)).length, alert: true, hint: 'ในใบรอบัญชีตรวจ' },
  ];
}

// ---------------------------------------------------------------- คอลัมน์ (ตาราง + ช่องกรอง + Excel ชุดเดียวกัน เหมือน EXPORT_COLUMNS ของ Advance)

export type WorklistCtx = {
  typeName: (code: string) => string;
  fundOf: (fundId: number) => PettyFund | undefined;
  /** เลขรอบของใบ (จากรายการรอบที่โหลดไว้) */
  roundNo: (batchId: number | null) => string | null;
};

export type WorklistColumn<T> = {
  label: string;
  /** ตัวเลขเงิน: ชิดขวา กรองด้วย > < ได้ ส่งออกเป็นตัวเลข */
  money?: boolean;
  date?: boolean;
  /** ช่องกรองกว้าง */
  wide?: boolean;
  text: (row: T, ctx: WorklistCtx) => string;
  value?: (row: T) => number | null;
};

const day = (v: string | null | undefined) => {
  const out = v ? formatDate(v) : '';
  return out === '-' ? '' : out;
};

function claimPeriod(c: PettyClaim): string {
  if (c.period_from && c.period_to) {
    return c.period_from === c.period_to ? day(c.period_from) : `${day(c.period_from)} – ${day(c.period_to)}`;
  }
  return day(c.expense_date);
}

function claimNote(c: PettyClaim): string {
  if (c.status === 'SENT_BACK') return c.review_remark ?? '';
  if (c.status === 'RETURNED') return c.return_reason ?? '';
  return '';
}

export const CLAIM_COLUMNS: WorklistColumn<PettyClaim>[] = [
  { label: 'ลำดับ', text: () => '' },
  { label: 'เลขที่ใบเบิก', text: c => c.form_id },
  { label: 'ผู้เปิดใบ', wide: true, text: c => c.created_by_name ?? c.created_by },
  { label: 'สาขา', text: (c, x) => x.fundOf(c.fund_id)?.branch_code ?? '' },
  { label: 'แผนก', text: (c, x) => x.fundOf(c.fund_id)?.division_code ?? '' },
  { label: 'สถานะ', text: c => CLAIM_STATUS_LABELS[c.status] ?? c.status },
  { label: 'รอบ', text: (c, x) => x.roundNo(c.batch_id) ?? '' },
  { label: 'ประเภท', text: (c, x) => x.typeName(c.expense_type) },
  { label: 'จ่ายให้', wide: true, text: c => c.payee_name ?? '' },
  { label: 'ช่วงวันที่', date: true, text: claimPeriod },
  { label: 'ยอดเงิน', money: true, text: c => formatBaht(c.amount), value: c => c.amount },
  { label: 'เลขที่ DD', text: c => c.dd_no ?? '' },
  { label: 'วันที่จ่าย', date: true, text: c => day(c.transfer_date) },
  { label: 'เจ้าของเงินสด', wide: true, text: (c, x) => c.approved_by_name ?? x.fundOf(c.fund_id)?.holder_name ?? '' },
  { label: 'หมายเหตุ', wide: true, text: claimNote },
];

export const ROUND_COLUMNS: WorklistColumn<PettyRound>[] = [
  { label: 'ลำดับ', text: () => '' },
  { label: 'เลขที่รอบ', text: r => r.batch_no },
  { label: 'เจ้าของเงินสด', wide: true, text: r => r.holder_name ?? r.holder_employee_id ?? '' },
  { label: 'สาขา', text: r => r.branch_code ?? '' },
  { label: 'แผนก', text: r => r.division_code ?? '' },
  { label: 'สถานะ', text: r => ROUND_STATUS_LABELS[r.status] ?? r.status },
  { label: 'เลขที่ตั้งเบิก', text: r => r.voucher_no ?? '' },
  { label: 'วันที่ตั้งเบิก', date: true, text: r => day(r.voucher_date) },
  { label: 'เลขที่ทำจ่าย', text: r => r.pay_doc_no ?? '' },
  { label: 'จำนวนใบ', text: r => String(r.claim_count ?? r.claims?.length ?? '') },
  { label: 'ยอดเงิน', money: true, text: r => formatBaht(r.total_amount), value: r => r.total_amount },
  { label: 'วันที่ส่งเคลียร์', date: true, text: r => day(r.submitted_at) },
  { label: 'หัวหน้าที่อนุมัติเคลียร์', wide: true, text: r => r.clear_approved_by_name ?? r.clear_approved_by ?? '' },
  { label: 'วันที่โอนเงิน', date: true, text: r => day(r.pay_date) },
  { label: 'ปิดรอบเมื่อ', date: true, text: r => day(r.closed_at) },
];

/** ตัดลูกน้ำ ยุบเว้นวรรค ตัวพิมพ์เล็ก — แบบเดียวกับตัวกรองของ Advance */
const norm = (s: string) => s.toLowerCase().replace(/,/g, '').replace(/\s+/g, ' ').trim();

const ALL_STATUS_CODES = new Set<string>([...Object.keys(PETTY_STATUS_LABELS), ...Object.keys(ROUND_STATUS_LABELS)]);

function compare(n: number, op: string, value: number): boolean {
  const a = Math.round(n * 100), b = Math.round(value * 100);
  switch (op) {
    case '>': return a > b;
    case '<': return a < b;
    case '>=': return a >= b;
    case '<=': return a <= b;
    default: return a === b;
  }
}

/** แถวนี้ผ่านทุกช่องกรองใต้หัวคอลัมน์ไหม (ช่องว่างไม่นับ · "-" = หาช่องว่าง · เงินใช้ >5000 ได้) */
export function matchesWorklistFilters<T extends { status: string }>(
  row: T, columns: readonly WorklistColumn<T>[], filters: Record<string, string | undefined>, ctx: WorklistCtx,
): boolean {
  for (const [label, raw] of Object.entries(filters)) {
    const f = (raw ?? '').trim();
    if (!f) continue;
    const col = columns.find(c => c.label === label);
    if (!col) continue;
    if (label === 'สถานะ' && ALL_STATUS_CODES.has(f)) {
      if (row.status !== f) return false;
      continue;
    }
    const text = col.text(row, ctx);
    if (f === '-') {
      if (text.trim() !== '') return false;
      continue;
    }
    const num = col.money ? parseNumberFilter(f) : null;
    if (num && col.value) {
      const n = col.value(row);
      if (n === null || !compare(n, num.op, num.value)) return false;
      continue;
    }
    if (!norm(text).includes(norm(f))) return false;
  }
  return true;
}

export function hasWorklistFilters(filters: Record<string, string | undefined>): boolean {
  return Object.values(filters).some(v => (v ?? '').trim() !== '');
}

/** ช่องค้นหาบนหัวการ์ด */
export function searchWorklist(kind: WorklistKind, row: PettyClaim | PettyRound, query: string, ctx: WorklistCtx): boolean {
  const q = query.trim().toLowerCase();
  if (!q) return true;
  const hay = kind === 'claim'
    ? (() => {
        const c = row as PettyClaim;
        return [c.form_id, c.created_by_name, c.created_by, c.payee_name, c.dd_no, ctx.typeName(c.expense_type), ctx.roundNo(c.batch_id)];
      })()
    : (() => {
        const r = row as PettyRound;
        return [r.batch_no, r.holder_name, r.holder_employee_id, r.voucher_no, r.pay_doc_no];
      })();
  return hay.filter(Boolean).join(' ').toLowerCase().includes(q);
}

/** ช่วงเดือน: ใบดูวันที่บนใบ · รอบดูวันที่ส่งเคลียร์ (เวลาไทย) · ไม่มีวันที่ = ไม่ซ่อน */
export function inMonthRange(kind: WorklistKind, row: PettyClaim | PettyRound, start: string, end: string): boolean {
  const ym = kind === 'claim' ? toBkkYM((row as PettyClaim).expense_date) : toBkkYM((row as PettyRound).submitted_at);
  if (!ym) return true;
  return (!start || ym >= start) && (!end || ym <= end);
}

/** เรียงตามลำดับที่สร้าง (id) — ใหม่ก่อนเป็นค่าเริ่มต้นเหมือน Advance */
export function sortWorklist<T extends { id: number }>(rows: readonly T[], order: 'asc' | 'desc'): T[] {
  return [...rows].sort((a, b) => (order === 'desc' ? b.id - a.id : a.id - b.id));
}

/** แถว Excel — ใช้คอลัมน์ชุดเดียวกับตาราง เงินเป็นตัวเลข */
export function worklistSheetRows(kind: WorklistKind, rows: readonly (PettyClaim | PettyRound)[], ctx: WorklistCtx): Record<string, string | number | null>[] {
  const columns = (kind === 'claim' ? CLAIM_COLUMNS : ROUND_COLUMNS) as WorklistColumn<PettyClaim | PettyRound>[];
  return rows.map((row, i) => {
    const out: Record<string, string | number | null> = {};
    for (const col of columns) {
      if (col.label === 'ลำดับ') out[col.label] = i + 1;
      else if (col.money && col.value) out[col.label] = col.value(row);
      else out[col.label] = col.text(row, ctx);
    }
    return out;
  });
}

// ---------------------------------------------------------------- กล่องตั้งเบิก / จ่ายเงิน

export const DOC_NO_MAX = 50;

export function voucherPayload(voucherNo: string, voucherDate: string): { voucher_no: string | null; voucher_date: string } {
  return { voucher_no: voucherNo.trim() || null, voucher_date: voucherDate };
}

export function voucherFormError(voucherNo: string, voucherDate: string): string | null {
  if (!voucherDate) return 'กรุณาระบุวันที่ตั้งเบิก';
  if (voucherNo.trim().length > DOC_NO_MAX) return `เลขที่ตั้งเบิกยาวได้ไม่เกิน ${DOC_NO_MAX} ตัว`;
  return null;
}

export function payPayload(payDate: string, payDocNo: string): { pay_date: string; pay_doc_no: string | null } {
  return { pay_date: payDate, pay_doc_no: payDocNo.trim() || null };
}

export function payFormError(payDate: string, payDocNo: string): string | null {
  if (!payDate) return 'กรุณาระบุวันที่โอนเงิน';
  if (payDocNo.trim().length > DOC_NO_MAX) return `เลขที่ทำจ่ายยาวได้ไม่เกิน ${DOC_NO_MAX} ตัว`;
  return null;
}

// ---------------------------------------------------------------- แก้เลขที่เอกสารของรอบ (แบบ EditDocNumbersButton ของ Advance)

export type RoundDocField = 'voucher_no' | 'voucher_date' | 'pay_doc_no';
export type RoundDupField = 'voucher_no' | 'pay_doc_no';

export const ROUND_DOC_LABELS: Record<RoundDocField, string> = {
  voucher_no: 'เลขที่ตั้งเบิก', voucher_date: 'วันที่ตั้งเบิก', pay_doc_no: 'เลขที่ทำจ่าย',
};

/** ช่องที่เปลี่ยนจริง (ตัดช่องว่างแล้ว) เฉพาะช่องที่คนนี้แก้ได้ */
export function roundDocChanges(
  round: Pick<PettyRound, 'voucher_no' | 'voucher_date' | 'pay_doc_no'>,
  draft: Partial<Record<RoundDocField, string | null>>,
  fields: readonly RoundDocField[],
): Partial<Record<RoundDocField, string>> {
  const out: Partial<Record<RoundDocField, string>> = {};
  for (const f of fields) {
    const next = draft[f];
    if (next === undefined || next === null) continue;
    const text = String(next).trim();
    if (text !== String(round[f] ?? '').trim()) out[f] = text;
  }
  return out;
}

export function roundDocError(changes: Partial<Record<RoundDocField, string>>): string | null {
  const keys = Object.keys(changes) as RoundDocField[];
  if (!keys.length) return 'ยังไม่ได้แก้อะไร';
  if (changes.voucher_date !== undefined && !changes.voucher_date) return 'กรุณาระบุวันที่ตั้งเบิก';
  for (const f of ['voucher_no', 'pay_doc_no'] as const) {
    if ((changes[f] ?? '').length > DOC_NO_MAX) return `${ROUND_DOC_LABELS[f]}ยาวได้ไม่เกิน ${DOC_NO_MAX} ตัว`;
  }
  return null;
}

/** ข้อความเตือนเลขซ้ำกับรอบอื่น */
export function roundDuplicateText(field: RoundDupField, value: string, batchNos: readonly string[]): string {
  const shown = batchNos.slice(0, 5).join(', ') + (batchNos.length > 5 ? ` และอีก ${batchNos.length - 5} รอบ` : '');
  return `${ROUND_DOC_LABELS[field]} ${value.trim()} ซ้ำกับรอบ ${shown}`;
}

// ---------------------------------------------------------------- proxy: ส่งต่อเฉพาะช่องที่แต่ละคำสั่งใช้

export type RoundActionName = 'clear-approve' | 'clear-reject' | 'voucher' | 'pay' | 'doc-numbers';

const ACTION_FIELDS: Record<RoundActionName, readonly string[]> = {
  'clear-approve': [],
  'clear-reject': ['reason'],
  voucher: ['voucher_no', 'voucher_date'],
  pay: ['pay_date', 'pay_doc_no'],
  'doc-numbers': ['voucher_no', 'voucher_date', 'pay_doc_no', 'remark'],
};

export function roundActionBody(action: RoundActionName, body: unknown): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  if (!body || typeof body !== 'object' || Array.isArray(body)) return out;
  for (const key of ACTION_FIELDS[action]) {
    if (Object.prototype.hasOwnProperty.call(body, key)) out[key] = (body as Record<string, unknown>)[key];
  }
  return out;
}

// ---------------------------------------------------------------- ประวัติ

export const ROUND_LOG_LABELS: Record<string, string> = {
  SUBMIT_ROUND: 'ส่งเคลียร์', SUBMIT: 'ส่งเคลียร์', CREATE: 'ส่งเคลียร์',
  CLEAR_APPROVE: 'อนุมัติเคลียร์', CLEAR_REJECT: 'ไม่อนุมัติรอบ',
  VOUCHER: 'ตั้งเบิกทำจ่าย', PAY: 'จ่ายเงิน', PAY_CLOSE: 'จ่ายเงิน ปิดรอบ', CLOSE: 'ปิดรอบ',
  EDIT_DOC_NUMBERS: 'แก้ไขเลขที่เอกสาร',
};

export const CLAIM_LOG_LABELS: Record<string, string> = {
  CREATE: 'เปิดใบ', UPDATE: 'แก้ไขใบ', RESUBMIT: 'ส่งให้เจ้าของเงินสดอีกครั้ง', RESUBMIT_ACC: 'ส่งกลับให้บัญชี',
  APPROVE: 'อนุมัติจ่าย', RETURN: 'ตีกลับผู้เบิก', SET_DD: 'ใส่เลข DD', SUBMIT_ROUND: 'ส่งเคลียร์',
  CLEAR_APPROVE: 'หัวหน้าอนุมัติเคลียร์', CLEAR_REJECT: 'หัวหน้าไม่อนุมัติเคลียร์', ACC_PASS: 'บัญชีตรวจผ่าน',
  SEND_BACK: 'ส่งกลับแก้ไข', PAY_CLOSE: 'จ่ายเงิน ปิดใบ',
};

export const roundLogLabel = (action: string) => ROUND_LOG_LABELS[action] ?? action;

export type HistoryEntry = { key: string; action: string; label: string; actor: string | null; at: string | null; remark: string | null };

/** เก่าไปใหม่ (แบบประวัติของ Advance) · ไม่มีเวลาไปท้าย · เท่ากันคงลำดับเดิม */
function byTime(rows: HistoryEntry[]): HistoryEntry[] {
  const t = (at: string | null) => (at ? Date.parse(at) || Number.MAX_SAFE_INTEGER : Number.MAX_SAFE_INTEGER);
  return rows.map((r, i) => ({ r, i })).sort((a, b) => t(a.r.at) - t(b.r.at) || a.i - b.i).map(x => x.r);
}

function fromLogs(logs: readonly PettyRoundLog[], labels: Record<string, string>, prefix: string): HistoryEntry[] {
  return byTime(logs.map((l, i) => ({
    key: `${prefix}-${i}`, action: l.action, label: labels[l.action] ?? l.action,
    actor: l.actor_name ?? l.actor ?? null, at: l.at ?? null, remark: l.remark ?? null,
  })));
}

export function roundHistory(logs: readonly PettyRoundLog[] | null | undefined): HistoryEntry[] {
  return logs?.length ? fromLogs(logs, ROUND_LOG_LABELS, 'r') : [];
}

/** ประวัติใบ: ใช้ log จาก BE ถ้ามี ไม่มีก็ประกอบจากวันที่ที่อยู่ในใบ */
export function claimHistory(claim: PettyClaim): HistoryEntry[] {
  if (claim.logs?.length) return fromLogs(claim.logs, CLAIM_LOG_LABELS, 'c');
  const rows: HistoryEntry[] = [];
  if (claim.approved_at) {
    rows.push({ key: 'approve', action: 'APPROVE', label: 'อนุมัติจ่าย', actor: claim.approved_by_name ?? claim.approved_by,
      at: claim.approved_at, remark: claim.transfer_date ? `จ่าย ${day(claim.transfer_date)}` : null });
  }
  if (claim.status === 'RETURNED' && claim.return_reason) {
    rows.push({ key: 'return', action: 'RETURN', label: 'ตีกลับผู้เบิก', actor: null, at: null, remark: claim.return_reason });
  }
  if (claim.submitted_to_acc_at) {
    rows.push({ key: 'acc', action: 'CLEAR_APPROVE', label: 'ส่งถึงบัญชี', actor: null, at: claim.submitted_to_acc_at, remark: null });
  }
  if (claim.reviewed_at) {
    const sentBack = claim.status === 'SENT_BACK' || (claim.status === 'AWAITING_REVIEW' && !!claim.review_remark);
    const passed = claim.status === 'REVIEWED' || claim.status === 'CLOSED';
    rows.push({ key: 'review', action: sentBack ? 'SEND_BACK' : 'ACC_PASS',
      label: sentBack ? 'ส่งกลับแก้ไข' : passed ? 'บัญชีตรวจผ่าน' : 'บัญชีตรวจ',
      actor: claim.reviewed_by, at: claim.reviewed_at, remark: claim.review_remark });
  }
  return byTime(rows);
}
