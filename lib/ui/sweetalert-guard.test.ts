import { describe, expect, test } from 'bun:test';
import { isFromSweetAlert } from './sweetalert-guard';

const el = (inSwal: boolean) => ({ closest: (sel: string) => (inSwal && sel === '.swal2-container' ? {} : null) });

describe('isFromSweetAlert — คลิกใน SweetAlert ต้องไม่นับเป็นคลิกนอก Dialog', () => {
  test('target อยู่ใน swal', () => expect(isFromSweetAlert({ target: el(true) })).toBe(true));
  test('target นอก swal', () => expect(isFromSweetAlert({ target: el(false) })).toBe(false));
  test('ดูจาก originalEvent ของ Radix ก่อน', () =>
    expect(isFromSweetAlert({ target: el(false), detail: { originalEvent: { target: el(true) } } })).toBe(true));
  test('target ไม่ใช่ element', () => expect(isFromSweetAlert({ target: null })).toBe(false));
});

import { shouldHideFocusEvent } from './sweetalert-guard';

describe('shouldHideFocusEvent — โฟกัสเข้า SweetAlert ต้องไม่ให้ Radix ดึงกลับ', () => {
  test('focusin เข้าช่องพิมพ์ใน swal', () => expect(shouldHideFocusEvent({ type: 'focusin', target: el(true) })).toBe(true));
  test('focusout จาก Dialog ไป swal', () =>
    expect(shouldHideFocusEvent({ type: 'focusout', target: el(false), relatedTarget: el(true) })).toBe(true));
  test('โฟกัสปกติใน Dialog ไม่ยุ่ง', () => {
    expect(shouldHideFocusEvent({ type: 'focusin', target: el(false) })).toBe(false);
    expect(shouldHideFocusEvent({ type: 'focusout', target: el(false), relatedTarget: el(false) })).toBe(false);
    expect(shouldHideFocusEvent({ type: 'focusout', target: el(false), relatedTarget: null })).toBe(false);
  });
});
