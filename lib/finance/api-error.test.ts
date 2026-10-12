import { describe, expect, test } from 'bun:test';
import { ApiError, apiErrorFrom, errorBodyFrom } from './api-error';

describe('errorBodyFrom', () => {
  test('a string detail becomes the error message', () =>
    expect(errorBodyFrom({ detail: 'ไม่พบใบเบิก' }, 'พลาด')).toEqual({ error: 'ไม่พบใบเบิก' }));

  test('an object detail keeps its fields — นี่คือรายการที่ขาดของด่านเอกสาร', () => {
    const body = errorBodyFrom({
      detail: { error: 'เอกสารไม่ครบ อนุมัติไม่ได้', missing: [{ key: 'weigh_slip', label: 'ใบชั่งน้ำหนัก' }] },
    }, 'พลาด');
    expect(body.error).toBe('เอกสารไม่ครบ อนุมัติไม่ได้');
    expect(body.missing).toHaveLength(1);
  });

  test('an object detail with no error field falls back', () =>
    expect(errorBodyFrom({ detail: { missing: [] } }, 'พลาด').error).toBe('พลาด'));

  test('pydantic validation errors (detail is an array) do not crash', () => {
    const body = errorBodyFrom({ detail: [{ loc: ['body', 'rate'], msg: 'field required' }] }, 'พลาด');
    expect(body.error).toBe('พลาด');
  });

  test('no detail at all', () => expect(errorBodyFrom(null, 'พลาด')).toEqual({ error: 'พลาด' }));
});

describe('apiErrorFrom', () => {
  test('carries the status and the whole body', () => {
    const err = apiErrorFrom(403, { error: 'เอกสารไม่ครบ', missing: [{ label: 'ใบชั่ง' }] });
    expect(err).toBeInstanceOf(ApiError);
    expect(err.status).toBe(403);
    expect(err.message).toBe('เอกสารไม่ครบ');
    expect(err.missing).toEqual([{ label: 'ใบชั่ง' }]);
  });

  test('duplicates come through', () => {
    const err = apiErrorFrom(409, { error: 'ซ้ำ', duplicates: [{ message: 'เบิกไปแล้ว', form_id: '03-B02-2609-001' }] });
    expect(err.duplicates?.[0].form_id).toBe('03-B02-2609-001');
  });

  test('a body with no error uses the status', () =>
    expect(apiErrorFrom(500, null).message).toBe('เกิดข้อผิดพลาด (500)'));
});
