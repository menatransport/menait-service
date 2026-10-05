/** An item counts as Advance when either the shared forms engine's form_code or form_type says so. */
export function isAdvanceItem(item: unknown): boolean {
  if (!item || typeof item !== 'object') return false;
  const it = item as Record<string, unknown>;
  if (it.form_code === 'ADV') return true;
  if (it.form_type === 'Advance') return true;
  return false;
}

/** Splits IT vs Advance form submissions. Non-array input passes through unchanged (defensive). */
export function filterByScope<T>(items: T, scope: 'it' | 'advance'): T {
  if (!Array.isArray(items)) return items;
  return items.filter(item => (scope === 'advance' ? isAdvanceItem(item) : !isAdvanceItem(item))) as T;
}

/**
 * /api/tickets: role 'a' lists every user's forms. Honour it only when the session user is entitled to that
 * scope — IT admins (session role 'a') for IT forms, Finance for ADV. A client-sent role never widens access.
 */
export function canListAll(opts: {
  clientRole: string | null | undefined;
  scope: 'it' | 'advance';
  sessionRole?: string | null;
  isFinance?: boolean | null;
}): boolean {
  if (opts.clientRole !== 'a') return false;
  return opts.scope === 'advance' ? opts.isFinance === true : opts.sessionRole === 'a';
}
