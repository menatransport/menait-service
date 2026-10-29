import { describe, expect, test } from 'bun:test';
import {
  COST_CENTERS, COST_CENTER_GROUPS, centerOfSite, claimCostCenterLine, costCenterGroupsForSite, costCenterLabel,
  defaultCostCenterForUser, isCostCenter,
} from './petty-cost-centers';

describe('รายการศูนย์และแผนก (จากผู้ใช้ 29/10/2026)', () => {
  test('ครบ 43 รหัส ไม่ซ้ำ', () => {
    expect(COST_CENTERS).toHaveLength(43);
    expect(new Set(COST_CENTERS.map(c => c.code)).size).toBe(43);
  });
  test('ชื่อตามที่ส่งมา', () => {
    expect(costCenterLabel('1400')).toBe('1400 สกท - ขาย');
    expect(costCenterLabel('2B02')).toBe('2B02 สสบ - ยานยนต์');
    expect(costCenterLabel('3B07')).toBe('3B07 ศลบ. - Business Development');
  });
  test('แบ่งกลุ่มตามศูนย์ สกท / สสบ / ศลบ เรียงตามรายการ', () => {
    expect(COST_CENTER_GROUPS.map(g => g.center)).toEqual(['สกท', 'สสบ', 'ศลบ']);
    expect(COST_CENTER_GROUPS.map(g => g.items.length)).toEqual([11, 15, 17]);
    expect(COST_CENTER_GROUPS[0].items[0].code).toBe('1400');
  });
  test('รหัสที่ไม่รู้จัก/ว่าง', () => {
    expect(isCostCenter('3B02')).toBe(true);
    expect(isCostCenter('9Z99')).toBe(false);
    expect(costCenterLabel('9Z99')).toBe('9Z99');
    expect(costCenterLabel(null)).toBe('');
  });
});

describe('ค่าตั้งต้นจากแผนกของผู้เบิก (ผู้ใช้อนุมัติ map 29/10/2026 · เปลี่ยนเองได้)', () => {
  const u = (site: string, division_code: string | null, department_id: number | null = null) =>
    ({ site, department_id, division: division_code ? { division_code } : null });
  const cases: [string, ReturnType<typeof u>, string][] = [
    ['Process Excellence (OPS) HQ → 1B06', u('Bangkok HQ', 'OPS', 29), '1B06'],
    ['Fuel Control (OPS) ลาดกระบัง → 3B06', u('Lat Krabang', 'OPS', 32), '3B06'],
    ['บัญชี สระบุรี → 2A04', u('Saraburi', 'ACC', 6), '2A04'],
    ['การเงิน HQ → 1A04', u('Bangkok HQ', 'FIN', 4), '1A04'],
    ['IT HQ → 1A05', u('Bangkok HQ', 'IT', 21), '1A05'],
    ['ค่าจ้างและสวัสดิการ HQ → 1A03', u('Bangkok HQ', 'HCB', 7), '1A03'],
    ['สรรหา Mass ลาดกระบัง → 3A03', u('Lat Krabang', 'HRC', 22), '3A03'],
    ['ยานยนต์ ลาดกระบัง → 3B02', u('Lat Krabang', 'VHC', 3), '3B02'],
    ['สโตร์ สระบุรี → 2B03', u('Saraburi', 'SPR', 31), '2B03'],
    ['MENA Academy → 3B04', u('Lat Krabang', 'STY', 16), '3B04'],
    ['Compliance สระบุรี → 2B04', u('Saraburi', 'CPA', 17), '2B04'],
    ['Delivery Service → 3B01', u('Lat Krabang', 'LKB', 15), '3B01'],
    ['ศูนย์ปฏิบัติการสระบุรีทุกแผนก → 2B01', u('Saraburi', 'SRB', 27), '2B01'],
    ['Chief-Level HQ → 1A01', u('Bangkok HQ', 'EX', 1), '1A01'],
    ['Company Secretary & Compliance → 1A06', u('Bangkok HQ', 'CSC', 10), '1A06'],
    ['Sales & Driver Partner (ไม่มีฝ่าย) ลาดกระบัง → 3500', u('Lat Krabang', null, 9), '3500'],
  ];
  for (const [name, user, code] of cases) test(name, () => expect(defaultCostCenterForUser(user)).toBe(code));

  test('รหัสที่ไม่มีในรายการ (สกท ไม่มี B02) → ว่าง ให้เลือกเอง', () =>
    expect(defaultCostCenterForUser(u('Bangkok HQ', 'VHC', 3))).toBe(''));
  test('ศูนย์ที่ยังไม่มีรหัส (Rayong) → ว่าง', () => expect(defaultCostCenterForUser(u('Rayong', 'SRB', 19))).toBe(''));
  test('แผนกที่ยังไม่ได้ map → ว่าง', () => expect(defaultCostCenterForUser(u('Bangkok HQ', null, 999))).toBe(''));
  test('ยังไม่มีข้อมูลผู้ใช้ → ว่าง', () => expect(defaultCostCenterForUser(null)).toBe(''));
});

describe('บรรทัดรหัสค่าใช้จ่ายของผู้เบิก', () => {
  const fund = { division_code: 'B02' };
  test('ใบที่เลือกศูนย์และแผนกแล้ว → รหัสที่เลือก', () =>
    expect(claimCostCenterLine({ cost_center: '3B04' }, fund)).toBe('3B04 ศลบ - ความปลอดภัย'));
  test('ใบเก่าที่ไม่มี → รหัสแผนกของวงเงินแบบเดิม', () =>
    expect(claimCostCenterLine({ cost_center: null }, fund)).toBe('B02 ฝ่ายยานยนต์'));
});

describe('กรองตามศูนย์ของผู้เบิก (ผู้ใช้สั่ง 29/10/2026: Bangkok HQ มาช่วยกรอง)', () => {
  test('ชื่อศูนย์จาก session (site_name_en) → ศูนย์ในรายการ', () => {
    expect(centerOfSite('Bangkok HQ')).toBe('สกท');
    expect(centerOfSite('Saraburi')).toBe('สสบ');
    expect(centerOfSite('Lat Krabang')).toBe('ศลบ');
  });
  test('รหัสศูนย์ภาษาไทยก็ได้ มีจุดหรือไม่มีก็ได้', () => {
    expect(centerOfSite('สกท.')).toBe('สกท');
    expect(centerOfSite(' ศลบ ')).toBe('ศลบ');
  });
  test('ศูนย์ที่ยังไม่มีรหัสในรายการ / ว่าง → ไม่รู้', () => {
    for (const s of ['Rayong', 'Bang Pakong', 'Khon Kaen', '', null, undefined]) expect(centerOfSite(s)).toBeNull();
  });
  test('Bangkok HQ เห็นแค่กลุ่ม สกท 11 รหัส', () => {
    const groups = costCenterGroupsForSite('Bangkok HQ');
    expect(groups.map(g => g.center)).toEqual(['สกท']);
    expect(groups[0].items).toHaveLength(11);
  });
  test('ศูนย์ที่ไม่รู้ เห็นทุกกลุ่ม', () =>
    expect(costCenterGroupsForSite('Rayong').map(g => g.center)).toEqual(['สกท', 'สสบ', 'ศลบ']));
});
