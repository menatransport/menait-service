import { describe, expect, test } from 'bun:test';
import { typeGuide } from './petty-type-guide';

describe('typeGuide', () => {
  test('ทุกประเภทที่เปิดใช้มีคำอธิบายและขั้นเฉพาะของตัวเอง', () => {
    for (const code of ['WEIGH', 'TIRE', 'REPAIR', 'TRAVEL', 'TOLL', 'GENERAL']) {
      const g = typeGuide(code);
      expect(g.summary).toBeTruthy();
      expect(g.steps.length).toBeGreaterThanOrEqual(4);
    }
  });

  test('เริ่มด้วยเลือกแผนก จบด้วยส่งให้ผู้อนุมัติ', () => {
    const g = typeGuide('TOLL');
    expect(g.steps[0]).toContain('ศูนย์และแผนก');
    expect(g.steps.at(-1)).toContain('ส่งให้ผู้อนุมัติ');
  });

  test('ประเภทที่ไม่มีคู่มือ ยังได้ขั้นแรกกับขั้นสุดท้าย', () => {
    expect(typeGuide('TESTSIX')).toEqual({ summary: null, steps: [typeGuide('TOLL').steps[0], typeGuide('TOLL').steps.at(-1)!] });
  });

  test('ค่าชั่งบอกเรื่องแยก พจส./พจร. คนละใบ', () => {
    expect(typeGuide('WEIGH').steps.join(' ')).toContain('แยกเปิดคนละใบ');
  });
});
