import type { AdvanceDetail, ClearItem } from '@/app/finance/types';
import { cashAdvanceBody, cashAdvanceFooter, CASH_ADVANCE_CSS, dmy, payeeFields, thaiShortDate, type CashAdvanceFormData } from './cashAdvanceForm';
import { centerCheckboxesHtml, centerFromSite } from './centers';
import { rowTotals, sumItems } from './clearItems';
import { toBkkDate } from './dates';
import { documentControlFooter, esc, formatBkkDateTime, money, printedNow, stampHtml, wrapDocument, wrapSegments, type DocumentControl, type ESign } from './printShared';

/** Part 2 = the company's "ใบขอเบิกค่าใช้จ่าย/เคลียร์เบิกล่วงหน้า (Expense Claim Form)", landscape A4 (spec v2 §5i.2). */
export const CLAIM_TITLE = 'ใบขอเบิกค่าใช้จ่าย/เคลียร์เบิกล่วงหน้า';
export const CLAIM_SUBTITLE = '(Expense Claim Form)';
export const CLEARING_DOC_NAME = 'Expense Claim Form (ADV)';
export const COMBINED_DOC_NAME = 'Cash Advance Request & Expense Claim Form (ADV)';
/** The items table always shows at least this many rows (empty rows stay blank). */
export const CLAIM_MIN_ROWS = 12;

/** Column headers, verbatim: [main, second line]; the printed text is "main second". */
export const CLAIM_COLUMNS: [string, string][] = [
  ['วันที่', ''],
  ['ทะเบียนรถและประเภท', ''],
  ['ใบกำกับภาษี/ใบเสร็จรับเงิน', 'Y/N*'],
  ['รายละเอียด', ''],
  ['ยอดเงิน(ก่อน VAT)', '(A)'],
  ['ภาษีมูลค่าเพิ่ม 7%', '(B)'],
  ['ยอดรวม', '(C)=(A)+(B)'],
  ['หัก ณ ที่จ่าย', '(D)'],
  ['สุทธิ', '(E)=(C)-(D)'],
];

export const CLAIM_CLAUSES = [
  'ข้าพเจ้าได้อ่านและเข้าใจนโยบายและข้อปฏิบัติของการเบิกค่าใช้จ่ายของบริษัทแล้ว',
  'ใบกำกับภาษี/ใบเสร็จรับเงินต้องออกในนามของบริษัท มีนาทรานสปอร์ต จำกัด (มหาชน) และที่อยู่ตามสาขา',
  'กรุณาส่งเอกสารที่ได้รับอนุมัติตาม TOA ภายในวันอังคาร เพื่อรับชำระเงินภายในวันพฤหัสบดี',
];

export const CLAIM_FOOTNOTE = '* Y = มีใบกำกับภาษี/ใบเสร็จรับเงินแนบ N= ไม่มีใบกำกับภาษี/ใบเสร็จรับเงินแนบ';

export const CLAIM_SUMMARY_LABELS = {
  total: 'รวม',
  advance: 'หัก เงินเบิกล่วงหน้า',
  diff: 'จ่ายเงินคืนพนักงาน /(พนักงานคืนเงินบริษัท)',
} as const;

export const CLAIM_SIGNERS = ['ผู้ขอเบิก', 'หัวหน้าหน่วยงาน', 'ผู้จัดการ', 'ผู้มีอำนาจอนุมัติ', 'แผนกบัญชีและการเงิน'] as const;

/** One printed expense row. Amounts null = blank; C and E are always computed from A, B, D. */
export interface ClaimRow {
  /** 'YYYY-MM-DD'; '' prints "-" (old clearings without items). */
  expense_date: string;
  vehicle: string;
  receipt: 'Y' | 'N' | '-';
  description: string;
  amount_before_vat: number | null;
  vat_amount: number | null;
  wht_amount: number | null;
}

export interface ClearingSignature { name: string; date: string; esign?: ESign }

export interface ClearingFormData {
  /** form_id: Document Control ref and the requester stamp's ref. */
  document_no: string;
  /** REF No. (โดยแผนกบัญชี) = fin.clear_doc_no */
  ref_no: string;
  /** 'YYYY-MM-DD' */
  clear_date: string;
  centers: string[];
  center_other_text: string;
  employee: { name: string; position: string; department: string; bank_account_no: string; account_name: string; bank_name: string };
  items: ClaimRow[];
  /** หัก เงินเบิกล่วงหน้า */
  amount_paid: number | null;
  signatures: { requester: ClearingSignature; accounting: ClearingSignature };
}

const num = (v: unknown): number | null => (v === null || v === undefined || v === '' || Number.isNaN(Number(v)) ? null : Number(v));

const toRow = (i: ClearItem): ClaimRow => ({
  expense_date: toBkkDate(i.expense_date),
  vehicle: i.vehicle ?? '',
  receipt: i.has_receipt ? 'Y' : 'N',
  description: i.description ?? '',
  amount_before_vat: num(i.amount_before_vat),
  vat_amount: num(i.vat_amount),
  wht_amount: num(i.wht_amount),
});

export function toClearingData(detail: AdvanceDetail): ClearingFormData {
  const fin = detail.fin;
  const name = detail.requester.name ?? '';
  const closed = detail.status === 'CLOSED' && fin?.closed_at;
  const center = centerFromSite(detail.requester.site_code, detail.requester.site);
  const items: ClaimRow[] = fin?.clear_items?.length
    ? [...fin.clear_items].sort((a, b) => a.line_no - b.line_no).map(toRow)
    // Old clearings (before line items): one row, purpose + the stored ยอดใช้จริง as A.
    : [{ expense_date: '', vehicle: '-', receipt: '-', description: fin?.purpose || detail.request.purpose || '',
      amount_before_vat: num(fin?.amount_actual), vat_amount: null, wht_amount: null }];
  return {
    document_no: detail.form_id,
    ref_no: fin?.clear_doc_no ?? '',
    clear_date: toBkkDate(fin?.clear_date),
    centers: center.centers,
    center_other_text: center.other,
    employee: {
      name,
      position: detail.requester.position ?? '',
      department: detail.requester.department ?? '',
      ...payeeFields(detail.request),
    },
    items,
    amount_paid: num(fin?.amount_paid),
    signatures: {
      requester: {
        name, date: dmy(fin?.clear_submitted_at),
        ...(fin?.clear_submitted_at ? { esign: { name, timestamp: fin.clear_submitted_at, ref: detail.form_id } } : {}),
      },
      accounting: closed
        ? { name: fin?.closed_by_name ?? '', date: dmy(fin?.closed_at), esign: { name: fin?.closed_by_name ?? '', timestamp: fin!.closed_at!, ref: 'ปิดรายการ' } }
        : { name: '', date: '' },
    },
  };
}

/** Column sums (satang-exact) + the summary box: diff = ΣE − advance (+ company pays the employee, − employee returns). */
export function claimSummary(items: ClaimRow[], amountPaid: number | null): { a: number; b: number; c: number; d: number; e: number; advance: number; diff: number } {
  const s = sumItems(items.map(r => ({
    expense_date: r.expense_date, vehicle: r.vehicle, has_receipt: r.receipt !== 'N', description: r.description,
    amount_before_vat: r.amount_before_vat, vat_amount: r.vat_amount, wht_amount: r.wht_amount,
  })));
  const advance = amountPaid ?? 0;
  return { ...s, advance, diff: (Math.round(s.e * 100) - Math.round(advance * 100)) / 100 };
}

/** Summary sign rule: positive plain, negative in parentheses "(2.00)", zero "-". */
export function formatClaimDiff(diff: number): string {
  if (diff > 0) return money(diff);
  if (diff < 0) return `(${money(-diff)})`;
  return '-';
}

/** Printed width of a string in base glyphs (Thai above/below marks take no width). */
const glyphs = (v: string) => v.replace(/[\u0E31\u0E34-\u0E3A\u0E47-\u0E4E]/g, '').length;
/** Conservative glyphs per line of the wrapping columns (รายละเอียด, ทะเบียนรถและประเภท) at the printed widths. */
const DESC_PER_LINE = 44;
const VEHICLE_PER_LINE = 14;

/** Estimated text lines of a row (the tallest wrapping cell). */
export function claimRowLines(r: ClaimRow): number {
  return Math.max(1, Math.ceil(glyphs(r.description) / DESC_PER_LINE), Math.ceil(glyphs(r.vehicle) / VEHICLE_PER_LINE));
}

/**
 * Rows to print: the items plus blank rows up to CLAIM_MIN_ROWS. A row whose text wraps takes about one blank row
 * per extra line (line 13.7px vs row 19px, rounded up), so those blank rows are dropped to keep the form on one page.
 */
export function claimRowCount(items: ClaimRow[]): number {
  const extra = items.reduce((n, r) => n + Math.ceil(((claimRowLines(r) - 1) * 13.7) / 19), 0);
  return Math.max(items.length, CLAIM_MIN_ROWS - extra);
}

/** Zero or blank amounts print "-". */
const amt = (n: number | null | undefined) => (n ? money(n) : '-');

export const CLAIM_CSS = `
@page claim { size: A4 landscape; }
.claim { page: claim; }
.claim .head-space { height: 9mm; }
.claim .att-grid { grid-template-columns: repeat(3, 1fr); }
.claim .att-grid img { max-height: 138mm; }
.cf .head { gap: 12px; }
.cf .head .logo { height: 38px; }
.cf .t1 { font-size: 19px; }
.cf .meta { min-width: 66mm; }
.cf .who { margin-top: 7px; display: grid; row-gap: 3px; }
.cf .cbs { margin-top: 0; gap: 18px; font-size: 11px; }
.cf .line { display: grid; column-gap: 16px; }
.cf .line.ppl { grid-template-columns: 1.15fr 1.25fr 1fr; }
.cf .line.acc { grid-template-columns: 1.15fr 1.25fr 1fr; }
.cf .fi { display: flex; align-items: baseline; gap: 7px; border-bottom: 1px solid var(--line); padding: 1px 0 2px; min-width: 0; }
.cf .fi .l { font-size: 10px; color: var(--muted); white-space: nowrap; flex: none; }
.cf .fi .v { font-size: 12px; font-weight: 500; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; min-width: 0; flex: 1; }
.cf .terms { margin-top: 7px; background: var(--mint); border-left: 3px solid var(--teal); padding: 3px 10px 4px; font-size: 10px; line-height: 1.5; }
.cf .terms .th { font-weight: 700; color: var(--teal); font-size: 10.5px; }
.cf .terms ol { padding-left: 15px; }
.cf .terms li::marker { color: var(--teal); font-weight: 700; }
table.ci { width: 100%; border-collapse: collapse; table-layout: fixed; margin-top: 7px; }
table.ci th { background: var(--mint); color: var(--teal); font-size: 9.5px; font-weight: 600; line-height: 1.25; padding: 3px 4px; text-align: center; vertical-align: middle; border: 1px solid var(--line); }
table.ci th .sub { display: block; font-weight: 500; }
table.ci th .nw { white-space: nowrap; }
table.ci td { border-left: 1px solid var(--line); border-right: 1px solid var(--line); border-bottom: 1px dotted #A9B8B5; height: 19px; padding: 1px 5px; font-size: 10.5px; line-height: 1.3; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
table.ci td.w { white-space: normal; overflow-wrap: anywhere; }
table.ci td.n { text-align: right; }
table.ci td.c { text-align: center; }
table.ci tr.sumrow td { border: 1px solid var(--line); border-top: 1.5px solid var(--teal); background: var(--mint); font-weight: 700; height: 21px; }
table.ci tr.sumrow td.lb { text-align: right; color: var(--teal); }
.cf .below { break-inside: avoid; display: grid; grid-template-columns: 1fr auto; column-gap: 9mm; margin-top: 3px; align-items: start; }
.cf .fn { font-size: 9.5px; color: var(--muted); }
.cf table.sig { margin-top: 5px; }
.cf table.sig th { font-size: 10px; padding: 3px; }
.cf table.sig td { padding: 0 6px 4px; }
.cf table.sig td.space { height: 17mm; padding: 2px; }
.cf table.sig .row { font-size: 9.5px; margin-top: 3px; }
.cf table.sig .row i { font-size: 10px; min-height: 14px; }
.cf .esign { font-size: 8.5px; line-height: 1.22; padding: 2px 7px; }
.cf .esign-title { font-size: 9px; }
.cf .esign { max-width: 100%; }
.cf .esign > div { white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
table.csum { border-collapse: collapse; margin-left: auto; }
table.csum td { padding: 3px 5px; font-size: 10.5px; }
table.csum td.k { text-align: right; color: var(--ink); padding-right: 9px; white-space: nowrap; }
table.csum td.v { width: 24mm; text-align: right; font-weight: 600; border: 1px solid var(--line); }
table.csum tr.diff td.v { background: var(--teal); border-color: var(--teal); color: #fff; font-weight: 700; }
table.csum tr.diff td.k { font-weight: 600; }
.cf .right .esign-note { text-align: right; margin-top: 6px; }
`;

/** Column widths in mm (รายละเอียด takes the rest). The summary value cell uses the same width as (E). */
const COL_WIDTHS = ['18mm', '28mm', '25mm', '', '24mm', '24mm', '24mm', '24mm', '24mm'];

export function clearingFooter(data: ClearingFormData, printed?: string, name = CLEARING_DOC_NAME): DocumentControl {
  const a = data.signatures.accounting;
  return { ref: data.document_no, name, owner: data.employee.name, approvedBy: a.name, approvedDate: a.date, printed: printed ?? printedNow() };
}

/** Part 2 body markup. `band` adds the top teal band (only when Part 2 starts the document). */
export function clearingBody(data: ClearingFormData, opts: { logoUrl?: string; band?: boolean } = {}): string {
  const e = data.employee;
  const fi = (label: string, value: unknown) => `<div class="fi"><span class="l">${label}</span><span class="v">${esc(value)}</span></div>`;
  const logo = opts.logoUrl ? `<img class="logo" src="${esc(opts.logoUrl)}" alt="MENA Transport">` : '<span></span>';
  const s = claimSummary(data.items, data.amount_paid);

  // Break header text only after "/" (ใบกำกับภาษี/ | ใบเสร็จรับเงิน), never inside a Thai word.
  const th = (m: string) => esc(m).split('/').map((p, i, a) => `<span class="nw">${p}${i < a.length - 1 ? '/' : ''}</span>`).join('<wbr>');
  const head = `<thead><tr>${CLAIM_COLUMNS.map(([m, sub]) => `<th>${m.includes('/') ? th(m) : esc(m)}${sub ? ` <span class="sub">${esc(sub)}</span>` : ''}</th>`).join('')}</tr></thead>`;
  const cols = `<colgroup>${COL_WIDTHS.map(w => (w ? `<col style="width:${w}">` : '<col>')).join('')}</colgroup>`;
  const rows = Array.from({ length: claimRowCount(data.items) }, (_, i) => {
    const r = data.items[i];
    if (!r) return `<tr class="r">${'<td></td>'.repeat(9)}</tr>`;
    const t = rowTotals(r);
    return `<tr class="r"><td class="c">${esc(thaiShortDate(r.expense_date) || '-')}</td><td class="w">${esc(r.vehicle)}</td><td class="c">${esc(r.receipt)}</td>`
      + `<td class="w">${esc(r.description)}</td><td class="n">${amt(r.amount_before_vat)}</td><td class="n">${amt(r.vat_amount)}</td>`
      + `<td class="n">${amt(t.total)}</td><td class="n">${amt(r.wht_amount)}</td><td class="n">${amt(t.net)}</td></tr>`;
  }).join('');
  const total = `<tr class="sumrow"><td class="lb" colspan="4">${CLAIM_SUMMARY_LABELS.total}</td>${[s.a, s.b, s.c, s.d, s.e].map(v => `<td class="n">${amt(v)}</td>`).join('')}</tr>`;

  const sg = data.signatures;
  const valid = (x?: ClearingSignature) => (x?.esign && formatBkkDateTime(x.esign.timestamp).date ? x.esign : null);
  const line = (k: string, v: string) => `<div class="row"><span class="k">${k}</span><i>${esc(v)}</i></div>`;
  const nameDate = (x?: ClearingSignature) => line('ชื่อ', x?.name ?? '') + line('วันที่', valid(x) ? dmy(valid(x)!.timestamp) : x?.date ?? '');
  const cells: [string, string][] = [
    [stampHtml(valid(sg.requester)), nameDate(sg.requester)],
    ['', nameDate()], ['', nameDate()], ['', nameDate()],
    // วันที่รับเอกสาร is written by hand when accounting receives the paper; the system only knows the close time (stamp).
    [stampHtml(valid(sg.accounting)), line('วันที่รับเอกสาร', '') + line('ชื่อ', sg.accounting.name)],
  ];
  const anyEsign = valid(sg.requester) || valid(sg.accounting);

  return `<section class="doc-part cf">${opts.band ? '<div class="doc-band"></div>' : ''}
<header class="head">${logo}<div><div class="t1">${CLAIM_TITLE}</div><div class="t2">${CLAIM_SUBTITLE}</div></div>
<div class="meta"><div><span>REF No. (โดยแผนกบัญชี)</span><b>${esc(data.ref_no)}</b></div><div class="date"><span>วันที่</span><b>${esc(dmy(data.clear_date))}</b></div></div></header>

<div class="who">
<div class="cbs"><span class="lbl">ศูนย์</span>${centerCheckboxesHtml(data.centers, data.center_other_text)}</div>
<div class="line ppl">${fi('ชื่อ-สกุล', e.name)}${fi('ตำแหน่ง', e.position)}${fi('แผนก', e.department)}</div>
<div class="line acc">${fi('โอนเงินเข้าบัญชีธนาคารเลขที่', e.bank_account_no)}${fi('ชื่อบัญชี', e.account_name)}${fi('ธนาคาร', e.bank_name)}</div>
</div>

<div class="terms"><div class="th">เงื่อนไขและข้อตกลง</div><ol>${CLAIM_CLAUSES.map(c => `<li>${esc(c)}</li>`).join('')}</ol></div>

<table class="ci">${cols}${head}<tbody>${rows}${total}</tbody></table>

<div class="below">
<div class="left"><div class="fn">${esc(CLAIM_FOOTNOTE)}</div>
<table class="sig"><thead><tr>${CLAIM_SIGNERS.map(t => `<th>${t}</th>`).join('')}</tr></thead><tbody>
<tr>${cells.map(([stamp]) => `<td class="space">${stamp}</td>`).join('')}</tr>
<tr>${cells.map(([, lines]) => `<td>${lines}</td>`).join('')}</tr></tbody></table></div>
<div class="right"><table class="csum"><tbody>
<tr><td class="k">${CLAIM_SUMMARY_LABELS.total}</td><td class="v">${amt(s.e)}</td></tr>
<tr><td class="k"><u>หัก</u> เงินเบิกล่วงหน้า</td><td class="v">${amt(data.amount_paid)}</td></tr>
<tr class="diff"><td class="k">${CLAIM_SUMMARY_LABELS.diff}</td><td class="v">${formatClaimDiff(s.diff)}</td></tr>
</tbody></table>
${anyEsign ? '<div class="esign-note">ลงนามอิเล็กทรอนิกส์ผ่านระบบ menait-service · เวลาประเทศไทย (UTC+7)</div>' : ''}</div>
</div>
</section>`;
}

export interface ClearingOpts { logoUrl?: string; fontCss?: boolean; printed?: string; attachmentsHtml?: string }

/** Part 2 on its own: every page (form + its image pages) is landscape. */
export function buildClearingHtml(data: ClearingFormData, opts: ClearingOpts = {}): string {
  return wrapDocument({
    title: `${data.document_no} — ${CLAIM_TITLE}`,
    body: clearingBody(data, { logoUrl: opts.logoUrl, band: true }) + (opts.attachmentsHtml ?? ''),
    extraCss: CASH_ADVANCE_CSS + CLAIM_CSS, fontCss: opts.fontCss, tableClass: 'claim',
    footerHtml: documentControlFooter(clearingFooter(data, opts.printed)),
  });
}

/**
 * Part 1 (+ images) portrait, then Part 2 (+ images) landscape, one document with one footer named for both.
 * Segments use named pages; a segment that ends on its form page gets `fill` so its footer sits at the page bottom.
 */
export function buildCombinedHtml(
  cash: CashAdvanceFormData, clearing: ClearingFormData,
  opts: ClearingOpts & { part1AttachmentsHtml?: string; part2AttachmentsHtml?: string } = {},
): string {
  const footer = { ...cashAdvanceFooter(cash, opts.printed), name: COMBINED_DOC_NAME };
  const att1 = opts.part1AttachmentsHtml ?? '';
  const att2 = opts.part2AttachmentsHtml ?? '';
  return wrapSegments({
    title: `${cash.document_no ?? clearing.document_no} — ใบคำขอเบิกเงินล่วงหน้า + ${CLAIM_TITLE}`,
    segments: [
      { body: cashAdvanceBody(cash, { logoUrl: opts.logoUrl }) + att1, className: att1 ? '' : 'fill' },
      { body: clearingBody(clearing, { logoUrl: opts.logoUrl, band: false }) + att2, className: att2 ? 'claim' : 'claim fill' },
    ],
    extraCss: CASH_ADVANCE_CSS + CLAIM_CSS + COMBINED_CSS, fontCss: opts.fontCss,
    footerHtml: documentControlFooter(footer),
  });
}

/** Min heights that push a form-only segment's footer down to the page bottom (page height − margins − footer, with slack). */
const COMBINED_CSS = `
.seg.fill > tbody > tr > td > .doc-part { min-height: 252mm; }
.seg.claim.fill > tbody > tr > td > .doc-part { min-height: 166mm; }
`;
