import { describe, expect, test } from 'bun:test';
import { stepBadge, stepChainText } from './approvalSteps';

describe('approvalSteps', () => {
  test('chain text only for 2+ steps', () => {
    expect(stepChainText(undefined)).toBeNull();
    expect(stepChainText([{ step: 1, required_level: 4, label: 'หัวหน้าระดับ 4 ขึ้นไป' }])).toBeNull();
    expect(stepChainText([
      { step: 1, required_level: 4, label: 'หัวหน้าระดับ 4 ขึ้นไป' },
      { step: 2, required_level: 5, label: 'ระดับ 5 ขึ้นไป (ข้อ 6.5 · x)' },
    ])).toBe('ขั้น 1: หัวหน้าระดับ 4 ขึ้นไป → ขั้น 2: ระดับ 5 ขึ้นไป (ข้อ 6.5 · x)');
  });
  test('badge degrades without fields', () => {
    expect(stepBadge(undefined, undefined)).toBeNull();
    expect(stepBadge(2, 2)).toBe('ขั้น 2/2');
  });
});
