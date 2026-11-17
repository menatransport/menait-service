import { describe, expect, test } from 'bun:test';
import type { PettyClaim } from '@/app/finance/types-petty';
import { canEditReturned, editPrefill, fileCounts, itemDraftsFrom, withoutOwnClaim } from './petty-edit';

const claim = {
  id: 1, form_id: 'LB-B02-2611-500', fund_id: 7, expense_type: 'WEIGH', expense_date: '2026-11-15',
  period_from: null, period_to: null, driver_employee_id: null, driver_name: null, payee_name: 'สถานีชั่ง',
  detail: { payee_name: 'สถานีชั่ง', driver_role: 'พจส.' }, amount: 600, dd_no: 'DD1', receipt_no: null,
  expense_code: '3200', wht_amount: 6, status: 'RETURNED', created_by: '680001', cost_center: '3B02',
  return_reason: 'ยอดผิด',
  items: [{ event_date: '2026-11-14', truck_code: 'ME147', truck_plate: '71-4285', qty: 2, rate: 300, amount: 600,
    fleet: 'Mixer L', driver_role: 'พจส.', driver_name: 'สมชาย', driver_code: '650001' }],
} as unknown as PettyClaim;

describe('แก้ใบที่ถูกตีกลับ', () => {
  test('แก้ได้เฉพาะผู้เปิดใบ และเฉพาะใบที่ตีกลับ', () => {
    expect(canEditReturned(claim, '680001')).toBe(true);
    expect(canEditReturned(claim, '680002')).toBe(false);
    expect(canEditReturned({ ...claim, status: 'PENDING_APPROVAL' } as PettyClaim, '680001')).toBe(false);
    expect(canEditReturned({ ...claim, status: 'SENT_BACK' } as PettyClaim, '680001')).toBe(false);
    expect(canEditReturned(null, '680001')).toBe(false);
  });

  test('ค่าตั้งต้นจากใบเดิมครบ: ประเภท วงเงิน ศูนย์ หัวใบ แถว DD WHT รหัส', () => {
    const p = editPrefill(claim);
    expect([p.typeCode, p.fundId, p.costCenter, p.ddNo, p.wht, p.expenseCode]).toEqual(['WEIGH', '7', '3B02', 'DD1', '6.00', '3200']);
    expect(p.header).toMatchObject({ expense_date: '2026-11-15', payee_name: 'สถานีชั่ง', driver_role: 'พจส.' });
    expect(p.rows[0]).toMatchObject({ truck_code: 'ME147', qty: 2, rate: 300, fleet: 'Mixer L', driver_code: '650001' });
  });

  test('ไม่มี WHT = ช่องว่าง · แถวไม่มีช่อง amount (BE คำนวณเอง)', () => {
    const p = editPrefill({ ...claim, wht_amount: 0 } as PettyClaim);
    expect(p.wht).toBe('');
    expect('amount' in itemDraftsFrom(claim)[0]).toBe(false);
  });

  test('นับไฟล์เดิมตามหมวด', () => {
    expect(fileCounts([{ folder: 'weigh_ticket' }, { folder: 'weigh_ticket' }, { folder: null }])).toEqual({ weigh_ticket: 2, request: 1 });
  });

  test('เตือนซ้ำไม่นับแถวของใบตัวเอง', () => {
    const hints = [{ form_id: 'LB-B02-2611-500' }, { form_id: 'LB-B02-2611-372' }];
    expect(withoutOwnClaim(hints, 'LB-B02-2611-500')).toEqual([{ form_id: 'LB-B02-2611-372' }]);
    expect(withoutOwnClaim(hints, null)).toHaveLength(2);
  });
});
