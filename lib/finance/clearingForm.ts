import type { AdvanceDetail } from '@/app/finance/types';
import { bahtText } from './bahtText';
import { cashAdvanceBody, cashAdvanceFooter, CASH_ADVANCE_CSS, dmy, thaiShortDate, type CashAdvanceFormData } from './cashAdvanceForm';
import { toBkkDate } from './dates';
import { documentControlFooter, esc, formatBkkDateTime, money, printedNow, stampHtml, wrapDocument, type DocumentControl, type ESign } from './printShared';

export interface ClearingSignature { name: string; date: string; esign?: ESign }
export interface ClearingFormData {
  document_no: string;
  clear_date: string;
  employee: { name: string; employee_id: string; position: string; department: string; cost_center: string };
  purpose: string;
  voucher_no: string;
  amount_paid: number | null;
  transfer_date: string;
  clear_due_date: string;
  amount_actual: number | null;
  settle_amount: number | null;
  settle_date: string;
  clear_doc_no: string;
  remark: string;
  signatures: { clearer: ClearingSignature; unit_head: ClearingSignature; reviewer: ClearingSignature };
}

export const CLEARING_DOC_NAME = 'Advance Clearing (ADV)';
export const COMBINED_DOC_NAME = 'Cash Advance Request & Clearing (ADV)';

/** รับคืน / เบิกเพิ่ม / พอดี from the signed settle amount (+ = company receives back, − = extra payout). */
export function settleInfo(settle: number | null | undefined): { label: string; amount: number | null } {
  if (settle === null || settle === undefined) return { label: '-', amount: null };
  if (settle > 0) return { label: 'รับคืน', amount: settle };
  if (settle < 0) return { label: 'เบิกเพิ่ม', amount: Math.abs(settle) };
  return { label: 'พอดี (ไม่มียอดคงค้าง)', amount: 0 };
}

export function toClearingData(detail: AdvanceDetail): ClearingFormData {
  const fin = detail.fin;
  const name = detail.requester.name ?? '';
  const closed = detail.status === 'CLOSED' && fin?.closed_at;
  return {
    document_no: detail.form_id,
    clear_date: toBkkDate(fin?.clear_date),
    employee: {
      name, employee_id: detail.requester.employee_id ?? '', position: detail.requester.position ?? '',
      department: detail.requester.department ?? '', cost_center: detail.request.cost_center ?? '',
    },
    purpose: fin?.purpose || detail.request.purpose || '',
    voucher_no: fin?.voucher_no ?? '',
    amount_paid: fin?.amount_paid ?? null,
    transfer_date: toBkkDate(fin?.transfer_date),
    clear_due_date: toBkkDate(fin?.clear_due_date),
    amount_actual: fin?.amount_actual ?? null,
    settle_amount: fin?.settle_amount ?? null,
    settle_date: toBkkDate(fin?.settle_date),
    clear_doc_no: fin?.clear_doc_no ?? '',
    remark: fin?.remark ?? '',
    signatures: {
      clearer: {
        name, date: dmy(fin?.clear_submitted_at),
        ...(fin?.clear_submitted_at ? { esign: { name, timestamp: fin.clear_submitted_at, ref: detail.form_id } } : {}),
      },
      unit_head: { name: '', date: '' },
      reviewer: closed
        ? { name: fin?.closed_by_name ?? '', date: dmy(fin?.closed_at), esign: { name: fin?.closed_by_name ?? '', timestamp: fin!.closed_at!, ref: 'ปิดรายการ' } }
        : { name: '', date: '' },
    },
  };
}

export const CLEARING_CSS = `
.pair { display: grid; grid-template-columns: 1fr 1fr; column-gap: 22px; row-gap: 5px; }
.f.wide { grid-column: 1 / -1; }
.f.box { background: var(--mint); border: 1px solid var(--line); border-radius: 3px; padding: 4px 8px; }
.f.box .v { font-weight: 700; font-size: 14px; }
.settle { display: grid; grid-template-columns: 1fr auto; gap: 16px; align-items: stretch; }
.settle .tot { display: flex; flex-direction: column; justify-content: center; }
`;

export function clearingFooter(data: ClearingFormData, printed?: string, name = CLEARING_DOC_NAME): DocumentControl {
  const r = data.signatures.reviewer;
  return { ref: data.document_no, name, owner: data.employee.name, approvedBy: r.name, approvedDate: r.date, printed: printed ?? printedNow() };
}

/** Part 2 body markup. `band` adds the top teal band (only when Part 2 starts the document). */
export function clearingBody(data: ClearingFormData, opts: { logoUrl?: string; band?: boolean } = {}): string {
  const e = data.employee;
  const field = (label: string, value: unknown, cls = '') =>
    `<div class="f ${cls}"><span class="l">${label}</span><span class="v">${esc(value)}</span></div>`;
  const amt = (n: number | null) => (n === null ? '' : money(n));
  const sec = (n: number, th: string, en: string) => `<div class="sec"><span class="n">${n}</span><h2>${th}</h2><small>${en}</small></div>`;
  const logo = opts.logoUrl ? `<img class="logo" src="${esc(opts.logoUrl)}" alt="MENA Transport">` : '<span></span>';
  const s = settleInfo(data.settle_amount);
  const sigCols: [string, ClearingSignature][] = [
    ['ผู้เคลียร์', data.signatures.clearer], ['หัวหน้าหน่วยงาน', data.signatures.unit_head], ['ผู้ตรวจ (บัญชี)', data.signatures.reviewer],
  ];
  const valid = (sg: ClearingSignature) => (sg.esign && formatBkkDateTime(sg.esign.timestamp).date ? sg.esign : null);
  const anyEsign = sigCols.some(([, sg]) => valid(sg));
  const lines = (sg: ClearingSignature) =>
    `<div class="row"><span class="k">ชื่อ</span><i>${esc(sg.name)}</i></div><div class="row"><span class="k">วันที่</span><i>${esc(valid(sg) ? dmy(valid(sg)!.timestamp) : sg.date)}</i></div>`;
  const settleBlock = s.amount === null
    ? `<div class="tot"><div class="k">ผลการเคลียร์</div><div class="amt">-</div></div>`
    : s.amount === 0
      ? `<div class="tot"><div class="k">ผลการเคลียร์</div><div class="amt" style="font-size:16px">${esc(s.label)}</div></div>`
      : `<div class="tot"><div class="k">${esc(s.label)}</div><div class="amt">${money(s.amount)}<span>บาท</span></div><div class="words">จำนวนเงิน (ตัวอักษร) : ${esc(bahtText(s.amount))}</div></div>`;

  return `<section class="doc-part">${opts.band ? '<div class="doc-band"></div>' : ''}
<header class="head">${logo}<div><div class="t1">ใบเคลียร์เงินทดรองจ่าย</div><div class="t2">(Cash Advance Clearing form)</div></div>
<div class="meta"><div class="ver">เริ่มใช้ 1 Nov 22</div><div><span>เลขที่</span><b>${esc(data.document_no)}</b></div><div class="date"><span>วันที่</span><b>${esc(thaiShortDate(data.clear_date))}</b></div></div></header>

${sec(1, 'ข้อมูลผู้เบิก', 'Requester')}
<div class="grid">${field('ชื่อ-สกุล', e.name)}${field('รหัสพนักงาน', e.employee_id)}${field('ตำแหน่ง', e.position)}${field('แผนก', e.department)}${field('ศูนย์ค่าใช้จ่าย', e.cost_center)}</div>

${sec(2, 'ข้อมูลการเบิก', 'Advance')}
<div class="pair">${field('วัตถุประสงค์', data.purpose, 'wide')}${field('เลขที่ใบเบิก', data.voucher_no)}${field('ยอดเงินที่ได้รับ (บาท)', amt(data.amount_paid), 'box')}${field('วันที่โอนเงิน', dmy(data.transfer_date))}${field('กำหนดการเคลียร์', dmy(data.clear_due_date))}</div>

${sec(3, 'สรุปการเคลียร์', 'Clearing summary')}
<div class="settle"><div class="pair" style="align-content:start">${field('ยอดใช้จริง (บาท)', amt(data.amount_actual), 'box')}${field('วันที่ส่งเอกสารเคลียร์', dmy(data.clear_date))}${field('วันที่โอนเงินคืนบริษัท', dmy(data.settle_date))}${field('เอกสารเคลียร์ (บัญชี)', data.clear_doc_no)}${field('หมายเหตุ', data.remark, 'wide')}</div>${settleBlock}</div>

${sec(4, 'ลงนาม', 'Signatures')}
<table class="sig"><thead><tr>${sigCols.map(([t]) => `<th>${t}</th>`).join('')}</tr></thead><tbody>
<tr>${sigCols.map(([, sg]) => `<td class="space">${stampHtml(valid(sg))}</td>`).join('')}</tr>
<tr>${sigCols.map(([, sg]) => `<td>${lines(sg)}</td>`).join('')}</tr></tbody></table>
${anyEsign ? '<div class="esign-note">ลงนามอิเล็กทรอนิกส์ผ่านระบบ menait-service · เวลาประเทศไทย (UTC+7)</div>' : ''}
</section>`;
}

export interface ClearingOpts { logoUrl?: string; fontCss?: boolean; printed?: string; attachmentsHtml?: string }

/** Part 2 on its own. */
export function buildClearingHtml(data: ClearingFormData, opts: ClearingOpts = {}): string {
  return wrapDocument({
    title: `${data.document_no} — ใบเคลียร์เงินทดรองจ่าย`,
    body: clearingBody(data, { logoUrl: opts.logoUrl, band: true }) + (opts.attachmentsHtml ?? ''),
    extraCss: CASH_ADVANCE_CSS + CLEARING_CSS, fontCss: opts.fontCss,
    footerHtml: documentControlFooter(clearingFooter(data, opts.printed)),
  });
}

/** Part 1 + images, page break, Part 2 + images, one document, one footer named for both. */
export function buildCombinedHtml(
  cash: CashAdvanceFormData, clearing: ClearingFormData,
  opts: ClearingOpts & { part1AttachmentsHtml?: string; part2AttachmentsHtml?: string } = {},
): string {
  const footer = { ...cashAdvanceFooter(cash, opts.printed), name: COMBINED_DOC_NAME };
  return wrapDocument({
    title: `${cash.document_no ?? clearing.document_no} — ใบคำขอเบิกและใบเคลียร์เงินทดรองจ่าย`,
    body: cashAdvanceBody(cash, { logoUrl: opts.logoUrl }) + (opts.part1AttachmentsHtml ?? '')
      + clearingBody(clearing, { logoUrl: opts.logoUrl, band: false }) + (opts.part2AttachmentsHtml ?? ''),
    extraCss: CASH_ADVANCE_CSS + CLEARING_CSS, fontCss: opts.fontCss,
    footerHtml: documentControlFooter(footer),
  });
}
