import { describe, expect, test } from 'bun:test';
import { FORM_ID_PATTERN } from '@/lib/s3';
import { canApprove, canCloseBatch, canSeeClaim, isPettyFormId } from './petty-access';

const fund = { id: 1, branch_code: '03', division_code: 'B02', holder_employee_id: '12345' };

describe('isPettyFormId', () => {
  test('accepts the real shape', () => expect(isPettyFormId('03-B02-2610-001')).toBe(true));
  test('rejects an ADV id', () => expect(isPettyFormId('ADV-2610-001')).toBe(false));
  test('rejects a path traversal attempt', () => expect(isPettyFormId('../../etc/passwd')).toBe(false));
  test('the shared S3 pattern already accepts it — do not change that regex', () => {
    expect(FORM_ID_PATTERN.test('03-B02-2610-001')).toBe(true);
  });
});

describe('canApprove', () => {
  test('fund holder may', () => expect(canApprove({ employee_id: '12345' }, fund)).toBe(true));
  test('someone else may not, even finance', () =>
    expect(canApprove({ employee_id: '99999', is_finance: true }, fund)).toBe(false));
  test('no fund means no', () => expect(canApprove({ employee_id: '12345' }, null)).toBe(false));
});

describe('canSeeClaim', () => {
  const claim = { created_by: '55555', fund_id: 1, status: 'PENDING_APPROVAL' as const };
  test('the clerk who opened it', () =>
    expect(canSeeClaim({ employee_id: '55555' }, claim, [])).toBe(true));
  test('the holder of its fund', () =>
    expect(canSeeClaim({ employee_id: '12345' }, claim, [fund])).toBe(true));
  test('another clerk cannot', () =>
    expect(canSeeClaim({ employee_id: '77777' }, claim, [])).toBe(false));
  test('finance sees it only from AWAITING_REVIEW onwards', () => {
    expect(canSeeClaim({ employee_id: '9', is_finance: true }, claim, [])).toBe(false);
    expect(canSeeClaim({ employee_id: '9', is_finance: true }, { ...claim, status: 'AWAITING_REVIEW' }, []))
      .toBe(true);
  });
  test('admin sees everything', () =>
    expect(canSeeClaim({ employee_id: '9', role: 'a' }, claim, [])).toBe(true));
});

describe('canCloseBatch', () => {
  test('finance may', () => expect(canCloseBatch({ employee_id: '9', is_finance: true })).toBe(true));
  test('a clerk may not', () => expect(canCloseBatch({ employee_id: '55555' })).toBe(false));
});
