import type { PettyClaim, PettyExpenseType } from '@/app/finance/types-petty';
import { bahtText } from '@/lib/finance/bahtText';
import { round2 } from '@/lib/finance/status';
import { documentControlFooter, esc, money, printedNow, VERSION_NO, wrapSegments } from '@/lib/finance/printShared';

export type ClerkGroup = { clerk: string; claims: PettyClaim[]; total: number };

/** ใบปะหน้าแยกตามชื่อเจ้าหน้าที่ผู้เปิดใบ (ไม่ใช่เจ้าของค่าใช้จ่าย) ตามที่ตกลงไว้ */
export function groupByClerk(claims: readonly PettyClaim[]): ClerkGroup[] {
  const buckets = new Map<string, ClerkGroup>();
  for (const claim of claims) {
    let group = buckets.get(claim.created_by);
    if (!group) {
      group = { clerk: claim.created_by, claims: [], total: 0 };
      buckets.set(claim.created_by, group);
    }
    group.claims.push(claim);
    group.total = round2(group.total + claim.amount);
  }
  return [...buckets.values()].sort((a, b) => b.total - a.total);
}

export type CoverRow = {
  no: number; formId: string; typeName: string; payee: string; ddNo: string;
  period: string; amount: number;
};

function thaiDate(iso: string | null | undefined): string {
  if (!iso) return '';
  const [y, m, d] = iso.split('-');
  return y && m && d ? `${d}/${m}/${y}` : '';
}

export function coverRows(group: ClerkGroup, types: readonly PettyExpenseType[]): CoverRow[] {
  return group.claims.map((claim, index) => ({
    no: index + 1,
    formId: claim.form_id,
    typeName: types.find(t => t.code === claim.expense_type)?.name_th ?? claim.expense_type,
    payee: claim.payee_name ?? '-',
    ddNo: claim.dd_no ?? '-',
    period: claim.period_from && claim.period_to && claim.period_from !== claim.period_to
      ? `${thaiDate(claim.period_from)} – ${thaiDate(claim.period_to)}`
      : thaiDate(claim.period_from ?? claim.expense_date),
    amount: claim.amount,
  }));
}

const CSS = `
@page { size: A4 portrait; margin: 12mm; }
.title { text-align:center; font-weight:700; font-size:15pt; margin:0 0 1mm; }
.sub { text-align:center; font-size:10pt; margin:0 0 5mm; }
.meta { display:flex; gap:6mm; font-size:10pt; margin-bottom:3mm; }
.meta > div { flex:1; border:1px solid #000; padding:2mm 3mm; }
table.cover { width:100%; border-collapse:collapse; font-size:10pt; }
table.cover th, table.cover td { border:1px solid #000; padding:1.5mm 2mm; }
table.cover th { background:#f2f2f2; }
.num { text-align:right; white-space:nowrap; }
.signs { display:flex; gap:6mm; margin-top:10mm; font-size:10pt; }
.sign { flex:1; border-top:1px dotted #000; padding-top:2mm; text-align:center; min-height:20mm; }
`;

export function coverSheetHtml(opts: {
  group: ClerkGroup;
  types: readonly PettyExpenseType[];
  clerkName: string;
  branchCode: string;
  divisionCode: string;
  batchNo?: string | null;
}): string {
  const rows = coverRows(opts.group, opts.types);
  const body = `
<p class="title">ใบปะหน้าเอกสารเบิกเงินสดย่อย</p>
<p class="sub">ส่งฝ่ายบัญชีและการเงิน</p>
<div class="meta">
  <div>เจ้าหน้าที่ผู้เปิดใบ <strong>${esc(opts.clerkName)}</strong></div>
  <div>สาขา ${esc(opts.branchCode)} · แผนก ${esc(opts.divisionCode)}</div>
  <div>รอบ ${esc(opts.batchNo ?? '-')}</div>
</div>
<table class="cover">
  <thead><tr>
    <th style="width:8%">ลำดับ</th><th style="width:22%">เลขที่ใบเบิก</th>
    <th style="width:18%">ประเภท</th><th style="width:16%">จ่ายให้</th>
    <th style="width:16%">ช่วงวันที่</th><th style="width:12%">เลขที่ DD</th>
    <th class="num">จำนวนเงิน</th>
  </tr></thead>
  <tbody>${rows.map(r => `<tr>
    <td class="num">${r.no}</td>
    <td>${esc(r.formId)}</td>
    <td>${esc(r.typeName)}</td>
    <td>${esc(r.payee)}</td>
    <td>${esc(r.period)}</td>
    <td>${esc(r.ddNo)}</td>
    <td class="num">${money(r.amount)}</td>
  </tr>`).join('')}</tbody>
  <tfoot><tr>
    <td colspan="6" class="num"><strong>รวม ${rows.length} ใบ</strong></td>
    <td class="num"><strong>${money(opts.group.total)}</strong></td>
  </tr>
  <tr><td colspan="7">ตัวอักษร ${esc(bahtText(opts.group.total))}</td></tr></tfoot>
</table>
<div class="signs">
  <div class="sign">ผู้ส่งเอกสาร<br/><span style="font-size:9pt">(${esc(opts.clerkName)})</span></div>
  <div class="sign">ผู้รับเอกสาร (บัญชี)<br/><span style="font-size:9pt">วันที่ ............</span></div>
</div>`;

  return wrapSegments({
    title: `ใบปะหน้าเงินสดย่อย ${opts.clerkName}`,
    segments: [{ body }],
    footerHtml: documentControlFooter({
      ref: opts.batchNo ?? opts.group.claims[0]?.form_id ?? '-',
      name: `ใบปะหน้าเอกสารเบิกเงินสดย่อย (v${VERSION_NO})`,
      owner: 'ฝ่ายบัญชีและการเงิน',
      approvedBy: '-', approvedDate: '-', printed: printedNow(),
    }),
    extraCss: CSS,
    fontCss: true,
  });
}
