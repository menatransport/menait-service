import type { PettyClaim, PettyFund } from '@/app/finance/types-petty';
import { bahtText } from '@/lib/finance/bahtText';
import { groupForPrint, paginateGroups } from '@/lib/finance/petty-print';
import {
  documentControlFooter, esc, money, printedNow, stampHtml, VERSION_NO, wrapSegments,
} from '@/lib/finance/printShared';

export type VoucherOpts = {
  claim: PettyClaim;
  fund: PettyFund;
  typeName: string;
  payeePosition?: string | null;
  companyName?: string;
  /** หน่วยนับบนใบ มาจาก spec.atms.unit ของประเภทนั้น — ชั่งน้ำหนัก=คัน ยาง=เส้น เดินทาง=เที่ยว */
  unit?: string;
};

const COMPANY = 'บริษัท มีนาทรานสปอร์ต จำกัด';
const DIVISIONS = ['B01', 'B02', 'B03', 'B04', 'A01', 'A02', 'A03', 'A04', 'A05', 'PJS'];
const BRANCHES: Record<string, string> = {
  '01': 'สกท', '02': 'สสบ', '03': 'สลบ', '04': 'ศรย', '05': 'สขก',
};

const CSS = `
@page { size: A4 portrait; margin: 10mm 12mm; }
.title { text-align:center; font-weight:700; font-size:15pt; margin:0 0 2mm; }
.sub { text-align:center; font-size:10pt; margin:0 0 4mm; }
.row { display:flex; gap:6mm; font-size:10pt; margin-bottom:2mm; }
.row > div { flex:1; }
.box { border:1px solid #000; padding:2mm 3mm; }
table.items { width:100%; border-collapse:collapse; font-size:10pt; margin-top:3mm; }
table.items th, table.items td { border:1px solid #000; padding:1.5mm 2mm; vertical-align:top; }
table.items th { background:#f2f2f2; text-align:center; }
.num { text-align:right; white-space:nowrap; }
.tick { font-family:monospace; }
.signs { display:flex; gap:4mm; margin-top:8mm; font-size:10pt; }
.sign { flex:1; border-top:1px dotted #000; padding-top:2mm; text-align:center; min-height:22mm; }
.note { font-size:9pt; margin-top:2mm; }
.pagemark { text-align:right; font-size:9pt; margin-top:2mm; }
`;

function footer(claim: PettyClaim, docName: string): string {
  return documentControlFooter({
    ref: claim.form_id,
    name: docName,
    owner: 'ฝ่ายบัญชีและการเงิน',
    approvedBy: claim.approved_by ?? '-',
    approvedDate: claim.approved_at ? bangkokDate(claim.approved_at) : '-',
    printed: printedNow(),
  });
}

function thaiDate(iso: string | null | undefined): string {
  if (!iso) return '';
  const [y, m, d] = iso.split('-');
  return y && m && d ? `${d}/${m}/${y}` : '';
}

/** วันที่ (ไม่ใช่เวลา) ของ timestamp ตามเวลาไทย — approved_at เป็น UTC ถ้าตัด 10 ตัวแรกจะได้วันก่อนหน้าหลังสี่ทุ่ม */
function bangkokDate(timestamp: string | null | undefined): string {
  if (!timestamp) return '';
  const date = new Date(timestamp);
  if (Number.isNaN(date.getTime())) return timestamp.slice(0, 10);
  const parts = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Bangkok', year: 'numeric', month: '2-digit', day: '2-digit' })
    .formatToParts(date);
  const get = (type: string) => parts.find(p => p.type === type)?.value ?? '';
  return `${get('year')}-${get('month')}-${get('day')}`;
}

function divisionTicks(code: string): string {
  return DIVISIONS.map(d => `<span class="tick">${d === code ? '[x]' : '[ ]'} ${esc(d)}</span>`).join(' &nbsp; ');
}

function itemRows(groups: ReturnType<typeof groupForPrint>): string {
  const rows = groups.map(g => `<tr>
    <td>${esc(g.label)}</td>
    <td class="num">${g.count} ${esc(g.unit)}</td>
    <td class="num">${money(g.rate)}</td>
    <td class="num">${money(g.total)}</td>
    <td>${esc(g.truckCodes.join(', '))}</td>
  </tr>`);
  // ตารางบนกระดาษมี 6 บรรทัดเสมอ เติมแถวว่างให้ครบเพื่อให้ช่องเซ็นอยู่ที่เดิม
  for (let i = groups.length; i < 6; i += 1) {
    rows.push('<tr><td>&nbsp;</td><td></td><td></td><td></td><td></td></tr>');
  }
  return rows.join('');
}

/** ใบสำคัญจ่ายเงินสดย่อย — ช่องตามฟอร์มกระดาษเดิม ยกเว้นเล่มที่/เลขที่โรงพิมพ์ที่เลิกใช้ */
export function pettyVoucherHtml(opts: VoucherOpts): string {
  const { claim, fund, typeName } = opts;
  const groups = groupForPrint(claim.items, typeName, { unit: opts.unit });
  const pages = paginateGroups(groups);
  const total = groups.reduce((s, g) => s + g.total, 0);
  const company = opts.companyName ?? COMPANY;

  const segments = (pages.length ? pages : [[]]).map((pageGroups, index) => {
    const isLast = index === (pages.length || 1) - 1;
    const pageTotal = pageGroups.reduce((s, g) => s + g.total, 0);
    return {
      body: `
<p class="title">${esc(company)}</p>
<p class="sub">ใบสำคัญจ่ายเงินสดย่อย</p>
<div class="row">
  <div class="box">เลขที่ <strong>${esc(claim.form_id)}</strong></div>
  <div class="box">วันที่ ${esc(thaiDate(claim.approved_at ? bangkokDate(claim.approved_at) : claim.expense_date))}</div>
  <div class="box">Project Code</div>
</div>
<div class="row"><div class="box">จ่ายให้ <strong>${esc(claim.payee_name ?? '')}</strong></div></div>
<div class="row"><div class="box">Division ${divisionTicks(fund.division_code)}</div></div>
<div class="row">
  <div class="box">สาขา ${esc(fund.branch_code)} ${esc(BRANCHES[fund.branch_code] ?? '')}</div>
  <div class="box">เลขที่ใบรับสินค้า (DD) ${esc(claim.dd_no ?? '')}</div>
</div>
<table class="items">
  <thead><tr>
    <th style="width:42%">รายการ</th><th style="width:10%">จำนวน</th>
    <th style="width:12%">ราคา/หน่วย</th><th style="width:14%">จำนวนเงิน</th><th>หมายเหตุ</th>
  </tr></thead>
  <tbody>${itemRows(pageGroups)}</tbody>
  <tfoot><tr>
    <td colspan="3" class="num"><strong>${isLast ? 'รวมทั้งสิ้น' : 'รวมแผ่นนี้'}</strong></td>
    <td class="num"><strong>${money(isLast ? total : pageTotal)}</strong></td>
    <td>${isLast ? esc(bahtText(total)) : ''}</td>
  </tr></tfoot>
</table>
${isLast ? `<div class="signs">
  <div class="sign">ผู้จ่ายเงิน<br/><span class="note">(ลงชื่อ)</span></div>
  <div class="sign">ผู้รับเงิน<br/><span class="note">(ลงชื่อ)</span></div>
  <div class="sign">หัวหน้าแผนก${stampHtml(claim.approved_by && claim.approved_at
      ? { name: claim.approved_by, timestamp: claim.approved_at, ref: claim.form_id } : null)}</div>
  <div class="sign">ผู้อนุมัติ${stampHtml(claim.approved_by && claim.approved_at
      ? { name: claim.approved_by, timestamp: claim.approved_at, ref: claim.form_id } : null)}</div>
</div>` : ''}
${pages.length > 1 ? `<p class="pagemark">แผ่นที่ ${index + 1}/${pages.length}</p>` : ''}`,
    };
  });

  return wrapSegments({
    title: `ใบสำคัญจ่ายเงินสดย่อย ${claim.form_id}`,
    segments,
    footerHtml: footer(claim, `ใบสำคัญจ่ายเงินสดย่อย (v${VERSION_NO})`),
    extraCss: CSS,
    fontCss: true,
  });
}

/** ใบรับรองแทนใบเสร็จรับเงิน — ใช้กับประเภทที่ไม่มีใบเสร็จ เช่น ค่าชั่งน้ำหนัก */
export function receiptSubstituteHtml(opts: VoucherOpts): string {
  const { claim, fund, typeName } = opts;
  const groups = groupForPrint(claim.items, typeName, { unit: opts.unit });
  const total = groups.reduce((s, g) => s + g.total, 0);
  const company = opts.companyName ?? COMPANY;
  const from = thaiDate(claim.period_from ?? claim.expense_date);
  const to = thaiDate(claim.period_to ?? claim.expense_date);

  const body = `
<p class="title">${esc(company)} (สาขา ${esc(fund.branch_code.padStart(5, '0'))})</p>
<p class="sub">ใบรับรองแทนใบเสร็จรับเงิน</p>
<table class="items">
  <thead><tr>
    <th style="width:14%">วันที่</th><th style="width:46%">รายละเอียดรายจ่าย</th>
    <th style="width:10%">จำนวน</th><th style="width:16%">จำนวนเงิน</th><th>หมายเหตุ</th>
  </tr></thead>
  <tbody>${groups.map(g => `<tr>
    <td>${esc(to)}</td>
    <td>${esc(g.label)}</td>
    <td class="num">${g.count} ${esc(g.unit)}</td>
    <td class="num">${money(g.total)}</td>
    <td>${esc(g.truckCodes.join(', '))}</td>
  </tr>`).join('')}</tbody>
  <tfoot><tr>
    <td colspan="3" class="num"><strong>รวมทั้งสิ้น</strong></td>
    <td class="num"><strong>${money(total)}</strong></td>
    <td>${esc(bahtText(total))}</td>
  </tr></tfoot>
</table>
<p class="note" style="margin-top:4mm">
  ข้าพเจ้า <strong>${esc(claim.payee_name ?? '')}</strong>
  ตำแหน่ง ${esc(opts.payeePosition ?? '')}
  ขอรับรองว่าได้จ่ายเงินตามรายการข้างต้นไปจริง ตั้งแต่วันที่ ${esc(from)} ถึงวันที่ ${esc(to)}
  และไม่สามารถเรียกใบเสร็จรับเงินจากผู้รับเงินได้
</p>
<div class="signs">
  <div class="sign">ผู้เบิกจ่าย<br/><span class="note">(ลงชื่อ)</span></div>
  <div class="sign">ผู้อนุมัติ${stampHtml(claim.approved_by && claim.approved_at
    ? { name: claim.approved_by, timestamp: claim.approved_at, ref: claim.form_id } : null)}</div>
</div>`;

  return wrapSegments({
    title: `ใบรับรองแทนใบเสร็จรับเงิน ${claim.form_id}`,
    segments: [{ body }],
    footerHtml: footer(claim, `ใบรับรองแทนใบเสร็จรับเงิน (v${VERSION_NO})`),
    extraCss: CSS,
    fontCss: true,
  });
}
