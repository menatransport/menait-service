import { describe, expect, test } from 'bun:test';
import type { PettySpec } from '@/app/finance/types-petty';
import { blankItem, claimPayload, headerFields, isItemBased, itemFields, requiredAttachments, singleItemFrom } from './petty-spec';

const WEIGH: PettySpec = {
  item_based: true,
  header_fields: [{ key: 'payee_name', label: 'จ่ายให้', type: 'employee', required: true }],
  item_fields: [
    { key: 'event_date', label: 'วันที่ชั่ง', type: 'date', required: true },
    { key: 'ref_no', label: 'เลขที่บัตรชั่ง', type: 'text', required: true },
    { key: 'rate', label: 'ราคา/ครั้ง', type: 'money', required: true },
  ],
  attachments: [
    { key: 'weigh_slip', label: 'ใบชั่งน้ำหนัก (สำเนา)', required: true, max: 10 },
    { key: 'transfer', label: 'หลักฐานโอนเงิน', required: true, max: 3 },
    { key: 'other', label: 'อื่นๆ', required: false, max: 3 },
  ],
  rules: [{ when: 'total >= 500', require_field: 'dd_no', at: 'BEFORE_SUBMIT_TO_ACCOUNTING' }],
};

describe('shape', () => {
  test('weigh is item based', () => expect(isItemBased(WEIGH)).toBe(true));
  test('an empty spec is not', () => expect(isItemBased({})).toBe(false));
  test('header fields read back', () => expect(headerFields(WEIGH).map(f => f.key)).toEqual(['payee_name']));
  test('item fields read back', () => expect(itemFields(WEIGH)).toHaveLength(3));
  test('missing groups give empty arrays, never undefined', () => {
    expect(itemFields({})).toEqual([]);
    expect(headerFields({})).toEqual([]);
  });
});

describe('requiredAttachments', () => {
  test('only the required ones', () =>
    expect(requiredAttachments(WEIGH).map(a => a.key)).toEqual(['weigh_slip', 'transfer']));
  test('none when the spec has no attachments', () => expect(requiredAttachments({})).toEqual([]));
});

describe('blankItem', () => {
  test('one key per item field plus qty', () => {
    const row = blankItem(WEIGH);
    expect(Object.keys(row).sort()).toEqual(['event_date', 'qty', 'rate', 'ref_no']);
    expect(row.qty).toBe(1);
  });
  test('a truck field splits into code and plate', () => {
    const row = blankItem({ item_based: true, item_fields: [{ key: 'truck', label: 'รถ', type: 'truck' }] });
    expect(Object.keys(row).sort()).toEqual(['qty', 'truck_code', 'truck_plate']);
  });
});

describe('claimPayload', () => {
  const form = { fund_id: 1, expense_type: 'WEIGH', expense_date: '2026-09-25', payee_name: 'อัญชัญ น่วมมี' };
  const items = [{ event_date: '2026-09-17', ref_no: '000055', qty: 1, rate: 100 }];

  test('carries items through', () => expect(claimPayload(form, items).items).toHaveLength(1));
  test('does not send amount — BE computes it', () =>
    expect('amount' in claimPayload({ ...form, amount: 999 }, items)).toBe(false));
  test('does not send created_by — the BFF adds it from the session', () =>
    expect('created_by' in claimPayload({ ...form, created_by: 'x' }, items)).toBe(false));
  test('drops rows with no rate at all', () =>
    expect(claimPayload(form, [...items, { event_date: '', ref_no: '', qty: 1, rate: '' }]).items)
      .toHaveLength(1));
});

describe('singleItemFrom', () => {
  test('toll claim becomes one row', () => {
    const row = singleItemFrom({ event_date: '2026-09-25', truck_code: '161', rate: 120, receipt_no: 'A1' });
    expect(row).toMatchObject({ event_date: '2026-09-25', qty: 1, rate: 120, ref_no: 'A1' });
  });
  test('missing optional fields become null, not the string "undefined"', () => {
    expect(singleItemFrom({ event_date: '2026-09-25', rate: 100 }).truck_code).toBeNull();
  });
});
