import { describe, expect, test } from 'bun:test';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'fs';
import { spawnSync } from 'child_process';
import sample from './cash-advance-sample.json';
import { buildCashAdvanceHtml, dmy, formatBkkDateTime, thaiShortDate, validateCashAdvance, toCashAdvanceData } from './cashAdvanceForm';

describe('cash advance form', () => {
  test('dates', () => {
    expect(thaiShortDate('2026-08-13')).toBe('13-ส.ค.-26');
    expect(dmy('2026-08-18')).toBe('18/8/2026');
    expect(dmy('2026-10-01T00:00:00+00:00')).toBe('1/10/2026');
    expect(dmy('')).toBe('');
  });
  test('validation', () => {
    expect(validateCashAdvance(sample as any)).toEqual([]);
    const five = { ...sample, items: Array(5).fill({ description: 'x', amount: 1 }) };
    expect(validateCashAdvance(five as any).length).toBeGreaterThan(0);
    const zero = { ...sample, items: [{ description: 'x', amount: 0 }] };
    expect(validateCashAdvance(zero as any).length).toBeGreaterThan(0);
    expect(() => buildCashAdvanceHtml(zero as any, {})).toThrow();
  });
  test('html has every section and value', () => {
    const html = buildCashAdvanceHtml(sample as any, { logoUrl: '' });
    for (const s of ['ใบคำขอเบิกเงินล่วงหน้า', '(Cash Advance Request form)', 'เริ่มใช้ 1 Nov 22', 'วันที่', '13-ส.ค.-26',
      'ส่วนที่ 1', 'ส่วนที่ 2', 'ส่วนที่ 3', 'ส่วนที่ 4', 'นางสาวตัวอย่าง ทดสอบ', '000000', 'ผู้ช่วยหัวหน้าแผนกบัญชี',
      '000-0-00000-0', 'กสิกรไทย', '5,000.00', 'ห้าพันบาทถ้วน', '18/8/2026', 'กรุงเทพ', 'ลาดกระบัง/ขอนแก่น',
      'สระบุรี/ระยอง', 'MDD', 'อื่นๆ', 'ผู้ขอเบิก', 'หัวหน้าหน่วยงาน', 'ผู้จัดการ', 'ผู้มีอำนาจอนุมัติ', 'Page 1',
      'ภายใน 7 วันหลังจากได้รับเงิน', 'กรุณาส่งเอกสารที่ได้รับอนุมัติตาม TOA ภายในวันอังคาร']) {
      expect(html).toContain(s);
    }
    expect((html.match(/class="cb checked"/g) ?? []).length).toBe(2); // ลาดกระบัง/ขอนแก่น + อื่นๆ
  });
  test('html escapes interpolated strings', () => {
    const d = { ...sample, additional_details: '<script>x</script>' };
    const html = buildCashAdvanceHtml(d as any, {});
    expect(html).not.toContain('<script>x');
    expect(html).toContain('&lt;script&gt;');
  });
  test('toCashAdvanceData maps an AdvanceDetail', () => {
    const detail: any = {
      status: 'AWAITING_PAYMENT', created_at: '2026-08-13T03:00:00+00:00',
      requester: { employee_id: '123', name: 'สมชาย ใจดี', department: 'บัญชี', position: 'เจ้าหน้าที่' },
      request: { purpose: 'ค่าน้ำมัน', amount: 1500, use_date: '2026-08-20', cost_center: 'ศขก', bank: 'KBANK', account_no: '1234567890', account_name: 'สมชาย ใจดี' },
      fin: { voucher_date: '2026-08-14', transfer_date: '2026-08-18' },
      approval_logs: [{ level_no: 2, action: 'APPROVED', action_at: '2026-08-14T05:00:00+00:00', actor_name: 'ผู้จัดการ หนึ่ง', remark: null }],
    };
    const d = toCashAdvanceData(detail);
    expect(d.centers).toEqual(['ลาดกระบัง/ขอนแก่น']);
    expect(d.employee.bank_name).toBe('กสิกรไทย');
    expect(d.employee.bank_account_no).toBe('123-4-56789-0');
    expect(d.employee.position).toBe('เจ้าหน้าที่');
    expect(d.items).toEqual([{ description: 'ค่าน้ำมัน', amount: 1500 }]);
    expect(d.disbursement_round).toBe('2026-08-18');
    expect(d.request_date).toBe('2026-08-13');
    expect(d.signatures.approver.name).toBe('ผู้จัดการ หนึ่ง');
    expect(d.signatures.approver.date).toBe('14/8/2026');
    const o = toCashAdvanceData({ ...detail, request: { ...detail.request, cost_center: 'ศบก' }, fin: { voucher_date: '2026-08-14', transfer_date: null } });
    expect(o.centers).toEqual(['อื่นๆ']);
    expect(o.center_other_text).toBe('บางปะกง');
    expect(o.disbursement_round).toBe('2026-08-14');
  });
  test.each([
    ['สกท', ['กรุงเทพ'], ''],
    ['ศลบ', ['ลาดกระบัง/ขอนแก่น'], ''],
    ['ศขก', ['ลาดกระบัง/ขอนแก่น'], ''],
    ['สสบ', ['สระบุรี/ระยอง'], ''],
    ['ศรย', ['สระบุรี/ระยอง'], ''],
    ['ศบก', ['อื่นๆ'], 'บางปะกง'],
  ])('cost center %s maps to centers', (code, centers, other) => {
    const d = toCashAdvanceData({
      status: 'AWAITING_PAYMENT', created_at: '2026-08-13T03:00:00+00:00',
      requester: { employee_id: '1', name: 'x' }, request: { purpose: 'p', amount: 1, cost_center: code },
      fin: null, approval_logs: [],
    } as any);
    expect(d.centers).toEqual(centers as string[]);
    expect(d.center_other_text).toBe(other as string);
  });
  test('formatBkkDateTime', () => {
    expect(formatBkkDateTime('2026-09-16T07:03:10+00:00')).toEqual({ date: '16/09/2026', time: '14:03:10' });
    expect(formatBkkDateTime('nope')).toEqual({ date: '', time: '' });
    expect(formatBkkDateTime('')).toEqual({ date: '', time: '' });
  });
  const withEsign = (reqName = 'ณรงค์กรณ์ ท.') => ({
    ...sample,
    signatures: {
      ...sample.signatures,
      requester: { name: 'a', date: '15/9/2026', esign: { name: reqName, timestamp: '2026-09-15T02:12:45Z', ref: 'ADV-2026-0001' } },
      approver: { name: 'b', date: '16/9/2026', esign: { name: 'อธิวัฒน์', timestamp: '2026-09-16T07:03:10Z', ref: 'ข้อ 6.6' } },
    },
  });
  test('no esign markup without esign', () => {
    const html = buildCashAdvanceHtml(sample as any, {});
    expect(html).not.toContain('class="esign"');
    expect(html).not.toContain('ลงนามอิเล็กทรอนิกส์ผ่านระบบ');
  });
  test('esign stamps render', () => {
    const html = buildCashAdvanceHtml(withEsign() as any, {});
    expect((html.match(/class="esign"/g) ?? []).length).toBe(2);
    for (const s of ['✔ e-Signature', '15/09/2026', '09:12:45 น.', '16/09/2026', '14:03:10 น.', 'ADV-2026-0001', 'ข้อ 6.6',
      'ลงนามอิเล็กทรอนิกส์ผ่านระบบ menait-service · เวลาประเทศไทย (UTC+7)']) expect(html).toContain(s);
    const bad = buildCashAdvanceHtml(withEsign('<b>x</b>') as any, {});
    expect(bad).toContain('&lt;b&gt;');
    expect(bad).not.toContain('<b>x</b>');
  });
  test('toCashAdvanceData esign mapping', () => {
    const detail: any = {
      form_id: 'ADV-2026-0001', status: 'AWAITING_PAYMENT', created_at: '2026-09-15T02:12:45+00:00',
      requester: { employee_id: '1', name: 'ผู้ขอ' }, request: { purpose: 'p', amount: 1 }, fin: null,
      approval: { clause: '6.6', approver_label: 'x', required_level: 5 },
      approval_logs: [{ level_no: 5, action: 'APPROVED', action_at: '2026-09-16T07:03:10+00:00', actor_name: 'อธิวัฒน์', remark: null }],
    };
    const d = toCashAdvanceData(detail);
    expect(d.signatures.requester.esign).toEqual({ name: 'ผู้ขอ', timestamp: '2026-09-15T02:12:45+00:00', ref: 'ADV-2026-0001' });
    expect(d.signatures.approver.esign).toEqual({ name: 'อธิวัฒน์', timestamp: '2026-09-16T07:03:10+00:00', ref: 'ข้อ 6.6' });
    expect(d.signatures.unit_head.esign).toBeUndefined();
    expect(d.signatures.manager.esign).toBeUndefined();
    expect(toCashAdvanceData({ ...detail, approval_logs: [] }).signatures.approver.esign).toBeUndefined();
  });
  const chrome = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
  test.skipIf(!existsSync(chrome))('generates an e-signature sample PDF', () => {
    mkdirSync('tmp', { recursive: true });
    writeFileSync('tmp/cash-advance-esign-sample.html', buildCashAdvanceHtml(withEsign() as any, { logoUrl: `file://${process.cwd()}/public/mena.png` }));
    const r = spawnSync(chrome, ['--headless=new', '--disable-gpu', '--no-pdf-header-footer', '--allow-file-access-from-files',
      '--virtual-time-budget=5000', `--print-to-pdf=${process.cwd()}/tmp/cash-advance-esign-sample.pdf`,
      `file://${process.cwd()}/tmp/cash-advance-esign-sample.html`], { timeout: 60000 });
    expect(r.status).toBe(0);
  }, 70000);
  test.skipIf(!existsSync(chrome))('generates a sample PDF from the example JSON', () => {
    mkdirSync('tmp', { recursive: true });
    writeFileSync('tmp/cash-advance-sample.html', buildCashAdvanceHtml(sample as any, { logoUrl: `file://${process.cwd()}/public/mena.png` }));
    const r = spawnSync(chrome, ['--headless=new', '--disable-gpu', '--no-pdf-header-footer', '--allow-file-access-from-files',
      '--virtual-time-budget=5000', `--print-to-pdf=${process.cwd()}/tmp/cash-advance-sample.pdf`,
      `file://${process.cwd()}/tmp/cash-advance-sample.html`], { timeout: 60000 });
    expect(r.status).toBe(0);
    expect(readFileSync('tmp/cash-advance-sample.pdf').subarray(0, 4).toString()).toBe('%PDF');
  }, 70000);
});
