import type { PettyClaim, PettyFund, PettySpec, PettySpecField } from '@/app/finance/types-petty';
import { bahtText } from '@/lib/finance/bahtText';
import { groupForPrint } from '@/lib/finance/petty-print';
import {
  bangkokDate, checkboxes, docHead, field, PETTY_DOC_CSS, sec, signatureTable, thaiDate, totalBox,
} from '@/lib/finance/petty-doc';
import { documentControlFooter, esc, money, printedNow, wrapDocument, type ESign } from '@/lib/finance/printShared';

export type VoucherOpts = {
  claim: PettyClaim;
  fund: PettyFund;
  typeName: string;
  payeePosition?: string | null;
  /** หน่วยนับบนใบ (คัน/เส้น/เที่ยว) จาก spec.print.unit — ไม่ใช่หน่วย SKU */
  unit?: string;
  /** โลโก้บริษัท (origin + /mena.png) แบบเดียวกับใบ Advance */
  logoUrl?: string | null;
  /** หน้าแนบไฟล์ต่อท้าย (printShared.attachmentPagesHtml) */
  attachmentsHtml?: string;
};

const DIVISIONS = ['B01', 'B02', 'B03', 'B04', 'A01', 'A02', 'A03', 'A04', 'A05', 'PJS'];
const BRANCHES: Record<string, string> = {
  '01': 'สกท', '02': 'สสบ', '03': 'สลบ', '04': 'ศรย', '05': 'สขก',
};

function approverEsign(claim: PettyClaim): ESign | null {
  return claim.approved_by && claim.approved_at
    ? { name: claim.approved_by, timestamp: claim.approved_at, ref: claim.form_id } : null;
}

function footer(claim: PettyClaim, docName: string): string {
  return documentControlFooter({
    ref: claim.form_id,
    name: docName,
    owner: claim.payee_name ?? 'ฝ่ายบัญชีและการเงิน',
    approvedBy: claim.approved_by ?? '',
    approvedDate: claim.approved_at ? bangkokDate(claim.approved_at) : '',
    printed: printedNow(),
  });
}

function periodText(claim: PettyClaim): string {
  const from = thaiDate(claim.period_from ?? claim.expense_date);
  const to = thaiDate(claim.period_to ?? claim.expense_date);
  return from === to ? from : `${from} – ${to}`;
}

function voucherDate(claim: PettyClaim): string {
  return thaiDate(claim.approved_at ? bangkokDate(claim.approved_at) : claim.expense_date);
}

/** ใบสำคัญจ่ายเงินสดย่อย — ช่องตามฟอร์มกระดาษ โครงและสไตล์เดียวกับใบ Advance */
export function pettyVoucherHtml(opts: VoucherOpts): string {
  const { claim, fund, typeName } = opts;
  const groups = groupForPrint(claim.items, typeName, { unit: opts.unit });
  const total = groups.reduce((s, g) => s + g.total, 0);

  const rows = groups.map(g => `<tr><td>${esc(g.label)}</td><td class="c">${g.count} ${esc(g.unit)}</td>` +
    `<td class="a">${money(g.rate)}</td><td class="a">${money(g.total)}</td><td>${esc(g.truckCodes.join(', '))}</td></tr>`);
  // ฟอร์มกระดาษมี 6 บรรทัดเสมอ — เติมแถวว่างให้ช่องเซ็นอยู่ที่เดิม
  for (let i = groups.length; i < 6; i += 1) rows.push('<tr><td>&nbsp;</td><td></td><td class="a"></td><td class="a"></td><td></td></tr>');

  const body = `<section class="doc-part">
${docHead({ title: 'ใบสำคัญจ่ายเงินสดย่อย', english: '(Petty Cash Voucher)', logoUrl: opts.logoUrl,
    meta: [['เลขที่', claim.form_id], ['วันที่', voucherDate(claim)]] })}

${sec(1, 'ข้อมูลการจ่าย', 'Payment')}
<div class="grid">${field('จ่ายให้', claim.payee_name)}${field('ประเภทการเบิก', typeName)}
${field('สาขา', `${fund.branch_code} ${BRANCHES[fund.branch_code] ?? ''}`.trim())}${field('เลขที่ใบรับสินค้า (DD)', claim.dd_no)}
${field('ช่วงวันที่ค่าใช้จ่าย', periodText(claim))}${field('Project Code', '')}</div>
${checkboxes('Division', DIVISIONS, fund.division_code)}

${sec(2, 'รายการ', 'Items')}
<table class="items"><thead><tr><th style="width:40%">รายการ</th><th class="c" style="width:12%">จำนวน</th>
<th class="a" style="width:16%">ราคา/หน่วย</th><th class="a" style="width:18%">จำนวนเงิน</th><th>หมายเหตุ</th></tr></thead>
<tbody>${rows.join('')}</tbody></table>
<div class="sum"><div class="dates">${field('ผู้เปิดใบ', claim.created_by)}${field('วันที่โอน', thaiDate(claim.transfer_date))}</div>
${totalBox('รวมทั้งสิ้น', money(total), bahtText(total))}</div>

${sec(3, 'ลงนามและอนุมัติ', 'Signatures')}
${signatureTable([
    { title: 'ผู้จ่ายเงิน', name: fund.holder_employee_id },
    { title: 'ผู้รับเงิน', name: claim.payee_name },
    { title: 'หัวหน้าแผนก', name: claim.approved_by, esign: approverEsign(claim) },
    { title: 'ผู้อนุมัติ', name: claim.approved_by, esign: approverEsign(claim) },
  ])}
</section>${opts.attachmentsHtml ?? ''}`;

  return wrapDocument({
    title: `${claim.form_id} — ใบสำคัญจ่ายเงินสดย่อย`,
    body, extraCss: PETTY_DOC_CSS, fontCss: true,
    footerHtml: footer(claim, 'Petty Cash Voucher (PC)'),
  });
}

/** ใบรับรองแทนใบเสร็จรับเงิน — ใช้กับประเภทที่ไม่มีใบเสร็จ เช่น ค่าชั่งน้ำหนัก */
export function receiptSubstituteHtml(opts: VoucherOpts): string {
  const { claim, fund, typeName } = opts;
  const groups = groupForPrint(claim.items, typeName, { unit: opts.unit });
  const total = groups.reduce((s, g) => s + g.total, 0);
  const from = thaiDate(claim.period_from ?? claim.expense_date);
  const to = thaiDate(claim.period_to ?? claim.expense_date);

  const rows = groups.map(g => `<tr><td class="c">${esc(to)}</td><td>${esc(g.label)}</td><td class="c">${g.count} ${esc(g.unit)}</td>` +
    `<td class="a">${money(g.total)}</td><td>${esc(g.truckCodes.join(', '))}</td></tr>`).join('');

  const body = `<section class="doc-part">
${docHead({ title: 'ใบรับรองแทนใบเสร็จรับเงิน', english: '(Receipt Substitute)', logoUrl: opts.logoUrl,
    meta: [['เลขที่', claim.form_id], ['วันที่', voucherDate(claim)]] })}

${sec(1, 'ผู้รับรอง', 'Certifier')}
<div class="grid">${field('ชื่อ', claim.payee_name)}${field('ตำแหน่ง', opts.payeePosition)}
${field('บริษัท', 'บริษัท มีนาทรานสปอร์ต จำกัด')}${field('สาขา', fund.branch_code.padStart(5, '0'))}</div>

${sec(2, 'รายละเอียดรายจ่าย', 'Expenses')}
<table class="items"><thead><tr><th class="c" style="width:16%">วันที่</th><th>รายละเอียดรายจ่าย</th>
<th class="c" style="width:12%">จำนวน</th><th class="a" style="width:18%">จำนวนเงิน</th><th style="width:22%">หมายเหตุ</th></tr></thead>
<tbody>${rows}</tbody></table>
<div class="sum"><div class="dates">${field('ตั้งแต่วันที่', from)}${field('ถึงวันที่', to)}</div>
${totalBox('รวมทั้งสิ้น', money(total), bahtText(total))}</div>

${sec(3, 'คำรับรอง', 'Declaration')}
<ol class="clauses"><li>ข้าพเจ้า ${esc(claim.payee_name ?? '')} ขอรับรองว่าได้จ่ายเงินตามรายการข้างต้นไปจริง ตั้งแต่วันที่ ${esc(from)} ถึงวันที่ ${esc(to)}</li>
<li>รายการข้างต้นไม่สามารถเรียกใบเสร็จรับเงินจากผู้รับเงินได้ จึงออกใบรับรองนี้แทน</li></ol>

${sec(4, 'ลงนามและอนุมัติ', 'Signatures')}
${signatureTable([
    { title: 'ผู้เบิกจ่าย', name: claim.payee_name },
    { title: 'ผู้อนุมัติ', name: claim.approved_by, esign: approverEsign(claim) },
  ])}
</section>${opts.attachmentsHtml ?? ''}`;

  return wrapDocument({
    title: `${claim.form_id} — ใบรับรองแทนใบเสร็จรับเงิน`,
    body, extraCss: PETTY_DOC_CSS, fontCss: true,
    footerHtml: footer(claim, 'Receipt Substitute (PC)'),
  });
}

// ---------------------------------------------------------------- ใบสรุปรายการประกอบ

type Column = { head: string; cell: (item: PettyClaim['items'][number]) => string; cls?: string };

/** คอลัมน์จาก item_fields ของ spec — `truck` แตกเป็นเบอร์รถ+ทะเบียน · `rate` กลายเป็นจำนวนเงินท้ายตาราง */
function columnsFromSpec(fields: PettySpecField[], unit: string): Column[] {
  const cols: Column[] = [];
  for (const f of fields) {
    // ยางนับเป็นเส้น: จำนวนและราคาต่อหน่วยอยู่บนใบด้วย · ค่าชั่งมีแค่ราคา/ครั้ง
    if (f.key === 'qty') { cols.push({ head: f.label, cell: i => `${Number(i.qty ?? 1)} ${esc(unit)}`, cls: 'c' }); continue; }
    if (f.key === 'rate') { cols.push({ head: f.label, cell: i => money(Number(i.rate)), cls: 'a' }); continue; }
    if (f.key === 'truck') {
      cols.push({ head: 'เบอร์รถ', cell: i => esc(i.truck_code ?? '-') });
      cols.push({ head: 'ทะเบียน', cell: i => esc(i.truck_plate ?? '-') });
      continue;
    }
    if (f.key === 'event_date') { cols.push({ head: f.label, cell: i => esc(thaiDate(i.event_date)), cls: 'c' }); continue; }
    if (f.key === 'driver' || f.key === 'driver_name') { cols.push({ head: f.label, cell: i => esc(i.driver_name || '-') }); continue; }
    const key = f.key as keyof PettyClaim['items'][number];
    cols.push({ head: f.label, cell: i => esc((i[key] as string | null | undefined) || '-') });
  }
  return cols;
}

/**
 * ใบสรุปรายการประกอบ — หนึ่งแถวต่อรายการ คอลัมน์ตามประเภท (ค่าชั่ง: วันที่ เบอร์รถ ทะเบียน ประเภทรถ พจส. เลขที่บัตรชั่ง)
 * สรุปย่อยรายวันแล้วรวมทั้งสิ้น · ประเภทที่ไม่ใช่รายการรถพิมพ์เป็นตารางหัวใบ
 */
export function itemSummaryHtml(opts: VoucherOpts & { spec: PettySpec | null | undefined }): string {
  const { claim, fund, typeName, spec } = opts;
  const itemBased = spec?.item_based !== false && (spec?.item_fields?.length ?? 0) > 0;
  let content: string;

  if (itemBased) {
    const cols = columnsFromSpec(spec?.item_fields ?? [], opts.unit ?? 'คัน');
    const heads = ['<th class="c" style="width:8mm">#</th>', ...cols.map(c => `<th>${esc(c.head)}</th>`),
      '<th class="a" style="width:26mm">จำนวนเงิน</th>'].join('');
    const byDate = new Map<string, PettyClaim['items']>();
    for (const item of claim.items) {
      const key = item.event_date;
      if (!byDate.has(key)) byDate.set(key, []);
      byDate.get(key)!.push(item);
    }
    const bodyRows: string[] = [];
    let no = 0;
    for (const [date, items] of [...byDate.entries()].sort(([a], [b]) => a.localeCompare(b))) {
      for (const item of items) {
        no += 1;
        bodyRows.push(`<tr><td class="c">${no}</td>${cols.map(c => `<td class="${c.cls ?? ''}">${c.cell(item)}</td>`).join('')}` +
          `<td class="a">${money(Number(item.amount))}</td></tr>`);
      }
      const sub = items.reduce((s, i) => s + Number(i.amount), 0);
      bodyRows.push(`<tr><td class="sub" colspan="${cols.length + 1}">รวม ${esc(thaiDate(date))} · ${items.length} รายการ</td>` +
        `<td class="sub a">${money(sub)}</td></tr>`);
    }
    content = `<table class="items"><thead><tr>${heads}</tr></thead><tbody>${bodyRows.join('')}</tbody></table>` +
      `<div class="sum"><div class="dates">${field('รวมทั้งสิ้น', `${claim.items.length} รายการ`)}${field('ช่วงวันที่', periodText(claim))}</div>` +
      `${totalBox('รวมทั้งสิ้น', money(Number(claim.amount)), bahtText(Number(claim.amount)))}</div>`;
  } else {
    const detail = (claim.detail ?? {}) as Record<string, unknown>;
    const item = claim.items[0];
    const value = (f: PettySpecField): string => {
      if (f.key === 'event_date') return thaiDate(item?.event_date ?? claim.expense_date);
      if (f.key === 'rate') return money(Number(claim.amount));
      if (f.key === 'payee_name') return claim.payee_name ?? '';
      if (f.key === 'ref_no') return item?.ref_no ?? claim.receipt_no ?? '';
      if (f.key === 'truck') return [item?.truck_code, item?.truck_plate].filter(Boolean).join(' / ');
      if (f.key === 'driver' || f.key === 'driver_name') return claim.driver_name ?? '';
      // ช่องที่เป็นคอลัมน์ของใบเอง (เลขที่ใบเสร็จ เลข DD ฯลฯ) มาก่อนค่าใน detail
      const own = (claim as unknown as Record<string, unknown>)[f.key];
      if (own !== undefined && own !== null && own !== '') return String(own);
      const v = detail[f.key];
      return v === undefined || v === null ? '' : String(v);
    };
    const fields = (spec?.header_fields ?? []).map(f => field(f.label, value(f))).join('');
    content = `<div class="kv">${fields}${field('หมายเหตุ', item?.remark ?? '')}</div>` +
      `<div class="sum"><div class="dates"></div>${totalBox('รวมทั้งสิ้น', money(Number(claim.amount)), bahtText(Number(claim.amount)))}</div>`;
  }

  const body = `<section class="doc-part">
${docHead({ title: `ใบสรุปรายการ ${typeName}`, english: '(Item Summary)', logoUrl: opts.logoUrl,
    meta: [['เลขที่', claim.form_id], ['วันที่', voucherDate(claim)]] })}

${sec(1, 'ข้อมูลใบเบิก', 'Claim')}
<div class="grid">${field('จ่ายให้', claim.payee_name)}${field('ประเภทการเบิก', typeName)}
${field('สาขา · Division', `${fund.branch_code} ${BRANCHES[fund.branch_code] ?? ''} · ${fund.division_code}`)}${field('เลขที่ใบรับสินค้า (DD)', claim.dd_no)}</div>

${sec(2, 'รายการ', 'Items')}
${content}

${sec(3, 'ลงนาม', 'Signatures')}
${signatureTable([
    { title: 'ผู้เปิดใบ', name: claim.created_by },
    { title: 'ผู้อนุมัติ', name: claim.approved_by, esign: approverEsign(claim) },
  ])}
</section>${opts.attachmentsHtml ?? ''}`;

  return wrapDocument({
    title: `${claim.form_id} — ใบสรุปรายการ`,
    body, extraCss: PETTY_DOC_CSS, fontCss: true,
    footerHtml: footer(claim, 'Item Summary (PC)'),
  });
}
