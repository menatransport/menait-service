import { describe, expect, test } from 'bun:test';
import type { PettyClaim } from '@/app/finance/types-petty';
import {
  FLOW_STEPS, flowPosition, matchesSearch, matchesTab, pageCount, paginate, paidInRange, quickAction, sortClaims, tabCounts,
  type PettyTab,
} from './petty-list';

const base = {
  id: 1, fund_id: 1, expense_type: 'WEIGH', expense_date: '2026-10-10', period_from: '2026-10-06', period_to: '2026-10-09',
  driver_employee_id: null, driver_name: null, payee_name: 'สถานีชั่ง ลาดกระบัง', amount: 420, dd_no: null, receipt_no: null,
  created_by: '680043', created_by_name: 'กฤตบุญ ลายเงิน', approved_by: null, approved_at: null, transfer_date: null,
  review_remark: null, return_reason: null, reviewed_by: null, reviewed_at: null, submitted_to_acc_at: null,
  dup_override_reason: null, batch_id: null, items: [],
} as const;
const claim = (over: Partial<PettyClaim>): PettyClaim =>
  ({ ...base, form_id: 'LB-B02-2610-068', status: 'PENDING_APPROVAL', ...over }) as PettyClaim;

const TABS: PettyTab[] = [
  { key: 'pending', label: 'รออนุมัติ', statuses: ['PENDING_APPROVAL'] },
  { key: 'review', label: 'รอตรวจ', statuses: ['AWAITING_REVIEW'] },
  { key: 'passed', label: 'ตรวจผ่าน', statuses: ['REVIEWED'] },
  { key: 'all', label: 'ทั้งหมด' },
];

describe('matchesTab', () => {
  test('status tab', () => expect(matchesTab(claim({}), TABS[0])).toBe(true));
  test('all tab takes everything', () => expect(matchesTab(claim({ status: 'CLOSED' }), TABS[3])).toBe(true));
  test('passed is its own status now (no reviewed flag)', () => {
    expect(matchesTab(claim({ status: 'AWAITING_REVIEW' }), TABS[2])).toBe(false);
    expect(matchesTab(claim({ status: 'REVIEWED' }), TABS[2])).toBe(true);
  });
});

describe('tabCounts', () => {
  test('counts per tab over the whole list', () => {
    const rows = [claim({}), claim({ id: 2, status: 'AWAITING_REVIEW' }), claim({ id: 3, status: 'CLOSED' })];
    expect(tabCounts(rows, TABS)).toEqual({ pending: 1, review: 1, passed: 0, all: 3 });
  });
});

describe('matchesSearch', () => {
  const c = claim({ dd_no: 'LBDD26090931' });
  test('empty query matches', () => expect(matchesSearch(c, '', 'ค่าชั่งน้ำหนัก')).toBe(true));
  test('by form id, case-insensitive', () => expect(matchesSearch(c, 'lb-b02-2610-068', '')).toBe(true));
  test('by clerk name', () => expect(matchesSearch(c, 'ลายเงิน', '')).toBe(true));
  test('by payee', () => expect(matchesSearch(c, 'ลาดกระบัง', '')).toBe(true));
  test('by DD', () => expect(matchesSearch(c, '26090931', '')).toBe(true));
  test('by type name', () => expect(matchesSearch(c, 'ชั่ง', 'ค่าชั่งน้ำหนัก')).toBe(true));
  test('no match', () => expect(matchesSearch(c, 'ยาง', 'ค่าชั่งน้ำหนัก')).toBe(false));
});

describe('sortClaims / paginate', () => {
  const rows = [claim({ id: 1 }), claim({ id: 3 }), claim({ id: 2 })];
  test('desc = newest first by id', () => expect(sortClaims(rows, 'desc').map(c => c.id)).toEqual([3, 2, 1]));
  test('asc', () => expect(sortClaims(rows, 'asc').map(c => c.id)).toEqual([1, 2, 3]));
  test('does not mutate', () => { sortClaims(rows, 'desc'); expect(rows.map(c => c.id)).toEqual([1, 3, 2]); });
  test('pageCount never below 1', () => { expect(pageCount(0, 20)).toBe(1); expect(pageCount(41, 20)).toBe(3); });
  test('paginate slices', () => expect(paginate([1, 2, 3, 4, 5], 2, 2)).toEqual([3, 4]));
});

describe('quickAction — ปุ่มลัดตามสถานะและบทบาท', () => {
  test('holder: pending → approve and pay', () =>
    expect(quickAction(claim({}), 'holder')).toEqual({ action: 'approve', label: 'อนุมัติจ่าย' }));
  test('holder: approved claims go out as a round, not one by one', () =>
    expect(quickAction(claim({ status: 'APPROVED' }), 'holder')).toBeNull());
  test('holder: nothing to do once at accounting', () =>
    expect(quickAction(claim({ status: 'AWAITING_REVIEW' }), 'holder')).toBeNull());
  test('accounting: awaiting review → review', () =>
    expect(quickAction(claim({ status: 'AWAITING_REVIEW' }), 'accounting')?.action).toBe('review'));
  test('accounting: already passed → nothing', () =>
    expect(quickAction(claim({ status: 'REVIEWED' }), 'accounting')).toBeNull());
  test('accounting never approves', () => expect(quickAction(claim({}), 'accounting')).toBeNull());
  test('requester never has a quick action', () => expect(quickAction(claim({}), 'mine')).toBeNull());
  test('holder waits while the head has not approved', () =>
    expect(quickAction(claim({ status: 'PENDING_HEAD' }), 'holder')).toBeNull());
  test('holder who is also the head approves in one click', () =>
    expect(quickAction(claim({ status: 'PENDING_HEAD', can_head_approve: true }), 'holder')?.action).toBe('approve'));
});

describe('flowPosition — แถบขั้นตอน', () => {
  test('seven steps in order — หัวหน้าอนุมัติก่อนเจ้าของเงินสด (flow v3)', () =>
    expect(FLOW_STEPS.map(s => s.status)).toEqual(
      ['PENDING_HEAD', 'PENDING_APPROVAL', 'APPROVED', 'CLEAR_PENDING', 'AWAITING_REVIEW', 'REVIEWED', 'CLOSED']));
  test('on-track statuses map to their step', () => {
    expect(flowPosition('PENDING_HEAD')).toEqual({ index: 0, offTrack: false });
    expect(flowPosition('PENDING_APPROVAL')).toEqual({ index: 1, offTrack: false });
    expect(flowPosition('CLEAR_PENDING')).toEqual({ index: 3, offTrack: false });
    expect(flowPosition('CLOSED')).toEqual({ index: 6, offTrack: false });
  });
  test('returned sits at step 0 off track', () => expect(flowPosition('RETURNED')).toEqual({ index: 0, offTrack: true }));
  test('sent back sits at the accounting step off track (clerk fixes, then straight back)', () =>
    expect(flowPosition('SENT_BACK')).toEqual({ index: 4, offTrack: true }));
  test('old transferred claims sit with the approved ones', () =>
    expect(flowPosition('TRANSFERRED')).toEqual({ index: 2, offTrack: false }));
});

describe('paidInRange — รวมรอบตามช่วงวันที่จ่าย (29/10/2026)', () => {
  const paid = (d: string | null) => claim({ status: 'APPROVED', transfer_date: d });
  test('inside the range, both ends included', () => {
    expect(paidInRange(paid('2026-10-20'), '2026-10-20', '2026-10-26')).toBe(true);
    expect(paidInRange(paid('2026-10-26'), '2026-10-20', '2026-10-26')).toBe(true);
  });
  test('outside', () => expect(paidInRange(paid('2026-10-27'), '2026-10-20', '2026-10-26')).toBe(false));
  test('open ends take everything on that side', () => {
    expect(paidInRange(paid('2026-01-01'), '', '2026-10-26')).toBe(true);
    expect(paidInRange(paid('2026-12-31'), '2026-10-20', '')).toBe(true);
  });
  test('no payment date only matches an open range', () => {
    expect(paidInRange(paid(null), '', '')).toBe(true);
    expect(paidInRange(paid(null), '2026-10-20', '')).toBe(false);
  });
});
