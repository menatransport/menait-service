import { describe, expect, test } from 'bun:test';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'fs';
import { spawnSync } from 'child_process';
import sample from './cash-advance-sample.json';
import { buildCashAdvanceHtml, dmy, formatBkkDateTime, thaiShortDate, validateCashAdvance, toCashAdvanceData, PRINTABLE_STATUSES } from './cashAdvanceForm';

describe('cash advance form', () => {
  test('PRINTABLE_STATUSES includes correct statuses and excludes others', () => {
    expect(PRINTABLE_STATUSES).toContain('AWAITING_VOUCHER');
    expect(PRINTABLE_STATUSES).toContain('AWAITING_PAYMENT');
    expect(PRINTABLE_STATUSES).toContain('AWAITING_CLEARING');
    expect(PRINTABLE_STATUSES).toContain('SENT_BACK');
    expect(PRINTABLE_STATUSES).toContain('AWAITING_REVIEW');
    expect(PRINTABLE_STATUSES).toContain('CLOSED');
    expect(PRINTABLE_STATUSES).not.toContain('PENDING_APPROVAL');
    expect(PRINTABLE_STATUSES).not.toContain('REJECTED');
    expect(PRINTABLE_STATUSES[0]).toBe('AWAITING_VOUCHER');
  });
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
    for (const s of ['ใบคำขอเบิกเงินล่วงหน้า', '(Cash Advance Request form)', 'วันที่', '13-ส.ค.-26',
      'ข้อมูลพนักงานผู้เบิกเงิน', 'ประเภทและวัตถุประสงค์ในการเบิกเงินล่วงหน้า', 'เงื่อนไขและข้อตกลง', 'ลงนามและอนุมัติ', 'นางสาวตัวอย่าง ทดสอบ', '000000', 'ผู้ช่วยหัวหน้าแผนกบัญชี',
      '000-0-00000-0', 'กสิกรไทย', '5,000.00', 'ห้าพันบาทถ้วน', '18/8/2026', 'กรุงเทพ', 'ลาดกระบัง/ขอนแก่น',
      'สระบุรี/ระยอง/บางปะกง', 'MDD', 'อื่นๆ', 'ผู้ขอเบิก', 'หัวหน้าหน่วยงาน', 'ผู้จัดการ', 'ผู้มีอำนาจอนุมัติ', 'counter(page)', 'Document Control &amp; Revision History',
      'ภายใน 7 วันหลังจากได้รับเงิน', 'กรุณาส่งเอกสารที่ได้รับอนุมัติตาม TOA ภายในวันอังคาร']) {
      expect(html).toContain(s);
    }
    expect(html).not.toContain('เริ่มใช้');
    expect(html).not.toContain('1 Nov 22');
    expect((html.match(/class="cb checked"/g) ?? []).length).toBe(2); // ลาดกระบัง/ขอนแก่น + อื่นๆ
  });
  test('document_no shows in the meta box and the footer; toCashAdvanceData sets it from form_id', () => {
    const html = buildCashAdvanceHtml({ ...sample, document_no: 'ADV-2026-0007' } as any, {});
    expect(html).toContain('<span>เลขที่</span><b>ADV-2026-0007</b>');
    expect(html).toContain('<td style="width:33%">ADV-2026-0007</td>');
    expect(html).toContain('Cash Advance Request (ADV)');
    const d = toCashAdvanceData({ form_id: 'ADV-2026-0009', status: 'CLOSED', created_at: '2026-08-13T03:00:00+00:00',
      requester: { employee_id: '1', name: 'x' }, request: { purpose: 'p', amount: 1 }, fin: null, approval_logs: [] } as any);
    expect(d.document_no).toBe('ADV-2026-0009');
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
      requester: { employee_id: '123', name: 'สมชาย ใจดี', department: 'บัญชี', position: 'เจ้าหน้าที่', site: 'ศูนย์ขอนแก่น', site_code: 'ศขก.' },
      request: { purpose: 'ค่าน้ำมัน', amount: 1500, use_date: '2026-08-20', cost_center: 'สกท', bank: 'KBANK', account_no: '1234567890', account_name: 'สมชาย ใจดี' },
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
    expect(d.center_other_text).toBe('');
    const o = toCashAdvanceData({ ...detail, requester: { ...detail.requester, site: 'ศูนย์บางปะกง', site_code: 'ศบก.' }, fin: { voucher_date: '2026-08-14', transfer_date: null } });
    expect(o.centers).toEqual(['สระบุรี/ระยอง/บางปะกง']);
    expect(o.center_other_text).toBe('');
    expect(o.disbursement_round).toBe('2026-08-14');
    const u = toCashAdvanceData({ ...detail, requester: { ...detail.requester, site: 'สำนักงานใหม่', site_code: null } });
    expect(u.centers).toEqual(['อื่นๆ']);
    expect(u.center_other_text).toBe('สำนักงานใหม่');
  });
  test.each([
    ['สกท.', ['กรุงเทพ'], ''],
    ['ศลบ.', ['ลาดกระบัง/ขอนแก่น'], ''],
    ['ศขก', ['ลาดกระบัง/ขอนแก่น'], ''],
    ['สสบ.', ['สระบุรี/ระยอง/บางปะกง'], ''],
    ['ศรย', ['สระบุรี/ระยอง/บางปะกง'], ''],
    ['ศบก.', ['สระบุรี/ระยอง/บางปะกง'], ''],
    ['สขข.', ['อื่นๆ'], 'สาขาทดสอบ'],
    [null, ['อื่นๆ'], 'สาขาทดสอบ'],
  ])('requester site %s maps to centers (cost_center is ignored)', (code, centers, other) => {
    const d = toCashAdvanceData({
      status: 'AWAITING_PAYMENT', created_at: '2026-08-13T03:00:00+00:00',
      requester: { employee_id: '1', name: 'x', site: 'สาขาทดสอบ', site_code: code }, request: { purpose: 'p', amount: 1, cost_center: 'สกท' },
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
      requester: { name: 'นางสาวตัวอย่างชื่อยาวมาก นามสกุลยาวมาก', date: '15/9/2026', esign: { name: reqName, timestamp: '2026-09-15T02:12:45Z', ref: 'ADV-2026-0001' } },
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
  test('stamp and วันที่ line share the Bangkok date; invalid timestamp / null name handled', () => {
    expect(dmy('2026-09-15T18:00:00Z')).toBe('16/9/2026');
    const d: any = withEsign();
    d.signatures.requester = { name: 'a', date: '15/9/2026', esign: { name: 'x', timestamp: '2026-09-15T18:00:00Z', ref: 'R1' } };
    d.signatures.approver = { name: 'b', date: '1/1/2026', esign: { name: '', timestamp: 'bad', ref: 'R2' } };
    const html = buildCashAdvanceHtml(d, {});
    expect(html).toContain('16/09/2026');
    expect(html).toContain('<i>16/9/2026</i>');
    expect((html.match(/class="esign"/g) ?? []).length).toBe(1);
    expect(html).toContain('<i>1/1/2026</i>');
    d.signatures.requester.esign.name = null;
    const h2 = buildCashAdvanceHtml(d, {});
    expect(h2).toContain('<div>-</div>');
    expect(h2).not.toContain(' น.</div><div class="esign-ref">R2');
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
