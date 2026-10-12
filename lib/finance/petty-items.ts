import { round2 } from '@/lib/finance/status';

export type PettyItemDraft = {
  event_date?: string | null;
  truck_code?: string | null;
  truck_plate?: string | null;
  truck_type?: string | null;
  ref_no?: string | null;
  qty?: number | string | null;
  rate?: number | string | null;
  remark?: string | null;
};

/** ทะเบียน/รหัสรถให้เทียบกันได้ — ด่านซ้ำเข้มใช้ค่านี้เป็นคีย์ '71 4285' จึงต้องเท่ากับ '71-4285' */
export function normalizePlate(raw: string | null | undefined): string {
  if (!raw) return '';
  return raw.replace(/[^0-9A-Za-z฀-๿]/g, '').toUpperCase();
}

function num(v: number | string | null | undefined): number {
  if (v === null || v === undefined || v === '') return 0;
  const n = typeof v === 'number' ? v : Number(String(v).replace(/,/g, '').trim());
  return Number.isFinite(n) ? n : 0;
}

export function lineAmount(qty: number | string | null | undefined, rate: number | string | null | undefined): number {
  return round2(num(qty) * num(rate));
}

/** ยอดรวม = ผลรวมของยอดรายบรรทัดที่ปัดแล้ว ให้ตรงกับใบที่พิมพ์ */
export function claimTotal(items: readonly PettyItemDraft[]): number {
  return round2(items.reduce((sum, i) => sum + lineAmount(i.qty ?? 1, i.rate), 0));
}

export function periodOf(items: readonly PettyItemDraft[]): { from: string | null; to: string | null } {
  const dates = items.map(i => i.event_date).filter((d): d is string => !!d).sort();
  return dates.length ? { from: dates[0], to: dates[dates.length - 1] } : { from: null, to: null };
}

/** "161 144, F014\nF016" → ['161','144','F014','F016'] · คงของซ้ำไว้ ของจริงมีรถซ้ำในใบเดียว */
export function parseTruckPaste(raw: string): string[] {
  return raw.split(/[\s,;]+/).map(s => s.trim()).filter(Boolean);
}
