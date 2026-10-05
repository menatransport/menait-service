import { esc } from './printShared';

/** ศูนย์ checkboxes printed on Part 1 and Part 2 (spec v3 §1): exactly these three; no MDD, no อื่นๆ. */
export const CENTER_OPTIONS = ['กรุงเทพ', 'ลาดกระบัง/ขอนแก่น', 'สระบุรี/ระยอง/บางปะกง'] as const;

/** sites.site_code (without the trailing ".") → checkbox. */
const SITE_TO_CENTER: Record<string, string> = {
  'สกท': 'กรุงเทพ',
  'ศลบ': 'ลาดกระบัง/ขอนแก่น',
  'ศขก': 'ลาดกระบัง/ขอนแก่น',
  'สสบ': 'สระบุรี/ระยอง/บางปะกง',
  'ศรย': 'สระบุรี/ระยอง/บางปะกง',
  'ศบก': 'สระบุรี/ระยอง/บางปะกง',
};

/** 'สกท.' → 'สกท' (trim + strip trailing dots). */
export function normalizeSiteCode(code: string | null | undefined): string {
  return (code ?? '').trim().replace(/\.+$/, '').trim();
}

/** The requester's own centre from their site. Known code → that box. Unknown or empty → no box ticked. */
export function centerFromSite(siteCode: string | null | undefined): { centers: string[] } {
  const known = SITE_TO_CENTER[normalizeSiteCode(siteCode)];
  return { centers: known ? [known] : [] };
}

/** Checkbox row items (uses the .cbi / .cb classes of the Part 1 stylesheet). */
export function centerCheckboxesHtml(centers: string[] | null | undefined): string {
  const checked = new Set(centers ?? []);
  return CENTER_OPTIONS.map(c => `<span class="cbi"><span class="cb${checked.has(c) ? ' checked' : ''}"></span>${esc(c)}</span>`).join('');
}
