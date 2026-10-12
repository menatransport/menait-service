import { describe, expect, test } from 'bun:test';
import { pettyVoucherHtml, receiptSubstituteHtml } from './petty-voucher';
import type { PettyClaim, PettyFund } from '@/app/finance/types-petty';

const fund: PettyFund = {
  id: 1, branch_code: '03', division_code: 'B02',
  holder_employee_id: '12345', fund_limit: null, is_active: true,
};

const claim = {
  id: 1, form_id: '03-B02-2610-001', fund_id: 1, expense_type: 'WEIGH',
  expense_date: '2026-09-25', period_from: '2026-09-17', period_to: '2026-09-24',
  driver_employee_id: null, driver_name: null, payee_name: 'อัญชัญ น่วมมี',
  amount: 1640, dd_no: 'LBDD26090931', receipt_no: null, status: 'AWAITING_REVIEW',
  created_by: '55555', approved_by: '12345', approved_at: '2026-09-25T03:00:00Z',
  transfer_date: '2026-09-25', review_remark: null, return_reason: null,
  reviewed_by: null, reviewed_at: null, submitted_to_acc_at: null,
  dup_override_reason: null, batch_id: null,
  items: [
    ...['161', '144'].map((code, i) => ({ line_no: i + 1, event_date: '2026-09-17', truck_code: code,
      truck_plate: '71-4285', truck_type: 'โม่ใหญ่', ref_no: '00005' + i, qty: 1, rate: 100, amount: 100 })),
    { line_no: 3, event_date: '2026-09-24', truck_code: '165', truck_plate: '71-9001',
      truck_type: 'โม่เล็ก', ref_no: '000172', qty: 1, rate: 80, amount: 80 },
  ],
} as unknown as PettyClaim;

describe('pettyVoucherHtml', () => {
  const html = pettyVoucherHtml({ claim, fund, typeName: 'ค่าชั่งน้ำหนัก', payeePosition: 'เจ้าหน้าที่รับแจ้งซ่อม' });

  test('uses the system document number', () => expect(html).toContain('03-B02-2610-001'));
  test('no printer book/number fields any more', () => {
    expect(html).not.toContain('เล่มที่');
  });
  test('shows the branch and division of the fund', () => {
    expect(html).toContain('B02');
    expect(html).toContain('03');
  });
  test('groups rows by rate and truck type', () => {
    expect(html).toContain('ค่าชั่งน้ำหนักรถโม่ใหญ่ 100 บาท');
    expect(html).toContain('ค่าชั่งน้ำหนักรถโม่เล็ก 80 บาท');
  });
  test('truck codes land in the remark column', () => expect(html).toContain('161, 144'));
  test('total and baht text', () => {
    expect(html).toContain('280.00');
    expect(html).toContain('สองร้อยแปดสิบบาทถ้วน');
  });
  test('names the payee', () => expect(html).toContain('อัญชัญ น่วมมี'));
  test('stamps the approver e-signature', () => expect(html).toContain('e-Signature'));
  test('escapes data into HTML safely', () => {
    const nasty = { ...claim, payee_name: '<script>bad()</script>' } as PettyClaim;
    expect(pettyVoucherHtml({ claim: nasty, fund, typeName: 'x' })).not.toContain('<script>bad()');
  });
});

describe('receiptSubstituteHtml', () => {
  const html = receiptSubstituteHtml({ claim, fund, typeName: 'ค่าชั่งน้ำหนัก', payeePosition: 'เจ้าหน้าที่รับแจ้งซ่อม' });

  test('carries the branch in the five-digit form the paper uses', () =>
    expect(html).toContain('00003'));
  test('states the period, which is why the claim keeps two dates', () => {
    expect(html).toContain('17/09/2026');
    expect(html).toContain('24/09/2026');
  });
  test('includes the certifier position', () => expect(html).toContain('เจ้าหน้าที่รับแจ้งซ่อม'));
  test('baht text again', () => expect(html).toContain('สองร้อยแปดสิบบาทถ้วน'));
  test('a claim with no period falls back to the voucher date', () => {
    const noPeriod = { ...claim, period_from: null, period_to: null } as PettyClaim;
    expect(receiptSubstituteHtml({ claim: noPeriod, fund, typeName: 'x' })).toContain('25/09/2026');
  });
});

describe('หน่วยนับบนใบ มาจากประเภท ไม่ใช่ฮาร์ดโค้ด', () => {
  const tyreClaim = {
    ...claim,
    amount: 1200,
    items: [{ line_no: 1, event_date: '2026-09-15', truck_code: '6604', truck_plate: '72-8179',
      truck_type: 'โม่ใหญ่', ref_no: 'B-01', qty: 6, rate: 200, amount: 1200,
      remark: 'เปลี่ยนยาง 6 เส้น' }],
  } as unknown as PettyClaim;

  test('a tyre voucher counts in เส้น', () => {
    const html = pettyVoucherHtml({ claim: tyreClaim, fund, typeName: 'ค่าปะ-เปลี่ยนยาง', unit: 'เส้น' });
    expect(html).toContain('6 เส้น');
    expect(html).toContain('เปลี่ยนยาง 6 เส้น');
  });

  test('weighing still counts in คัน when no unit is given', () =>
    expect(pettyVoucherHtml({ claim, fund, typeName: 'ค่าชั่งน้ำหนัก' })).toContain('คัน'));

  test('the tyre total reads 1,200.00', () =>
    expect(pettyVoucherHtml({ claim: tyreClaim, fund, typeName: 'ค่าปะ-เปลี่ยนยาง', unit: 'เส้น' }))
      .toContain('1,200.00'));
});
