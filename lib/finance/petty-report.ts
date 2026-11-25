import type { PettyClaim, PettyExpenseType, PettyFund } from '@/app/finance/types-petty';
import { PETTY_STATUS_LABELS } from '@/lib/finance/petty-status';
import { round2 } from '@/lib/finance/status';
import { claimExpenseCode } from './petty-expense-code';
import { fundLabel } from './petty-fund-label';

/**
 * รายงาน Excel เงินสดย่อย (ผู้ใช้สั่ง 7/11/2026 ข้อ 14) — ชีต Summary รวมตามประเภทค่าใช้จ่าย × ประเภทรถ
 * และชีต Detail รายใบ · ยอด WHT และยอดจ่ายสุทธิ ตามตัวอย่างที่ผู้ใช้ส่ง · ช่วงวันที่ยึดวันที่โอน (ข้อ 4)
 */

/** คอลัมน์ฟลีท (ผู้ใช้สั่ง 17/11/2026 เปลี่ยนหัวจาก ประเภทรถ): ฟลีทจากแถวรายการ (Mixer S → MS · Mixer L → ML · อื่นตามชื่อ) · ใบไม่มีรถ = รหัสใบสำคัญจ่าย/แผนก */
export const FLEET_SHORT: Record<string, string> = { 'Mixer S': 'MS', 'Mixer L': 'ML', Trailer: 'TR', 'Side curtain': 'SC' };

/** ฟลีทแบบย่อของใบ (MS / ML / TR / SC · หลายฟลีทต่อด้วย +) · ใบไม่มีรถ = '' */
export function fleetShortOf(claim: Pick<PettyClaim, 'items'>): string {
  const items = claim.items ?? [];
  const fleets = [...new Set(items.map(i => (i.fleet ?? '').trim()).filter(Boolean))];
  if (fleets.length) return fleets.map(f => FLEET_SHORT[f] ?? f).join('+');
  const types = [...new Set(items.map(i => (i.truck_type ?? '').trim()).filter(Boolean))];
  return types.map(t => (t === 'โม่เล็ก' ? 'MS' : t === 'โม่ใหญ่' ? 'ML' : t)).join('+');
}

export function vehicleTypeOf(claim: PettyClaim): string {
  return fleetShortOf(claim) || claimExpenseCode(claim) || '-';
}

// ลำดับคอลัมน์ตามตัวอย่างของผู้ใช้ (16/11/2026): 7 คอลัมน์แรกตรงตัวอย่าง คอลัมน์ประกอบอยู่ขวาสุด
export type ReportDetailRow = {
  'ลำดับ': number; 'เลขที่ขอเบิก': string; 'ประเภทค่าใช้จ่าย': string; 'ฟลีท': string;
  'ยอดค่าใช้จ่าย': number; 'WHT': number; 'ยอดจ่ายสุทธิ': number;
  'วันที่โอน': string; 'วันที่ขอเบิก': string; 'รหัสใบสำคัญจ่าย': string; 'จ่ายให้': string; 'วงเงิน': string;
  'ผู้เปิดใบ': string; 'สถานะ': string; 'รหัสรอบส่งเคลียร์': string;
};
export type ReportSummaryRow = {
  'ประเภทค่าใช้จ่าย': string; 'ฟลีท': string; 'ยอดค่าใช้จ่าย': number; 'WHT': number; 'ยอดจ่ายสุทธิ': number;
  /** ใช้นับในเทสต์/หน้าจอ ไม่ลงชีต */
  'จำนวนใบ': number;
};

const typeName = (types: readonly PettyExpenseType[], code: string) => types.find(t => t.code === code)?.name_th ?? code;
const wht = (c: PettyClaim) => round2(Number(c.wht_amount ?? 0));
const net = (c: PettyClaim) => round2(c.amount - wht(c));

/** ใบที่โอนแล้วในช่วง (ยึดวันที่โอน) · ไม่ใส่ช่วง = ทุกใบที่มีวันที่โอน */
export function reportClaims(claims: readonly PettyClaim[], from?: string | null, to?: string | null): PettyClaim[] {
  return claims
    .filter(c => !!c.transfer_date && c.status !== 'RETURNED')
    .filter(c => (!from || c.transfer_date! >= from) && (!to || c.transfer_date! <= to))
    .sort((a, b) => (a.transfer_date! < b.transfer_date! ? -1 : a.transfer_date! > b.transfer_date! ? 1 : a.form_id.localeCompare(b.form_id)));
}

export function detailRows(claims: readonly PettyClaim[], types: readonly PettyExpenseType[], funds: readonly PettyFund[]): ReportDetailRow[] {
  return claims.map((c, i) => {
    const fund = funds.find(f => f.id === c.fund_id);
    return {
      'ลำดับ': i + 1, 'เลขที่ขอเบิก': c.form_id, 'ประเภทค่าใช้จ่าย': typeName(types, c.expense_type), 'ฟลีท': vehicleTypeOf(c),
      'ยอดค่าใช้จ่าย': round2(c.amount), 'WHT': wht(c), 'ยอดจ่ายสุทธิ': net(c),
      'วันที่โอน': c.transfer_date ?? '', 'วันที่ขอเบิก': c.expense_date, 'รหัสใบสำคัญจ่าย': claimExpenseCode(c),
      'จ่ายให้': c.payee_name ?? '', 'วงเงิน': fund ? fundLabel(fund) : String(c.fund_id),
      'ผู้เปิดใบ': c.created_by_name ?? c.created_by,
      'สถานะ': PETTY_STATUS_LABELS[c.status] ?? c.status, 'รหัสรอบส่งเคลียร์': c.batch_id ? String(c.batch_id) : '',
    };
  });
}

export function summaryRows(claims: readonly PettyClaim[], types: readonly PettyExpenseType[]): ReportSummaryRow[] {
  const buckets = new Map<string, ReportSummaryRow>();
  for (const c of claims) {
    const key = `${c.expense_type}|${vehicleTypeOf(c)}`;
    const row = buckets.get(key) ?? { 'ประเภทค่าใช้จ่าย': typeName(types, c.expense_type), 'ฟลีท': vehicleTypeOf(c), 'ยอดค่าใช้จ่าย': 0, 'WHT': 0, 'ยอดจ่ายสุทธิ': 0, 'จำนวนใบ': 0 };
    row['จำนวนใบ'] += 1;
    row['ยอดค่าใช้จ่าย'] = round2(row['ยอดค่าใช้จ่าย'] + c.amount);
    row['WHT'] = round2(row['WHT'] + wht(c));
    row['ยอดจ่ายสุทธิ'] = round2(row['ยอดจ่ายสุทธิ'] + net(c));
    buckets.set(key, row);
  }
  const rows = [...buckets.values()].sort((a, b) => a['ประเภทค่าใช้จ่าย'].localeCompare(b['ประเภทค่าใช้จ่าย']) || a['ฟลีท'].localeCompare(b['ฟลีท']));
  if (rows.length) rows.push(totalRow(rows));
  return rows;
}

function totalRow(rows: ReportSummaryRow[]): ReportSummaryRow {
  return {
    'ประเภทค่าใช้จ่าย': 'รวม', 'ฟลีท': '',
    'ยอดค่าใช้จ่าย': round2(rows.reduce((s, r) => s + r['ยอดค่าใช้จ่าย'], 0)),
    'WHT': round2(rows.reduce((s, r) => s + r['WHT'], 0)),
    'ยอดจ่ายสุทธิ': round2(rows.reduce((s, r) => s + r['ยอดจ่ายสุทธิ'], 0)),
    'จำนวนใบ': rows.reduce((s, r) => s + r['จำนวนใบ'], 0),
  };
}

const SUMMARY_COLS = ['ประเภทค่าใช้จ่าย', 'ฟลีท', 'ยอดค่าใช้จ่าย', 'WHT', 'ยอดจ่ายสุทธิ'] as const;
const DETAIL_COLS = ['ลำดับ', 'เลขที่ขอเบิก', 'ประเภทค่าใช้จ่าย', 'ฟลีท', 'ยอดค่าใช้จ่าย', 'WHT', 'ยอดจ่ายสุทธิ',
  'วันที่โอน', 'วันที่ขอเบิก', 'รหัสใบสำคัญจ่าย', 'จ่ายให้', 'วงเงิน', 'ผู้เปิดใบ', 'สถานะ', 'รหัสรอบส่งเคลียร์'] as const;
const MONEY_COLS = new Set<string>(['ยอดค่าใช้จ่าย', 'WHT', 'ยอดจ่ายสุทธิ']);

/** แถวของชีตเป็น array ตามลำดับคอลัมน์ · WHT = 0 เว้นว่างตามตัวอย่าง · แถวรวมท้ายตาราง */
export function sheetAoa(kind: 'summary' | 'detail', claims: readonly PettyClaim[], types: readonly PettyExpenseType[], funds: readonly PettyFund[]): (string | number)[][] {
  const cols: readonly string[] = kind === 'summary' ? SUMMARY_COLS : DETAIL_COLS;
  const summary = summaryRows(claims, types);
  const total = summary.find(r => r['ประเภทค่าใช้จ่าย'] === 'รวม');
  const body = (kind === 'summary' ? summary.filter(r => r !== total) : detailRows(claims, types, funds)) as Record<string, string | number>[];
  const cell = (k: string, v: string | number | undefined) => (k === 'WHT' && Number(v) === 0 ? '' : v ?? '');
  const out: (string | number)[][] = [[...cols], ...body.map(r => cols.map(k => cell(k, r[k])))];
  if (total) out.push(cols.map(k => (k === cols[0] ? 'รวม' : MONEY_COLS.has(k) ? cell(k, total[k as 'WHT']) : '')));
  return out;
}

export async function exportPettyReportXlsx(opts: {
  claims: readonly PettyClaim[]; types: readonly PettyExpenseType[]; funds: readonly PettyFund[];
  from?: string | null; to?: string | null; fileName: string;
}): Promise<number> {
  const picked = reportClaims(opts.claims, opts.from, opts.to);
  const XLSX = await import('xlsx');
  const book = XLSX.utils.book_new();
  const make = (kind: 'summary' | 'detail') => {
    const aoa = sheetAoa(kind, picked, opts.types, opts.funds);
    const ws = XLSX.utils.aoa_to_sheet(aoa);
    // ตัวเลขเงินโชว์ 1,234.00
    aoa[0].forEach((head, c) => {
      if (!MONEY_COLS.has(String(head))) return;
      for (let r = 1; r < aoa.length; r += 1) {
        const ref = XLSX.utils.encode_cell({ r, c });
        if (ws[ref] && typeof ws[ref].v === 'number') ws[ref].z = '#,##0.00';
      }
    });
    return ws;
  };
  const summary = make('summary');
  const detail = make('detail');
  summary['!cols'] = [{ wch: 22 }, { wch: 12 }, { wch: 16 }, { wch: 12 }, { wch: 16 }];
  detail['!cols'] = [{ wch: 6 }, { wch: 18 }, { wch: 20 }, { wch: 10 }, { wch: 14 }, { wch: 10 }, { wch: 14 },
    { wch: 12 }, { wch: 12 }, { wch: 14 }, { wch: 24 }, { wch: 26 }, { wch: 20 }, { wch: 22 }, { wch: 10 }];
  XLSX.utils.book_append_sheet(book, summary, 'Summary');
  XLSX.utils.book_append_sheet(book, detail, 'Detail');
  XLSX.writeFile(book, opts.fileName);
  return picked.length;
}
