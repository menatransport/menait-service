import { describe, expect, test } from 'bun:test';
import { canUploadPettyFile, isPettyFolder, PETTY_FOLDERS } from './petty-upload';

const claim = { created_by: '55555', fund_id: 1, status: 'PENDING_APPROVAL' as const };
const fund = { id: 1, holder_employee_id: '12345' };

describe('isPettyFolder', () => {
  test('known attachment keys pass', () => {
    for (const key of PETTY_FOLDERS) expect(isPettyFolder(key)).toBe(true);
  });
  test('the ADV folders are not petty folders', () => {
    expect(isPettyFolder('pay')).toBe(false);
    expect(isPettyFolder('check')).toBe(false);
  });
  test('a path traversal attempt is not a folder', () => expect(isPettyFolder('../pay')).toBe(false));
  test('the approved request form of a taxi claim has a home', () =>
    expect(isPettyFolder('request_form')).toBe(true));
  test('an unknown folder is still rejected', () => expect(isPettyFolder('whatever')).toBe(false));
  test('empty is not a folder', () => expect(isPettyFolder('')).toBe(false));
});

describe('canUploadPettyFile', () => {
  test('the clerk who opened the claim may', () =>
    expect(canUploadPettyFile({ user: { employee_id: '55555' }, claim, fund })).toBe(true));
  test('the fund holder may — ผู้อนุมัติแนบสลิปโอนเอง', () =>
    expect(canUploadPettyFile({ user: { employee_id: '12345' }, claim, fund })).toBe(true));
  test('a stranger may not, even when logged in', () =>
    expect(canUploadPettyFile({ user: { employee_id: '77777' }, claim, fund })).toBe(false));
  test('finance may not upload into other people’s claims', () =>
    expect(canUploadPettyFile({ user: { employee_id: '80001', is_finance: true }, claim, fund })).toBe(false));
  test('admin may', () =>
    expect(canUploadPettyFile({ user: { employee_id: '1', role: 'a' }, claim, fund })).toBe(true));
  test('a claim that could not be loaded fails closed', () =>
    expect(canUploadPettyFile({ user: { employee_id: '55555' }, claim: null, fund: null })).toBe(false));
  test('a closed claim takes no more files', () =>
    expect(canUploadPettyFile({ user: { employee_id: '55555' }, claim: { ...claim, status: 'CLOSED' }, fund }))
      .toBe(false));
  test('no session means no', () =>
    expect(canUploadPettyFile({ user: { employee_id: null }, claim, fund })).toBe(false));
});
