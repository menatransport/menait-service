import type { PettyClaim, PettyExpenseType, PettyFund } from '@/app/finance/types-petty';
import { PETTY_STATUS_LABELS } from '@/lib/finance/petty-status';

export const PETTY_EXPORT_COLUMNS = [
  'ลำดับ', 'เลขที่ใบเบิก', 'Project Code', 'สาขา', 'แผนก', 'ประเภท', 'จ่ายให้', 'พจส.', 'ช่วงวันที่', 'วันที่บนใบ',
  'จำนวนเงิน', 'สถานะ', 'เลขที่ DD', 'เจ้าหน้าที่ผู้เปิดใบ', 'ผู้อนุมัติ', 'วันที่อนุมัติ',
  'วันที่โอน', 'รอบคืนยอด',
] as const;

type Row = Record<(typeof PETTY_EXPORT_COLUMNS)[number], string | number | null>;

function thaiDate(iso: string | null | undefined): string {
  if (!iso) return '';
  const [y, m, d] = iso.slice(0, 10).split('-');
  return y && m && d ? `${d}/${m}/${y}` : '';
}

export function toPettySheetRows(
  claims: readonly PettyClaim[],
  types: readonly PettyExpenseType[],
  funds: readonly PettyFund[],
): Row[] {
  return claims.map((claim, index) => {
    const fund = funds.find(f => f.id === claim.fund_id);
    const period = claim.period_from && claim.period_to && claim.period_from !== claim.period_to
      ? `${thaiDate(claim.period_from)} – ${thaiDate(claim.period_to)}`
      : thaiDate(claim.period_from ?? claim.expense_date);
    return {
      'ลำดับ': index + 1,
      'เลขที่ใบเบิก': claim.form_id,
      'Project Code': claim.project_code ?? '',
      'สาขา': fund?.branch_code ?? '',
      'แผนก': fund?.division_code ?? '',
      'ประเภท': types.find(t => t.code === claim.expense_type)?.name_th ?? claim.expense_type,
      'จ่ายให้': claim.payee_name ?? '',
      'พจส.': claim.driver_name ?? '',
      'ช่วงวันที่': period,
      'วันที่บนใบ': thaiDate(claim.expense_date),
      'จำนวนเงิน': claim.amount,
      'สถานะ': PETTY_STATUS_LABELS[claim.status] ?? claim.status,
      'เลขที่ DD': claim.dd_no ?? '',
      'เจ้าหน้าที่ผู้เปิดใบ': claim.created_by,
      'ผู้อนุมัติ': claim.approved_by ?? '',
      'วันที่อนุมัติ': thaiDate(claim.approved_at),
      'วันที่โอน': thaiDate(claim.transfer_date),
      'รอบคืนยอด': claim.batch_id ?? '',
    };
  });
}

export async function exportPettyXlsx(
  claims: readonly PettyClaim[],
  types: readonly PettyExpenseType[],
  funds: readonly PettyFund[],
  fileName: string,
): Promise<void> {
  const XLSX = await import('xlsx');
  const sheet = XLSX.utils.json_to_sheet(toPettySheetRows(claims, types, funds),
    { header: [...PETTY_EXPORT_COLUMNS] });
  const book = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(book, sheet, 'เงินสดย่อย');
  XLSX.writeFile(book, fileName);
}
