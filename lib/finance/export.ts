import type { AdvanceItem } from '@/app/finance/types';
import { formatDate } from './status';

export const EXPORT_COLUMNS = [
  'ลำดับ', 'เลขที่เอกสาร', 'ผู้เบิก', 'แผนก', 'ศูนย์', 'สถานะ', 'เลขที่ใบเบิก', 'วันที่ตั้งเบิก', 'วันที่ใช้เงิน',
  'เลขที่เอกสารจ่าย', 'วัตถุประสงค์', 'ยอดเงิน', 'วันที่โอนเงิน', 'กำหนดการเคลียร์', 'วันที่เคลียร์', 'ยอดใช้จริง',
  'เอกสารเคลียร์', 'รับคืน (เบิกเพิ่ม)', 'วันที่โอนเงินคืน', 'หมายเหตุ', 'รหัสบัญชี',
] as const;

type Row = Record<(typeof EXPORT_COLUMNS)[number], string | number | null>;

const d = (value: string | null | undefined) => (value ? formatDate(value) : '');

export function toSheetRows(items: AdvanceItem[]): Row[] {
  return items.map((it, idx) => ({
    'ลำดับ': idx + 1,
    'เลขที่เอกสาร': it.form_id,
    'ผู้เบิก': it.requester.name ?? it.requester.employee_id,
    'แผนก': it.requester.department ?? '',
    'ศูนย์': it.requester.site_code ?? it.requester.site ?? '',
    'สถานะ': it.status_label + (it.overdue ? ' (เกินกำหนด)' : ''),
    'เลขที่ใบเบิก': it.fin?.voucher_no ?? '',
    'วันที่ตั้งเบิก': d(it.fin?.voucher_date),
    'วันที่ใช้เงิน': d(it.request.use_date),
    'เลขที่เอกสารจ่าย': it.fin?.payment_doc_no ?? '',
    'วัตถุประสงค์': it.fin?.purpose ?? it.request.purpose ?? '',
    'ยอดเงิน': it.fin?.amount_paid ?? it.request.amount ?? null,
    'วันที่โอนเงิน': d(it.fin?.transfer_date),
    'กำหนดการเคลียร์': d(it.fin?.clear_due_date),
    'วันที่เคลียร์': d(it.fin?.clear_date),
    'ยอดใช้จริง': it.fin?.amount_actual ?? null,
    'เอกสารเคลียร์': it.fin?.clear_doc_no ?? '',
    'รับคืน (เบิกเพิ่ม)': it.fin?.settle_amount ?? null,
    'วันที่โอนเงินคืน': d(it.fin?.settle_date),
    'หมายเหตุ': it.fin?.remark ?? '',
    'รหัสบัญชี': it.fin?.acc_code ?? '',
  }));
}

export async function exportAdvancesXlsx(items: AdvanceItem[], fileName: string): Promise<void> {
  const XLSX = await import('xlsx');
  const sheet = XLSX.utils.json_to_sheet(toSheetRows(items), { header: [...EXPORT_COLUMNS] });
  const book = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(book, sheet, 'Advance');
  XLSX.writeFile(book, fileName);
}
