import { describe, expect, test } from 'bun:test';
import { clerkNameOf, coverRows, coverSheetHtml, groupByClerk } from './petty-cover';
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

describe('ใบปะหน้า มาตรฐานเดียวกับ Advance', () => {
  const html = coverSheetHtml({ group: groupByClerk(CLAIMS)[0], types: TYPES, clerkName: 'สายใจ ทองดี', branchCode: '03', divisionCode: 'B02', logoUrl: 'http://x/mena.png' });
  test('หัวเอกสาร', () => {
    expect(html).toContain('class="doc-band"');
    expect(html).toContain('<img class="logo" src="http://x/mena.png"');
    expect(html).toContain('<div class="t1">ใบปะหน้าเอกสารเบิกเงินสดย่อย</div>');
    expect(html).toContain('(Petty Cash Cover Sheet)');
  });
  test('ตารางรายการแบบ Advance และกล่องยอดรวม', () => {
    expect(html).toContain('<table class="items">');
    expect(html).toContain('<div class="tot">');
  });
  test('ลงนาม ผู้ส่ง/ผู้รับ (บัญชี)', () => {
    expect(html).toContain('<th>ผู้ส่งเอกสาร</th>');
    expect(html).toContain('<th>ผู้รับเอกสาร (บัญชี)</th>');
  });
  test('ชื่อเอกสาร', () => expect(html).toContain('Petty Cash Cover Sheet (PC)'));
});

describe('วันที่บนใบปะหน้าเป็นวันไทย', () => {
  test('ตอนตีสองของไทย (19:00 UTC เมื่อวาน) ต้องขึ้นวันไทย', () => {
    const html = coverSheetHtml({ group: groupByClerk(CLAIMS)[0], types: TYPES, clerkName: 'x', branchCode: '03', divisionCode: 'B02',
      now: new Date('2026-10-12T19:00:00Z') });
    expect(html).toContain('<span>วันที่</span><b>13/10/2026</b>');
  });
  test('เลขที่ใบเบิกไม่ถูกตัดบรรทัด', () =>
    expect(coverSheetHtml({ group: groupByClerk(CLAIMS)[0], types: TYPES, clerkName: 'x', branchCode: '03', divisionCode: 'B02' }))
      .toContain('<td class="nw">'));
});

describe('ใบปะหน้า — ลงนามอยู่ด้านล่างเสมอ', () => {
  test('มีบล็อกลงนามที่ดันลงล่าง', () =>
    expect(coverSheetHtml({ group: groupByClerk(CLAIMS)[0], types: TYPES, clerkName: 'x', branchCode: '03', divisionCode: 'B02' }))
      .toContain('<div class="sign-block">'));
});

describe('ใบปะหน้า — ชื่อเจ้าหน้าที่จากใบ', () => {
  test('clerkNameOf ใช้ชื่อเมื่อมี ไม่มีก็รหัส', () => {
    expect(clerkNameOf({ clerk: '680043', claims: [{ created_by: '680043', created_by_name: 'กฤตบุญ ลายเงิน' } as PettyClaim], total: 0 })).toBe('กฤตบุญ ลายเงิน');
    expect(clerkNameOf({ clerk: '680043', claims: [{ created_by: '680043' } as PettyClaim], total: 0 })).toBe('680043');
  });
});
