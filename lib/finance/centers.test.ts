import { describe, expect, test } from 'bun:test';
import { CENTER_OPTIONS, CENTER_OTHER, centerCheckboxesHtml, centerFromSite, normalizeSiteCode } from './centers';

describe('centers (ศูนย์ from the requester site)', () => {
  test('options: Part 1 label is now สระบุรี/ระยอง/บางปะกง', () => {
    expect([...CENTER_OPTIONS]).toEqual(['กรุงเทพ', 'ลาดกระบัง/ขอนแก่น', 'สระบุรี/ระยอง/บางปะกง', 'MDD']);
    expect(CENTER_OTHER).toBe('อื่นๆ');
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
    expect(centerFromSite(code, 'ชื่อสาขา')).toEqual({ centers: [center], other: '' });
    expect(centerFromSite(`${code}.`, 'ชื่อสาขา')).toEqual({ centers: [center], other: '' });
  });
  test('MDD is never auto-ticked', () => {
    expect(centerFromSite('MDD', 'MDD').centers).toEqual([CENTER_OTHER]);
  });
  test('unknown code → อื่นๆ + site name (code when there is no name)', () => {
    expect(centerFromSite('สขข.', 'สำนักงานใหม่')).toEqual({ centers: ['อื่นๆ'], other: 'สำนักงานใหม่' });
    expect(centerFromSite('สขข.', null)).toEqual({ centers: ['อื่นๆ'], other: 'สขข' });
  });
  test('empty code → อื่นๆ + site name; nothing known → no box', () => {
    expect(centerFromSite(null, 'สำนักงานสระบุรี')).toEqual({ centers: ['อื่นๆ'], other: 'สำนักงานสระบุรี' });
    expect(centerFromSite('', '  ')).toEqual({ centers: [], other: '' });
    expect(centerFromSite(undefined, undefined)).toEqual({ centers: [], other: '' });
  });
  test('checkbox markup ticks the mapped box and escapes the other text', () => {
    const html = centerCheckboxesHtml(['สระบุรี/ระยอง/บางปะกง'], '');
    expect((html.match(/class="cb checked"/g) ?? []).length).toBe(1);
    expect(html).toContain('<span class="cb checked"></span>สระบุรี/ระยอง/บางปะกง');
    const other = centerCheckboxesHtml(['อื่นๆ'], '<b>x</b>');
    expect(other).toContain('<span class="cb checked"></span>อื่นๆ<span class="oth">&lt;b&gt;x&lt;/b&gt;</span>');
    expect(other).not.toContain('<b>x</b>');
  });
});
