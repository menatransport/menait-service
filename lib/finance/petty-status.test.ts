import { describe, expect, test } from 'bun:test';
import {
  PETTY_ALLOWED, PETTY_ROUND_LABELS, PETTY_ROUND_STYLES, PETTY_STATUS_LABELS, PETTY_STATUS_STYLES, canGo,
} from './petty-status';

describe('labels — flow v2 (29/10/2026)', () => {
  test('eight live statuses plus the old TRANSFERRED for history', () =>
    expect(Object.keys(PETTY_STATUS_LABELS)).toHaveLength(9));
  test('wording matches the backend', () => {
    expect(PETTY_STATUS_LABELS.PENDING_APPROVAL).toBe('รอเจ้าของเงินสดอนุมัติ');
    expect(PETTY_STATUS_LABELS.APPROVED).toBe('อนุมัติจ่ายแล้ว รอส่งเคลียร์');
    expect(PETTY_STATUS_LABELS.CLEAR_PENDING).toBe('รอหัวหน้าอนุมัติเคลียร์');
    expect(PETTY_STATUS_LABELS.SENT_BACK).toBe('ส่งกลับแก้ไข');
    expect(PETTY_STATUS_LABELS.REVIEWED).toBe('บัญชีตรวจผ่าน รอตั้งเบิก');
    expect(PETTY_STATUS_LABELS.CLOSED).toBe('ปิดแล้ว');
  });
  test('every status has a style', () => {
    expect(Object.keys(PETTY_STATUS_STYLES).sort()).toEqual(Object.keys(PETTY_STATUS_LABELS).sort());
  });
  test('every round status has a label and a style', () => {
    expect(Object.keys(PETTY_ROUND_LABELS).sort()).toEqual(
      ['AWAITING_REVIEW', 'CLEAR_PENDING', 'CLEAR_REJECTED', 'CLOSED', 'REVIEWED', 'VOUCHERED']);
    expect(Object.keys(PETTY_ROUND_STYLES).sort()).toEqual(Object.keys(PETTY_ROUND_LABELS).sort());
    expect(PETTY_ROUND_LABELS.VOUCHERED).toBe('ตั้งเบิกแล้ว รอทำจ่าย');
  });
});

describe('transitions mirror the backend', () => {
  test('approve', () => expect(canGo('PENDING_APPROVAL', 'APPROVED')).toBe(true));
  test('resubmit after return', () => expect(canGo('RETURNED', 'PENDING_APPROVAL')).toBe(true));
  test('approved goes into a round', () => expect(canGo('APPROVED', 'CLEAR_PENDING')).toBe(true));
  test('cannot skip the head', () => expect(canGo('APPROVED', 'AWAITING_REVIEW')).toBe(false));
  test('sent back goes straight back to accounting', () => expect(canGo('SENT_BACK', 'AWAITING_REVIEW')).toBe(true));
  test('closed is terminal', () => expect(PETTY_ALLOWED.CLOSED).toEqual([]));
  test('old TRANSFERRED no longer moves', () => expect(PETTY_ALLOWED.TRANSFERRED).toEqual([]));
});
