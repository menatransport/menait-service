import { describe, expect, test } from 'bun:test';
import { CENTER_OPTIONS, centerCheckboxesHtml, centerFromSite, normalizeSiteCode } from './centers';

describe('centers (ศูนย์ from the requester site)', () => {
  test('options: one box per centre, no "/" (user 29/10/2026), no MDD, no อื่นๆ', () => {
    expect([...CENTER_OPTIONS]).toEqual(['กรุงเทพ', 'ลาดกระบัง', 'ขอนแก่น', 'สระบุรี', 'ระยอง', 'บางปะกง']);
    expect(CENTER_OPTIONS.some(c => c.includes('/'))).toBe(false);
  });
  test('normalizeSiteCode strips the trailing dot and spaces', () => {
    expect(normalizeSiteCode('สกท.')).toBe('สกท');
    expect(normalizeSiteCode(' ศบก. ')).toBe('ศบก');
    expect(normalizeSiteCode('สสบ')).toBe('สสบ');
    expect(normalizeSiteCode(null)).toBe('');
  });
  const cases: [string, string][] = [
    ['สกท', 'กรุงเทพ'],
    ['ศลบ', 'ลาดกระบัง'],
    ['ศขก', 'ขอนแก่น'],
    ['สสบ', 'สระบุรี'],
    ['ศรย', 'ระยอง'],
    ['ศบก', 'บางปะกง'],
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
  test('checkbox markup: six options, only the requester centre ticked', () => {
    const html = centerCheckboxesHtml(['บางปะกง']);
    expect((html.match(/class="cbi"/g) ?? []).length).toBe(6);
    expect((html.match(/class="cb checked"/g) ?? []).length).toBe(1);
    expect(html).toContain('<span class="cb checked"></span>บางปะกง');
    expect(html.replace(/<[^>]*>/g, '')).not.toContain('/'); // ตัวหนังสือที่พิมพ์ไม่มี "/"
    expect(html).not.toContain('MDD');
    expect(html).not.toContain('อื่นๆ');
    expect((centerCheckboxesHtml([]).match(/checked/g) ?? []).length).toBe(0);
  });
});
