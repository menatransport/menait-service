import { describe, expect, test } from 'bun:test';
import { safeNextPath } from './safeRedirect';

const REJECT = [
  '/\t/evil.com', '/\n/evil.com', '/\r/evil.com', '/\t\\evil.com', '//evil.com', '/\\evil.com',
  'https://evil.com', 'javascript:alert(1)', '/./login', '/login?next=x', '/login', '/login/x', '', 'finance', '/\u0000x',
  '/..//evil.com', '/.//evil.com', '/a/..//evil.com', '/%2e%2e//evil.com', '/%2e//evil.com', '/a/%2e%2e//evil.com',
];
const ACCEPT = ['/finance/approvals?doc=ADV-2026-0001', '/home'];

describe('safeNextPath', () => {
  test.each(REJECT)('rejects %j', v => expect(safeNextPath(v)).toBeNull());
  test('null/undefined', () => {
    expect(safeNextPath(null)).toBeNull();
    expect(safeNextPath(undefined)).toBeNull();
  });
  test('valid path round-trips', () => {
    for (const v of ACCEPT) expect(safeNextPath(v)).toBe(v);
  });
  test('encoded forms are only dangerous once decoded; decoded raw is rejected', () => {
    for (const e of ['/%09/evil.com', '/%0A/evil.com', '/%0D/evil.com', '/%09%5Cevil.com']) {
      expect(safeNextPath(decodeURIComponent(e))).toBeNull();
    }
  });
  test('property: any output stays on the same origin', () => {
    for (const v of [...REJECT, ...ACCEPT, '/a/./b', '/x/../y', '/a//b']) {
      const out = safeNextPath(v);
      expect(out === null || new URL(out, 'http://localhost:4000').origin === 'http://localhost:4000').toBe(true);
      if (out) expect(out.startsWith('//')).toBe(false);
    }
  });
});
