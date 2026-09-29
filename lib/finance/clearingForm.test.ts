import { describe, expect, test } from 'bun:test';
import { existsSync, mkdirSync, writeFileSync } from 'fs';
import { spawnSync } from 'child_process';
import { buildClearingHtml, buildCombinedHtml, settleInfo, toClearingData } from './clearingForm';
import { toCashAdvanceData } from './cashAdvanceForm';
import { attachmentPagesHtml } from './printShared';

const detail = (over: any = {}, finOver: any = {}): any => ({
  form_id: 'ADV-2026-0001', status: 'AWAITING_REVIEW', created_at: '2026-08-13T02:12:45+00:00',
  requester: { employee_id: '000000', name: 'นางสาวตัวอย่าง ทดสอบ', department: 'บัญชี', position: 'ผู้ช่วยหัวหน้าแผนกบัญชี' },
  request: { purpose: 'เพื่อสำรองจ่าย', amount: 5000, use_date: '2026-08-18', cost_center: 'ศลบ', bank: 'KBANK', account_no: '0000000000', account_name: 'x' },
  approval: { clause: '6.5', approver_label: 'x', required_level: 5 },
  approval_logs: [{ level_no: 5, action: 'APPROVED', action_at: '2026-08-14T07:03:10+00:00', actor_name: 'นายผู้อนุมัติ', remark: null }],
  fin: {
    voucher_no: 'V-1', amount_paid: 5000, transfer_date: '2026-08-18', clear_due_date: '2026-08-25', purpose: 'เพื่อสำรองจ่ายเครดิต',
    clear_date: '2026-08-24', amount_actual: 4200, clear_doc_no: 'CL-9', settle_amount: 800, settle_date: '2026-08-26', remark: 'หมายเหตุ <x>',
    clear_submitted_at: '2026-08-24T03:00:00+00:00', closed_at: '2026-08-27T08:30:00+00:00', closed_by_name: 'นายบัญชี ตรวจ', ...finOver,
  },
  ...over,
});

describe('clearing form', () => {
  test('settleInfo: รับคืน / เบิกเพิ่ม / พอดี', () => {
    expect(settleInfo(800)).toEqual({ label: 'รับคืน', amount: 800 });
    expect(settleInfo(-250.5)).toEqual({ label: 'เบิกเพิ่ม', amount: 250.5 });
    expect(settleInfo(0)).toEqual({ label: 'พอดี (ไม่มียอดคงค้าง)', amount: 0 });
    expect(settleInfo(null).amount).toBeNull();
  });
  test('toClearingData maps fields; reviewer stamp only when CLOSED', () => {
    const open = toClearingData(detail());
    expect(open.document_no).toBe('ADV-2026-0001');
    expect(open.purpose).toBe('เพื่อสำรองจ่ายเครดิต');
    expect(open.clear_date).toBe('2026-08-24');
    expect(open.signatures.clearer.esign).toEqual({ name: 'นางสาวตัวอย่าง ทดสอบ', timestamp: '2026-08-24T03:00:00+00:00', ref: 'ADV-2026-0001' });
    expect(open.signatures.reviewer).toEqual({ name: '', date: '' });
    expect(open.signatures.unit_head).toEqual({ name: '', date: '' });
    const closed = toClearingData(detail({ status: 'CLOSED' }));
    expect(closed.signatures.reviewer.esign).toEqual({ name: 'นายบัญชี ตรวจ', timestamp: '2026-08-27T08:30:00+00:00', ref: 'ปิดรายการ' });
    expect(closed.signatures.reviewer.date).toBe('27/8/2026');
    expect(toClearingData(detail({ status: 'CLOSED' }, { closed_at: null })).signatures.reviewer.esign).toBeUndefined();
  });
  test('html has all sections, labels and the settle result', () => {
    const html = buildClearingHtml(toClearingData(detail({ status: 'CLOSED' })), {});
    for (const s of ['ใบเคลียร์เงินทดรองจ่าย', '(Cash Advance Clearing form)', 'เริ่มใช้ 1 Nov 22', 'ADV-2026-0001', '24-ส.ค.-26',
      'ข้อมูลผู้เบิก', 'ข้อมูลการเบิก', 'สรุปการเคลียร์', 'ลงนาม', 'ศูนย์ค่าใช้จ่าย', 'เลขที่ใบเบิก', 'ยอดเงินที่ได้รับ', 'กำหนดการเคลียร์',
      'ยอดใช้จริง', 'วันที่ส่งเอกสารเคลียร์', 'วันที่โอนเงินคืนบริษัท', 'เอกสารเคลียร์ (บัญชี)', 'หมายเหตุ',
      'ผู้เคลียร์', 'หัวหน้าหน่วยงาน', 'ผู้ตรวจ (บัญชี)', 'รับคืน', '800.00', 'แปดร้อยบาทถ้วน', '4,200.00', 'ปิดรายการ', 'ลงนามอิเล็กทรอนิกส์',
      'Advance Clearing (ADV)', 'counter(page)']) expect(html).toContain(s);
    expect((html.match(/class="esign"/g) ?? []).length).toBe(2);
  });
  test('เบิกเพิ่ม, พอดี and no-stamp cases', () => {
    expect(buildClearingHtml(toClearingData(detail({}, { settle_amount: -300 })), {})).toContain('เบิกเพิ่ม');
    expect(buildClearingHtml(toClearingData(detail({}, { settle_amount: 0 })), {})).toContain('พอดี (ไม่มียอดคงค้าง)');
    const open = buildClearingHtml(toClearingData(detail()), {});
    expect((open.match(/class="esign"/g) ?? []).length).toBe(1);
  });
  test('escapes interpolated strings', () => {
    const html = buildClearingHtml(toClearingData(detail()), {});
    expect(html).toContain('หมายเหตุ &lt;x&gt;');
    expect(html).not.toContain('<x>');
  });
  test('combined: one document, both parts, page break sibling rule, combined footer name', () => {
    const html = buildCombinedHtml(toCashAdvanceData(detail()), toClearingData(detail()), {});
    expect(html).toContain('Cash Advance Request &amp; Clearing (ADV)');
    expect(html).toContain('(Cash Advance Request form)');
    expect(html).toContain('(Cash Advance Clearing form)');
    expect((html.match(/class="doc-band"/g) ?? []).length).toBe(1);
    expect((html.match(/<section class="doc-part">/g) ?? []).length).toBe(2);
    expect(html.indexOf('(Cash Advance Request form)')).toBeLessThan(html.indexOf('(Cash Advance Clearing form)'));
  });
  const chrome = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
  const render = (name: string, html: string) => {
    mkdirSync('tmp', { recursive: true });
    writeFileSync(`tmp/${name}.html`, html);
    return spawnSync(chrome, ['--headless=new', '--disable-gpu', '--no-pdf-header-footer', '--allow-file-access-from-files',
      '--virtual-time-budget=5000', `--print-to-pdf=${process.cwd()}/tmp/${name}.pdf`, `file://${process.cwd()}/tmp/${name}.html`], { timeout: 60000 });
  };
  const logo = `file://${process.cwd()}/public/mena.png`;
  const att = (f: string[]) => attachmentPagesHtml(f.map((folder, i) => ({ folder, fileName: `f${i}.png`, url: logo })), f, { clear: 'เอกสารเคลียร์ / สลิปคืนเงิน', check: 'หลักฐานการเงิน (จ่ายเพิ่ม)', request: 'เอกสารประกอบการขอเบิก' });
  test.skipIf(!existsSync(chrome))('generates clearing + combined sample PDFs', () => {
    const d = detail({ status: 'CLOSED' });
    expect(render('clearing-sample', buildClearingHtml(toClearingData(d), { logoUrl: logo, attachmentsHtml: att(['clear', 'clear']) })).status).toBe(0);
    expect(render('both-sample', buildCombinedHtml({ ...toCashAdvanceData(d), ...({} as any) } as any, toClearingData(d),
      { logoUrl: logo, part1AttachmentsHtml: att(['request', 'request']), part2AttachmentsHtml: att(['clear', 'clear']) })).status).toBe(0);
  }, 120000);
});
