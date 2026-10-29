import { describe, expect, test } from 'bun:test';
import { FORM_ID_PATTERN } from '@/lib/s3';
import { canApprove, canCloseBatch, canReview, canSeeAllClaims, canSeeClaim, canSeeRound, canVoucher, isPettyFormId } from './petty-access';

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
  test('accounting sees it only from AWAITING_REVIEW onwards', () => {
    expect(canSeeClaim({ employee_id: '9', is_accounting: true }, claim, [])).toBe(false);
    expect(canSeeClaim({ employee_id: '9', is_accounting: true }, { ...claim, status: 'AWAITING_REVIEW' }, []))
      .toBe(true);
  });
  test('treasury sees the same window', () =>
    expect(canSeeClaim({ employee_id: '9', is_treasury: true }, { ...claim, status: 'CLOSED' }, []))
      .toBe(true));
  test('the old is_finance flag keeps working during the rollout', () =>
    expect(canSeeClaim({ employee_id: '9', is_finance: true }, { ...claim, status: 'AWAITING_REVIEW' }, []))
      .toBe(true));
  test('admin sees everything', () =>
    expect(canSeeClaim({ employee_id: '9', role: 'a' }, claim, [])).toBe(true));
});

describe('canCloseBatch', () => {
  test('finance may', () => expect(canCloseBatch({ employee_id: '9', is_finance: true })).toBe(true));
  test('a clerk may not', () => expect(canCloseBatch({ employee_id: '55555' })).toBe(false));
});

describe('ปิดรอบเป็นงานการเงิน ตรวจเอกสารเป็นงานบัญชี', () => {
  test('treasury may close', () =>
    expect(canCloseBatch({ employee_id: '90001', is_treasury: true })).toBe(true));
  test('accounting may not close', () =>
    expect(canCloseBatch({ employee_id: '80001', is_accounting: true })).toBe(false));
  test('accounting may review', () =>
    expect(canReview({ employee_id: '80001', is_accounting: true })).toBe(true));
  test('treasury may not review', () =>
    expect(canReview({ employee_id: '90001', is_treasury: true })).toBe(false));
  test('admin may do both', () => {
    expect(canCloseBatch({ employee_id: '1', role: 'a' })).toBe(true);
    expect(canReview({ employee_id: '1', role: 'a' })).toBe(true);
  });
  test('a plain clerk may do neither', () => {
    expect(canReview({ employee_id: '55555' })).toBe(false);
    expect(canCloseBatch({ employee_id: '55555' })).toBe(false);
  });
  test('is_finance still works while the new flags roll out', () => {
    // ระหว่างที่ยังไม่ได้ตั้ง env ใหม่ คนที่เคยเป็น is_finance ต้องทำงานได้เหมือนเดิม
    expect(canReview({ employee_id: '9', is_finance: true })).toBe(true);
    expect(canCloseBatch({ employee_id: '9', is_finance: true })).toBe(true);
  });
});

describe('canSeeAllClaims — ใครดึงคิวทุกกองทุนได้', () => {
  test('accounting may', () => expect(canSeeAllClaims({ employee_id: '8', is_accounting: true })).toBe(true));
  test('treasury may', () => expect(canSeeAllClaims({ employee_id: '9', is_treasury: true })).toBe(true));
  test('admin may', () => expect(canSeeAllClaims({ employee_id: '1', role: 'a' })).toBe(true));
  test('the old flag still may during the rollout', () =>
    expect(canSeeAllClaims({ employee_id: '9', is_finance: true })).toBe(true));
  test('a clerk may not — ค่าเริ่มต้นต้องแคบสุด', () =>
    expect(canSeeAllClaims({ employee_id: '55555' })).toBe(false));
  test('an approver may not either; they get their own funds only', () =>
    expect(canSeeAllClaims({ employee_id: '12345' })).toBe(false));
  test('no session means no', () => expect(canSeeAllClaims(null)).toBe(false));
});

describe('เลขที่ใบแบบตัวอักษรสาขา (2026-10-13)', () => {
  test('LB-B02-2610-001 เป็นเลขที่ใบเบิก', () => expect(isPettyFormId('LB-B02-2610-001')).toBe(true));
  test('สาขาที่ยังเป็นตัวเลขก็ยังใช้ได้', () => expect(isPettyFormId('04-A01-2610-001')).toBe(true));
  test('ADV ยังไม่ใช่', () => expect(isPettyFormId('ADV-2610-001')).toBe(false));
});

describe('flow v2 (29/10/2026)', () => {
  const claimAt = (status: string) => ({ created_by: '1', fund_id: 1, status }) as never;
  test('back office sees claims that passed review but are not paid yet', () =>
    expect(canSeeClaim({ employee_id: '9', is_accounting: true }, claimAt('REVIEWED'), [])).toBe(true));
  test('back office does not see claims still with the head', () =>
    expect(canSeeClaim({ employee_id: '9', is_accounting: true }, claimAt('CLEAR_PENDING'), [])).toBe(false));
  test('voucher is accounting work', () => {
    expect(canVoucher({ employee_id: '8', is_accounting: true })).toBe(true);
    expect(canVoucher({ employee_id: '9', is_treasury: true })).toBe(false);
  });

  const round = { holder_employee_id: '12345', clear_approved_by: null, can_clear: false };
  test('holder sees their round', () => expect(canSeeRound({ employee_id: '12345' }, round)).toBe(true));
  test('the head who may clear sees it', () =>
    expect(canSeeRound({ employee_id: '600100' }, { ...round, can_clear: true })).toBe(true));
  test('the head who already decided still sees it', () =>
    expect(canSeeRound({ employee_id: '600100' }, { ...round, clear_approved_by: '600100' })).toBe(true));
  test('back office and admin see every round', () => {
    expect(canSeeRound({ employee_id: '9', is_treasury: true }, round)).toBe(true);
    expect(canSeeRound({ employee_id: '1', role: 'a' }, round)).toBe(true);
  });
  test('anyone else does not', () => expect(canSeeRound({ employee_id: '777' }, round)).toBe(false));
});
