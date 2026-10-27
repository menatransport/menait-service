import type { AdvanceItem } from '@/app/finance/types';
import { normalizeAccountNo } from './bank';
import { EXPORT_COLUMNS, toSheetRow, type ExportColumn } from './export';
import { STATUS_LABELS, formatBaht, settleLabel } from './status';

/**
 * ตัวกรองรายคอลัมน์ในตารางฝ่ายการเงิน (/finance) กรองในเบราว์เซอร์จากข้อความเดียวกับที่ตาราง/Excel แสดง
 * แผนกกับศูนย์ค่าใช้จ่ายไม่ได้มาทางนี้ หน้าเว็บส่งไปให้ BE กรองเหมือนเดิม (ตัวเลขบนแท็บจะได้ตรง)
 */
export type ColumnFilters = Partial<Record<ExportColumn, string>>;

/** ทุกคอลัมน์ ยกเว้นลำดับ (เลขแถว) */
export const FILTER_COLUMNS: ExportColumn[] = EXPORT_COLUMNS.filter(c => c !== 'ลำดับ');

/** คอลัมน์ที่ BE กรองให้ (ใช้ตัวเลือกจาก response.options) */
export const SERVER_FILTER_COLUMNS = new Set<ExportColumn>(['แผนก', 'ศูนย์ค่าใช้จ่าย']);

export const MONEY_FILTER_COLUMNS = new Set<ExportColumn>(['ยอดเงิน', 'ยอดใช้จริง', 'ยอดเงินโอนคืนบริษัท']);

export const DATE_FILTER_COLUMNS = new Set<ExportColumn>([
  'วันที่ตั้งเบิก', 'วันที่ใช้เงิน', 'วันที่โอนเงิน', 'กำหนดการเคลียร์', 'วันที่ส่งเอกสารเคลียร์', 'วันที่โอนเงินคืนบริษัท',
]);

/** ค่าในช่องสถานะสำหรับ "เกินกำหนด" (ไม่ใช่สถานะจริง เป็นธงที่ติดกับใบ) */
export const OVERDUE_FILTER = 'OVERDUE';

/** "รับคืน 500.00 บาท" (พนักงานคืนเงิน) / "เบิกเพิ่ม 450.00 บาท" (บริษัทจ่ายเพิ่ม) / "พอดี" */
export function settleText(amount: number | null | undefined): string | null {
  if (amount === null || amount === undefined) return null;
  if (amount === 0) return 'พอดี';
  return `${settleLabel(amount)} ${formatBaht(Math.abs(amount))} บาท`;
}

export function hasColumnFilters(filters: ColumnFilters): boolean {
  return Object.values(filters).some(v => (v ?? '').trim() !== '');
}

type NumberOp = '>' | '<' | '>=' | '<=' | '=';

/** '>1,000' → { op: '>', value: 1000 } · ไม่มีเครื่องหมายนำหน้าหรือตัวเลขผิด → null */
export function parseNumberFilter(raw: string): { op: NumberOp; value: number } | null {
  const m = /^(>=|<=|>|<|=)\s*(-?[\d,]*\.?\d+)$/.exec(raw.trim());
  if (!m) return null;
  const value = Number(m[2].replace(/,/g, ''));
  return Number.isFinite(value) ? { op: m[1] as NumberOp, value } : null;
}

function compare(n: number, op: NumberOp, value: number): boolean {
  const a = Math.round(n * 100), b = Math.round(value * 100); // สตางค์ ไม่ให้ทศนิยมลอยเพี้ยน
  switch (op) {
    case '>': return a > b;
    case '<': return a < b;
    case '>=': return a >= b;
    case '<=': return a <= b;
    default: return a === b;
  }
}

/** ตัดลูกน้ำ ยุบเว้นวรรค ตัวพิมพ์เล็ก: "1,500" กับ "1500.00" จะได้หาเจอกัน */
const norm = (s: string) => s.toLowerCase().replace(/,/g, '').replace(/\s+/g, ' ').trim();

function moneyValue(item: AdvanceItem, col: ExportColumn): number | null {
  if (col === 'ยอดเงิน') return item.fin?.amount_paid ?? item.request.amount ?? null;
  if (col === 'ยอดใช้จริง') return item.fin?.amount_actual ?? null;
  const settle = item.fin?.settle_amount;
  return settle === null || settle === undefined ? null : Math.abs(settle);
}

/** ข้อความที่ใช้ค้นในคอลัมน์นั้น ('' = ช่องว่าง ในตารางเห็นเป็น -) */
function cellTexts(item: AdvanceItem, col: ExportColumn, row: ReturnType<typeof toSheetRow>): string[] {
  if (col === 'ยอดเงิน' || col === 'ยอดใช้จริง') {
    const n = moneyValue(item, col);
    return [n === null ? '' : formatBaht(n)];
  }
  if (col === 'ยอดเงินโอนคืนบริษัท') return [settleText(item.fin?.settle_amount) ?? ''];
  if (col === 'ธนาคาร') return [String(row[col] ?? ''), item.request.bank ?? ''];
  if (col === 'เลขที่บัญชี') return [String(row[col] ?? ''), normalizeAccountNo(item.request.account_no)];
  return [String(row[col] ?? '')];
}

function matchesColumn(item: AdvanceItem, col: ExportColumn, raw: string, row: ReturnType<typeof toSheetRow>): boolean {
  const f = raw.trim();
  if (col === 'สถานะ') {
    if (f === OVERDUE_FILTER) return item.overdue;
    if (f in STATUS_LABELS) return item.status === f;
  }
  const texts = cellTexts(item, col, row);
  if (f === '-') return texts.every(t => t.trim() === '');
  if (MONEY_FILTER_COLUMNS.has(col)) {
    const num = parseNumberFilter(f);
    if (num) {
      const n = moneyValue(item, col);
      return n !== null && compare(n, num.op, num.value);
    }
  }
  const needle = norm(f);
  return texts.some(t => norm(t).includes(needle));
}

/** ใบนี้ผ่านทุกช่องที่กรอกไหม (ช่องว่างไม่นับ) */
export function matchesColumnFilters(item: AdvanceItem, filters: ColumnFilters): boolean {
  const active = (Object.entries(filters) as [ExportColumn, string | undefined][]).filter(([, v]) => (v ?? '').trim() !== '');
  if (active.length === 0) return true;
  const row = toSheetRow(item, 0);
  return active.every(([col, v]) => matchesColumn(item, col, v!, row));
}

export function applyColumnFilters(items: AdvanceItem[], filters: ColumnFilters): AdvanceItem[] {
  if (!hasColumnFilters(filters)) return items;
  return items.filter(it => matchesColumnFilters(it, filters));
}
