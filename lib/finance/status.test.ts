import { describe, expect, test } from 'bun:test';
import {
  STATUS_LABELS, addDays, computeSettle, displayFileName, formatBaht, formatDate, parseAmount,
  clearNeedsSlip, settleLabel, todayBkk, toBkkYM, uniqueFileName,
} from './status';

describe('labels', () => {
  test('awaiting clearing label', () => expect(STATUS_LABELS.AWAITING_CLEARING).toBe('จ่ายแล้วรอเคลียร์'));
  test('returned label', () => expect(STATUS_LABELS.RETURNED).toBe('ตีกลับให้ผู้เบิกแก้ไข'));
  test('awaiting review label', () => expect(STATUS_LABELS.AWAITING_REVIEW).toBe('รอบัญชีตรวจ'));
});

describe('addDays', () => {
  test('plus 7', () => expect(addDays('2026-06-25', 7)).toBe('2026-07-02'));
  test('crosses month end', () => expect(addDays('2026-06-28', 7)).toBe('2026-07-05'));
  test('invalid input gives empty string', () => expect(addDays('', 7)).toBe(''));
});

describe('parseAmount', () => {
  test('commas', () => expect(parseAmount('1,000.50')).toBe(1000.5));
  test('rounds to 2 decimals', () => expect(parseAmount('10.126')).toBe(10.13));
  test('blank is null, not zero', () => expect(parseAmount('  ')).toBeNull());
  test('ไม่รับเลขยกกำลังหรือฐานสิบหก', () => { expect(parseAmount('1e3')).toBeNull(); expect(parseAmount('0x10')).toBeNull(); expect(parseAmount('Infinity')).toBeNull(); });
  test('ยังรับทศนิยมและติดลบ (ให้ตัวตรวจฟอร์มเตือนเอง)', () => { expect(parseAmount('.5')).toBe(0.5); expect(parseAmount('-20')).toBe(-20); expect(parseAmount('12.')).toBe(12); });
  test('garbage is null', () => expect(parseAmount('abc')).toBeNull());
  test('number passthrough', () => expect(parseAmount(4840)).toBe(4840));
});

describe('settle', () => {
  test('return', () => expect(computeSettle(1000, 800.5)).toBe(199.5));
  test('extra', () => expect(computeSettle(1000, 1250)).toBe(-250));
  test('labels', () => {
    expect(settleLabel(1)).toBe('รับคืน');
    expect(settleLabel(-1)).toBe('เบิกเพิ่ม');
    expect(settleLabel(0)).toBe('พอดี (ไม่มียอดคงค้าง)');
    expect(settleLabel(null)).toBe('-');
  });
});

describe('formatting', () => {
  test('baht', () => expect(formatBaht(12740)).toBe('12,740.00'));
  test('baht null', () => expect(formatBaht(null)).toBe('-'));
  test('date-only never shifts', () => expect(formatDate('2026-07-09')).toBe('09/07/2026'));
  test('UTC datetime shown in Bangkok', () => expect(formatDate('2026-07-08T18:30:00+00:00')).toBe('09/07/2026'));
  test('empty', () => expect(formatDate(null)).toBe('-'));
  test('todayBkk after 17:00 UTC is next day', () =>
    expect(todayBkk(new Date('2026-07-08T17:30:00Z'))).toBe('2026-07-09'));
});

describe('toBkkYM', () => {
  test('UTC datetime rolls into next day/month in Bangkok', () =>
    expect(toBkkYM('2026-07-31T18:00:00+00:00')).toBe('2026-08'));
  test('date-only string keeps its own month', () => expect(toBkkYM('2026-07-09')).toBe('2026-07'));
});

describe('file names', () => {
  test('same name gets unique key', () => {
    expect(uniqueFileName('slip.jpg', 1751980000000)).toBe('1751980000000-slip.jpg');
    expect(uniqueFileName('a/b.pdf', 1)).toBe('1-a_b.pdf');
  });
  test('display strips prefix', () => expect(displayFileName('1751980000000-slip.jpg')).toBe('slip.jpg'));
});

describe('clearNeedsSlip', () => {
  test('refund to company needs a transfer slip', () => expect(clearNeedsSlip(440)).toBe(true));
  test('company pays more: slip optional', () => expect(clearNeedsSlip(-1200)).toBe(false));
  test('exact amount: slip optional', () => expect(clearNeedsSlip(0)).toBe(false));
  test('unknown settle: slip optional', () => expect(clearNeedsSlip(null)).toBe(false));
});

import { clearSlipMissing } from './status';

describe('clearSlipMissing — สลิปโอนเงินตอนคืนเงินบริษัท', () => {
  const base = { settle: 800, newFiles: 0, existingFiles: 0, priorSettle: null as number | null, uploadedNow: 0 };
  test('คืนเงิน ไม่มีไฟล์เลย = ขาด', () => expect(clearSlipMissing(base)).toBe(true));
  test('คืนเงิน แนบใหม่ = ครบ', () => expect(clearSlipMissing({ ...base, newFiles: 1 })).toBe(false));
  test('เคลียร์ใหม่ รอบก่อนก็คืนเงิน มีไฟล์เดิม = ครบ', () => expect(clearSlipMissing({ ...base, existingFiles: 2, priorSettle: 500 })).toBe(false));
  test('เคลียร์ใหม่ รอบก่อนเบิกเพิ่ม ไฟล์เดิมเป็นใบเสร็จ ไม่นับเป็นสลิป', () =>
    expect(clearSlipMissing({ ...base, existingFiles: 1, priorSettle: -200 })).toBe(true));
  test('อัปโหลดรอบนี้ไปแล้วแต่บันทึกพลาด กดซ้ำไม่ต้องแนบอีก', () =>
    expect(clearSlipMissing({ ...base, existingFiles: 1, priorSettle: -200, uploadedNow: 1 })).toBe(false));
  test('เบิกเพิ่มหรือพอดี ไม่ต้องมีสลิป', () => {
    expect(clearSlipMissing({ ...base, settle: -200 })).toBe(false);
    expect(clearSlipMissing({ ...base, settle: 0 })).toBe(false);
  });
});

import { amountError, TEST_MAX_AMOUNT_TEXT } from './status';

describe('amountError — ช่องจำนวนเงินที่ขอเบิก', () => {
  test('มีสตางค์ได้', () => { expect(amountError('1250.50')).toBeNull(); expect(amountError('1,250.5')).toBeNull(); });
  test('ศูนย์หรือติดลบไม่ได้', () => { expect(amountError('0')).toBe('จำนวนเงินต้องมากกว่า 0'); expect(amountError('-5')).toBe('จำนวนเงินต้องมากกว่า 0'); });
  test('ทศนิยมเกิน 2 ตำแหน่ง', () => expect(amountError('12.345')).toBe('ใส่ทศนิยมได้ไม่เกิน 2 ตำแหน่ง'));
  test('ช่วงทดสอบระบบ เบิกได้พอดี 100,000', () => { expect(amountError('100000')).toBeNull(); expect(amountError('100,000.00')).toBeNull(); });
  test('ช่วงทดสอบระบบ เกิน 100,000 ไม่ได้ แม้แค่สตางค์เดียว', () => {
    expect(amountError('100000.01')).toBe(TEST_MAX_AMOUNT_TEXT);
    expect(amountError('250,000')).toBe(TEST_MAX_AMOUNT_TEXT);
  });
  test('ยอดใหญ่จนเกินฐานข้อมูล ก็ขึ้นข้อความช่วงทดสอบ ไม่ใช่เลข 9,999 ล้าน', () => expect(amountError('99999999999999999')).toBe(TEST_MAX_AMOUNT_TEXT));
  test('ข้อความบอกยอดสูงสุดเป็นตัวเลขจริง', () => expect(TEST_MAX_AMOUNT_TEXT).toContain('100,000'));
});
