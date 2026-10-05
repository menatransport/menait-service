import { describe, expect, test } from 'bun:test';
import { forceAdvActor, isAdvTarget } from './formsubmit-guard';

describe('formsubmit guard', () => {
  test('detects ADV by code or id', () => {
    expect(isAdvTarget({ formCode: 'ADV' })).toBe(true);
    expect(isAdvTarget({ formId: 'ADV-2610-001' })).toBe(true);
    expect(isAdvTarget({ formCode: 'ISSUE_IT', formId: 'IT-1' })).toBe(false);
  });
  test('forces actor for ADV', () => {
    const r = forceAdvActor({ form_code: 'ADV', created_by: 'evil' }, 'E1', {});
    expect(r.created_by).toBe('E1');
    expect(r.updated_by).toBe('E1');
    const p = forceAdvActor({ updated_by: 'evil', values: [] }, 'E1', { formId: 'ADV-1' });
    expect(p.updated_by).toBe('E1');
  });
  test('leaves IT forms untouched', () => {
    const b = { form_code: 'ISSUE_IT', created_by: 'x' };
    expect(forceAdvActor(b, 'E1', {})).toEqual(b);
  });
});
