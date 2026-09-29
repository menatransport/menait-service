import { describe, expect, test } from 'bun:test';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'fs';
import { spawnSync } from 'child_process';
import sample from './cash-advance-sample.json';
import { buildCashAdvanceHtml, dmy, thaiShortDate, validateCashAdvance, toCashAdvanceData } from './cashAdvanceForm';

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
    expect(d.signatures.approver).toEqual({ name: 'ผู้จัดการ หนึ่ง', date: '14/8/2026' });
    const o = toCashAdvanceData({ ...detail, request: { ...detail.request, cost_center: 'ศบก' }, fin: { voucher_date: '2026-08-14', transfer_date: null } });
    expect(o.centers).toEqual(['อื่นๆ']);
    expect(o.center_other_text).toBe('บางปะกง');
    expect(o.disbursement_round).toBe('2026-08-14');
  });
  const chrome = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
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
