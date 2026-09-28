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
