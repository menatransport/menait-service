import { describe, expect, test } from 'bun:test';
import { coverRows, coverSheetHtml, groupByClerk } from './petty-cover';
import type { PettyClaim } from '@/app/finance/types-petty';

const CLAIMS = [
  { id: 1, form_id: '03-B02-2610-001', created_by: '55555', amount: 1640, expense_type: 'WEIGH',
    payee_name: 'อัญชัญ น่วมมี', dd_no: 'LBDD26090931', status: 'AWAITING_REVIEW',
    period_from: '2026-09-17', period_to: '2026-09-24', expense_date: '2026-09-25' },
  { id: 2, form_id: '03-B02-2610-002', created_by: '55555', amount: 1200, expense_type: 'TIRE',
    payee_name: 'สมชาย', dd_no: null, status: 'AWAITING_REVIEW',
    period_from: null, period_to: null, expense_date: '2026-09-26' },
  { id: 3, form_id: '03-B02-2610-003', created_by: '77777', amount: 500, expense_type: 'TOLL',
    payee_name: 'สมหญิง', dd_no: null, status: 'AWAITING_REVIEW',
    period_from: null, period_to: null, expense_date: '2026-09-26' },
] as unknown as PettyClaim[];

const TYPES = [
  { code: 'WEIGH', name_th: 'ค่าชั่งน้ำหนัก' },
  { code: 'TIRE', name_th: 'ค่าปะ-เปลี่ยนยาง' },
  { code: 'TOLL', name_th: 'ค่าทางด่วน' },
] as never[];

describe('groupByClerk — แยกเอกสารตามชื่อเจ้าหน้าที่', () => {
  test('one group per clerk', () => expect(groupByClerk(CLAIMS)).toHaveLength(2));
  test('totals per clerk', () => {
    const [first] = groupByClerk(CLAIMS);
    expect(first.clerk).toBe('55555');
    expect(first.total).toBe(2840);
  });
  test('sorted by total, biggest first', () =>
    expect(groupByClerk(CLAIMS).map(g => g.total)).toEqual([2840, 500]));
  test('empty input', () => expect(groupByClerk([])).toEqual([]));
  test('claims keep their order inside a group', () =>
    expect(groupByClerk(CLAIMS)[0].claims.map(c => c.form_id))
      .toEqual(['03-B02-2610-001', '03-B02-2610-002']));
});

describe('coverRows', () => {
  const rows = coverRows(groupByClerk(CLAIMS)[0], TYPES);

  test('one row per claim with a running number', () => {
    expect(rows).toHaveLength(2);
    expect(rows[0].no).toBe(1);
  });
  test('shows the type name, not its code', () => expect(rows[0].typeName).toBe('ค่าชั่งน้ำหนัก'));
  test('missing DD shows a dash, not "null"', () => expect(rows[1].ddNo).toBe('-'));
  test('a period becomes a range, a single date stays one date', () => {
    expect(rows[0].period).toBe('17/09/2026 – 24/09/2026');
    expect(rows[1].period).toBe('26/09/2026');
  });
  test('an unknown type code falls back to the code itself', () => {
    const rows2 = coverRows(groupByClerk([{ ...CLAIMS[0], expense_type: 'NEW' } as PettyClaim])[0], TYPES);
    expect(rows2[0].typeName).toBe('NEW');
  });
});

describe('coverSheetHtml', () => {
  const html = coverSheetHtml({ group: groupByClerk(CLAIMS)[0], types: TYPES,
    clerkName: 'สายใจ ทองดี', branchCode: '03', divisionCode: 'B02' });

  test('names the clerk', () => expect(html).toContain('สายใจ ทองดี'));
  test('lists every claim', () => {
    expect(html).toContain('03-B02-2610-001');
    expect(html).toContain('03-B02-2610-002');
  });
  test('shows the group total and baht text', () => {
    expect(html).toContain('2,840.00');
    expect(html).toContain('สองพันแปดร้อยสี่สิบบาทถ้วน');
  });
  test('escapes data', () => {
    const nasty = coverSheetHtml({ group: groupByClerk(CLAIMS)[0], types: TYPES,
      clerkName: '<script>bad()</script>', branchCode: '03', divisionCode: 'B02' });
    expect(nasty).not.toContain('<script>bad()');
  });
});
