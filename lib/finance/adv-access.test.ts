import { describe, expect, test } from 'bun:test';
import { advDetailGrantsView, advUploadRole, isAdvRequester, isAdvStepApprover, listHasForm } from './adv-access';

const detail = {
  form_id: 'ADV-2610-001',
  requester: { employee_id: 'E1', name: 'ผู้เบิก' },
  approval: {
    current_step: 2,
    step_approvals: [{ step: 1, employee_id: 'L4', name: 'หัวหน้า', action_at: '2026-10-01T09:00:00' }],
  },
  approval_logs: [{ level_no: 1, action: 'APPROVED', actor_name: 'หัวหน้า' }],
};

describe('isAdvRequester', () => {
  test('matches the requester only', () => {
    expect(isAdvRequester(detail, 'E1')).toBe(true);
    expect(isAdvRequester(detail, 'L4')).toBe(false);
    expect(isAdvRequester(detail, 'E2')).toBe(false);
  });
  test('fails closed on missing / malformed data', () => {
    expect(isAdvRequester(null, 'E1')).toBe(false);
    expect(isAdvRequester({}, 'E1')).toBe(false);
    expect(isAdvRequester({ requester: null }, 'E1')).toBe(false);
    expect(isAdvRequester({ requester: { employee_id: '' } }, '')).toBe(false);
    expect(isAdvRequester({ requester: { employee_id: 1 } }, '1')).toBe(false);
    expect(isAdvRequester([detail], 'E1')).toBe(false);
  });
});

describe('isAdvStepApprover', () => {
  test('matches a current-round step approver', () => {
    expect(isAdvStepApprover(detail, 'L4')).toBe(true);
    expect(isAdvStepApprover(detail, 'E1')).toBe(false);
  });
  test('fails closed without an approval block', () => {
    expect(isAdvStepApprover({ ...detail, approval: null }, 'L4')).toBe(false);
    expect(isAdvStepApprover({ approval: { step_approvals: 'L4' } }, 'L4')).toBe(false);
    expect(isAdvStepApprover({ approval: { step_approvals: [null, { employee_id: null }] } }, 'L4')).toBe(false);
    expect(isAdvStepApprover({ approval: { step_approvals: [{ employee_id: null }] } }, '')).toBe(false);
  });
  test('approval_logs carry only actor_name, so a name never grants access', () => {
    expect(isAdvStepApprover({ approval_logs: [{ actor_name: 'L4' }] }, 'L4')).toBe(false);
  });
});

describe('advDetailGrantsView', () => {
  test('requester or step approver', () => {
    expect(advDetailGrantsView(detail, 'E1')).toBe(true);
    expect(advDetailGrantsView(detail, 'L4')).toBe(true);
    expect(advDetailGrantsView(detail, 'X9')).toBe(false);
    expect(advDetailGrantsView(undefined, 'E1')).toBe(false);
  });
});

describe('listHasForm', () => {
  const list = [{ form_id: 'ADV-2610-001' }, { form_id: 'ADV-2610-002' }];
  test('finds the exact form id', () => {
    expect(listHasForm(list, 'ADV-2610-002')).toBe(true);
    expect(listHasForm(list, 'ADV-2610-003')).toBe(false);
    expect(listHasForm(list, 'ADV-2610-00')).toBe(false);
  });
  test('fails closed on non-lists', () => {
    expect(listHasForm({ items: list }, 'ADV-2610-001')).toBe(false);
    expect(listHasForm(null, 'ADV-2610-001')).toBe(false);
    expect(listHasForm([null, 'ADV-2610-001'], 'ADV-2610-001')).toBe(false);
    expect(listHasForm(list, '')).toBe(false);
  });
});

describe('advUploadRole', () => {
  test('pay/check are finance, request/clear are the owner', () => {
    expect(advUploadRole('pay')).toBe('finance');
    expect(advUploadRole('check')).toBe('finance');
    expect(advUploadRole('clear')).toBe('owner');
    expect(advUploadRole('')).toBe('owner');
  });
});
