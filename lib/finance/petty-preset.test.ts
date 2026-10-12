import { describe, expect, test } from 'bun:test';
import type { PettySpec } from '@/app/finance/types-petty';
import { printableDocs, requiredDocs, ruleSentences } from './petty-preset';

const WEIGH: PettySpec = {
  item_based: true,
  attachments: [
    { key: 'weigh_slip', label: 'ใบชั่งน้ำหนัก (สำเนา)', required: true, max: 10 },
    { key: 'other', label: 'อื่นๆ', required: false, max: 3 },
    { key: 'transfer', label: 'หลักฐานโอนเงิน', required: true, max: 3 },
  ],
  rules: [
    { when: 'total >= 500', require_field: 'dd_no', at: 'BEFORE_SUBMIT_TO_ACCOUNTING' },
    { when: 'always', require_attachment: 'weigh_slip', at: 'BEFORE_APPROVE' },
  ],
  duplicate_check: {
    hard: { keys: ['ref_no', 'truck_code', 'truck_plate'], days: 365, action: 'block' },
    soft: { keys: ['event_date', 'truck'], days: 7, action: 'warn' },
  },
  prints: ['PETTY_VOUCHER', 'RECEIPT_SUBSTITUTE', 'DD'],
};

describe('requiredDocs', () => {
  test('required ones come first', () =>
    expect(requiredDocs(WEIGH).map(d => d.key)).toEqual(['weigh_slip', 'transfer', 'other']));
  test('flags which are required', () =>
    expect(requiredDocs(WEIGH).filter(d => d.required)).toHaveLength(2));
  test('ticks the ones already attached', () => {
    const docs = requiredDocs(WEIGH, { weigh_slip: 16 });
    expect(docs.find(d => d.key === 'weigh_slip')?.done).toBe(true);
    expect(docs.find(d => d.key === 'transfer')?.done).toBe(false);
  });
  test('an optional folder with files also ticks', () =>
    expect(requiredDocs(WEIGH, { other: 1 }).find(d => d.key === 'other')?.done).toBe(true));
  test('a spec with no attachments gives an empty list, not a crash', () =>
    expect(requiredDocs({})).toEqual([]));
});

describe('printableDocs', () => {
  test('thai names in the order the spec lists them', () =>
    expect(printableDocs(WEIGH)).toEqual([
      'ใบสำคัญจ่ายเงินสดย่อย', 'ใบรับรองแทนใบเสร็จรับเงิน', 'ใบรับสินค้า (DD)',
    ]));
  test('a type without the receipt substitute does not list it', () =>
    expect(printableDocs({ prints: ['PETTY_VOUCHER', 'DD'] }))
      .toEqual(['ใบสำคัญจ่ายเงินสดย่อย', 'ใบรับสินค้า (DD)']));
  test('no prints key falls back to the voucher alone', () =>
    expect(printableDocs({})).toEqual(['ใบสำคัญจ่ายเงินสดย่อย']));
  test('an unknown print code is shown as-is rather than dropped silently', () =>
    expect(printableDocs({ prints: ['SOMETHING_NEW'] })).toEqual(['SOMETHING_NEW']));
});

describe('ruleSentences', () => {
  const lines = ruleSentences(WEIGH);

  test('the DD rule reads like a sentence', () =>
    expect(lines.some(l => l.includes('500') && l.includes('ก่อนส่งบัญชี'))).toBe(true));
  test('the hard duplicate rule is stated as blocking', () =>
    expect(lines.some(l => l.includes('เบิกซ้ำไม่ได้'))).toBe(true));
  test('the soft duplicate rule says it only warns', () =>
    expect(lines.some(l => l.includes('7 วัน') && l.includes('เตือน'))).toBe(true));
  test('attachment rules are not repeated — the checklist above already shows them', () =>
    expect(lines.some(l => l.includes('ใบชั่งน้ำหนัก'))).toBe(false));
  test('an empty spec produces no sentences', () => expect(ruleSentences({})).toEqual([]));
  test('a travel spec keyed on the driver says driver, not truck', () => {
    const travel: PettySpec = {
      duplicate_check: { soft: { keys: ['event_date', 'driver'], days: 7, action: 'warn' } },
    };
    expect(ruleSentences(travel)[0]).toContain('คนเดิม');
  });
});

describe('เอกสารที่บังคับตามเงื่อนไข (บัตรประชาชนเมื่อโอนเข้าบุคคล/ร้านเงินสด)', () => {
  const spec = {
    header_fields: [
      { key: 'payment_method', label: 'วิธีจ่าย', type: 'select', options: ['โอนเงิน', 'เงินสด'] },
      { key: 'payee_type', label: 'ผู้รับเงิน', type: 'select', options: ['ร้านจดทะเบียน', 'บุคคล/ร้านเงินสด'] },
    ],
    attachments: [
      { key: 'receipt', label: 'บิล', required: true },
      { key: 'id_card', label: 'สำเนาบัตรประชาชน', required: false },
      { key: 'other', label: 'อื่นๆ', required: false },
    ],
    rules: [{ when: 'payment_method == โอนเงิน && payee_type == บุคคล/ร้านเงินสด', require_attachment: 'id_card', at: 'BEFORE_APPROVE' }],
  };
  const docs = requiredDocs(spec);
  test('บอกเงื่อนไขเป็นภาษาคน ไม่ใช่ (ไม่บังคับ)', () =>
    expect(docs.find(d => d.key === 'id_card')?.condition).toBe('บังคับเมื่อ วิธีจ่าย = โอนเงิน และ ผู้รับเงิน = บุคคล/ร้านเงินสด'));
  test('หมวดที่ไม่มีกฎ ไม่มีเงื่อนไข', () => expect(docs.find(d => d.key === 'other')?.condition).toBeUndefined());
  test('เรียง: บังคับ → บังคับตามเงื่อนไข → ไม่บังคับ', () =>
    expect(docs.map(d => d.key)).toEqual(['receipt', 'id_card', 'other']));
});
