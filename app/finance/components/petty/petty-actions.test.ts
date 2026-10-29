import { describe, expect, test } from 'bun:test';
import type { PettyClaim } from '@/app/finance/types-petty';
import { approveDialogHtml } from './petty-actions';

const claim = (over: Partial<PettyClaim> = {}): PettyClaim => ({
  id: 1, form_id: 'LB-B02-2610-001', fund_id: 1, expense_type: 'TIRE', expense_date: '2026-10-20',
  period_from: null, period_to: null, driver_employee_id: null, driver_name: null, payee_name: 'ร้านยาง',
  detail: { payee_type: 'บุคคล/ร้านเงินสด' }, amount: 1200, dd_no: null, receipt_no: null, status: 'PENDING_APPROVAL',
  created_by: '680043', approved_by: null, approved_at: null, transfer_date: null, review_remark: null, return_reason: null,
  reviewed_by: null, reviewed_at: null, submitted_to_acc_at: null, dup_override_reason: null, batch_id: null,
  items: [{ event_date: '2026-10-20', qty: 1, rate: 1200, amount: 1200, driver_role: 'พจส.' }], ...over,
});

describe('approveDialogHtml — กล่องยืนยันอนุมัติจ่ายแบบ Advance + ตัวเลขของเงินสดย่อย', () => {
  test('starts with the form line like Advance ("ฟอร์ม …")', () => {
    const html = approveDialogHtml(claim(), { available: 25660 });
    expect(html.indexOf('ฟอร์ม LB-B02-2610-001')).toBeGreaterThan(-1);
    expect(html.indexOf('ฟอร์ม LB-B02-2610-001')).toBeLessThan(html.indexOf('ยอดคงเหลือของคุณ'));
  });
  test('keeps balance, after-approval balance and the real transfer amount', () => {
    const html = approveDialogHtml(claim(), { available: 25660 });
    expect(html).toContain('ยอดคงเหลือของคุณ');
    expect(html).toContain('25,660.00');
    expect(html).toContain('หลังอนุมัติใบนี้');
    expect(html).toContain('24,460.00');
    expect(html).toContain('ยอดที่ต้องโอนจริง');
  });
  test('says when the balance could not be loaded', () => {
    expect(approveDialogHtml(claim(), null)).toContain('โหลดยอดคงเหลือไม่ได้');
  });
  test('shows the debt-acknowledgment number when a row is พจร.', () => {
    const c = claim({ items: [{ event_date: '2026-10-20', qty: 1, rate: 1200, amount: 1200, driver_role: 'พจร.' }] });
    expect(approveDialogHtml(c, { available: 5000 }, 'DA-001')).toContain('ใบรับสภาพหนี้เลขที่ DA-001');
    expect(approveDialogHtml(claim(), { available: 5000 })).not.toContain('ใบรับสภาพหนี้');
  });
  test('escapes the form id', () => {
    expect(approveDialogHtml(claim({ form_id: '<b>x</b>' }), null)).toContain('&lt;b&gt;x&lt;/b&gt;');
  });
});
