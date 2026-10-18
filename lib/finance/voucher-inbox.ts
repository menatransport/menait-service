/** Shared with the in-app notifier so the rule "what is already there is not news" is testable. */
export type VoucherInboxItem = {
  form_id: string;
  requester_name: string | null;
  amount: number | null;
  created_at: string | null;
};

export const SEEN_CAP = 200;

/** Items the user has not been told about yet. */
export function freshItems(items: VoucherInboxItem[], seen: Iterable<string>): VoucherInboxItem[] {
  const known = new Set(seen);
  return items.filter(it => !known.has(it.form_id));
}

/** The newest ids, capped, so the stored list cannot grow without end. */
export function nextSeen(seen: Iterable<string>, items: VoucherInboxItem[]): string[] {
  const out = [...new Set([...seen, ...items.map(it => it.form_id)])];
  return out.slice(-SEEN_CAP);
}
