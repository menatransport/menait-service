import { describe, expect, it } from 'bun:test';
import { PERM, can, type PermissionState } from './permissions';

const bow: PermissionState = { permissions: [PERM.pay, PERM.return] };

describe('can', () => {
  it('อนุญาตสิทธิ์ที่ถืออยู่', () => {
    expect(can(bow, PERM.pay)).toBe(true);
    expect(can(bow, PERM.return)).toBe(true);
  });

  it('ปฏิเสธสิทธิ์ที่ไม่ได้ถือ', () => {
    expect(can(bow, PERM.close)).toBe(false);
    expect(can(bow, PERM.clearingReview)).toBe(false);
  });

  it('ยังโหลดไม่เสร็จ ไม่ซ่อนปุ่ม', () => {
    expect(can(null, PERM.pay)).toBe(true);
  });

  it('หลังบ้านตอบไม่ได้ ไม่ซ่อนปุ่ม', () => {
    expect(can({ permissions: [], unavailable: true }, PERM.close)).toBe(true);
  });

  it('ไม่มีสิทธิ์เลยแต่หลังบ้านตอบปกติ ซ่อนทุกปุ่ม', () => {
    const none: PermissionState = { permissions: [] };
    for (const p of Object.values(PERM)) expect(can(none, p)).toBe(false);
  });
});
