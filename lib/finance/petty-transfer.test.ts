import { describe, expect, test } from 'bun:test';
import { transferCalc } from './petty-transfer';

describe('transferCalc — ยอดที่ต้องโอนจริง ตามผู้รับเงิน', () => {
  test('ร้านเงินสด/บุคคล: บริษัทออกภาษีให้ — ตัวอย่างจริงบิล 1,200 → ฐาน 1,237.11 ภาษี 37.11', () => {
    const c = transferCalc(1200, 'บุคคล/ร้านเงินสด');
    expect([c.kind, c.transfer, c.base, c.tax]).toEqual(['gross_up', 1200, 1237.11, 37.11]);
  });
  test('นิติบุคคล: หัก ณ ที่จ่าย 3% จากยอดบิล', () => {
    const c = transferCalc(1200, 'นิติบุคคล');
    expect([c.kind, c.transfer, c.tax]).toEqual(['withhold', 1164, 36]);
  });
  test('ต่ำกว่า 1,000 บาท ไม่หัก', () => {
    const c = transferCalc(999.99, 'นิติบุคคล');
    expect([c.kind, c.transfer, c.tax]).toEqual(['none', 999.99, 0]);
  });
  test('1,000 พอดีเริ่มหัก', () => expect(transferCalc(1000, 'นิติบุคคล').tax).toBe(30));
  test('ใบเก่าที่ยังเป็นชื่อเดิม "ร้านจดทะเบียน" คิดแบบนิติบุคคล (เปลี่ยนชื่อ 29/10/2026)', () =>
    expect(transferCalc(1200, 'ร้านจดทะเบียน').kind).toBe('withhold'));
  test('ประเภทที่ไม่มีช่องผู้รับเงิน โอนเต็มยอด', () => {
    const c = transferCalc(1640, null);
    expect([c.kind, c.transfer]).toEqual(['none', 1640]);
  });
  test('every result explains itself', () => {
    for (const t of ['บุคคล/ร้านเงินสด', 'นิติบุคคล', null]) expect(transferCalc(2000, t).note.length).toBeGreaterThan(10);
  });
});
