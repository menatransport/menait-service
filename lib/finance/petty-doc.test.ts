import { describe, expect, test } from 'bun:test';
import { bangkokToday } from '@/lib/finance/petty-doc';

describe('bangkokToday — ค่าเริ่มต้นช่องวันที่ขอเบิก', () => {
  test('หลังสี่ทุ่มเวลาไทย UTC ยังเป็นวันก่อนหน้า แต่ต้องได้วันไทย', () => {
    expect(bangkokToday(new Date('2026-10-14T17:30:00Z'))).toBe('2026-10-15');
  });
  test('กลางวันได้วันเดียวกัน', () => {
    expect(bangkokToday(new Date('2026-10-14T03:00:00Z'))).toBe('2026-10-14');
  });
});
