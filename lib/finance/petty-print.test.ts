import { describe, expect, test } from 'bun:test';
import { groupForPrint, paginateGroups, voucherLabel } from './petty-print';

/** ใบจริงเลขที่ 093787: 16 คัน 3 ราคา รวม 1,640.00 */
const REAL = [
  ...['161', '144', 'F014', 'F016', '113', '118', '145', '340'].map(code => ({
    truck_code: code, truck_type: 'โม่ใหญ่', rate: 100, qty: 1, amount: 100,
  })),
  ...['1126', '1145', '1093', '1093'].map(code => ({
    truck_code: code, truck_type: 'โม่เล็ก', rate: 100, qty: 1, amount: 100,
  })),
  ...['153', '146', '151'].map(code => ({
    truck_code: code, truck_type: 'โม่ใหญ่', rate: 120, qty: 1, amount: 120,
  })),
  { truck_code: '165', truck_type: 'โม่เล็ก', rate: 80, qty: 1, amount: 80 },
];

describe('groupForPrint — ตามที่คนเขียนมือจัดอยู่แล้ว', () => {
  const groups = groupForPrint(REAL, 'ค่าชั่งน้ำหนัก');

  test('groups by rate and truck type', () => expect(groups).toHaveLength(4));
  test('big mixers at 100 baht are eight trucks', () => {
    const g = groups.find(x => x.rate === 100 && x.label.includes('โม่ใหญ่'))!;
    expect(g.count).toBe(8);
    expect(g.total).toBe(800);
  });
  test('small mixers at 100 baht are their own line', () => {
    const g = groups.find(x => x.rate === 100 && x.label.includes('โม่เล็ก'))!;
    expect(g.count).toBe(4);
  });
  test('grand total matches the real voucher', () =>
    expect(groups.reduce((s, g) => s + g.total, 0)).toBe(1640));
  test('truck codes travel into the remark column', () => {
    const g = groups.find(x => x.rate === 80)!;
    expect(g.truckCodes).toEqual(['165']);
  });
  test('the duplicate 1093 is listed twice, as the paper does', () => {
    const g = groups.find(x => x.rate === 100 && x.label.includes('โม่เล็ก'))!;
    expect(g.truckCodes.filter(c => c === '1093')).toHaveLength(2);
  });
  test('empty input gives no groups, not a crash', () => expect(groupForPrint([], 'x')).toEqual([]));
  test('rows with no amount fall back to qty times rate', () => {
    const groups2 = groupForPrint([{ truck_code: 'a', rate: 50, qty: 2 }], 'ค่าทางด่วน');
    expect(groups2[0].total).toBe(100);
  });
});

describe('voucherLabel', () => {
  test('includes the type name, truck type and rate', () =>
    expect(voucherLabel(100, 'โม่ใหญ่', 'ค่าชั่งน้ำหนัก')).toBe('ค่าชั่งน้ำหนักรถโม่ใหญ่ 100 บาท'));
  test('no truck type still reads properly', () =>
    expect(voucherLabel(120, null, 'ค่าชั่งน้ำหนัก')).toBe('ค่าชั่งน้ำหนัก 120 บาท'));
});

describe('paginateGroups', () => {
  const stub = { label: 'x', count: 1, rate: 1, total: 1, truckCodes: [] };
  test('six lines fit one page', () => expect(paginateGroups(Array(6).fill(stub))).toHaveLength(1));
  test('seven lines spill to a second page', () => expect(paginateGroups(Array(7).fill(stub))).toHaveLength(2));
  test('no groups means no pages', () => expect(paginateGroups([])).toEqual([]));
  test('the real voucher is a single page', () =>
    expect(paginateGroups(groupForPrint(REAL, 'ค่าชั่งน้ำหนัก'))).toHaveLength(1));
});
