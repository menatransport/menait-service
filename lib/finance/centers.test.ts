import { describe, expect, test } from 'bun:test';
import { CENTER_OPTIONS, centerCheckboxesHtml, centerFromSite, normalizeSiteCode } from './centers';

describe('centers (ศูนย์ from the requester site)', () => {
  test('options: exactly three (no MDD, no อื่นๆ)', () => {
    expect([...CENTER_OPTIONS]).toEqual(['กรุงเทพ', 'ลาดกระบัง/ขอนแก่น', 'สระบุรี/ระยอง/บางปะกง']);
  });
  test('normalizeSiteCode strips the trailing dot and spaces', () => {
    expect(normalizeSiteCode('สกท.')).toBe('สกท');
    expect(normalizeSiteCode(' ศบก. ')).toBe('ศบก');
    expect(normalizeSiteCode('สสบ')).toBe('สสบ');
    expect(normalizeSiteCode(null)).toBe('');
  });
  const cases: [string, string][] = [
    ['สกท', 'กรุงเทพ'],
    ['ศลบ', 'ลาดกระบัง/ขอนแก่น'],
    ['ศขก', 'ลาดกระบัง/ขอนแก่น'],
    ['สสบ', 'สระบุรี/ระยอง/บางปะกง'],
    ['ศรย', 'สระบุรี/ระยอง/บางปะกง'],
    ['ศบก', 'สระบุรี/ระยอง/บางปะกง'],
  ];
  test.each(cases)('%s (with and without the trailing dot) → %s', (code, center) => {
    expect(centerFromSite(code)).toEqual({ centers: [center] });
    expect(centerFromSite(`${code}.`)).toEqual({ centers: [center] });
  });
  test('MDD, unknown, empty → no box ticked', () => {
    expect(centerFromSite('MDD').centers).toEqual([]);
    expect(centerFromSite('สขข.').centers).toEqual([]);
    expect(centerFromSite('').centers).toEqual([]);
    expect(centerFromSite(null).centers).toEqual([]);
    expect(centerFromSite(undefined).centers).toEqual([]);
  });
  test('checkbox markup: three options, the mapped one ticked', () => {
    const html = centerCheckboxesHtml(['สระบุรี/ระยอง/บางปะกง']);
    expect((html.match(/class="cbi"/g) ?? []).length).toBe(3);
    expect((html.match(/class="cb checked"/g) ?? []).length).toBe(1);
    expect(html).toContain('<span class="cb checked"></span>สระบุรี/ระยอง/บางปะกง');
    expect(html).not.toContain('MDD');
    expect(html).not.toContain('อื่นๆ');
    expect((centerCheckboxesHtml([]).match(/checked/g) ?? []).length).toBe(0);
  });
});
