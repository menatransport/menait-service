import { describe, expect, it } from 'bun:test';
import { PERM, can, canSendVoucherBack, type PermissionState } from './permissions';

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

describe('canSendVoucherBack — การเงินส่งกลับให้บัญชีแก้ตั้งเบิก (ผู้ใช้ 26/10/2026)', () => {
  it('การเงิน (สิทธิ์จ่ายเงิน) กดได้ตอนรอจ่ายเท่านั้น', () => {
    expect(canSendVoucherBack('AWAITING_PAYMENT', bow)).toBe(true);
    for (const s of ['AWAITING_VOUCHER', 'AWAITING_CLEARING', 'PENDING_APPROVAL', 'CLOSED']) {
      expect(canSendVoucherBack(s, bow)).toBe(false);
    }
  });
  it('ไม่มีสิทธิ์จ่ายเงิน ไม่เห็นปุ่ม', () => {
    expect(canSendVoucherBack('AWAITING_PAYMENT', { permissions: [PERM.voucher] })).toBe(false);
  });
});
