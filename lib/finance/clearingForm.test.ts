import { describe, expect, test } from 'bun:test';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'fs';
import { spawnSync } from 'child_process';
import {
  buildClearingHtml, buildCombinedHtml, CLAIM_CLAUSES, CLAIM_COLUMNS, CLAIM_FOOTNOTE, CLAIM_MIN_ROWS, CLAIM_SIGNERS, CLAIM_SUMMARY_LABELS,
  claimRowCount, claimSummary, formatClaimDiff, toClearingData, type ClaimRow,
} from './clearingForm';
import { toCashAdvanceData } from './cashAdvanceForm';
import { attachmentPagesHtml } from './printShared';

/** Reference example (ADV/20260930095247.pdf page 2): 6 receipts, advance 2,000.00. */
const REF_ITEMS: [number, number][] = [[398.13, 27.87], [403.74, 28.26], [251.40, 17.60], [398.13, 27.87], [357.94, 25.06], [66.00, 0]];
const clearItems = (rows = REF_ITEMS) => rows.map(([a, b], i) => ({
  line_no: i + 1, expense_date: '2026-08-14', vehicle: null, has_receipt: true, description: 'กาแฟเครื่องดื่ม ศบก.',
  amount_before_vat: a, vat_amount: b, total_amount: Math.round((a + b) * 100) / 100, wht_amount: 0, net_amount: Math.round((a + b) * 100) / 100,
}));

const detail = (over: any = {}, finOver: any = {}): any => ({
  form_id: 'ADV-2026-0001', status: 'AWAITING_REVIEW', created_at: '2026-08-13T02:12:45+00:00',
  requester: { employee_id: '660367', name: 'สุนิสา ทาระเวท', department: 'ทรัพยากรบุคคล', position: 'หัวหน้าแผนกค่าจ้างและสวัสดิการ', site: 'สำนักงานสระบุรี', site_code: 'สสบ.' },
  request: { purpose: 'เพื่อสำรองจ่าย', amount: 2000, use_date: '2026-08-18', cost_center: 'สกท', bank: 'KBANK', account_no: '0413954568', account_name: 'สุนิสา ทาระเวท' },
  approval: { clause: '6.5', approver_label: 'x', required_level: 5 },
  approval_logs: [{ level_no: 5, action: 'APPROVED', action_at: '2026-08-14T07:03:10+00:00', actor_name: 'นายผู้อนุมัติ', remark: null }],
  fin: {
    voucher_no: 'V-1', amount_paid: 2000, transfer_date: '2026-08-18', clear_due_date: '2026-08-25', purpose: 'กาแฟเครื่องดื่ม ศบก.',
    clear_date: '2026-09-10', amount_actual: 2002, clear_doc_no: 'CL-2609-0012', settle_amount: -2, settle_date: null, remark: null,
    clear_items: clearItems(),
    clear_submitted_at: '2026-09-10T03:15:00+00:00', closed_at: '2026-09-11T08:30:00+00:00', closed_by_name: 'นายบัญชี ตรวจ', ...finOver,
  },
  ...over,
});

/** Visible text: tags removed, whitespace collapsed (headers are split into spans / <wbr>). */
const text = (html: string) => html.replace(/<wbr>/g, '').replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ');
const bodyRows = (html: string) => (html.match(/<tr class="r">/g) ?? []).length;
/** Items-table header cells as printed (inline markup removed). */
const headerTexts = (html: string) => [...html.slice(html.indexOf('<table class="ci">')).split('</thead>')[0].matchAll(/<th>(.*?)<\/th>/g)]
  .map(m => m[1].replace(/<[^>]+>/g, ''));

describe('expense claim form (Part 2)', () => {
  test('toClearingData maps header, ศูนย์ from the requester site, payee and items', () => {
    const d = toClearingData(detail());
    expect(d.document_no).toBe('ADV-2026-0001');
    expect(d.ref_no).toBe('CL-2609-0012');
    expect(d.clear_date).toBe('2026-09-10');
    expect(d.centers).toEqual(['สระบุรี/ระยอง/บางปะกง']);
    expect(d.employee).toEqual({ name: 'สุนิสา ทาระเวท', position: 'หัวหน้าแผนกค่าจ้างและสวัสดิการ', department: 'ทรัพยากรบุคคล',
      bank_account_no: '041-3-95456-8', bank_name: 'กสิกรไทย', account_name: 'สุนิสา ทาระเวท' });
    expect(d.amount_paid).toBe(2000);
    expect(d.items.length).toBe(6);
    expect(d.items[0]).toEqual({ expense_date: '2026-08-14', vehicle: '', receipt: 'Y', description: 'กาแฟเครื่องดื่ม ศบก.',
      amount_before_vat: 398.13, vat_amount: 27.87, wht_amount: 0 });
  });
  test('items follow line_no; N receipts', () => {
    const items = clearItems().reverse().map((x, i) => (i === 0 ? { ...x, has_receipt: false, vehicle: '70-1234 (รถโม่)' } : x));
    const d = toClearingData(detail({}, { clear_items: items }));
    expect(d.items.map(r => r.amount_before_vat)).toEqual(REF_ITEMS.map(([a]) => a));
    expect(d.items[5]).toMatchObject({ receipt: 'N', vehicle: '70-1234 (รถโม่)' });
  });
  test('e-sign: requester from clear_submitted_at; แผนกบัญชีและการเงิน only when CLOSED', () => {
    const open = toClearingData(detail());
    expect(open.signatures.requester.esign).toEqual({ name: 'สุนิสา ทาระเวท', timestamp: '2026-09-10T03:15:00+00:00', ref: 'ADV-2026-0001' });
    expect(open.signatures.requester.date).toBe('10/9/2026');
    expect(open.signatures.accounting).toEqual({ name: '', date: '' });
    const closed = toClearingData(detail({ status: 'CLOSED' }));
    expect(closed.signatures.accounting.esign).toEqual({ name: 'นายบัญชี ตรวจ', timestamp: '2026-09-11T08:30:00+00:00', ref: 'ปิดรายการ' });
    expect(toClearingData(detail({ status: 'CLOSED' }, { closed_at: null })).signatures.accounting.esign).toBeUndefined();
    expect((buildClearingHtml(open, {}).match(/class="esign"/g) ?? []).length).toBe(1);
    const html = buildClearingHtml(closed, {});
    expect((html.match(/class="esign"/g) ?? []).length).toBe(2);
    expect(html).toContain('ปิดรายการ');
    expect(html).toContain('ลงนามอิเล็กทรอนิกส์ผ่านระบบ');
  });
  test('html has the title, header, every column header, clause, summary label and signature title (verbatim)', () => {
    const html = buildClearingHtml(toClearingData(detail({ status: 'CLOSED' })), {});
    const t = text(html);
    for (const s of ['ใบขอเบิกค่าใช้จ่าย/เคลียร์เบิกล่วงหน้า', '(Expense Claim Form)', 'REF No. (โดยแผนกบัญชี)', 'CL-2609-0012', 'วันที่ 10/9/2026',
      'ศูนย์', 'ชื่อ-สกุล', 'ตำแหน่ง', 'แผนก', 'โอนเงินเข้าบัญชีธนาคารเลขที่ 041-3-95456-8', 'ชื่อบัญชี สุนิสา ทาระเวท', 'ธนาคาร กสิกรไทย',
      'เงื่อนไขและข้อตกลง', CLAIM_FOOTNOTE, 'วันที่รับเอกสาร', 'Expense Claim Form (ADV)']) expect(t).toContain(s);
    expect(t).not.toContain('ธนาคาร ธนาคาร');
    const headers = CLAIM_COLUMNS.map(([m, sub]) => (sub ? `${m} ${sub}` : m));
    expect(headers).toEqual(['วันที่', 'ทะเบียนรถและประเภท', 'ใบกำกับภาษี/ใบเสร็จรับเงิน Y/N*', 'รายละเอียด', 'ยอดเงิน', 'หัก ณ ที่จ่าย', 'สุทธิ']);
    expect(headers.length).toBe(7);
    expect(headerTexts(html)).toEqual(headers);
    expect(CLAIM_CLAUSES).toEqual([
      'ข้าพเจ้าได้อ่านและเข้าใจนโยบายและข้อปฏิบัติของการเบิกค่าใช้จ่ายของบริษัทแล้ว',
      'ใบกำกับภาษี/ใบเสร็จรับเงินต้องออกในนามของบริษัท มีนาทรานสปอร์ต จำกัด (มหาชน) และที่อยู่ตามสาขา',
      'กรุณาส่งเอกสารที่ได้รับอนุมัติตาม TOA ภายในวันอังคาร เพื่อรับชำระเงินภายในวันพฤหัสบดี',
    ]);
    for (const c of CLAIM_CLAUSES) expect(html).toContain(`<li>${c}</li>`);
    expect(CLAIM_FOOTNOTE).toBe('* Y = มีใบกำกับภาษี/ใบเสร็จรับเงินแนบ N= ไม่มีใบกำกับภาษี/ใบเสร็จรับเงินแนบ');
    for (const l of [CLAIM_SUMMARY_LABELS.total, 'หัก เงินเบิกล่วงหน้า', 'จ่ายเงินคืนพนักงาน /(พนักงานคืนเงินบริษัท)']) expect(t).toContain(l);
    expect([...CLAIM_SIGNERS]).toEqual(['ผู้ขอเบิก', 'หัวหน้าหน่วยงาน', 'ผู้จัดการ', 'ผู้มีอำนาจอนุมัติ', 'แผนกบัญชีและการเงิน']);
    for (const s of CLAIM_SIGNERS) expect(html).toContain(`<th>${s}</th>`);
    expect((html.match(/class="cb checked"/g) ?? []).length).toBe(1);
    expect(html).toContain('<span class="cb checked"></span>สระบุรี/ระยอง/บางปะกง');
    expect((html.match(/<span class="cbi">/g) ?? []).length).toBe(3); // 3 ศูนย์ options only
    for (const gone of ['MDD', 'อื่นๆ']) expect(html).not.toContain(gone);
    // landscape named page, page counter, no version box
    expect(html).toContain('@page claim { size: A4 landscape; }');
    expect(html).toContain('<table class="print-wrap claim">');
    expect(html).toContain('counter(page)');
    expect(html).not.toContain('เริ่มใช้');
    expect(html).not.toContain('1 Nov 22');
  });
  test('rows: dates thaiShortDate, zero amounts "-", at least 12 rows, totals of ยอดเงิน/หัก/สุทธิ', () => {
    const html = buildClearingHtml(toClearingData(detail()), {});
    expect(bodyRows(html)).toBe(CLAIM_MIN_ROWS);
    expect(html).toContain('<td class="c">14-ส.ค.-26</td>');
    expect(html).toContain('<td class="n">66.00</td><td class="n">-</td><td class="n">66.00</td></tr>');
    expect(html).toContain('<td class="n">426.00</td><td class="n">-</td><td class="n">426.00</td></tr>');
    expect(html).toContain('<td class="n">2,002.00</td><td class="n">-</td><td class="n">2,002.00</td></tr>');
    const many = clearItems(Array.from({ length: 15 }, (_, i) => REF_ITEMS[i % 6]));
    expect(bodyRows(buildClearingHtml(toClearingData(detail({}, { clear_items: many })), {}))).toBe(15);
    const one = buildClearingHtml(toClearingData(detail({}, { clear_items: clearItems([[100, 7]]) })), {});
    expect(bodyRows(one)).toBe(12);
    expect((one.match(/<tr class="r"><td><\/td>/g) ?? []).length).toBe(11);
  });
  test('wrapping text uses blank rows; never fewer rows than items', () => {
    const r = (description: string, vehicle = ''): ClaimRow => ({ expense_date: '2026-08-14', vehicle, receipt: 'Y', description,
      amount_before_vat: 1, vat_amount: 0, wht_amount: 0 });
    expect(claimRowCount([r('สั้น')])).toBe(12);
    expect(claimRowCount([r('ก'.repeat(100))])).toBe(10); // 3 lines → 2 blank rows used
    expect(claimRowCount([r('x', '70-1234 สระบุรี (รถโม่ 10 ล้อ)')])).toBe(11); // 26 glyphs → 2 lines
    expect(claimRowCount(Array.from({ length: 20 }, () => r('ก'.repeat(200))))).toBe(20);
    // Thai marks take no width: 180 chars = 60 glyphs → 2 lines → 1 blank row
    expect(claimRowCount([r('กี่'.repeat(60))])).toBe(11);
  });
  test('summary: ΣE − advance; positive plain, negative in parentheses, zero "-"', () => {
    expect(formatClaimDiff(2)).toBe('2.00');
    expect(formatClaimDiff(-800)).toBe('(800.00)');
    expect(formatClaimDiff(0)).toBe('-');
    const ref = claimSummary(toClearingData(detail()).items, 2000);
    expect(ref).toEqual({ a: 1875.34, b: 126.66, c: 2002, d: 0, e: 2002, advance: 2000, diff: 2 });
    const pos = buildClearingHtml(toClearingData(detail()), {});
    expect(pos).toContain('<tr class="diff"><td class="k">จ่ายเงินคืนพนักงาน /(พนักงานคืนเงินบริษัท)</td><td class="v">2.00</td></tr>');
    expect(pos).toContain('<td class="v">2,000.00</td>');
    const neg = buildClearingHtml(toClearingData(detail({}, { amount_paid: 5000, clear_items: clearItems([[4000, 0], [200, 0]]) })), {});
    expect(neg).toContain('<td class="v">(800.00)</td>');
    const zero = buildClearingHtml(toClearingData(detail({}, { amount_paid: 2002 })), {});
    expect(zero).toContain('<tr class="diff"><td class="k">จ่ายเงินคืนพนักงาน /(พนักงานคืนเงินบริษัท)</td><td class="v">-</td></tr>');
    // หัก ณ ที่จ่าย lowers E and the summary
    const whtRow = buildClearingHtml(toClearingData(detail({}, { clear_items: [{ ...clearItems([[1000, 0]])[0], wht_amount: 30, net_amount: 970 }] })), {});
    expect(whtRow).toContain('<td class="n">1,000.00</td><td class="n">30.00</td><td class="n">970.00</td></tr>');
    expect(whtRow).toContain('<td class="lb" colspan="4">รวม</td><td class="n">1,000.00</td><td class="n">30.00</td><td class="n">970.00</td>');
    const wht = claimSummary([{ expense_date: '', vehicle: '', receipt: 'Y', description: 'x', amount_before_vat: 1000, vat_amount: 70, wht_amount: 30 }], 1000);
    expect(wht).toMatchObject({ c: 1070, d: 30, e: 1040, diff: 40 });
  });
  test('old clearing without items: one fallback row (purpose, A = amount_actual, others "-")', () => {
    for (const items of [[], undefined]) {
      const d = toClearingData(detail({}, { clear_items: items, amount_actual: 1500 }));
      expect(d.items).toEqual([{ expense_date: '', vehicle: '-', receipt: '-', description: 'กาแฟเครื่องดื่ม ศบก.', amount_before_vat: 1500, vat_amount: null, wht_amount: null }]);
      const html = buildClearingHtml(d, {});
      expect(html).toContain('<tr class="r"><td class="c">-</td><td class="w">-</td><td class="c">-</td><td class="w">กาแฟเครื่องดื่ม ศบก.</td><td class="n">1,500.00</td><td class="n">-</td><td class="n">1,500.00</td></tr>');
      expect(bodyRows(html)).toBe(12);
      expect(html).toContain('<td class="v">(500.00)</td>');
    }
    expect(toClearingData(detail({}, { clear_items: [], purpose: null })).items[0].description).toBe('เพื่อสำรองจ่าย');
  });
  test('escapes interpolated strings', () => {
    const items = clearItems().map((x, i) => (i === 0 ? { ...x, description: '<script>x</script>', vehicle: '"&' } : x));
    const html = buildClearingHtml(toClearingData(detail({ requester: { ...detail().requester, name: '<b>n</b>', site_code: null, site: '<i>s</i>' } }, { clear_items: items, clear_doc_no: '<r>' })), {});
    for (const bad of ['<script>x', '<b>n</b>', '<r>']) expect(html).not.toContain(bad);
    for (const ok of ['&lt;script&gt;x&lt;/script&gt;', '&quot;&amp;', '&lt;b&gt;n&lt;/b&gt;', '&lt;r&gt;']) expect(html).toContain(ok);
  });
  test('window title and Document Control use the new Part 2 name', () => {
    const html = buildClearingHtml(toClearingData(detail()), {});
    expect(html).toContain('<title>ADV-2026-0001 — ใบขอเบิกค่าใช้จ่าย/เคลียร์เบิกล่วงหน้า</title>');
    expect(html).toContain('Expense Claim Form (ADV)');
    expect(html).not.toContain(['ใบเคลียร์', 'เงิน'].join('')); // old Part 2 name (split so the repo grep stays clean)
  });
  test('combined: Part 1 portrait segment then Part 2 landscape segment, one footer name', () => {
    const html = buildCombinedHtml(toCashAdvanceData(detail()), toClearingData(detail()), {});
    expect(html).toContain('Cash Advance Request &amp; Expense Claim Form (ADV)');
    expect(html).toContain('(Cash Advance Request form)');
    expect(html).toContain('(Expense Claim Form)');
    expect(html).not.toContain('class="footer-fixed"');
    expect((html.match(/class="doc-band"/g) ?? []).length).toBe(1);
    expect((html.match(/<table class="print-wrap seg/g) ?? []).length).toBe(2);
    expect(html).toContain('<table class="print-wrap seg fill">');
    expect(html).toContain('<table class="print-wrap seg claim fill">');
    expect((html.match(/class="seg-footer"/g) ?? []).length).toBe(2);
    expect(html.indexOf('(Cash Advance Request form)')).toBeLessThan(html.indexOf('(Expense Claim Form)'));
    expect(html.indexOf('<table class="print-wrap seg fill">')).toBeLessThan(html.indexOf('<table class="print-wrap seg claim fill">'));
    expect(html).toContain('<title>ADV-2026-0001 — ใบคำขอเบิกเงินล่วงหน้า + ใบขอเบิกค่าใช้จ่าย/เคลียร์เบิกล่วงหน้า</title>');
    const att = buildCombinedHtml(toCashAdvanceData(detail()), toClearingData(detail()), { part1AttachmentsHtml: '<section class="att">a</section>', part2AttachmentsHtml: '<section class="att">b</section>' });
    expect(att).toContain('<table class="print-wrap seg">');
    expect(att).toContain('<table class="print-wrap seg claim">');
  });

  const chrome = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
  const render = (name: string, html: string) => {
    mkdirSync('tmp', { recursive: true });
    writeFileSync(`tmp/${name}.html`, html);
    const r = spawnSync(chrome, ['--headless=new', '--disable-gpu', '--no-pdf-header-footer', '--allow-file-access-from-files',
      '--virtual-time-budget=5000', `--print-to-pdf=${process.cwd()}/tmp/${name}.pdf`, `file://${process.cwd()}/tmp/${name}.html`], { timeout: 60000 });
    expect(r.status).toBe(0);
    // Page orientations in page order, read from the PDF's /MediaBox entries: 'P' portrait, 'L' landscape.
    return [...readFileSync(`tmp/${name}.pdf`).toString('latin1').matchAll(/\/MediaBox \[0 0 ([\d.]+) ([\d.]+)\]/g)]
      .map(m => (Number(m[1]) > Number(m[2]) ? 'L' : 'P')).join('');
  };
  const logo = `file://${process.cwd()}/public/mena.png`;
  const att = (f: string[]) => attachmentPagesHtml(f.map((folder, i) => ({ folder, fileName: `f${i}.png`, url: logo })), f, { clear: 'เอกสารเคลียร์ / สลิปคืนเงิน', check: 'หลักฐานการเงิน (จ่ายเพิ่ม)', request: 'เอกสารประกอบการขอเบิก' });
  test.skipIf(!existsSync(chrome))('Chrome: claim form is one landscape page; combined prints portrait then landscape', () => {
    const d = detail({ status: 'CLOSED' });
    expect(render('clearing-sample', buildClearingHtml(toClearingData(d), { logoUrl: logo }))).toBe('L');
    expect(render('clearing-att-sample', buildClearingHtml(toClearingData(d), { logoUrl: logo, attachmentsHtml: att(['clear', 'clear']) }))).toBe('LL');
    expect(render('both-sample', buildCombinedHtml(toCashAdvanceData(d), toClearingData(d),
      { logoUrl: logo, part1AttachmentsHtml: att(['request', 'request']), part2AttachmentsHtml: att(['clear', 'clear']) }))).toBe('PPLL');
    expect(render('both-noatt-sample', buildCombinedHtml(toCashAdvanceData(d), toClearingData(d), { logoUrl: logo }))).toBe('PL');
  }, 180000);
});
