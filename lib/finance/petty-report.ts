import type { PettyClaim, PettyExpenseType, PettyFund } from '@/app/finance/types-petty';
import { PETTY_STATUS_LABELS } from '@/lib/finance/petty-status';
import { round2 } from '@/lib/finance/status';
import { claimExpenseCode } from './petty-expense-code';
import { fundLabel } from './petty-fund-label';

/**
 * รายงาน Excel เงินสดย่อย (ผู้ใช้สั่ง 7/11/2026 ข้อ 14) — ชีต Summary รวมตามประเภทค่าใช้จ่าย × ประเภทรถ
 * และชีต Detail รายใบ · ยอด WHT และยอดจ่ายสุทธิ ตามตัวอย่างที่ผู้ใช้ส่ง · ช่วงวันที่ยึดวันที่โอน (ข้อ 4)
 */

/** ประเภทรถของใบ: ฟลีทจากแถวรายการ (Mixer S → MS · Mixer L → ML · อื่นตามชื่อ) · ใบไม่มีรถ = รหัสใบสำคัญจ่าย/แผนก */
export const FLEET_SHORT: Record<string, string> = { 'Mixer S': 'MS', 'Mixer L': 'ML', Trailer: 'TR', 'Side curtain': 'SC' };

export function vehicleTypeOf(claim: PettyClaim): string {
  const fleets = [...new Set(claim.items.map(i => (i.fleet ?? '').trim()).filter(Boolean))];
  if (fleets.length === 0) {
    const types = [...new Set(claim.items.map(i => (i.truck_type ?? '').trim()).filter(Boolean))];
    const byType = types.map(t => (t === 'โม่เล็ก' ? 'MS' : t === 'โม่ใหญ่' ? 'ML' : t));
    if (byType.length) return byType.join('+');
    return claimExpenseCode(claim) || '-';
  }
  return fleets.map(f => FLEET_SHORT[f] ?? f).join('+');
}

export type ReportDetailRow = {
  'ลำดับ': number; 'เลขที่ขอเบิก': string; 'วันที่โอน': string; 'วันที่ขอเบิก': string;
  'ประเภทค่าใช้จ่าย': string; 'ประเภทรถ': string; 'รหัสใบสำคัญจ่าย': string; 'จ่ายให้': string; 'วงเงิน': string;
  'ผู้เปิดใบ': string; 'ยอดค่าใช้จ่าย': number; 'WHT': number; 'ยอดจ่ายสุทธิ': number; 'สถานะ': string; 'รหัสรอบส่งเคลียร์': string;
};
export type ReportSummaryRow = {
  'ประเภทค่าใช้จ่าย': string; 'ประเภทรถ': string; 'จำนวนใบ': number; 'ยอดค่าใช้จ่าย': number; 'WHT': number; 'ยอดจ่ายสุทธิ': number;
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
      'ลำดับ': i + 1, 'เลขที่ขอเบิก': c.form_id, 'วันที่โอน': c.transfer_date ?? '', 'วันที่ขอเบิก': c.expense_date,
      'ประเภทค่าใช้จ่าย': typeName(types, c.expense_type), 'ประเภทรถ': vehicleTypeOf(c), 'รหัสใบสำคัญจ่าย': claimExpenseCode(c),
      'จ่ายให้': c.payee_name ?? '', 'วงเงิน': fund ? fundLabel(fund) : String(c.fund_id),
      'ผู้เปิดใบ': c.created_by_name ?? c.created_by, 'ยอดค่าใช้จ่าย': c.amount, 'WHT': wht(c), 'ยอดจ่ายสุทธิ': net(c),
      'สถานะ': PETTY_STATUS_LABELS[c.status] ?? c.status, 'รหัสรอบส่งเคลียร์': c.batch_id ? String(c.batch_id) : '',
    };
  });
}

export function summaryRows(claims: readonly PettyClaim[], types: readonly PettyExpenseType[]): ReportSummaryRow[] {
  const buckets = new Map<string, ReportSummaryRow>();
  for (const c of claims) {
    const key = `${c.expense_type}|${vehicleTypeOf(c)}`;
    const row = buckets.get(key) ?? { 'ประเภทค่าใช้จ่าย': typeName(types, c.expense_type), 'ประเภทรถ': vehicleTypeOf(c), 'จำนวนใบ': 0, 'ยอดค่าใช้จ่าย': 0, 'WHT': 0, 'ยอดจ่ายสุทธิ': 0 };
    row['จำนวนใบ'] += 1;
    row['ยอดค่าใช้จ่าย'] = round2(row['ยอดค่าใช้จ่าย'] + c.amount);
    row['WHT'] = round2(row['WHT'] + wht(c));
    row['ยอดจ่ายสุทธิ'] = round2(row['ยอดจ่ายสุทธิ'] + net(c));
    buckets.set(key, row);
  }
  const rows = [...buckets.values()].sort((a, b) => a['ประเภทค่าใช้จ่าย'].localeCompare(b['ประเภทค่าใช้จ่าย']) || a['ประเภทรถ'].localeCompare(b['ประเภทรถ']));
  if (rows.length) rows.push(totalRow(rows));
  return rows;
}

function totalRow(rows: ReportSummaryRow[]): ReportSummaryRow {
  return {
    'ประเภทค่าใช้จ่าย': 'รวม', 'ประเภทรถ': '',
    'จำนวนใบ': rows.reduce((s, r) => s + r['จำนวนใบ'], 0),
    'ยอดค่าใช้จ่าย': round2(rows.reduce((s, r) => s + r['ยอดค่าใช้จ่าย'], 0)),
    'WHT': round2(rows.reduce((s, r) => s + r['WHT'], 0)),
    'ยอดจ่ายสุทธิ': round2(rows.reduce((s, r) => s + r['ยอดจ่ายสุทธิ'], 0)),
  };
}

export async function exportPettyReportXlsx(opts: {
  claims: readonly PettyClaim[]; types: readonly PettyExpenseType[]; funds: readonly PettyFund[];
  from?: string | null; to?: string | null; fileName: string;
}): Promise<number> {
  const picked = reportClaims(opts.claims, opts.from, opts.to);
  const XLSX = await import('xlsx');
  const book = XLSX.utils.book_new();
  const summary = XLSX.utils.json_to_sheet(summaryRows(picked, opts.types));
  const detail = XLSX.utils.json_to_sheet(detailRows(picked, opts.types, opts.funds));
  const detailTotal = totalRow(summaryRows(picked, opts.types).filter(r => r['ประเภทค่าใช้จ่าย'] !== 'รวม'));
  XLSX.utils.sheet_add_aoa(detail, [['รวม', '', '', '', '', '', '', '', '', '', detailTotal['ยอดค่าใช้จ่าย'], detailTotal['WHT'], detailTotal['ยอดจ่ายสุทธิ']]], { origin: -1 });
  summary['!cols'] = [{ wch: 22 }, { wch: 12 }, { wch: 10 }, { wch: 16 }, { wch: 12 }, { wch: 16 }];
  detail['!cols'] = [{ wch: 6 }, { wch: 18 }, { wch: 12 }, { wch: 12 }, { wch: 20 }, { wch: 10 }, { wch: 14 }, { wch: 24 }, { wch: 26 }, { wch: 20 }, { wch: 14 }, { wch: 10 }, { wch: 14 }, { wch: 22 }, { wch: 10 }];
  XLSX.utils.book_append_sheet(book, summary, 'Summary');
  XLSX.utils.book_append_sheet(book, detail, 'Detail');
  XLSX.writeFile(book, opts.fileName);
  return picked.length;
}
