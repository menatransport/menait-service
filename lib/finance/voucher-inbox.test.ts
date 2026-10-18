import { describe, expect, test } from 'bun:test';
import { freshItems, nextSeen, SEEN_CAP, type VoucherInboxItem } from './voucher-inbox';

const item = (id: string): VoucherInboxItem => ({ form_id: id, requester_name: null, amount: null, created_at: null });

describe('voucher inbox', () => {
  test('only requests the user has not been told about are fresh', () => {
    const fresh = freshItems([item('ADV-1'), item('ADV-2')], ['ADV-1']);
    expect(fresh.map(i => i.form_id)).toEqual(['ADV-2']);
  });

  test('nothing is fresh when everything is already seen', () => {
    expect(freshItems([item('ADV-1')], ['ADV-1'])).toEqual([]);
  });

  test('priming on first load marks everything seen, so nothing pops up', () => {
    const seen = nextSeen([], [item('ADV-1'), item('ADV-2')]);
    expect(freshItems([item('ADV-1'), item('ADV-2')], seen)).toEqual([]);
  });

  test('a request that arrives after priming does pop up', () => {
    const seen = nextSeen([], [item('ADV-1')]);
    expect(freshItems([item('ADV-2'), item('ADV-1')], seen).map(i => i.form_id)).toEqual(['ADV-2']);
  });

  test('the seen list never grows past the cap and keeps the newest', () => {
    const many = Array.from({ length: SEEN_CAP + 50 }, (_, i) => item(`ADV-${i}`));
    const seen = nextSeen([], many);
    expect(seen.length).toBe(SEEN_CAP);
    expect(seen.at(-1)).toBe(`ADV-${SEEN_CAP + 49}`);
  });

  test('ids are not duplicated when the same request is seen twice', () => {
    expect(nextSeen(['ADV-1'], [item('ADV-1')])).toEqual(['ADV-1']);
  });
});
