import { describe, expect, test } from 'bun:test';
import { PETTY_EXPORT_COLUMNS, toPettySheetRows } from './petty-export';
import type { PettyClaim, PettyExpenseType, PettyFund } from '@/app/finance/types-petty';

const funds = [{ id: 1, branch_code: '03', division_code: 'B02', holder_employee_id: '12345',
  fund_limit: null, is_active: true }] as PettyFund[];
const types = [{ code: 'WEIGH', name_th: 'ค่าชั่งน้ำหนัก' }] as PettyExpenseType[];

const claim = {
  id: 1, form_id: 'LB-B02-2610-001', fund_id: 1, expense_type: 'WEIGH',
  expense_date: '2026-09-25', period_from: '2026-09-17', period_to: '2026-09-24',
  payee_name: 'อัญชัญ น่วมมี', driver_name: null, amount: 1640, dd_no: 'LBDD26090931',
  status: 'CLOSED', created_by: '55555', approved_by: '12345',
  approved_at: '2026-09-25T03:00:00Z', transfer_date: '2026-09-25',
  batch_id: 7, items: [],
} as unknown as PettyClaim;

describe('toPettySheetRows', () => {
  const [row] = toPettySheetRows([claim], types, funds);

  test('every column is present', () =>
    expect(Object.keys(row).sort()).toEqual([...PETTY_EXPORT_COLUMNS].sort()));
  test('branch and division come from the fund', () => {
    expect(row['สาขา']).toBe('03');
    expect(row['แผนก']).toBe('B02');
  });
  test('type shows the Thai name', () => expect(row['ประเภท']).toBe('ค่าชั่งน้ำหนัก'));
  test('status shows the Thai label, not the code', () => expect(row['สถานะ']).toBe('คืนยอดแล้ว'));
  test('period is a range when the claim spans days', () =>
    expect(row['ช่วงวันที่']).toBe('17/09/2026 – 24/09/2026'));
  test('amount stays a number so Excel can sum it', () => expect(row['จำนวนเงิน']).toBe(1640));
  test('a missing DD is blank, not the word null', () => {
    const [r] = toPettySheetRows([{ ...claim, dd_no: null } as PettyClaim], types, funds);
    expect(r['เลขที่ DD']).toBe('');
  });
  test('an unknown fund leaves branch blank instead of crashing', () => {
    const [r] = toPettySheetRows([{ ...claim, fund_id: 99 } as PettyClaim], types, []);
    expect(r['สาขา']).toBe('');
  });
  test('running number per row', () => {
    const rows = toPettySheetRows([claim, { ...claim, id: 2 } as PettyClaim], types, funds);
    expect(rows.map(r => r['ลำดับ'])).toEqual([1, 2]);
  });
  test('empty input gives no rows', () => expect(toPettySheetRows([], types, funds)).toEqual([]));
});

describe('ไฟล์ส่งบัญชีไม่มีคอลัมน์ Project Code', () => {
  test('คอลัมน์หายไป', () => expect(PETTY_EXPORT_COLUMNS).not.toContain('Project Code'));
  test('เลขที่ใบเป็นแบบตัวอักษรสาขา', () =>
    expect(toPettySheetRows([claim], types, funds)[0]['เลขที่ใบเบิก']).toBe('LB-B02-2610-001'));
});
