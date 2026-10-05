import { describe, expect, test } from 'bun:test';
import { FORM_ID_PATTERN } from './s3';

describe('FORM_ID_PATTERN', () => {
  test.each(['ADV-2610-001', 'ADV-2026-0004', 'IT-2026-0012', 'ADV-2610-1000'])('accepts %s', id => {
    expect(FORM_ID_PATTERN.test(id)).toBe(true);
  });
  test.each(['ADV-2610-01', 'ADV-261-001', 'ADV-2610-', '../ADV-2610-001', 'ADV-2610-001/x', 'ADV 2610-001', ''])('rejects %j', id => {
    expect(FORM_ID_PATTERN.test(id)).toBe(false);
  });
});
