import { describe, expect, test } from 'bun:test';
import { claimRole, clerkNameOf, codeSummary, coverRows, coverSheetHtml, groupByClerk, partLabel, roundGroup, splitByFleetRole } from './petty-cover';
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
  test('สาขา · แผนก เป็น format รหัสแผนก (ผู้ใช้สั่ง 29/10/2026)', () =>
    expect(html).toMatch(/<span class="l">สาขา · แผนก<\/span><span class="v">3B02 ศลบ - ยานยนต์<\/span>/));
  test('lists every claim', () => {
    expect(html).toContain('03-B02-2610-001');
    expect(html).toContain('03-B02-2610-002');
  });
  test('shows the group total and baht text', () => {
    expect(html).toContain('ยอดจ่ายสุทธิ 2,840.00 บาท');
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
  test('ตารางรายการแบบ Advance · สรุปยอดเป็นบรรทัดท้าย ไม่มีกล่องยอดใหญ่ (25/11/2026)', () => {
    expect(html).toContain('<table class="items">');
    expect(html).toContain('<div class="cover-sum">');
    expect(html).not.toContain('<div class="tot">');
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

describe('ใบปะหน้ามี checklist รวบรวมเอกสารต่อใบ (ผู้ใช้สั่ง 2026-10-13)', () => {
  const typesWithSpec = TYPES.map(t => t.code === 'WEIGH' ? { ...t, spec: {
    prints: ['PETTY_VOUCHER', 'RECEIPT_SUBSTITUTE', 'DD'],
    attachments: [{ key: 'weigh_slip', label: 'ใบชั่งน้ำหนัก (สำเนา)', required: true }, { key: 'transfer', label: 'หลักฐานโอนเงิน', required: true }, { key: 'other', label: 'อื่นๆ', required: false }],
  } } : t);
  const html = coverSheetHtml({ group: groupByClerk(CLAIMS)[0], types: typesWithSpec, clerkName: 'x', branchCode: '03', divisionCode: 'B02' });
  test('มีหัวข้อ checklist', () => expect(html).toContain('รายการเอกสารที่ต้องรวบรวม'));
  test('แต่ละใบมีช่องติ๊กเอกสารที่ระบบพิมพ์และเอกสารที่ต้องแนบ', () => {
    expect(html).toContain('<span class="cb"></span>ใบสำคัญจ่ายเงินสดย่อย');
    expect(html).toContain('<span class="cb"></span>ใบรับรองแทนใบเสร็จรับเงิน');
    expect(html).toContain('<span class="cb"></span>ใบรับสินค้า (DD)');
    expect(html).toContain('<span class="cb"></span>ใบชั่งน้ำหนัก (สำเนา)');
    expect(html).toContain('<span class="cb"></span>หลักฐานโอนเงิน');
  });
  test('หมวดที่ไม่บังคับไม่ขึ้นใน checklist', () => expect(html).not.toContain('<span class="cb"></span>อื่นๆ'));
  test('checklist ระบุเลขที่ใบที่เป็นเจ้าของ', () => expect(html).toContain('03-B02-2610-001'));
});

describe('ใบปะหน้าของรอบส่งเคลียร์ (flow v2 29/10/2026 — แยกตามเจ้าของเงินสด)', () => {
  const round = { batch_no: 'LB-B02-2610-B1', holder_employee_id: '12345', holder_name: 'ณรงค์กรณ์ อัจฉริยญาติ',
    clear_approved_by_name: null, claims: CLAIMS };
  const group = roundGroup(round);
  test('one group = the whole round under the holder', () => {
    expect(group.clerk).toBe('12345');
    expect(group.claims).toHaveLength(3);
    expect(group.total).toBe(3340);
  });
  const html = coverSheetHtml({ group, types: TYPES, clerkName: round.holder_name, branchCode: '03',
    divisionCode: 'B02', batchNo: round.batch_no, mode: 'round', clearApproverName: 'สมศักดิ์ ผู้จัดการ' });
  test('says who sends it and which round', () => {
    expect(html).toContain('เจ้าของเงินสด');
    expect(html).toContain('รอบส่งเคลียร์');
    expect(html).toContain('LB-B02-2610-B1');
  });
  test('has a line for the head who approves the clearing', () => {
    expect(html).toContain('หัวหน้าอนุมัติเคลียร์');
    expect(html).toContain('สมศักดิ์ ผู้จัดการ');
  });
  test('the clerk cover sheet stays as it was', () => {
    const clerk = coverSheetHtml({ group: groupByClerk(CLAIMS)[0], types: TYPES, clerkName: 'x', branchCode: '03', divisionCode: 'B02' });
    expect(clerk).toContain('เจ้าหน้าที่ผู้เปิดใบ');
    expect(clerk).not.toContain('หัวหน้าอนุมัติเคลียร์');
  });
});

describe('สรุปตามรหัสใบสำคัญจ่าย (ข้อ 8 ผู้ใช้สั่ง 7/11/2026)', () => {
  test('รวมยอดและนับใบตามรหัส ใบที่ไม่มีรหัสใช้รหัสแผนกผู้เบิก', () => {
    const group = roundGroup({ holder_employee_id: 'h', claims: [
      { ...CLAIMS[0], expense_code: '3200', amount: 100 },
      { ...CLAIMS[0], form_id: 'X2', expense_code: '3200', amount: 50 },
      { ...CLAIMS[0], form_id: 'X3', expense_code: null, cost_center: '3B01', amount: 20 },
    ] as PettyClaim[] });
    expect(codeSummary(group)).toEqual([
      { code: '3200', label: '3200 ศลบ - บริการ', count: 2, amount: 150, wht: 0, net: 150 },
      { code: '3B01', label: '3B01 ศลบ - จัดส่ง', count: 1, amount: 20, wht: 0, net: 20 },
    ]);
    const html = coverSheetHtml({ group, types: TYPES, clerkName: 'x', branchCode: '03', divisionCode: 'B02', mode: 'round' });
    expect(html).toContain('รหัสใบสำคัญจ่าย');
    expect(html).toContain('3200 ศลบ - บริการ');
  });
});

describe('ใบปะหน้าแนวนอน (ผู้ใช้สั่ง 7/11/2026)', () => {
  test('@page เป็น A4 landscape · ไม่บังคับความสูง ลงนามตามท้ายเนื้อหา (ไม่ตกไปหน้า 2 คนเดียว 16/11/2026)', () => {
    const html = coverSheetHtml({ group: groupByClerk(CLAIMS)[0], types: TYPES, clerkName: 'สมชาย', branchCode: '03', divisionCode: 'B02' });
    expect(html).toContain('size: A4 landscape');
    expect(html).not.toContain('min-height: 160mm');
    expect(html).toContain('.doc-part { min-height: 0; }');
  });
});

describe('ใบปะหน้า 1 แผ่นต่อฟลีท × พจส./พจร. มีรหัสด้านบนและ WHT (ผู้ใช้สั่ง 25/11/2026)', () => {
  const item = (fleet: string | null, role: string | null) => ({ event_date: '2026-11-10', qty: 1, rate: 1, amount: 1, fleet, driver_role: role });
  const c = (form_id: string, amount: number, code: string, items: object[], wht = 0) =>
    ({ ...CLAIMS[0], form_id, amount, expense_code: code, wht_amount: wht, items }) as unknown as PettyClaim;
  const claims = [
    c('A1', 1000, '3200', [item('Mixer L', 'พจส.')], 30),
    c('A2', 500, '3300', [item('Mixer L', 'พจร.')]),
    c('A3', 400, '3200', [item('Mixer S', 'พจส.')]),
    c('A4', 200, '3200', [item('Mixer L', 'พจส.')]),
    c('A5', 100, '3B02', []),
  ];
  const group = roundGroup({ holder_employee_id: 'h', claims });

  test('claimRole reads the rows, falls back to the header', () => {
    expect(claimRole(claims[1])).toBe('พจร.');
    expect(claimRole({ items: [], detail: { driver_role: 'พจส.' } })).toBe('พจส.');
    expect(claimRole(claims[4])).toBe('');
  });
  test('one part per fleet × role, no-truck last, claims keep their order', () => {
    const parts = splitByFleetRole(group);
    expect(parts.map(partLabel)).toEqual(['ML · พจร.', 'ML · พจส.', 'MS · พจส.', 'ไม่มีรถ']);
    expect(parts[1].claims.map(x => x.form_id)).toEqual(['A1', 'A4']);
    expect(parts[1].total).toBe(1200);
  });
  const html = coverSheetHtml({ group, types: TYPES, clerkName: 'x', branchCode: '03', divisionCode: 'B02', mode: 'round', batchNo: 'B1' });
  test('one section per part, each with its code at the top (no fleet in the box)', () => {
    expect(html.match(/<section class="doc-part">/g)).toHaveLength(4);
    expect(html).toContain('<span>รหัสใบสำคัญจ่าย</span><b>3300</b>');
    expect(html).not.toContain('<span>ฟลีท</span>');
    expect(html).toContain('<span>แผ่น</span><b>2/4</b>');
  });
  test('section is "รายการใบเบิก" with the code summary on top, rows show net only', () => {
    expect(html).toContain('รายการใบเบิก');
    expect(html).not.toContain('ใบเบิกที่ส่งมาด้วย');
    expect(html.indexOf('<th>รหัสใบสำคัญจ่าย</th>')).toBeLessThan(html.indexOf('<th style="width:34mm">เลขที่ใบเบิก</th>'));
    expect(html).toContain('<td class="a">1,200.00</td><td class="a">30.00</td><td class="a">1,170.00</td>');
    expect(html).toContain('<td class="nw">ML</td><td>LBDD26090931</td><td class="a">970.00</td>');
  });
  test('closing line sums expense, WHT and net', () =>
    expect(html).toContain('รวม 2 ใบ · ยอดค่าใช้จ่าย 1,200.00 · WHT 30.00 · <b>ยอดจ่ายสุทธิ 1,170.00 บาท</b>'));
  test('a single part has no page counter', () => {
    const one = coverSheetHtml({ group: roundGroup({ holder_employee_id: 'h', claims: [claims[0]] }), types: TYPES, clerkName: 'x', branchCode: '03', divisionCode: 'B02' });
    expect(one).not.toContain('<span>แผ่น</span>');
  });
});
