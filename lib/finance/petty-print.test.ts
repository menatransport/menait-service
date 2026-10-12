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

describe('ประเภทที่กรอกยอดเดียว — ไม่ต้องจัดกลุ่มตามราคา', () => {
  test('a taxi claim prints one line with its route', () => {
    const groups = groupForPrint(
      [{ truck_code: null, truck_type: null, rate: 243, qty: 1, amount: 243,
         remark: 'คลองตัน → เมกาบางนา (ขากลับ)' }],
      'ค่าเดินทาง');
    expect(groups).toHaveLength(1);
    expect(groups[0].label).toBe('ค่าเดินทาง คลองตัน → เมกาบางนา (ขากลับ)');
    expect(groups[0].total).toBe(243);
  });

  test('without a remark it falls back to the plain type name and rate', () => {
    const groups = groupForPrint([{ rate: 215, qty: 1, amount: 215 }], 'ค่าเดินทาง');
    expect(groups[0].label).toBe('ค่าเดินทาง 215 บาท');
  });

  test('the tyre bill prints its own wording and counts tyres', () => {
    const groups = groupForPrint(
      [{ truck_code: '6604', truck_type: 'โม่ใหญ่', rate: 200, qty: 6, amount: 1200,
         remark: 'เปลี่ยนยาง 6 เส้น' }],
      'ค่าปะ-เปลี่ยนยาง', { unit: 'เส้น' });
    expect(groups[0].label).toBe('ค่าปะ-เปลี่ยนยาง เปลี่ยนยาง 6 เส้น');
    expect(groups[0].count).toBe(6);
    expect(groups[0].unit).toBe('เส้น');
    expect(groups[0].total).toBe(1200);
  });

  test('weighing still groups by rate and truck type, counted in คัน', () => {
    const groups = groupForPrint(
      [{ truck_code: '161', truck_type: 'โม่ใหญ่', rate: 100, qty: 1, amount: 100 },
       { truck_code: '144', truck_type: 'โม่ใหญ่', rate: 100, qty: 1, amount: 100 }],
      'ค่าชั่งน้ำหนัก');
    expect(groups).toHaveLength(1);
    expect(groups[0].count).toBe(2);
    expect(groups[0].unit).toBe('คัน');
  });

  test('two taxi trips stay on separate lines — คนละเส้นทาง', () => {
    const groups = groupForPrint(
      [{ rate: 215, qty: 1, amount: 215, remark: 'ไป' }, { rate: 243, qty: 1, amount: 243, remark: 'กลับ' }],
      'ค่าเดินทาง');
    expect(groups).toHaveLength(2);
  });
});
