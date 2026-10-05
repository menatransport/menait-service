import { describe, expect, test } from 'bun:test';
import { FORM_ID_PATTERN, isSafeUploadName } from './s3';

describe('FORM_ID_PATTERN', () => {
  test.each(['ADV-2610-001', 'ADV-2026-0004', 'IT-2026-0012', 'ADV-2610-1000'])('accepts %s', id => {
    expect(FORM_ID_PATTERN.test(id)).toBe(true);
  });
  test.each(['ADV-2610-01', 'ADV-261-001', 'ADV-2610-', '../ADV-2610-001', 'ADV-2610-001/x', 'ADV 2610-001', ''])('rejects %j', id => {
    expect(FORM_ID_PATTERN.test(id)).toBe(false);
  });
});

describe('isSafeUploadName', () => {
  test.each(['slip.pdf', '1759650000000-ใบเสร็จ.jpg', 'a b (1).png', '..pdf'])('accepts %j', n => {
    expect(isSafeUploadName(n)).toBe(true);
  });
  test.each(['', ' ', '.', '..', 'pay/slip.pdf', '../ADV-2610-001/pay/x.pdf', 'a\\b.pdf', 'a\u0000.pdf', 'x'.repeat(256), null, 3])('rejects %j', n => {
    expect(isSafeUploadName(n)).toBe(false);
  });
});
