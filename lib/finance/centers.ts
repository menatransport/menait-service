import { esc } from './printShared';

/** ศูนย์ checkboxes printed on Part 1 and Part 2 (spec v2 §5i.3). "อื่นๆ" is rendered separately with its text. */
export const CENTER_OPTIONS = ['กรุงเทพ', 'ลาดกระบัง/ขอนแก่น', 'สระบุรี/ระยอง/บางปะกง', 'MDD'] as const;
export const CENTER_OTHER = 'อื่นๆ';

/** sites.site_code (without the trailing ".") → checkbox. MDD is never auto-ticked. */
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

/**
 * The requester's own centre from their site. Known code → that box. Unknown or empty code → "อื่นๆ" with the
 * site name as text (the code itself when there is no name). Nothing at all → no box ticked.
 */
export function centerFromSite(siteCode: string | null | undefined, siteName: string | null | undefined): { centers: string[]; other: string } {
  const code = normalizeSiteCode(siteCode);
  const known = SITE_TO_CENTER[code];
  if (known) return { centers: [known], other: '' };
  const text = (siteName ?? '').trim() || code;
  return text ? { centers: [CENTER_OTHER], other: text } : { centers: [], other: '' };
}

/** Checkbox row items (uses the .cbi / .cb / .oth classes of the Part 1 stylesheet). */
export function centerCheckboxesHtml(centers: string[] | null | undefined, otherText: string | null | undefined): string {
  const checked = new Set(centers ?? []);
  const cb = (on: boolean) => `<span class="cb${on ? ' checked' : ''}"></span>`;
  return CENTER_OPTIONS.map(c => `<span class="cbi">${cb(checked.has(c))}${esc(c)}</span>`).join('')
    + `<span class="cbi">${cb(checked.has(CENTER_OTHER))}${CENTER_OTHER}<span class="oth">${esc(otherText)}</span></span>`;
}
