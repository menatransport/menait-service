import type { AdvanceItem } from '@/app/finance/types';
import { bankLabel, formatAccountNo } from './bank';
import { formatDate } from './status';

export const EXPORT_COLUMNS = [
  'ลำดับ', 'เลขที่คำขอเบิกเงิน', 'ผู้เบิก', 'แผนก', 'ศูนย์', 'สถานะ', 'เลขที่ตั้งเบิก', 'วันที่ตั้งเบิก', 'เลขที่ทำจ่าย',
  'วันที่ใช้เงิน', 'วัตถุประสงค์', 'ยอดเงิน', 'วันที่โอนเงิน', 'กำหนดการเคลียร์', 'วันที่ส่งเอกสารเคลียร์', 'ยอดใช้จริง',
  'เลขที่เอกสารเคลียร์เงิน', 'ยอดเงินโอนคืนบริษัท', 'วันที่โอนเงินคืนบริษัท', 'หมายเหตุ',
  'ศูนย์ค่าใช้จ่าย', 'ธนาคาร', 'เลขที่บัญชี', 'ชื่อบัญชี',
] as const;

type Row = Record<(typeof EXPORT_COLUMNS)[number], string | number | null>;

const d = (value: string | null | undefined) => (value ? formatDate(value) : '');

export function toSheetRows(items: AdvanceItem[]): Row[] {
  return items.map((it, idx) => ({
    'ลำดับ': idx + 1,
    'เลขที่คำขอเบิกเงิน': it.form_id,
    'ผู้เบิก': it.requester.name ?? it.requester.employee_id,
    'แผนก': it.requester.department ?? '',
    'ศูนย์': it.requester.site_code ?? it.requester.site ?? '',
    'สถานะ': it.status_label + (it.overdue ? ' (เกินกำหนด)' : ''),
    'เลขที่ตั้งเบิก': it.fin?.voucher_no ?? '',
    'วันที่ตั้งเบิก': d(it.fin?.voucher_date),
    'เลขที่ทำจ่าย': it.fin?.payment_doc_no ?? '',
    'วันที่ใช้เงิน': d(it.request.use_date),
    'วัตถุประสงค์': it.fin?.purpose ?? it.request.purpose ?? '',
    'ยอดเงิน': it.fin?.amount_paid ?? it.request.amount ?? null,
    'วันที่โอนเงิน': d(it.fin?.transfer_date),
    'กำหนดการเคลียร์': d(it.fin?.clear_due_date),
    'วันที่ส่งเอกสารเคลียร์': d(it.fin?.clear_date),
    'ยอดใช้จริง': it.fin?.amount_actual ?? null,
    'เลขที่เอกสารเคลียร์เงิน': it.fin?.clear_doc_no ?? '',
    'ยอดเงินโอนคืนบริษัท': it.fin?.settle_amount ?? null,
    'วันที่โอนเงินคืนบริษัท': d(it.fin?.settle_date),
    'หมายเหตุ': it.fin?.remark ?? '',
    'ศูนย์ค่าใช้จ่าย': it.request.cost_center ?? '',
    'ธนาคาร': it.request.bank ? bankLabel(it.request.bank) : '',
    'เลขที่บัญชี': it.request.account_no ? formatAccountNo(it.request.account_no) : '',
    'ชื่อบัญชี': it.request.account_name ?? '',
  }));
}

export async function exportAdvancesXlsx(items: AdvanceItem[], fileName: string): Promise<void> {
  const XLSX = await import('xlsx');
  const sheet = XLSX.utils.json_to_sheet(toSheetRows(items), { header: [...EXPORT_COLUMNS] });
  const book = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(book, sheet, 'Advance');
  XLSX.writeFile(book, fileName);
}
