/** value/today: 'YYYY-MM-DD'. Blank value is never "before" — required-ness is enforced elsewhere. */
export function isBeforeToday(value: string, today: string): boolean {
  if (!value) return false;
  return value < today;
}

const ISO_DAY = /^\d{4}-\d{2}-\d{2}$/;

/** 'YYYY-MM-DD' → 'dd/mm/yyyy' (Christian year, no timezone shift). Anything else → ''. */
export function formatDateFull(iso: string | null | undefined): string {
  if (!iso || !ISO_DAY.test(iso)) return '';
  const [y, m, d] = iso.split('-');
  return `${d}/${m}/${y}`;
}

/** 'YYYY-MM-DD' → local-midnight Date (for the calendar widget). */
export function isoToLocalDate(iso: string): Date {
  const [y, m, d] = iso.split('-').map(Number);
  return new Date(y, m - 1, d);
}

export function localDateToIso(date: Date): string {
  const mm = String(date.getMonth() + 1).padStart(2, '0');
  const dd = String(date.getDate()).padStart(2, '0');
  return `${date.getFullYear()}-${mm}-${dd}`;
}

/** ISO datetime or date-only string → Bangkok 'YYYY-MM-DD' ('' when missing/invalid). */
export function toBkkDate(value: string | null | undefined): string {
  if (!value) return '';
  if (ISO_DAY.test(value)) return value;
  const dt = new Date(value);
  if (Number.isNaN(dt.getTime())) return '';
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Bangkok' }).format(dt);
}

const TH_MONTHS_SHORT = ['ม.ค.', 'ก.พ.', 'มี.ค.', 'เม.ย.', 'พ.ค.', 'มิ.ย.', 'ก.ค.', 'ส.ค.', 'ก.ย.', 'ต.ค.', 'พ.ย.', 'ธ.ค.'];

/** 'YYYY-MM-DD' → 'd MMM yy' Thai short with Buddhist-era 2-digit year (2026-09-30 → '30 ก.ย. 69'). Anything else → ''. */
export function formatDateThaiShort(iso: string | null | undefined): string {
  if (!iso || !ISO_DAY.test(iso)) return '';
  const [y, m, d] = iso.split('-').map(Number);
  if (!TH_MONTHS_SHORT[m - 1]) return '';
  return `${d} ${TH_MONTHS_SHORT[m - 1]} ${String((y + 543) % 100).padStart(2, '0')}`;
}
