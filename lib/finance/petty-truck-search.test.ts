import { describe, expect, test } from 'bun:test';
import { highlightParts, stepIndex } from './petty-truck-search';

const joined = (parts: { text: string; hit: boolean }[]) =>
  parts.map(p => (p.hit ? `[${p.text}]` : p.text)).join('');

describe('highlightParts (bold the part that matched)', () => {
  test('a plain substring of the truck code', () =>
    expect(joined(highlightParts('TH1093', '109'))).toBe('TH[109]3'));

  test('case does not matter', () =>
    expect(joined(highlightParts('TH1093', 'th10'))).toBe('[TH10]93'));

  test('digits typed without dash/dot still light up the plate across the separators', () =>
    expect(joined(highlightParts('สบ.71-1325', '711325'))).toBe('สบ.[71-1325]'));

  test('typed separators are ignored too', () =>
    expect(joined(highlightParts('สบ.71-1325', 'สบ 71'))).toBe('[สบ.71]-1325'));

  test('no match = the text as is', () =>
    expect(highlightParts('TH1093', '777')).toEqual([{ text: 'TH1093', hit: false }]));

  test('empty query = the text as is', () =>
    expect(highlightParts('71-4285', ' ')).toEqual([{ text: '71-4285', hit: false }]));
});

describe('stepIndex (arrow keys in the list)', () => {
  test('down from nothing picks the first', () => expect(stepIndex(-1, 1, 3)).toBe(0));
  test('down wraps to the top', () => expect(stepIndex(2, 1, 3)).toBe(0));
  test('up wraps to the bottom', () => expect(stepIndex(0, -1, 3)).toBe(2));
  test('up from nothing picks the last', () => expect(stepIndex(-1, -1, 3)).toBe(2));
  test('empty list = nothing selected', () => expect(stepIndex(0, 1, 0)).toBe(-1));
});
