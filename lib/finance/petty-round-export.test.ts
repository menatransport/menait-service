import { describe, expect, test } from 'bun:test';
import type { PettyClaim, PettyExpenseType } from '@/app/finance/types-petty';
import { CLAIM_SHEET_COLS, ROUND_SHEET_COLS, claimSheetAoa, roundSheetAoa, roundsInRange, submittedDay, type RoundWithClaims } from './petty-round-export';

const types = [{ code: 'WEIGH', name_th: 'ค่าชั่งน้ำหนัก' }, { code: 'GENERAL', name_th: 'ค่าใช้จ่ายทั่วไป' }] as PettyExpenseType[];
const claim = (over: Partial<PettyClaim>): PettyClaim => ({
  id: 1, form_id: 'LB-B02-2611-001', fund_id: 1, expense_type: 'WEIGH', expense_date: '2026-11-20', period_from: '2026-11-18',
  period_to: '2026-11-20', payee_name: 'ประยูร', amount: 520, wht_amount: 0, dd_no: 'LBDD1', items: [], detail: {}, status: 'CLEAR_PENDING',
  ...over,
}) as unknown as PettyClaim;
const round = (over: Partial<RoundWithClaims>): RoundWithClaims => ({
  id: 10, batch_no: 'LB-B02-2611-B1', fund_id: 1, status: 'CLEAR_PENDING', submitted_at: '2026-11-24T03:00:00Z',
  clear_approved_by: null, clear_approved_by_name: null, clear_approved_at: null, voucher_no: null, pay_doc_no: null,
  claims: [claim({})], ...over,
}) as unknown as RoundWithClaims;

describe('roundsInRange — รอบตามวันส่งเคลียร์ (เวลาไทย)', () => {
  const rs = [
    round({ id: 1, submitted_at: '2026-11-01T02:00:00Z' }),
    round({ id: 2, submitted_at: '2026-11-24T18:30:00Z' }), // ไทย 25/11 01:30
    round({ id: 3, submitted_at: '2026-11-10T02:00:00Z', status: 'CLEAR_REJECTED' }),
  ];
  test('Bangkok day, not UTC day', () => expect(submittedDay(rs[1])).toBe('2026-11-25'));
  test('range both ends included, rejected rounds dropped', () =>
    expect(roundsInRange(rs, '2026-11-01', '2026-11-25').map(r => r.id)).toEqual([1, 2]));
  test('open range takes everything except rejected', () => expect(roundsInRange(rs).map(r => r.id)).toEqual([1, 2]));
  test('to-date cuts later rounds', () => expect(roundsInRange(rs, '', '2026-11-24').map(r => r.id)).toEqual([1]));
});

describe('roundSheetAoa — รอบละแถว + รวม', () => {
  const rs = [
    round({ claims: [claim({ amount: 1000, wht_amount: 10 }), claim({ id: 2, amount: 500 })], status: 'AWAITING_REVIEW',
      clear_approved_by_name: 'ชมภูนุช เกวลินวิภัช', clear_approved_at: '2026-11-25T03:00:00Z' }),
    round({ id: 11, batch_no: 'LB-B02-2611-B2', claims: [claim({ id: 3, amount: 200 })] }),
  ];
  const aoa = roundSheetAoa(rs);
  test('header', () => expect(aoa[0]).toEqual([...ROUND_SHEET_COLS]));
  test('round row: status label, head, count, amount / WHT / net', () => {
    const row = aoa[1];
    expect(row.slice(1, 7)).toEqual(['LB-B02-2611-B1', '24/11/2026', 'รอบัญชีตรวจ', 'ชมภูนุช เกวลินวิภัช', '25/11/2026', 2]);
    expect(row.slice(7, 10)).toEqual([1500, 10, 1490]);
  });
  test('no WHT stays blank, not 0', () => expect(aoa[2][8]).toBe(''));
  test('total row', () => expect(aoa[3].slice(0, 2).concat(aoa[3].slice(6, 10))).toEqual(['รวม', '2 รอบ', 3, 1700, 10, 1690]));
  test('no rounds → header only', () => expect(roundSheetAoa([])).toHaveLength(1));
});

describe('claimSheetAoa — ใบละแถว เรียงตามรอบ มีรวมต่อรอบ', () => {
  const rs = [round({ claims: [claim({ form_id: 'A1', amount: 1000, wht_amount: 10 }), claim({ form_id: 'A2', expense_type: 'GENERAL', amount: 300, dd_no: null })] })];
  const aoa = claimSheetAoa(rs, types);
  test('header', () => expect(aoa[0]).toEqual([...CLAIM_SHEET_COLS]));
  test('claim rows carry the round number and type name', () => {
    expect(aoa[1].slice(0, 5)).toEqual(['LB-B02-2611-B1', '24/11/2026', 1, 'A1', 'ค่าชั่งน้ำหนัก']);
    expect(aoa[2][4]).toBe('ค่าใช้จ่ายทั่วไป');
    expect(aoa[2][10]).toBe('-');
  });
  test('amounts per claim', () => expect(aoa[1].slice(11)).toEqual([1000, 10, 990]));
  test('round subtotal row', () => expect([aoa[3][0], aoa[3][3], ...aoa[3].slice(11)]).toEqual(['รวมรอบ LB-B02-2611-B1', '2 ใบ', 1300, 10, 1290]));
});

