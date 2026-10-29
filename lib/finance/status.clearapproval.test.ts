import { describe, expect, it } from 'bun:test';
import { STATUS_LABELS, STATUS_STYLES, type AdvanceStatus } from './status';

describe('สถานะรออนุมัติเคลียร์', () => {
  it('มีป้ายภาษาไทย', () => {
    expect(STATUS_LABELS.CLEARING_APPROVAL).toBe('รออนุมัติเคลียร์');
  });

  it('มีสีประจำสถานะ', () => {
    expect(STATUS_STYLES.CLEARING_APPROVAL).toContain('amber');
  });

  it('ทุกสถานะมีทั้งป้ายและสี', () => {
    const keys = Object.keys(STATUS_LABELS) as AdvanceStatus[];
    for (const k of keys) {
      expect(STATUS_LABELS[k]).toBeTruthy();
      expect(STATUS_STYLES[k]).toBeTruthy();
    }
  });
});
