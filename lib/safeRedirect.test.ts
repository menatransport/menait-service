import { describe, expect, test } from 'bun:test';
import { safeNextPath } from './safeRedirect';

describe('safeNextPath', () => {
  test.each([
    '/\t/evil.com', '/\n/evil.com', '/\r/evil.com', '/\t\\evil.com', '//evil.com', '/\\evil.com',
    'https://evil.com', 'javascript:alert(1)', '/./login', '/login?next=x', '/login', '/login/x', '', 'finance', '/\u0000x',
  ])('rejects %j', v => expect(safeNextPath(v)).toBeNull());
  test('null/undefined', () => {
    expect(safeNextPath(null)).toBeNull();
    expect(safeNextPath(undefined)).toBeNull();
  });
  test('valid path round-trips', () => {
    expect(safeNextPath('/finance/approvals?doc=ADV-2026-0001')).toBe('/finance/approvals?doc=ADV-2026-0001');
    expect(safeNextPath('/home')).toBe('/home');
  });
  test('encoded forms are only dangerous once decoded; decoded raw is rejected', () => {
    expect(safeNextPath(decodeURIComponent('/%09/evil.com'))).toBeNull();
    expect(safeNextPath(decodeURIComponent('/%0A/evil.com'))).toBeNull();
    expect(safeNextPath(decodeURIComponent('/%0D/evil.com'))).toBeNull();
    expect(safeNextPath(decodeURIComponent('/%09%5Cevil.com'))).toBeNull();
  });
});
