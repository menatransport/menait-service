import { describe, expect, test } from 'bun:test';
import {
  COST_CENTERS, COST_CENTER_GROUPS, centerOfSite, claimCostCenterLine, costCenterGroupsForSite, costCenterLabel,
  defaultCostCenter, isCostCenter,
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

describe('ค่าตั้งต้นจากวงเงิน', () => {
  test('สาขา 03 + B02 → 3B02', () => expect(defaultCostCenter({ branch_code: '03', division_code: 'B02' })).toBe('3B02'));
  test('สาขา 01 + A04 → 1A04', () => expect(defaultCostCenter({ branch_code: '01', division_code: 'A04' })).toBe('1A04'));
  test('ไม่มีในรายการ (สสบ ไม่มี A02) → ว่าง ให้เลือกเอง', () =>
    expect(defaultCostCenter({ branch_code: '02', division_code: 'A02' })).toBe(''));
  test('สาขาที่ยังไม่มีในรายการ → ว่าง', () => expect(defaultCostCenter({ branch_code: '04', division_code: 'B02' })).toBe(''));
  test('ไม่มีวงเงิน → ว่าง', () => expect(defaultCostCenter(null)).toBe(''));
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
