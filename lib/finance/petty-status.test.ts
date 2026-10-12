import { describe, expect, test } from 'bun:test';
import { PETTY_ALLOWED, PETTY_STATUS_LABELS, PETTY_STATUS_STYLES, canGo } from './petty-status';

describe('labels', () => {
  test('seven statuses', () => expect(Object.keys(PETTY_STATUS_LABELS)).toHaveLength(7));
  test('wording matches the spec', () => {
    expect(PETTY_STATUS_LABELS.APPROVED).toBe('อนุมัติแล้ว รอโอน');
    expect(PETTY_STATUS_LABELS.TRANSFERRED).toBe('โอนแล้ว รอเคลียร์เอกสาร');
    expect(PETTY_STATUS_LABELS.CLOSED).toBe('คืนยอดแล้ว');
    expect(PETTY_STATUS_LABELS.RETURNED).toBe('ตีกลับผู้เบิก');
  });
  test('every status has a style', () => {
    expect(Object.keys(PETTY_STATUS_STYLES).sort()).toEqual(Object.keys(PETTY_STATUS_LABELS).sort());
  });
});

describe('transitions mirror the backend', () => {
  test('approve', () => expect(canGo('PENDING_APPROVAL', 'APPROVED')).toBe(true));
  test('resubmit after return', () => expect(canGo('RETURNED', 'PENDING_APPROVAL')).toBe(true));
  test('cannot skip transfer', () => expect(canGo('APPROVED', 'AWAITING_REVIEW')).toBe(false));
  test('closed is terminal', () => expect(PETTY_ALLOWED.CLOSED).toEqual([]));
});
