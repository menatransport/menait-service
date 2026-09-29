import type { AdvanceDetail } from '@/app/finance/types';
import { bahtText } from './bahtText';
import { bankLabel, formatAccountNo } from './bank';
import { toBkkDate } from './dates';

export const PRINTABLE_STATUSES = ['AWAITING_PAYMENT', 'AWAITING_CLEARING', 'SENT_BACK', 'AWAITING_REVIEW', 'CLOSED'];

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

/** ISO datetime → Bangkok { date: 'dd/mm/yyyy', time: 'HH:mm:ss' }; blanks when invalid. */
export function formatBkkDateTime(iso: string | null | undefined): { date: string; time: string } {
  const dt = iso ? new Date(iso) : null;
  if (!dt || Number.isNaN(dt.getTime())) return { date: '', time: '' };
  const p = Object.fromEntries(new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Asia/Bangkok', hourCycle: 'h23', year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', second: '2-digit',
  }).formatToParts(dt).map(x => [x.type, x.value]));
  return { date: `${p.day}/${p.month}/${p.year}`, time: `${p.hour}:${p.minute}:${p.second}` };
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

const esc = (v: unknown) =>
  String(v ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c] as string));

const money = (n: number) => n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

const CLAUSES = [
  'ข้าพเจ้าได้อ่านและเข้าใจนโยบายและข้อปฏิบัติของการเบิกเงินล่วงหน้าของบริษัทแล้ว',
  'ข้าพเจ้าตกลงที่จะคืนเงินคงเหลือพร้อมทั้งใบกำกับภาษี/ใบเสร็จรับเงินและเอกสารประกอบอื่น ๆ ภายใน 7 วันหลังจากได้รับเงิน',
  'ข้าพเจ้ารับทราบว่าการที่ข้าพเจ้าไม่สามารถชี้แจงและนำส่งรายละเอียดการใช้เงินภายใน 7 วันหลังจากได้รับเงินแล้วนั้น จำนวนเงินดังกล่าวจะถูกหักจากเงินเดือนของข้าพเจ้า',
  'ตามที่ได้ลงนามไว้ข้างล่างนี้ ข้าพเจ้าตกลงและยอมรับให้บริษัทหักเงินเดือนของข้าพเจ้าโดยไม่มีข้อโต้แย้งใด ๆ',
  'กรุณาส่งเอกสารที่ได้รับอนุมัติตาม TOA ภายในวันอังคาร เพื่อรับชำระเงินคืนภายในวันพฤหัสบดี',
];

const CSS = `
@page { size: A4 portrait; margin: 12mm 14mm; }
* { box-sizing: border-box; }
html, body { margin: 0; padding: 0; }
body { font-family: 'Sarabun', 'TH Sarabun New', 'Noto Sans Thai', 'Thonburi', sans-serif; font-size: 11.5pt; line-height: 1.35; color: #111; }
.page { position: relative; width: 100%; }
.head { position: relative; height: 22mm; }
.head .logo { position: absolute; left: 0; top: 0; height: 18mm; max-width: 45mm; object-fit: contain; }
.head .ver { position: absolute; right: 0; top: 0; border: 1px solid #111; padding: 1px 8px; font-size: 9.5pt; }
.head .t1 { position: absolute; left: 0; right: 0; top: 2mm; text-align: center; font-size: 17pt; font-weight: 700; }
.head .t2 { position: absolute; left: 0; right: 0; top: 11mm; text-align: center; font-size: 12.5pt; font-weight: 700; }
hr { border: 0; border-top: 1.2px solid #111; margin: 1mm 0 2mm; }
.date { text-align: right; margin-bottom: 2mm; }
.date .v, .v { display: inline-block; border-bottom: 1px solid #111; min-width: 28mm; padding: 0 4px; text-align: center; }
.sec { background: #e5e7eb; font-weight: 700; padding: 1px 6px; margin: 3mm 0 1.5mm; }
.row { display: flex; gap: 6mm; margin: 1mm 0; align-items: flex-end; }
.f { display: flex; align-items: flex-end; flex: 1 1 0; min-width: 0; }
.f .l { white-space: nowrap; padding-right: 4px; }
.f .u { flex: 1; border-bottom: 1px solid #111; min-height: 1.35em; padding: 0 4px; overflow: hidden; }
.cbs { display: flex; gap: 5mm; align-items: flex-end; margin-top: 1.5mm; flex-wrap: nowrap; white-space: nowrap; }
.cbi { display: inline-flex; align-items: center; gap: 4px; }
.cb { display: inline-block; width: 3.6mm; height: 3.6mm; border: 1px solid #111; line-height: 3.2mm; text-align: center; font-size: 9pt; font-weight: 700; }
.cb.checked::after { content: '\\2713'; }
.cbi .oth { display: inline-block; border-bottom: 1px solid #111; min-width: 24mm; padding: 0 3px; min-height: 1.3em; }
table.items { width: 100%; border-collapse: collapse; margin-top: 1mm; }
table.items td { padding: 0; height: 7mm; vertical-align: bottom; }
table.items td.n { width: 7mm; }
table.items td.d { border-bottom: 1px solid #111; padding: 0 4px; }
table.items td.a { width: 32mm; border: 1px solid #111; text-align: right; padding: 0 6px; vertical-align: middle; }
table.items th.a { width: 32mm; border: 1px solid #111; font-weight: 400; text-align: center; }
.tot { display: flex; align-items: center; justify-content: flex-end; gap: 6px; margin-top: 0; }
.tot .box { width: 32mm; border: 1px solid #111; text-align: right; padding: 0 6px; font-weight: 700; }
.words { font-style: italic; }
.clauses { margin: 0; padding-left: 6mm; }
.clauses li { margin: 0.5mm 0; }
table.sig { width: 100%; border-collapse: collapse; table-layout: fixed; }
table.sig th, table.sig td { border: 1px solid #111; padding: 2px 6px; }
table.sig th { text-align: center; font-weight: 700; }
table.sig td.space { height: 24mm; }
table.sig td.ln { border-top: 0; border-bottom: 0; overflow: hidden; }
table.sig td.ln .u2 { display: flex; } table.sig td.ln .u2 b { font-weight: 400; padding-right: 4px; } table.sig td.ln .u2 i { font-style: normal; flex: 1; border-bottom: 1px solid #111; min-height: 1.35em; padding: 0 3px; }
table.sig td.ln.last { border-bottom: 1px solid #111; }
.esign { display: inline-block; max-width: 90%; border: 2px solid #0f766e; border-radius: 6px; color: #0f766e; font-size: 11px; line-height: 1.2; text-align: center; padding: 2px 6px; transform: rotate(-3deg); }
.esign-title { font-weight: 700; }
.esign-ref { font-size: 9.5px; }
table.sig td.space { text-align: center; vertical-align: middle; }
.esign-note { font-size: 9pt; color: #0f766e; margin-top: 1mm; }
.pg { position: fixed; right: 0; bottom: 0; font-size: 10pt; }
`;

export function buildCashAdvanceHtml(data: CashAdvanceFormData, opts: { logoUrl?: string; fontCss?: boolean } = {}): string {
  const errors = validateCashAdvance(data);
  if (errors.length) throw new Error(errors.join('\n'));
  const e = data.employee;
  const total = data.items.reduce((s, it) => s + Number(it.amount), 0);
  const checked = new Set(data.centers ?? []);
  const cb = (on: boolean) => `<span class="cb${on ? ' checked' : ''}"></span>`;
  const field = (label: string, value: unknown) =>
    `<div class="f"><span class="l">${label}</span><span class="u">${esc(value)}</span></div>`;

  const centers = CENTER_OPTIONS.map(c => `<span class="cbi">${cb(checked.has(c))}${esc(c)}</span>`).join('')
    + `<span class="cbi">${cb(checked.has(CENTER_OTHER))}${CENTER_OTHER}<span class="oth">${esc(data.center_other_text)}</span></span>`;

  const rows = [0, 1, 2, 3].map(i => {
    const it = data.items[i];
    return `<tr><td class="n">${i + 1}.</td><td class="d">${it ? esc(it.description) : ''}</td><td class="a">${it ? money(Number(it.amount)) : ''}</td></tr>`;
  }).join('');

  const sigs = data.signatures ?? ({} as CashAdvanceFormData['signatures']);
  const sigCols: [string, Signature | undefined][] = [
    ['ผู้ขอเบิก', sigs.requester], ['หัวหน้าหน่วยงาน', sigs.unit_head], ['ผู้จัดการ', sigs.manager], ['ผู้มีอำนาจอนุมัติ', sigs.approver],
  ];
  const stamp = (sg?: Signature) => {
    if (!sg?.esign) return '';
    const t = formatBkkDateTime(sg.esign.timestamp);
    return `<div class="esign"><div class="esign-title">✔ e-Signature</div><div>${esc(sg.esign.name)}</div><div>${esc(t.date)}</div><div>${esc(t.time)} น.</div><div class="esign-ref">${esc(sg.esign.ref)}</div></div>`;
  };
  const anyEsign = sigCols.some(([, sg]) => sg?.esign);
  const sigRow = (fn: (s: Signature | undefined) => string, cls = 'ln') => `<tr>${sigCols.map(([, s]) => `<td class="${cls}">${fn(s)}</td>`).join('')}</tr>`;

  const font = opts.fontCss === false ? '' :
    '<link rel="preconnect" href="https://fonts.googleapis.com"><link rel="preconnect" href="https://fonts.gstatic.com" crossorigin><link href="https://fonts.googleapis.com/css2?family=Sarabun:wght@400;600;700&display=swap" rel="stylesheet">';
  const logo = opts.logoUrl ? `<img class="logo" src="${esc(opts.logoUrl)}" alt="">` : '';

  return `<!doctype html><html lang="th"><head><meta charset="utf-8"><title>ใบคำขอเบิกเงินล่วงหน้า</title>${font}<style>${CSS}</style></head><body><div class="page">
<div class="head">${logo}<div class="ver">เริ่มใช้ 1 Nov 22</div><div class="t1">ใบคำขอเบิกเงินล่วงหน้า</div><div class="t2">(Cash Advance Request form)</div></div>
<hr>
<div class="date">วันที่ <span class="v">${esc(thaiShortDate(data.request_date))}</span></div>

<div class="sec">ส่วนที่ 1: ข้อมูลพนักงานผู้เบิกเงิน</div>
<div class="row">${field('ชื่อ-สกุล', e.name)}${field('รหัสพนักงาน', e.employee_id)}</div>
<div class="row">${field('ตำแหน่ง', e.position)}${field('แผนก', e.department)}</div>
<div class="row">${field('โอนเงินเข้าบัญชีธนาคารเลขที่', e.bank_account_no)}${field('ธนาคาร', e.bank_name)}</div>
<div class="row">${field('ชื่อบัญชี', e.account_name)}</div>
<div class="cbs"><span>ศูนย์ :</span>${centers}</div>

<div class="sec">ส่วนที่ 2: ประเภทและวัตถุประสงค์ในการเบิกเงินล่วงหน้า</div>
<table class="items"><tr><th style="text-align:left;font-weight:400" colspan="2">วัตถุประสงค์ในการเบิกเงินล่วงหน้า :</th><th class="a">(บาท)</th></tr>${rows}</table>
<div class="tot"><span>จำนวนเงินรวม</span><span class="box">${money(total)}</span></div>
<div class="row"><div class="f"><span class="l">จำนวนเงิน (ตัวอักษร)</span><span class="u words">${esc(bahtText(total))}</span></div></div>
<div class="row">${field('รอบการเบิกเงิน', dmy(data.disbursement_round))}${field('วันที่จะมีการใช้เงิน', dmy(data.use_date))}</div>
<div class="row"><div class="f"><span class="l">รายละเอียดเพิ่มเติม</span><span class="u">${esc(data.additional_details)}</span></div></div>
<div class="row"><div class="f"><span class="u">&nbsp;</span></div></div>

<div class="sec">ส่วนที่ 3: เงื่อนไขและข้อตกลง</div>
<ol class="clauses">${CLAUSES.map(c => `<li>${esc(c)}</li>`).join('')}</ol>

<div class="sec">ส่วนที่ 4: ลงนามและอนุมัติ</div>
<table class="sig"><tr>${sigCols.map(([t]) => `<th>${t}</th>`).join('')}</tr>
<tr>${sigCols.map(([, sg]) => `<td class="space">${stamp(sg)}</td>`).join('')}</tr>
${sigRow(s => `<div class="u2"><b>ชื่อ</b><i>${esc(s?.name)}</i></div>`)}
${sigRow(s => `<div class="u2"><b>วันที่</b><i>${esc(s?.date)}</i></div>`, 'ln last')}
</table>
${anyEsign ? '<div class="esign-note">ลงนามอิเล็กทรอนิกส์ผ่านระบบ menait-service · เวลาประเทศไทย (UTC+7)</div>' : ''}
</div><div class="pg">Page 1</div></body></html>`;
}

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

export function printCashAdvance(data: CashAdvanceFormData): void {
  const html = buildCashAdvanceHtml(data, { logoUrl: `${window.location.origin}/mena.png` });
  const w = window.open('', '', 'width=900,height=1000');
  if (!w) {
    import('@/app/finance/api').then(({ showAlert }) => showAlert({ icon: 'error', title: 'เบราว์เซอร์บล็อกหน้าต่างพิมพ์' }));
    return;
  }
  w.document.open();
  w.document.write(html);
  w.document.close();
  w.onafterprint = () => w.close();
  w.document.fonts.ready.then(() => { w.focus(); w.print(); });
}
