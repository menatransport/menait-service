import { describe, expect, test } from 'bun:test';
import { PETTY_CLAIM_CAP, claimCapProblem, routeHint, singleDriverRoleProblem } from './petty-rules';

describe('เพดาน 2,000 ต่อใบ (ผู้ใช้สั่ง 7/11/2026)', () => {
  test('2,000 พอดีผ่าน เกินสตางค์เดียวไม่ผ่าน และบอกให้ไป Advance', () => {
    expect(PETTY_CLAIM_CAP).toBe(2000);
    expect(claimCapProblem(2000)).toBeNull();
    expect(claimCapProblem(0)).toBeNull();
    expect(claimCapProblem(2000.01)).toContain('Advance');
  });
});

describe('ค่าชั่ง 1 ใบ = พจส. หรือ พจร. อย่างเดียว', () => {
  test('ปนสองประเภทไม่ผ่าน ประเภทเดียวหรือยังไม่เลือกผ่าน ประเภทอื่นไม่เช็ก', () => {
    expect(singleDriverRoleProblem('WEIGH', [{ driver_role: 'พจส.' }, { driver_role: 'พจร.' }])).toContain('แยกเปิดคนละใบ');
    expect(singleDriverRoleProblem('WEIGH', [{ driver_role: 'พจส.' }, { driver_role: '' }, {}])).toBeNull();
    expect(singleDriverRoleProblem('TOLL', [{ driver_role: 'พจส.' }, { driver_role: 'พจร.' }])).toBeNull();
  });
});

describe('บรรทัดบอกว่าใบจะไปหาใคร (TOA)', () => {
  const base = { required_level: 2, holder_employee_id: '690189', holder_name: 'เสถียรพงษ์', over_cap: false, cap: 2000 };
  test('เจ้าของเงินสดครอบ → ไม่ต้องผ่านหัวหน้า', () =>
    expect(routeHint({ ...base, head_required: false })).toBe('เจ้าของเงินสด (เสถียรพงษ์) อนุมัติจ่ายได้เลย ไม่ต้องผ่านหัวหน้า'));
  test('ไม่ครอบ → บอกระดับหัวหน้า', () =>
    expect(routeHint({ ...base, head_required: true, required_level: 3 })).toBe('หัวหน้าระดับ 3 ขึ้นไปอนุมัติก่อน แล้วถึงเจ้าของเงินสด'));
  test('เกินเพดาน และยังไม่รู้', () => {
    expect(routeHint({ ...base, head_required: true, over_cap: true })).toContain('เกินเพดาน');
    expect(routeHint(null)).toContain('TOA');
  });
});
