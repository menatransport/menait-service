import { describe, expect, test } from 'bun:test';
import type { AdvanceItem } from '@/app/finance/types';
import {
  FILTER_COLUMNS, OVERDUE_FILTER, applyColumnFilters, hasColumnFilters, matchesColumnFilters, parseNumberFilter, settleText,
} from './columnFilters';

const base: AdvanceItem = {
  form_id: 'ADV-2610-018', submission_id: 5, created_at: '2026-10-26T03:00:00+00:00', status_approve: 'Approved',
  status: 'AWAITING_CLEARING', status_label: 'จ่ายแล้วรอเคลียร์', overdue: false,
  requester: { employee_id: '670001', name: 'วรรษชล อุ่ยวิรัตน์', department: 'แผนกบัญชี', site: 'ลาดกระบัง', site_code: 'ศลบ.' },
  request: {
    purpose: 'จ่ายเงินสดย่อย 30-31/10/26', amount: 5000, use_date: '2026-10-30', cost_center: 'ศลบ', bank: 'KBANK',
    bank_label: 'ธนาคารกสิกรไทย', account_no: '1234567890', account_name: 'นาย ก',
  },
  fin: {
    acc_code: null, acc_name: null, voucher_no: 'LADV2610-010', voucher_date: '2026-10-26', payment_doc_no: 'Test-00002',
    purpose: 'จ่ายเงินสดย่อย 30-31/10/26', amount_paid: 5000, transfer_date: '2026-10-29', clear_due_date: '2026-11-05',
    paid_by: null, paid_at: null, clear_date: null, amount_actual: null, clear_doc_no: null, settle_amount: null,
    settle_date: null, remark: null, clear_submitted_at: null, review_remark: null, closed_by: null, closed_at: null,
    fin_status: 'PAID',
  },
};
const withFin = (fin: Partial<NonNullable<AdvanceItem['fin']>>): AdvanceItem => ({ ...base, fin: { ...base.fin!, ...fin } });

describe('columns', () => {
  test('ทุกคอลัมน์ของตารางกรองได้ ยกเว้นลำดับ', () => {
    expect(FILTER_COLUMNS).not.toContain('ลำดับ');
    expect(FILTER_COLUMNS).toHaveLength(23);
  });
});

describe('hasColumnFilters', () => {
  test('ช่องว่างหรือเว้นวรรคไม่นับ', () => {
    expect(hasColumnFilters({})).toBe(false);
    expect(hasColumnFilters({ 'ผู้เบิก': '  ' })).toBe(false);
    expect(hasColumnFilters({ 'ผู้เบิก': 'วรรษ' })).toBe(true);
  });
});

describe('ข้อความ', () => {
  test('พิมพ์บางส่วนก็เจอ', () => {
    expect(matchesColumnFilters(base, { 'ผู้เบิก': 'อุ่ย' })).toBe(true);
    expect(matchesColumnFilters(base, { 'ผู้เบิก': 'สมชาย' })).toBe(false);
  });
  test('ตัวพิมพ์เล็กใหญ่ไม่มีผล', () => expect(matchesColumnFilters(base, { 'เลขที่ตั้งเบิก': 'ladv2610' })).toBe(true));
  test('หลายคอลัมน์ต้องตรงทุกช่อง', () => {
    expect(matchesColumnFilters(base, { 'ผู้เบิก': 'วรรษชล', 'เลขที่ทำจ่าย': 'Test' })).toBe(true);
    expect(matchesColumnFilters(base, { 'ผู้เบิก': 'วรรษชล', 'เลขที่ทำจ่าย': 'ไม่มี' })).toBe(false);
  });
  test('ขีด - คือหาช่องที่ยังว่าง', () => {
    expect(matchesColumnFilters(base, { 'เลขที่เอกสารเคลียร์เงิน': '-' })).toBe(true);
    expect(matchesColumnFilters(withFin({ clear_doc_no: 'CLR26100000001' }), { 'เลขที่เอกสารเคลียร์เงิน': '-' })).toBe(false);
    expect(matchesColumnFilters(base, { 'วันที่ส่งเอกสารเคลียร์': ' - ' })).toBe(true);
  });
  test('ขีดในข้อความยาวยังเป็นการค้นหาปกติ', () => expect(matchesColumnFilters(base, { 'เลขที่คำขอเบิกเงิน': '2610-018' })).toBe(true));
  test('เลขบัญชีพิมพ์มีหรือไม่มีขีดก็เจอ', () => {
    expect(matchesColumnFilters(base, { 'เลขที่บัญชี': '1234567890' })).toBe(true);
    expect(matchesColumnFilters(base, { 'เลขที่บัญชี': '123-4-56' })).toBe(true);
  });
  test('ศูนย์และธนาคารค้นจากคำที่เห็นในตาราง', () => {
    expect(matchesColumnFilters(base, { 'ศูนย์': 'ศลบ' })).toBe(true);
    expect(matchesColumnFilters(base, { 'ธนาคาร': 'กสิกร' })).toBe(true);
  });
});

describe('วันที่', () => {
  test('พิมพ์เดือน/ปี หรือวันที่เต็ม', () => {
    expect(matchesColumnFilters(base, { 'กำหนดการเคลียร์': '11/2026' })).toBe(true);
    expect(matchesColumnFilters(base, { 'กำหนดการเคลียร์': '05/11/2026' })).toBe(true);
    expect(matchesColumnFilters(base, { 'กำหนดการเคลียร์': '10/2026' })).toBe(false);
  });
});

describe('ยอดเงิน', () => {
  test('ไม่ต้องใส่ลูกน้ำ', () => {
    expect(matchesColumnFilters(base, { 'ยอดเงิน': '5000' })).toBe(true);
    expect(matchesColumnFilters(base, { 'ยอดเงิน': '5,000' })).toBe(true);
  });
  test('มากกว่า น้อยกว่า เท่ากับ', () => {
    expect(matchesColumnFilters(base, { 'ยอดเงิน': '>4999.99' })).toBe(true);
    expect(matchesColumnFilters(base, { 'ยอดเงิน': '>5000' })).toBe(false);
    expect(matchesColumnFilters(base, { 'ยอดเงิน': '>=5,000' })).toBe(true);
    expect(matchesColumnFilters(base, { 'ยอดเงิน': '< 1000' })).toBe(false);
    expect(matchesColumnFilters(base, { 'ยอดเงิน': '<=5000' })).toBe(true);
    expect(matchesColumnFilters(base, { 'ยอดเงิน': '=5000' })).toBe(true);
  });
  test('ใช้ยอดที่จ่ายจริงก่อนยอดที่ขอ เหมือนในตาราง', () =>
    expect(matchesColumnFilters({ ...withFin({ amount_paid: 4800 }) }, { 'ยอดเงิน': '=4800' })).toBe(true));
  test('ยอดใช้จริงที่ยังว่าง ไม่ผ่านเงื่อนไขตัวเลข แต่ผ่าน -', () => {
    expect(matchesColumnFilters(base, { 'ยอดใช้จริง': '>0' })).toBe(false);
    expect(matchesColumnFilters(base, { 'ยอดใช้จริง': '-' })).toBe(true);
  });
  test('ยอดโอนคืน ค้นได้ทั้งคำและตัวเลข', () => {
    const refund = withFin({ settle_amount: 500 });
    const extra = withFin({ settle_amount: -450 });
    expect(matchesColumnFilters(refund, { 'ยอดเงินโอนคืนบริษัท': 'รับคืน' })).toBe(true);
    expect(matchesColumnFilters(extra, { 'ยอดเงินโอนคืนบริษัท': 'รับคืน' })).toBe(false);
    expect(matchesColumnFilters(extra, { 'ยอดเงินโอนคืนบริษัท': 'เบิกเพิ่ม' })).toBe(true);
    expect(matchesColumnFilters(extra, { 'ยอดเงินโอนคืนบริษัท': '>400' })).toBe(true);
  });
});

describe('สถานะ', () => {
  test('เลือกจากรหัสสถานะ', () => {
    expect(matchesColumnFilters(base, { 'สถานะ': 'AWAITING_CLEARING' })).toBe(true);
    expect(matchesColumnFilters(base, { 'สถานะ': 'CLOSED' })).toBe(false);
  });
  test('เลือกเกินกำหนด', () => {
    expect(matchesColumnFilters(base, { 'สถานะ': OVERDUE_FILTER })).toBe(false);
    expect(matchesColumnFilters({ ...base, overdue: true }, { 'สถานะ': OVERDUE_FILTER })).toBe(true);
  });
});

describe('ใบเก่าที่ยังไม่มีข้อมูลการเงิน', () => {
  test('ไม่พัง และนับเป็นช่องว่าง', () => {
    const noFin = { ...base, fin: null, request: { purpose: 'x', amount: 100, use_date: null } } as AdvanceItem;
    expect(matchesColumnFilters(noFin, { 'เลขที่ตั้งเบิก': '-', 'ธนาคาร': '-', 'ยอดเงิน': '=100' })).toBe(true);
  });
});

describe('applyColumnFilters', () => {
  test('ไม่มีตัวกรองได้ครบทุกใบ', () => {
    const items = [base, withFin({ voucher_no: 'X' })];
    expect(applyColumnFilters(items, {})).toBe(items);
  });
  test('คงลำดับเดิม', () => {
    const a = { ...base, form_id: 'A' }, b = { ...base, form_id: 'B', overdue: true }, c = { ...base, form_id: 'C', overdue: true };
    expect(applyColumnFilters([a, b, c], { 'สถานะ': OVERDUE_FILTER }).map(i => i.form_id)).toEqual(['B', 'C']);
  });
});

describe('parseNumberFilter', () => {
  test('อ่านเครื่องหมาย', () => {
    expect(parseNumberFilter('>1,000')).toEqual({ op: '>', value: 1000 });
    expect(parseNumberFilter(' <= 20 ')).toEqual({ op: '<=', value: 20 });
  });
  test('ไม่มีเครื่องหมายหรือเลขผิด คืน null', () => {
    expect(parseNumberFilter('1000')).toBeNull();
    expect(parseNumberFilter('>abc')).toBeNull();
    expect(parseNumberFilter('>')).toBeNull();
  });
});

describe('settleText', () => {
  test('ข้อความเหมือนในตาราง', () => {
    expect(settleText(500)).toBe('รับคืน 500.00 บาท');
    expect(settleText(-450)).toBe('เบิกเพิ่ม 450.00 บาท');
    expect(settleText(0)).toBe('พอดี');
    expect(settleText(null)).toBeNull();
  });
});
