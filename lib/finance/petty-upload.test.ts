import { describe, expect, test } from 'bun:test';
import { canUploadPettyFile, folderIsFull, isPettyFolder, PETTY_FOLDERS, PETTY_MAX_BYTES, pettyFileProblem, pettyKeyBelongsTo } from './petty-upload';

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

describe('หมวด map (REQUIREMENT §3.2/§3.5 รูป Map)', () => {
  test('อัปโหลดหมวด map ได้', () => expect(isPettyFolder('map')).toBe(true));
});

describe('pettyFileProblem — ชนิดและขนาดไฟล์ที่รับเข้าใบเงินสดย่อย', () => {
  test('a photo or a pdf is fine', () => {
    expect(pettyFileProblem('slip.jpg', 200_000)).toBeNull();
    expect(pettyFileProblem('ใบชั่ง.PDF', 1_000_000)).toBeNull();
    expect(pettyFileProblem('x.png', 1)).toBeNull();
    expect(pettyFileProblem('x.heic', 1)).toBeNull();
  });
  test('an executable is refused with a readable reason', () =>
    expect(pettyFileProblem('k6.exe', 2)).toBe('รับเฉพาะรูปภาพ (jpg, png, heic, webp) หรือ PDF'));
  test('a file with no extension is refused', () => expect(pettyFileProblem('README', 2)).not.toBeNull());
  test('over 10 MB is refused and the limit is in the message', () =>
    expect(pettyFileProblem('big.jpg', PETTY_MAX_BYTES + 1)).toBe('ไฟล์ใหญ่เกิน 10 MB'));
  test('exactly the limit passes', () => expect(pettyFileProblem('big.jpg', PETTY_MAX_BYTES)).toBeNull());
});

describe('folderIsFull — max ของหมวดใน spec', () => {
  const spec = { attachments: [{ key: 'transfer', max: 3 }, { key: 'other' }] };
  test('below max is not full', () => expect(folderIsFull(spec, 'transfer', 2)).toBe(false));
  test('at max is full', () => expect(folderIsFull(spec, 'transfer', 3)).toBe(true));
  test('a folder with no max never fills', () => expect(folderIsFull(spec, 'other', 99)).toBe(false));
  test('a folder the spec does not list never fills (spec may be stale)', () =>
    expect(folderIsFull(spec, 'weigh_slip', 99)).toBe(false));
  test('no spec at all never fills', () => expect(folderIsFull(null, 'transfer', 99)).toBe(false));
});

describe('pettyKeyBelongsTo — กุญแจ S3 ที่ลบได้ต้องอยู่ใต้ใบนั้น', () => {
  test('a key under the form is accepted', () =>
    expect(pettyKeyBelongsTo('menait-service/LB-B02-2610-023/transfer/a.jpg', 'LB-B02-2610-023')).toBe(true));
  test('another form’s key is not', () =>
    expect(pettyKeyBelongsTo('menait-service/LB-B02-2610-024/transfer/a.jpg', 'LB-B02-2610-023')).toBe(false));
  test('a prefix trick is not', () =>
    expect(pettyKeyBelongsTo('menait-service/LB-B02-2610-0230/x.jpg', 'LB-B02-2610-023')).toBe(false));
  test('the folder itself is not a file', () =>
    expect(pettyKeyBelongsTo('menait-service/LB-B02-2610-023/transfer/', 'LB-B02-2610-023')).toBe(false));
  test('dot segments are not', () =>
    expect(pettyKeyBelongsTo('menait-service/LB-B02-2610-023/../other/x.jpg', 'LB-B02-2610-023')).toBe(false));
});

describe('flow v2 — แนบไฟล์ได้ถึงตอนบัญชีตรวจผ่าน', () => {
  const holderFund = { id: 1, holder_employee_id: '12345' };
  const at = (status: string) => ({ created_by: '55555', fund_id: 1, status }) as never;
  test('while the head reviews the round', () =>
    expect(canUploadPettyFile({ user: { employee_id: '55555' }, claim: at('CLEAR_PENDING'), fund: holderFund })).toBe(true));
  test('not after accounting passed it', () =>
    expect(canUploadPettyFile({ user: { employee_id: '55555' }, claim: at('REVIEWED'), fund: holderFund })).toBe(false));
});
