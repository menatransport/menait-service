import { describe, expect, test } from 'bun:test';
import { TIRE_AXLES, TIRE_CODES, formatPositions, parsePositions, positionCountHint, togglePosition } from './tire-positions';

describe('รหัสตำแหน่งยาง — ชุดเดียวกับผังล้อ WMS', () => {
  test('25 positions: F1–F4, RA1–RA8, RB1–RB12 and the spare RB13', () => {
    expect(TIRE_CODES).toHaveLength(25);
    expect(TIRE_CODES.slice(0, 5)).toEqual(['F1', 'F2', 'F3', 'F4', 'RA1']);
    expect(TIRE_CODES.at(-1)).toBe('RB13');
  });
  test('axle rows follow the WMS layout', () =>
    expect(TIRE_AXLES[2]).toEqual({ label: 'หลัง 1', left: ['RA1', 'RA2'], right: ['RA3', 'RA4'] }));
});

describe('parse / format', () => {
  test('trims, upper-cases, drops unknown and duplicates, keeps layout order', () =>
    expect(parsePositions(' ra2, F1 ,zz9, RA2,rb13')).toEqual(['F1', 'RA2', 'RB13']));
  test('empty', () => expect(parsePositions(null)).toEqual([]));
  test('format joins with a comma', () => expect(formatPositions(['RA1', 'F2'])).toBe('F2,RA1'));
  test('toggle adds then removes', () => {
    expect(togglePosition('F1', 'RA1')).toBe('F1,RA1');
    expect(togglePosition('F1,RA1', 'F1')).toBe('RA1');
  });
});

describe('positionCountHint — เตือนเมื่อจำนวนตำแหน่งไม่ตรงจำนวนเส้น', () => {
  test('matching count says nothing', () => expect(positionCountHint('RA1,RA2', 2)).toBeNull());
  test('nothing picked yet says nothing (the required check covers it)', () => expect(positionCountHint('', 6)).toBeNull());
  test('mismatch is explained', () => expect(positionCountHint('RA1,RA2', 6)).toBe('เลือก 2 ตำแหน่ง แต่จำนวน 6 เส้น'));
});
