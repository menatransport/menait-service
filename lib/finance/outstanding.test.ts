import { describe, expect, test } from 'bun:test';
import { OUTSTANDING_STATUSES, summarizeOutstanding } from './outstanding';

const item = (status: string, amount: number | null, overdue = false, form_id = 'ADV-X') =>
  ({ form_id, status, overdue, fin: amount === null ? null : { amount_paid: amount } });

describe('ยอดค้างเคลียร์ของผู้ขอเบิก (หน้าอนุมัติ, ผู้ใช้ 26/10/2026)', () => {
  test('นับเฉพาะใบที่จ่ายเงินแล้วแต่ยังไม่ปิด แยกอยู่ในกำหนด / เกินกำหนด', () => {
    const got = summarizeOutstanding([
      item('AWAITING_CLEARING', 1000),
      item('AWAITING_CLEARING', 2500.5, true),
      item('SENT_BACK', 300.25, true),
      item('CLEARING_APPROVAL', 400),
      item('AWAITING_REVIEW', 600),
      item('CLOSED', 9999),
      item('AWAITING_PAYMENT', 8888),
      item('PENDING_APPROVAL', null),
    ]);
    expect(got.total).toEqual({ count: 5, amount: 4800.75 });
    expect(got.overdue).toEqual({ count: 2, amount: 2800.75 });
    expect(got.on_time).toEqual({ count: 3, amount: 2000 });
  });
  test('ไม่มีใบค้าง = ศูนย์ทุกช่อง', () => {
    const zero = { count: 0, amount: 0 };
    expect(summarizeOutstanding([])).toEqual({ total: zero, on_time: zero, overdue: zero });
  });
  test('ยอดทศนิยมรวมแล้วไม่เพี้ยน', () => {
    expect(summarizeOutstanding([item('AWAITING_CLEARING', 0.1), item('AWAITING_CLEARING', 0.2)]).total.amount).toBe(0.3);
  });
  test('สถานะที่นับ = ใบที่การเงินจ่ายไปแล้วและยังไม่ปิด', () => {
    expect([...OUTSTANDING_STATUSES].sort()).toEqual(['AWAITING_CLEARING', 'AWAITING_REVIEW', 'CLEARING_APPROVAL', 'SENT_BACK']);
  });
});
