import { expect, test } from 'bun:test';
import { EXPORT_COLUMNS, toSheetRows } from './export';
import type { AdvanceItem } from '@/app/finance/types';

const item: AdvanceItem = {
  form_id: 'ADV-2026-0001', submission_id: 5, created_at: '2026-07-07T03:00:00+00:00', status_approve: 'Approved',
  status: 'AWAITING_CLEARING', status_label: 'จ่ายแล้วรอเคลียร์', overdue: true,
  requester: { employee_id: '670001', name: 'อรณภัชชา จัตุรัส', department: 'HR', site: 'สำนักงานสระบุรี', site_code: 'สสบ.' },
  request: { purpose: 'ค่าแอร์', amount: 12740, use_date: '2026-07-09T00:00:00+00:00' },
  fin: {
    acc_code: '110102', acc_name: 'เงินสดย่อย-สระบุรี', voucher_no: 'SADV2607-005', voucher_date: '2026-07-07',
    payment_doc_no: null, purpose: 'ค่าแอร์', amount_paid: 12740, transfer_date: '2026-07-09', clear_due_date: '2026-07-16',
    paid_by: '680001', paid_at: null, clear_date: null, amount_actual: null, clear_doc_no: null, settle_amount: null,
    settle_date: null, remark: null, clear_submitted_at: null, review_remark: null, closed_by: null, closed_at: null,
    fin_status: 'PAID',
  },
};

test('rows follow the Excel sheet columns', () => {
  const [row] = toSheetRows([item]);
  expect(Object.keys(row)).toEqual([...EXPORT_COLUMNS]);
  expect(row['ลำดับ']).toBe(1);
  expect(row['ศูนย์']).toBe('สสบ.');
  expect(row['สถานะ']).toBe('จ่ายแล้วรอเคลียร์ (เกินกำหนด)');
  expect(row['วันที่โอนเงิน']).toBe('09/07/26');
  expect(row['กำหนดการเคลียร์']).toBe('16/07/26');
  expect(row['ยอดเงิน']).toBe(12740);
  expect(row['วันที่เคลียร์']).toBe('');
});
