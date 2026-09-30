import type { AdvanceDetail } from '@/app/finance/types';
import { bahtText } from './bahtText';
import { bankLabel, formatAccountNo } from './bank';
import { toBkkDate } from './dates';
import { documentControlFooter, esc, formatBkkDateTime, money, printedNow, stampHtml, wrapDocument, type DocumentControl } from './printShared';

export { formatBkkDateTime };

export const PRINTABLE_STATUSES = ['AWAITING_VOUCHER', 'AWAITING_PAYMENT', 'AWAITING_CLEARING', 'SENT_BACK', 'AWAITING_REVIEW', 'CLOSED'];

export const CENTER_OPTIONS = ['กรุงเทพ', 'ลาดกระบัง/ขอนแก่น', 'สระบุรี/ระยอง', 'MDD'] as const;
export const CENTER_OTHER = 'อื่นๆ';

/** ATMS cost-center code → checkbox on the form. Unknown codes fall back to "อื่นๆ" + the code as text. */
const COST_CENTER_TO_CENTER: Record<string, { center: string; other?: string }> = {
  'สกท': { center: 'กรุงเทพ' },
  'ศลบ': { center: 'ลาดกระบัง/ขอนแก่น' },
  'ศขก': { center: 'ลาดกระบัง/ขอนแก่น' },
  'สสบ': { center: 'สระบุรี/ระยอง' },
  'ศรย': { center: 'สระบุรี/ระยอง' },
  'ศบก': { center: CENTER_OTHER, other: 'บางปะกง' },
};

export interface Signature { name: string; date: string; esign?: { name: string; timestamp: string; ref: string } }
export interface CashAdvanceFormData {
  request_date: string;
  employee: {
    name: string; employee_id: string; position: string; department: string;
    bank_account_no: string; bank_name: string; account_name: string;
  };
  centers: string[];
  center_other_text: string;
  items: { description: string; amount: number }[];
  disbursement_round: string;
  use_date: string;
  additional_details: string;
  /** Document Ref / เลขที่ (the form_id) shown in the meta box and the Document Control footer. */
  document_no?: string;
  signatures: { requester: Signature; unit_head: Signature; manager: Signature; approver: Signature };
}

const MONTHS = ['ม.ค.', 'ก.พ.', 'มี.ค.', 'เม.ย.', 'พ.ค.', 'มิ.ย.', 'ก.ค.', 'ส.ค.', 'ก.ย.', 'ต.ค.', 'พ.ย.', 'ธ.ค.'];

function parts(value: string | null | undefined): [number, number, number] | null {
  const iso = toBkkDate(value);
  if (!iso) return null;
  const [y, m, d] = iso.split('-').map(Number);
  return [y, m, d];
}

/** '2026-08-13' → '13-ส.ค.-26' */
export function thaiShortDate(iso: string | null | undefined): string {
  const p = parts(iso);
  if (!p) return '';
  return `${String(p[2]).padStart(2, '0')}-${MONTHS[p[1] - 1]}-${String(p[0] % 100).padStart(2, '0')}`;
}

/** '2026-08-18' → '18/8/2026' */
export function dmy(iso: string | null | undefined): string {
  const p = parts(iso);
  return p ? `${p[2]}/${p[1]}/${p[0]}` : '';
}

export function validateCashAdvance(data: CashAdvanceFormData): string[] {
  const errors: string[] = [];
  if (!data.items?.length) errors.push('ต้องมีรายการอย่างน้อย 1 รายการ');
  if ((data.items?.length ?? 0) > 4) errors.push('ใบคำขอเบิกมีได้ไม่เกิน 4 รายการ');
  (data.items ?? []).forEach((it, i) => {
    if (!(Number(it.amount) > 0)) errors.push(`รายการที่ ${i + 1}: จำนวนเงินต้องมากกว่า 0`);
  });
  return errors;
}

const CLAUSES = [
  'ข้าพเจ้าได้อ่านและเข้าใจนโยบายและข้อปฏิบัติของการเบิกเงินล่วงหน้าของบริษัทแล้ว',
  'ข้าพเจ้าตกลงที่จะคืนเงินคงเหลือพร้อมทั้งใบกำกับภาษี/ใบเสร็จรับเงินและเอกสารประกอบอื่น ๆ ภายใน 7 วันหลังจากได้รับเงิน',
  'ข้าพเจ้ารับทราบว่าการที่ข้าพเจ้าไม่สามารถชี้แจงและนำส่งรายละเอียดการใช้เงินภายใน 7 วันหลังจากได้รับเงินแล้วนั้น จำนวนเงินดังกล่าวจะถูกหักจากเงินเดือนของข้าพเจ้า',
  'ตามที่ได้ลงนามไว้ข้างล่างนี้ ข้าพเจ้าตกลงและยอมรับให้บริษัทหักเงินเดือนของข้าพเจ้าโดยไม่มีข้อโต้แย้งใด ๆ',
  'กรุณาส่งเอกสารที่ได้รับอนุมัติตาม TOA ภายในวันอังคาร เพื่อรับชำระเงินคืนภายในวันพฤหัสบดี',
];

const PART_CSS = `
.head { display: grid; grid-template-columns: auto 1fr auto; gap: 14px; align-items: center; }
.head .logo { height: 44px; }
.t1 { font-size: 21px; font-weight: 700; color: var(--teal); letter-spacing: 0.1px; line-height: 1.2; }
.t2 { font-size: 12px; font-weight: 600; color: var(--muted); }
.meta { border: 1px solid var(--teal); border-radius: 3px; font-size: 10.5px; min-width: 150px; }
.meta div { display: flex; justify-content: space-between; gap: 12px; padding: 3px 8px; }
.meta div + div { border-top: 1px solid var(--line); }
.meta span { color: var(--muted); }
.meta b { font-weight: 600; }
.sec { display: flex; align-items: center; gap: 8px; margin: 12px 0 6px; }
.sec .n { width: 19px; height: 19px; border-radius: 3px; background: var(--teal); color: #fff; font-weight: 700; font-size: 11px; display: grid; place-items: center; flex: none; }
.sec h2 { font-size: 13px; font-weight: 700; white-space: nowrap; }
.sec small { font-size: 10px; color: var(--muted); font-weight: 500; white-space: nowrap; }
.sec::after { content: ""; flex: 1; border-top: 1px solid var(--line); margin-left: 4px; }
.grid { display: grid; grid-template-columns: 1fr 1fr; column-gap: 22px; row-gap: 5px; }
.f { border-bottom: 1px solid var(--line); padding-bottom: 2px; min-width: 0; }
.f .l { display: block; font-size: 9.5px; color: var(--muted); }
.f .v { display: block; font-size: 12.5px; font-weight: 500; min-height: 18px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.cbs { display: flex; align-items: center; gap: 16px; margin-top: 8px; font-size: 11.5px; flex-wrap: wrap; }
.cbs .lbl { color: var(--muted); font-size: 10.5px; }
.cbi { display: inline-flex; align-items: center; gap: 5px; }
.cb { width: 12px; height: 12px; border: 1.3px solid var(--ink); border-radius: 2px; display: inline-grid; place-items: center; font-size: 10px; line-height: 1; }
.cb.checked { background: var(--teal); border-color: var(--teal); color: #fff; }
.cb.checked::after { content: '\\2713'; }
.oth { display: inline-block; min-width: 70px; border-bottom: 1px solid var(--line); }
table.items { width: 100%; border-collapse: collapse; margin-top: 2px; }
table.items th { background: var(--mint); color: var(--teal); font-size: 10.5px; font-weight: 600; text-align: left; padding: 4px 8px; }
table.items th.a, table.items td.a { text-align: right; width: 34mm; }
table.items td { padding: 4px 8px; border-bottom: 1px solid var(--line); height: 23px; font-size: 12px; }
table.items td.no { width: 9mm; color: var(--muted); }
table.items td.a { font-weight: 600; }
.sum { display: grid; grid-template-columns: 1fr auto; gap: 16px; margin-top: 8px; align-items: stretch; }
.dates { display: grid; grid-template-columns: 1fr 1fr; column-gap: 18px; row-gap: 5px; align-content: start; }
.tot { background: var(--teal); color: #fff; border-radius: 3px; padding: 7px 12px; min-width: 68mm; }
.tot .k { font-size: 10px; opacity: 0.85; }
.tot .amt { font-size: 22px; font-weight: 700; line-height: 1.15; text-align: right; }
.tot .amt span { font-size: 11px; font-weight: 500; margin-left: 4px; }
.tot .words { font-size: 11px; font-style: italic; text-align: right; border-top: 1px solid rgba(255,255,255,.35); margin-top: 4px; padding-top: 3px; }
.more { grid-column: 1 / -1; margin-top: 2px; }
.more .l { font-size: 9.5px; color: var(--muted); }
.more .ln { border-bottom: 1px solid var(--line); min-height: 19px; font-size: 12px; }
ol.clauses { background: var(--mint); border-left: 3px solid var(--teal); padding: 7px 10px 7px 26px; font-size: 10.5px; line-height: 1.55; }
ol.clauses li { padding-left: 2px; }
ol.clauses li::marker { color: var(--teal); font-weight: 700; }
table.sig { width: 100%; border-collapse: collapse; table-layout: fixed; break-inside: avoid; }
table.sig th { background: var(--mint); color: var(--teal); font-size: 11px; font-weight: 600; padding: 5px; border: 1px solid var(--line); }
table.sig td { border: 1px solid var(--line); vertical-align: top; padding: 0 8px 6px; }
table.sig td.space { height: 23mm; text-align: center; vertical-align: middle; padding: 4px; }
table.sig .row { display: flex; gap: 6px; font-size: 10.5px; margin-top: 5px; align-items: baseline; }
table.sig .row .k { color: var(--muted); flex: none; }
table.sig .row i { font-style: normal; flex: 1; border-bottom: 1px dotted var(--muted); min-height: 16px; min-width: 0; font-size: 11px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
`;

export interface CashAdvanceOpts { logoUrl?: string; fontCss?: boolean; printed?: string; attachmentsHtml?: string }

export function cashAdvanceFooter(data: CashAdvanceFormData, printed?: string): DocumentControl {
  const ap = data.signatures?.approver;
  return {
    ref: data.document_no ?? '', name: 'Cash Advance Request (ADV)', owner: data.employee.name,
    approvedBy: ap?.name ?? '', approvedDate: ap?.date ?? '', printed: printed ?? printedNow(),
  };
}

/** Part 1 body markup only (header → signatures), without the page footer wrapper; 16b composes Part 2 the same way. */
export function cashAdvanceBody(data: CashAdvanceFormData, opts: { logoUrl?: string } = {}): string {
  const errors = validateCashAdvance(data);
  if (errors.length) throw new Error(errors.join('\n'));
  const e = data.employee;
  const total = data.items.reduce((s, it) => s + Number(it.amount), 0);
  const checked = new Set(data.centers ?? []);
  const cb = (on: boolean) => `<span class="cb${on ? ' checked' : ''}"></span>`;
  const field = (label: string, value: unknown) =>
    `<div class="f"><span class="l">${label}</span><span class="v">${esc(value)}</span></div>`;
  const sec = (n: number, th: string, en: string) => `<div class="sec"><span class="n">${n}</span><h2>${th}</h2><small>${en}</small></div>`;

  const centers = CENTER_OPTIONS.map(c => `<span class="cbi">${cb(checked.has(c))}${esc(c)}</span>`).join('')
    + `<span class="cbi">${cb(checked.has(CENTER_OTHER))}${CENTER_OTHER}<span class="oth">${esc(data.center_other_text)}</span></span>`;

  const rows = [0, 1, 2, 3].map(i => {
    const it = data.items[i];
    return `<tr><td class="no">${i + 1}.</td><td>${it ? esc(it.description) : ''}</td><td class="a">${it ? money(Number(it.amount)) : ''}</td></tr>`;
  }).join('');

  const sigs = data.signatures ?? ({} as CashAdvanceFormData['signatures']);
  const sigCols: [string, Signature | undefined][] = [
    ['ผู้ขอเบิก', sigs.requester], ['หัวหน้าหน่วยงาน', sigs.unit_head], ['ผู้จัดการ', sigs.manager], ['ผู้มีอำนาจอนุมัติ', sigs.approver],
  ];
  const validEsign = (sg?: Signature) => (sg?.esign && formatBkkDateTime(sg.esign.timestamp).date ? sg.esign : null);
  const anyEsign = sigCols.some(([, sg]) => validEsign(sg));
  const sigLines = (s: Signature | undefined) =>
    `<div class="row"><span class="k">ชื่อ</span><i>${esc(s?.name)}</i></div><div class="row"><span class="k">วันที่</span><i>${esc(validEsign(s) ? dmy(validEsign(s)!.timestamp) : s?.date)}</i></div>`;

  const logo = opts.logoUrl ? `<img class="logo" src="${esc(opts.logoUrl)}" alt="MENA Transport">` : '<span></span>';

  return `<section class="doc-part"><div class="doc-band"></div>
<header class="head">${logo}<div><div class="t1">ใบคำขอเบิกเงินล่วงหน้า</div><div class="t2">(Cash Advance Request form)</div></div>
<div class="meta"><div><span>เลขที่</span><b>${esc(data.document_no)}</b></div><div class="date"><span>วันที่</span><b>${esc(thaiShortDate(data.request_date))}</b></div></div></header>

${sec(1, 'ข้อมูลพนักงานผู้เบิกเงิน', 'Requester')}
<div class="grid">${field('ชื่อ-สกุล', e.name)}${field('รหัสพนักงาน', e.employee_id)}${field('ตำแหน่ง', e.position)}${field('แผนก', e.department)}${field('โอนเงินเข้าบัญชีธนาคารเลขที่', e.bank_account_no)}${field('ธนาคาร', e.bank_name)}${field('ชื่อบัญชี', e.account_name)}<div></div></div>
<div class="cbs"><span class="lbl">ศูนย์</span>${centers}</div>

${sec(2, 'ประเภทและวัตถุประสงค์ในการเบิกเงินล่วงหน้า', 'Purpose')}
<table class="items"><thead><tr><th colspan="2">วัตถุประสงค์ในการเบิกเงินล่วงหน้า</th><th class="a">(บาท)</th></tr></thead><tbody>${rows}</tbody></table>
<div class="sum"><div class="dates">${field('รอบการเบิกเงิน', dmy(data.disbursement_round))}${field('วันที่จะมีการใช้เงิน', dmy(data.use_date))}
<div class="more"><span class="l">รายละเอียดเพิ่มเติม</span><div class="ln">${esc(data.additional_details)}</div><div class="ln"></div></div></div>
<div class="tot"><div class="k">จำนวนเงินรวม</div><div class="amt">${money(total)}<span>บาท</span></div><div class="words">จำนวนเงิน (ตัวอักษร) : ${esc(bahtText(total))}</div></div></div>

${sec(3, 'เงื่อนไขและข้อตกลง', 'Terms')}
<ol class="clauses">${CLAUSES.map(c => `<li>${esc(c)}</li>`).join('')}</ol>

${sec(4, 'ลงนามและอนุมัติ', 'Signatures')}
<table class="sig"><thead><tr>${sigCols.map(([t]) => `<th>${t}</th>`).join('')}</tr></thead><tbody>
<tr>${sigCols.map(([, sg]) => `<td class="space">${stampHtml(validEsign(sg))}</td>`).join('')}</tr>
<tr>${sigCols.map(([, sg]) => `<td>${sigLines(sg)}</td>`).join('')}</tr></tbody></table>
${anyEsign ? '<div class="esign-note">ลงนามอิเล็กทรอนิกส์ผ่านระบบ menait-service · เวลาประเทศไทย (UTC+7)</div>' : ''}
</section>`;
}

export function buildCashAdvanceHtml(data: CashAdvanceFormData, opts: CashAdvanceOpts = {}): string {
  const body = cashAdvanceBody(data, opts) + (opts.attachmentsHtml ?? '');
  return wrapDocument({
    title: `${data.document_no ? `${data.document_no} — ` : ''}ใบคำขอเบิกเงินล่วงหน้า`,
    body, extraCss: PART_CSS, fontCss: opts.fontCss,
    footerHtml: documentControlFooter(cashAdvanceFooter(data, opts.printed)),
  });
}

/** CSS a composed document (Part 1 + Part 2) needs for Part 1's body. */
export const CASH_ADVANCE_CSS = PART_CSS;

export function toCashAdvanceData(detail: AdvanceDetail): CashAdvanceFormData {
  const r = detail.request;
  const cc = COST_CENTER_TO_CENTER[(r.cost_center ?? '').trim()];
  const rawCc = (r.cost_center ?? '').trim();
  const centers = cc ? [cc.center] : rawCc ? [CENTER_OTHER] : [];
  const otherText = cc ? (cc.other ?? '') : rawCc;
  const approved = [...(detail.approval_logs ?? [])].reverse().find(l => l.action === 'APPROVED');
  const bank = r.bank_label || (r.bank ? bankLabel(r.bank) : '');
  const account = r.account_no ? formatAccountNo(r.account_no) : '';
  const name = detail.requester.name ?? '';
  return {
    document_no: detail.form_id,
    request_date: toBkkDate(detail.created_at),
    employee: {
      name,
      employee_id: detail.requester.employee_id ?? '',
      position: detail.requester.position ?? '',
      department: detail.requester.department ?? '',
      bank_account_no: account === '-' ? '' : account,
      bank_name: bank.replace(/^ธนาคาร/, ''),
      account_name: r.account_name ?? '',
    },
    centers,
    center_other_text: otherText,
    items: [{ description: r.purpose ?? '', amount: Number(r.amount ?? 0) }],
    disbursement_round: toBkkDate(detail.fin?.transfer_date ?? detail.fin?.voucher_date),
    use_date: toBkkDate(r.use_date),
    additional_details: '',
    signatures: {
      requester: {
        name, date: dmy(detail.created_at),
        ...(detail.created_at ? { esign: { name, timestamp: detail.created_at, ref: detail.form_id } } : {}),
      },
      unit_head: { name: '', date: '' },
      manager: { name: '', date: '' },
      approver: {
        name: approved?.actor_name ?? '', date: dmy(approved?.action_at),
        ...(approved?.action_at ? { esign: {
          name: approved.actor_name ?? '', timestamp: approved.action_at,
          ref: detail.approval ? `ข้อ ${detail.approval.clause}` : detail.form_id,
        } } : {}),
      },
    },
  };
}
