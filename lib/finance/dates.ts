/** value/today: 'YYYY-MM-DD'. Blank value is never "before" — required-ness is enforced elsewhere. */
export function isBeforeToday(value: string, today: string): boolean {
  if (!value) return false;
  return value < today;
}
