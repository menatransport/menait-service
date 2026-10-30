/**
 * ตัวกรองหัวคอลัมน์แบบ Excel ของตารางเงินสดย่อย — เรียง ก→ฮ / ฮ→ก + รายการค่าให้ติ๊ก
 * ติ๊กไม่มีสักตัว = ไม่กรอง (ค่าเริ่มต้น) · ติ๊กแล้ว = เหลือเฉพาะค่าที่ติ๊ก
 * ไม่มี React เทสต์ได้ตรง ๆ
 */
import type { PettyClaim } from '@/app/finance/types-petty';
import { PETTY_STATUS_LABELS, type PettyStatus } from '@/lib/finance/petty-status';
import { formatBaht, formatDate, todayBkk } from '@/lib/finance/status';

/** ค่าในรายการติ๊กสำหรับช่องว่าง (ในตารางเห็นเป็น -) */
export const BLANK = '(ว่าง)';

export type SortDir = 'asc' | 'desc';
export type SortState = { key: string; dir: SortDir };
/** คอลัมน์ → ค่าที่ติ๊กไว้ (ไม่มี/ว่าง = ไม่กรอง) */
export type FilterState = Record<string, string[]>;

export type GridColumn<T> = {
  key: string;
  label: string;
  /** ค่าในรายการติ๊ก ('' = ว่าง) */
  value: (row: T) => string;
  /** ค่าที่ใช้เรียง — ไม่ระบุ = เรียงตาม value */
  sortValue?: (row: T) => string | number | null;
};

const sortKey = <T>(col: GridColumn<T>, row: T) => (col.sortValue ? col.sortValue(row) : col.value(row));
const asOption = (v: string) => (v.trim() === '' ? BLANK : v);

function compare(a: string | number | null, b: string | number | null): number {
  const ea = a === null || a === '', eb = b === null || b === '';
  if (ea || eb) return ea === eb ? 0 : ea ? 1 : -1; // ว่างไว้ท้ายเสมอ
  if (typeof a === 'number' && typeof b === 'number') return a - b;
  return String(a).localeCompare(String(b), 'th', { numeric: true });
}

/** เรียงคงลำดับเดิมเมื่อค่าเท่ากัน · ช่องว่างอยู่ท้ายทั้งสองทิศ */
export function sortRows<T>(rows: readonly T[], col: GridColumn<T>, dir: SortDir): T[] {
  return rows
    .map((row, i) => ({ row, i, k: sortKey(col, row) }))
    .sort((x, y) => {
      const blankX = x.k === null || x.k === '', blankY = y.k === null || y.k === '';
      if (blankX || blankY) return blankX === blankY ? x.i - y.i : blankX ? 1 : -1;
      const c = compare(x.k, y.k);
      return c === 0 ? x.i - y.i : dir === 'asc' ? c : -c;
    })
    .map(x => x.row);
}

export function activeFilterKeys(filters: FilterState): string[] {
  return Object.keys(filters).filter(k => (filters[k]?.length ?? 0) > 0);
}

/** แถวที่ผ่านทุกตัวกรอง (ยกเว้นคอลัมน์ except — ใช้ทำรายการติ๊กแบบ Excel ที่ขึ้นตามตัวกรองอื่น) */
export function applyFilters<T>(rows: readonly T[], columns: readonly GridColumn<T>[], filters: FilterState, except?: string): T[] {
  const active = activeFilterKeys(filters)
    .filter(k => k !== except)
    .map(k => ({ col: columns.find(c => c.key === k), picked: new Set(filters[k]) }))
    .filter((f): f is { col: GridColumn<T>; picked: Set<string> } => !!f.col);
  if (active.length === 0) return [...rows];
  return rows.filter(row => active.every(f => f.picked.has(asOption(f.col.value(row)))));
}

export type FilterOption = { value: string; count: number };

/** ค่าที่ไม่ซ้ำในคอลัมน์ เรียงตามค่าเรียงของคอลัมน์ (วันที่/เงิน/ขั้นสถานะ) · (ว่าง) อยู่ท้าย */
export function distinctOptions<T>(rows: readonly T[], col: GridColumn<T>): FilterOption[] {
  const seen = new Map<string, { count: number; k: string | number | null }>();
  for (const row of rows) {
    const v = asOption(col.value(row));
    const hit = seen.get(v);
    if (hit) hit.count += 1;
    else seen.set(v, { count: 1, k: v === BLANK ? null : sortKey(col, row) });
  }
  return [...seen.entries()]
    .sort(([, a], [, b]) => compare(a.k, b.k))
    .map(([value, { count }]) => ({ value, count }));
}

// ───────── คอลัมน์ของใบเบิกเงินสดย่อย ─────────

const TH_MONTHS = ['ม.ค.', 'ก.พ.', 'มี.ค.', 'เม.ย.', 'พ.ค.', 'มิ.ย.', 'ก.ค.', 'ส.ค.', 'ก.ย.', 'ต.ค.', 'พ.ย.', 'ธ.ค.'];
const STATUS_ORDER = Object.keys(PETTY_STATUS_LABELS) as PettyStatus[];

/** วันเริ่มของใบ (ช่วงวันที่ → วันแรก · ไม่มีช่วง → วันที่ใช้จ่าย) */
export const claimStartDate = (c: PettyClaim) => (c.period_from ?? c.expense_date ?? '').slice(0, 10);

/** "ต.ค. 2026" — ตัวกรองช่วงวันที่ติ๊กเป็นเดือน (ปีตามที่ตารางแสดง) */
export function monthLabel(isoDate: string): string {
  const [y, m] = isoDate.split('-');
  const i = Number(m) - 1;
  return y && TH_MONTHS[i] ? `${TH_MONTHS[i]} ${y}` : '';
}

export function periodText(c: PettyClaim): string {
  if (c.period_from && c.period_to) {
    return c.period_from === c.period_to ? formatDate(c.period_from) : `${formatDate(c.period_from)} – ${formatDate(c.period_to)}`;
  }
  return formatDate(c.expense_date);
}

/** วันที่เปิดใบตามเวลาไทย 'YYYY-MM-DD' ('' = ไม่มีข้อมูล) */
export function createdDate(c: PettyClaim): string {
  if (!c.created_at) return '';
  const d = new Date(c.created_at);
  return Number.isNaN(d.getTime()) ? '' : todayBkk(d);
}

/** เวลาเปิดใบ 'HH:mm' ตามเวลาไทย */
export function createdTime(c: PettyClaim): string {
  if (!c.created_at) return '';
  const d = new Date(c.created_at);
  return Number.isNaN(d.getTime()) ? '' : new Intl.DateTimeFormat('en-GB', { timeZone: 'Asia/Bangkok', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).format(d);
}

export const PETTY_COLUMN_KEYS = ['form_id', 'created', 'creator', 'type', 'payee', 'period', 'amount', 'dd', 'status'] as const;
export type PettyColumnKey = typeof PETTY_COLUMN_KEYS[number];

export function pettyColumns(typeName: (code: string) => string): GridColumn<PettyClaim>[] {
  return [
    { key: 'form_id', label: 'เลขที่ใบ', value: c => c.form_id, sortValue: c => c.id },
    { key: 'created', label: 'วันที่เปิดใบ', value: c => monthLabel(createdDate(c)), sortValue: c => c.created_at ?? null },
    { key: 'type', label: 'ประเภท', value: c => typeName(c.expense_type) },
    { key: 'creator', label: 'ผู้เปิดใบ', value: c => c.created_by_name ?? c.created_by },
    { key: 'payee', label: 'จ่ายให้', value: c => c.payee_name ?? '' },
    { key: 'period', label: 'ช่วงวันที่', value: c => monthLabel(claimStartDate(c)), sortValue: c => claimStartDate(c) || null },
    { key: 'amount', label: 'จำนวนเงิน', value: c => formatBaht(c.amount), sortValue: c => c.amount },
    { key: 'dd', label: 'DD', value: c => c.dd_no ?? '' },
    { key: 'status', label: 'สถานะ', value: c => PETTY_STATUS_LABELS[c.status], sortValue: c => STATUS_ORDER.indexOf(c.status) },
  ];
}
