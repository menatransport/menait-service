import { describe, expect, test } from 'bun:test';
import type { PettyClaim, PettyExpenseType, PettyRound } from '@/app/finance/types-petty';
import {
  ALL_TYPES_LABEL, TYPE_PARAM, fetchAllClaimPages, filterByType, filterRoundsByType, matchesType, resolveTypeParam,
  roundMatchesType, roundTypeCount, roundTypeHint, roundsMissingTally, tallyRoundTypes, typeOptions, typeRoundColumns,
  withTypeParam,
} from './petty-type-filter';

let seq = 0;
const claim = (expense_type: string, over: Partial<PettyClaim> = {}): PettyClaim => {
  seq += 1;
  return {
    id: seq, form_id: `LB-B02-2610-${String(seq).padStart(3, '0')}`, fund_id: 1, expense_type,
    expense_date: '2026-10-20', period_from: null, period_to: null, driver_employee_id: null, driver_name: null,
    payee_name: 'ร้านยางสมใจ', amount: 100, dd_no: null, receipt_no: null, status: 'APPROVED',
    created_by: '680043', approved_by: null, approved_at: null, transfer_date: null, review_remark: null,
    return_reason: null, reviewed_by: null, reviewed_at: null, submitted_to_acc_at: null, dup_override_reason: null,
    batch_id: null, items: [], ...over,
  };
};
const round = (id: number, over: Partial<PettyRound> = {}): PettyRound => ({
  id, batch_no: `LB-B02-2610-B${id}`, fund_id: 1, status: 'AWAITING_REVIEW', status_label: 'รอบัญชีตรวจ',
  branch_code: '03', division_code: 'B02', holder_employee_id: '12345', holder_name: 'สมพร ถือเงิน',
  total_amount: 1000, remark: null, claim_count: 3, submitted_by: '12345', submitted_at: '2026-10-27T03:00:00Z',
  clear_required_level: 5, clear_approved_by: null, clear_approved_by_name: null, clear_approved_at: null,
  clear_reject_reason: null, voucher_no: null, vouchered_by: null, vouchered_at: null, pay_date: null, paid_by: null,
  paid_at: null, closed_by: null, closed_at: null, ...over,
});
const type = (code: string, name_th: string, sort_order: number, is_active = true): PettyExpenseType =>
  ({ code, name_th, atms_sku: null, sort_order, is_active, spec: {} });

const TYPES = [
  type('GENERAL', 'ค่าใช้จ่ายทั่วไป', 6),
  type('WEIGH', 'ค่าชั่งน้ำหนัก', 1),
  type('OLD', 'ประเภทที่เลิกใช้', 0, false),
  type('TOLL', 'ค่าทางด่วน', 2),
];
const nameOf = (code: string) => TYPES.find(t => t.code === code)?.name_th ?? code;

describe('typeOptions', () => {
  test('active types only, sorted by sort_order, labelled with name_th', () => {
    expect(typeOptions(TYPES)).toEqual([
      { code: 'WEIGH', label: 'ค่าชั่งน้ำหนัก' },
      { code: 'TOLL', label: 'ค่าทางด่วน' },
      { code: 'GENERAL', label: 'ค่าใช้จ่ายทั่วไป' },
    ]);
  });
  test('the "all" choice reads ทุกประเภท and the URL key is type', () => {
    expect(ALL_TYPES_LABEL).toBe('ทุกประเภท');
    expect(TYPE_PARAM).toBe('type');
  });
});

describe('resolveTypeParam', () => {
  test('known code passes, case-insensitive and trimmed', () => {
    expect(resolveTypeParam('GENERAL', TYPES)).toBe('GENERAL');
    expect(resolveTypeParam(' weigh ', TYPES)).toBe('WEIGH');
  });
  test('missing, blank or unknown → all types', () => {
    expect(resolveTypeParam(null, TYPES)).toBe('');
    expect(resolveTypeParam(undefined, TYPES)).toBe('');
    expect(resolveTypeParam('  ', TYPES)).toBe('');
    expect(resolveTypeParam('NOPE', TYPES)).toBe('');
  });
  test('inactive type in the link is ignored (it is not in the dropdown)', () => {
    expect(resolveTypeParam('OLD', TYPES)).toBe('');
  });
  test('types not loaded yet → all types (never filter blind)', () => {
    expect(resolveTypeParam('WEIGH', [])).toBe('');
  });
});

describe('withTypeParam', () => {
  test('adds type and keeps other params', () => {
    expect(withTypeParam('tab=pay', 'TOLL')).toBe('tab=pay&type=TOLL');
    expect(withTypeParam('?tab=clear&doc=LB-1', 'WEIGH')).toBe('tab=clear&doc=LB-1&type=WEIGH');
  });
  test('replaces an existing type', () => {
    expect(withTypeParam('type=WEIGH&tab=pay', 'GENERAL')).toBe('type=GENERAL&tab=pay');
  });
  test('blank code removes type (back to ทุกประเภท)', () => {
    expect(withTypeParam('tab=pay&type=WEIGH', '')).toBe('tab=pay');
    expect(withTypeParam('type=WEIGH', '')).toBe('');
    expect(withTypeParam('', '')).toBe('');
  });
});

describe('claim filtering', () => {
  const rows = [claim('WEIGH'), claim('TOLL'), claim('WEIGH')];
  test('blank code keeps everything', () => {
    expect(filterByType(rows, '')).toEqual(rows);
    expect(matchesType(rows[1], '')).toBe(true);
  });
  test('code keeps only claims of that type', () => {
    expect(filterByType(rows, 'WEIGH').map(c => c.id)).toEqual([rows[0].id, rows[2].id]);
    expect(matchesType(rows[1], 'WEIGH')).toBe(false);
  });
});

describe('round tally', () => {
  test('counts claims per type per round from claims with batch_id', () => {
    const tally = tallyRoundTypes([
      claim('WEIGH', { batch_id: 7, amount: 300 }), claim('WEIGH', { batch_id: 7, amount: 200 }),
      claim('TOLL', { batch_id: 7, amount: 50 }), claim('TOLL', { batch_id: 8 }), claim('WEIGH', { batch_id: null }),
    ]);
    expect(roundTypeCount(round(7), 'WEIGH', tally)).toEqual({ count: 2, amount: 500, complete: true });
    expect(roundTypeCount(round(7), 'GENERAL', tally)).toEqual({ count: 0, amount: 0, complete: true });
    expect(roundTypeCount(round(8, { claim_count: 1 }), 'TOLL', tally)).toEqual({ count: 1, amount: 100, complete: true });
  });

  test('round details (round.claims) count too, without double counting the same claim', () => {
    const c1 = claim('WEIGH', { batch_id: 9, amount: 10 });
    const c2 = claim('GENERAL', { batch_id: 9, amount: 20 });
    const detail = round(9, { claim_count: 2, claims: [c1, c2] });
    const tally = tallyRoundTypes([c1], [detail]);
    expect(roundTypeCount(detail, 'WEIGH', tally)).toEqual({ count: 1, amount: 10, complete: true });
    expect(roundTypeCount(detail, 'GENERAL', tally)).toEqual({ count: 1, amount: 20, complete: true });
  });

  test('fewer known claims than claim_count = incomplete', () => {
    const tally = tallyRoundTypes([claim('WEIGH', { batch_id: 7 })]);
    expect(roundTypeCount(round(7, { claim_count: 3 }), 'TOLL', tally)).toEqual({ count: 0, amount: 0, complete: false });
    expect(roundTypeCount(round(5, { claim_count: 2 }), 'TOLL', tally)).toEqual({ count: 0, amount: 0, complete: false });
  });

  test('a round with no claims left (หัวหน้าไม่อนุมัติ → ใบหลุดรอบ) is known-empty', () => {
    expect(roundTypeCount(round(4, { claim_count: 0 }), 'WEIGH', new Map())).toEqual({ count: 0, amount: 0, complete: true });
  });

  test('roundsMissingTally lists rounds we cannot judge yet', () => {
    const tally = tallyRoundTypes([claim('WEIGH', { batch_id: 1 }), claim('WEIGH', { batch_id: 2 }), claim('TOLL', { batch_id: 2 })]);
    const rounds = [round(1, { claim_count: 1 }), round(2, { claim_count: 2 }), round(3, { claim_count: 4 }), round(4, { claim_count: 0 })];
    expect(roundsMissingTally(rounds, tally)).toEqual([3]);
  });
});

describe('round filtering', () => {
  const tally = tallyRoundTypes([
    claim('WEIGH', { batch_id: 1 }), claim('TOLL', { batch_id: 1 }),
    claim('TOLL', { batch_id: 2 }), claim('TOLL', { batch_id: 2 }),
  ]);
  const rounds = [round(1, { claim_count: 2 }), round(2, { claim_count: 2 }), round(3, { claim_count: 5 }), round(4, { claim_count: 0 })];

  test('blank code keeps every round', () => {
    expect(filterRoundsByType(rounds, '', tally)).toEqual(rounds);
  });
  test('keeps rounds with at least one claim of the type', () => {
    expect(filterRoundsByType(rounds, 'TOLL', tally).map(r => r.id)).toEqual([1, 2, 3]);
    expect(filterRoundsByType(rounds, 'WEIGH', tally).map(r => r.id)).toEqual([1, 3]);
  });
  test('round we know nothing about stays (do not hide work); empty round goes', () => {
    expect(roundMatchesType(rounds[2], 'GENERAL', tally)).toBe(true);
    expect(roundMatchesType(rounds[3], 'GENERAL', tally)).toBe(false);
    expect(roundMatchesType(rounds[1], 'WEIGH', tally)).toBe(false);
  });
  test('round totals are untouched', () => {
    expect(filterRoundsByType(rounds, 'WEIGH', tally)[0].total_amount).toBe(1000);
  });
});

describe('roundTypeHint', () => {
  const tally = tallyRoundTypes([
    claim('WEIGH', { batch_id: 1 }), claim('WEIGH', { batch_id: 1 }), claim('TOLL', { batch_id: 1 }),
    claim('TOLL', { batch_id: 2 }), claim('TOLL', { batch_id: 2 }),
    claim('TOLL', { batch_id: 3 }),
  ]);
  test('part of the round', () => {
    expect(roundTypeHint(round(1, { claim_count: 3 }), 'WEIGH', tally, nameOf)).toBe('มีค่าชั่งน้ำหนัก 2 จาก 3 ใบ');
  });
  test('whole round', () => {
    expect(roundTypeHint(round(2, { claim_count: 2 }), 'TOLL', tally, nameOf)).toBe('ค่าทางด่วนทั้งรอบ 2 ใบ');
  });
  test('only part of the round loaded → at least', () => {
    expect(roundTypeHint(round(3, { claim_count: 4 }), 'TOLL', tally, nameOf)).toBe('มีค่าทางด่วนอย่างน้อย 1 ใบ');
  });
  test('nothing to say: no filter, none of the type, or unknown', () => {
    expect(roundTypeHint(round(1, { claim_count: 3 }), '', tally, nameOf)).toBeNull();
    expect(roundTypeHint(round(2, { claim_count: 2 }), 'WEIGH', tally, nameOf)).toBeNull();
    expect(roundTypeHint(round(9, { claim_count: 2 }), 'WEIGH', tally, nameOf)).toBeNull();
  });
});

describe('typeRoundColumns (extra Excel columns for rounds)', () => {
  const tally = tallyRoundTypes([claim('WEIGH', { batch_id: 1, amount: 420 }), claim('WEIGH', { batch_id: 1, amount: 80 }), claim('TOLL', { batch_id: 1 })]);
  test('no filter → no extra columns', () => {
    expect(typeRoundColumns('', nameOf, tally)).toEqual([]);
  });
  test('count + amount of the chosen type in each round', () => {
    const cols = typeRoundColumns('WEIGH', nameOf, tally);
    expect(cols.map(c => c.label)).toEqual(['จำนวนใบค่าชั่งน้ำหนัก', 'ยอดค่าชั่งน้ำหนัก']);
    const r = round(1, { claim_count: 3 });
    const ctx = { typeName: nameOf, fundOf: () => undefined, roundNo: () => null };
    expect(cols[0].text(r, ctx)).toBe('2');
    expect(cols[0].value?.(r)).toBe(2); // Excel เป็นตัวเลข รวมได้
    expect(cols[1].money).toBe(true);
    expect(cols[1].value?.(r)).toBe(500);
  });
});

describe('fetchAllClaimPages', () => {
  test('walks offset pages until total, deduping by id', async () => {
    const all = Array.from({ length: 5 }, (_, i) => claim('WEIGH', { id: 1000 + i }));
    const calls: [number, number][] = [];
    const res = await fetchAllClaimPages(async (offset, limit) => {
      calls.push([offset, limit]);
      // หน้าสองซ้ำแถวสุดท้ายของหน้าแรก (รายการเปลี่ยนระหว่างดึง)
      const items = offset === 2 ? [all[1], all[2], all[3]].slice(0, limit) : all.slice(offset, offset + limit);
      return { total: 5, items };
    }, 2);
    expect(calls).toEqual([[0, 2], [2, 2], [4, 2]]);
    expect(res.items.map(c => c.id)).toEqual([1000, 1001, 1002, 1004]);
    expect(res.total).toBe(5);
    expect(res.complete).toBe(true);
  });

  test('single request when the first page already has everything', async () => {
    let n = 0;
    const res = await fetchAllClaimPages(async () => { n += 1; return { total: 2, items: [claim('A'), claim('B')] }; }, 200);
    expect(n).toBe(1);
    expect(res.items).toHaveLength(2);
    expect(res.complete).toBe(true);
  });

  test('stops at the page cap and says it is incomplete', async () => {
    let n = 0;
    const res = await fetchAllClaimPages(async (offset, limit) => {
      n += 1;
      return { total: 100, items: Array.from({ length: limit }, (_, i) => claim('A', { id: 5000 + offset + i })) };
    }, 10, 3);
    expect(n).toBe(3);
    expect(res.items).toHaveLength(30);
    expect(res.complete).toBe(false);
  });

  test('empty page ends the walk', async () => {
    const res = await fetchAllClaimPages(async () => ({ total: 50, items: [] }), 10);
    expect(res.items).toEqual([]);
    expect(res.complete).toBe(false);
  });
});
