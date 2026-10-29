import type { PettyClaim, PettyFund, PettySpec, PettySpecField } from '@/app/finance/types-petty';
import { bahtText } from '@/lib/finance/bahtText';
import { groupForPrint } from '@/lib/finance/petty-print';
import {
  bangkokDate, checkboxes, docHead, field, PETTY_DOC_CSS, sec, signBlock, thaiDate, totalBox,
} from '@/lib/finance/petty-doc';
import { claimCostCenterLine } from '@/lib/finance/petty-cost-centers';
import { fundPlaceWithHolder } from '@/lib/finance/petty-fund-label';
import { payeeBankText, type PayeeBank } from '@/lib/finance/petty-payee';
import { documentControlFooter, esc, money, printedNow, wrapDocument, type ESign } from '@/lib/finance/printShared';

export const COMPANY = 'บริษัท มีนาทรานสปอร์ต จำกัด (มหาชน)';

export type VoucherOpts = {
  claim: PettyClaim;
  fund: PettyFund;
  typeName: string;
  payeePosition?: string | null;
  /** หน่วยนับบนใบ (คัน/เส้น/เที่ยว) จาก spec.print.unit — ไม่ใช่หน่วย SKU */
  unit?: string;
  /** โลโก้บริษัท (origin + /mena.png) แบบเดียวกับใบ Advance */
  logoUrl?: string | null;
};

/** ที่อยู่สาขาที่พิมพ์บนใบรับรองแทนใบเสร็จ (จากต้นฉบับ) — สาขาอื่นเติมเมื่อได้เอกสาร */
const BRANCH_ADDRESS: Record<string, { address: string; taxId: string }> = {
  '03': { address: 'เลขที่ 1 ซอยแฮปปี้เพลส 16 แขวงคลองสามประเวศ เขตลาดกระบัง จังหวัดกรุงเทพมหานคร 10520', taxId: '0107563000207' },
};
const DEPARTMENTS = ['จัดส่ง', 'ยานยนต์', 'จป.', 'HR', 'บัญชี', 'จัดซื้อ', 'เชื้อเพลิง'];

/** "ทะเบียน 72-8179 (6604)" อย่างที่ใบยางจริงเขียน · หลายคันแสดงเบอร์รถเรียงกัน */
/** "ชื่อ · ธนาคาร เลขบัญชี" บนใบสำคัญจ่าย — ใบเก่าที่ไม่มีบัญชีก็ยังเป็นแค่ชื่อ */
function payeeLine(claim: PettyClaim): string {
  const bank = payeeBankText(claim.detail as PayeeBank | undefined);
  return bank ? `${claim.payee_name ?? ''} · ${bank}` : (claim.payee_name ?? '');
}

function truckRemark(items: PettyClaim['items']): string {
  const trucks = items.filter(i => i.truck_code || i.truck_plate);
  if (trucks.length === 1) {
    const t = trucks[0];
    return t.truck_plate && t.truck_code ? `ทะเบียน ${t.truck_plate} (${t.truck_code})` : (t.truck_plate ?? t.truck_code ?? '');
  }
  return trucks.map(t => t.truck_code ?? t.truck_plate ?? '').join(', ');
}

const approverName = (claim: PettyClaim) => claim.approved_by_name ?? claim.approved_by ?? '';
const clerkName = (claim: PettyClaim) => claim.created_by_name ?? claim.created_by;

function requesterEsign(claim: PettyClaim): ESign | null {
  return claim.created_at ? { name: clerkName(claim), timestamp: claim.created_at, ref: claim.form_id } : null;
}

function approverEsign(claim: PettyClaim): ESign | null {
  return claim.approved_by && claim.approved_at
    ? { name: approverName(claim), timestamp: claim.approved_at, ref: claim.form_id } : null;
}

function footer(claim: PettyClaim, docName: string): string {
  return documentControlFooter({
    ref: claim.form_id,
    name: docName,
    owner: claim.payee_name ?? 'ฝ่ายบัญชีและการเงิน',
    approvedBy: approverName(claim),
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

/** ใบสำคัญจ่ายเงินสดย่อย — ช่องและลำดับตามฟอร์มกระดาษของบริษัท โครงและสไตล์เดียวกับใบ Advance */
export function pettyVoucherHtml(opts: VoucherOpts): string {
  const { claim, fund, typeName } = opts;
  const groups = groupForPrint(claim.items, typeName, { unit: opts.unit });
  const total = groups.reduce((s, g) => s + g.total, 0);
  const singleTruck = claim.items.filter(i => i.truck_code || i.truck_plate).length === 1;

  const rows = groups.map((g, i) => {
    const remark = singleTruck ? truckRemark(claim.items) : g.truckCodes.join(', ');
    return `<tr><td class="c">${i + 1}</td><td></td><td>${esc(g.label)}</td><td class="c">${g.count} ${esc(g.unit)}</td>` +
      `<td class="a">${money(g.total)}</td><td>${esc(remark)}</td></tr>`;
  });
  // ฟอร์มกระดาษมี 6 บรรทัดเสมอ — เติมแถวว่างให้ช่องเซ็นอยู่ที่เดิม
  for (let i = rows.length; i < 6; i += 1) rows.push(`<tr><td class="c">${i + 1}</td><td></td><td>&nbsp;</td><td></td><td class="a"></td><td></td></tr>`);

  const body = `<section class="doc-part">
${docHead({ title: 'ใบสำคัญจ่ายเงินสดย่อย', english: '(Petty Cash Voucher)', logoUrl: opts.logoUrl,
    meta: [['เลขที่', claim.form_id], ['วันที่', voucherDate(claim)]] })}
<p class="t2" style="margin-top:4px">${esc(COMPANY)}</p>

${sec(1, 'ข้อมูลการจ่าย', 'Payment')}
<div class="grid">${field('จ่ายให้', payeeLine(claim))}${field('วงเงินสดย่อย', fundPlaceWithHolder(fund))}
${field('รหัสค่าใช้จ่ายของผู้เบิก (บัญชี)', claimCostCenterLine(claim, fund))}${field('ประเภทการเบิก', typeName)}
${field('เลขที่ใบรับสินค้า (DD)', claim.dd_no)}</div>

${sec(2, 'รายการ', 'Items')}
<table class="items"><thead><tr><th class="c" style="width:9mm">ลำดับ</th><th style="width:22mm">Account Code</th><th>รายการ</th>
<th class="c" style="width:22mm">จำนวน (หน่วย)</th><th class="a" style="width:24mm">จำนวนเงิน</th><th style="width:34mm">หมายเหตุ</th></tr></thead>
<tbody>${rows.join('')}</tbody></table>
<div class="sum"><div class="dates">${field('วันที่โอน', thaiDate(claim.transfer_date))}
${field('ช่วงวันที่ค่าใช้จ่าย', periodText(claim))}${field('หมายเหตุ', claim.dup_override_reason ?? '')}</div>
${totalBox('รวมทั้งสิ้น', money(total), bahtText(total))}</div>

${signBlock(3, 'ลงนามและอนุมัติ', 'Signatures', [
    { title: 'ผู้ขอเบิก', name: clerkName(claim), esign: requesterEsign(claim) },
    // เจ้าของเงินสดอนุมัติและโอนเงินเองในขั้นเดียว — รวมเป็นช่องเดียว (ผู้ใช้สั่ง 29/10/2026)
    { title: 'ผู้อนุมัติและผู้โอนเงิน', name: approverName(claim) || (fund.holder_name ?? fund.holder_employee_id), esign: approverEsign(claim) },
    { title: 'ผู้รับเงิน', name: claim.payee_name,
      received: claim.transfer_date ? { date: claim.transfer_date, ref: claim.form_id } : null },
  ])}
</section>`;

  return wrapDocument({
    title: `${claim.form_id} — ใบสำคัญจ่ายเงินสดย่อย`,
    body, extraCss: PETTY_DOC_CSS, fontCss: true,
    footerHtml: footer(claim, 'Petty Cash Voucher (PC)'),
  });
}

/** ใบรับรองแทนใบเสร็จรับเงิน — ตามต้นฉบับ: หัวบริษัท+สาขา+ที่อยู่+เลขผู้เสียภาษี · ตาราง 4 คอลัมน์ · คำรับรองครอบช่วงวัน */
export function receiptSubstituteHtml(opts: VoucherOpts): string {
  const { claim, fund, typeName } = opts;
  const groups = groupForPrint(claim.items, typeName, { unit: opts.unit });
  const total = groups.reduce((s, g) => s + g.total, 0);
  const from = thaiDate(claim.period_from ?? claim.expense_date);
  const to = thaiDate(claim.period_to ?? claim.expense_date);
  const branchNo = fund.branch_code.padStart(5, '0');
  const addr = BRANCH_ADDRESS[fund.branch_code];
  const singleTruck = claim.items.filter(i => i.truck_code || i.truck_plate).length === 1;

  // รายละเอียดรายจ่ายเขียนจำนวนไว้ในบรรทัด: "ค่าชั่งน้ำหนัก 100 บาท 12 คัน"
  const rows = groups.map(g => {
    const detail = g.label.includes(' = ') ? g.label.replace(/ = (\d+) (\S+).*$/, ' $1 $2') : g.label;
    const remark = singleTruck ? truckRemark(claim.items) : g.truckCodes.join(', ');
    return `<tr><td class="c">${esc(voucherDate(claim))}</td><td>${esc(detail)}</td><td class="a">${money(g.total)}</td><td>${esc(remark)}</td></tr>`;
  });
  for (let i = rows.length; i < 8; i += 1) rows.push('<tr><td>&nbsp;</td><td></td><td class="a"></td><td></td></tr>');

  const body = `<section class="doc-part">
${docHead({ title: 'ใบรับรองแทนใบเสร็จรับเงิน', english: '(Receipt Substitute)', logoUrl: opts.logoUrl,
    meta: [['วันที่', voucherDate(claim)]] })}
<p class="t2" style="margin-top:4px">${esc(COMPANY)} (สาขา${esc(branchNo)})<br>${esc(addr?.address ?? '')}${addr ? ` · เลขประจำตัวผู้เสียภาษี ${esc(addr.taxId)}` : ''}</p>

${sec(1, 'รายละเอียดรายจ่าย', 'Expenses')}
<table class="items"><thead><tr><th class="c" style="width:24mm">วัน เดือน ปี</th><th>รายละเอียดรายจ่าย</th>
<th class="a" style="width:26mm">จำนวนเงิน</th><th style="width:40mm">หมายเหตุ</th></tr></thead>
<tbody>${rows.join('')}</tbody></table>
<div class="sum"><div class="dates">${field('ข้าพเจ้า', claim.payee_name)}${field('ตำแหน่ง', opts.payeePosition)}</div>
${totalBox('รวมทั้งสิ้น', money(total), bahtText(total))}</div>

${sec(2, 'คำรับรอง', 'Declaration')}
<ol class="clauses"><li>ขอรับรองว่า รายจ่ายข้างต้นนี้ไม่อาจเรียกเก็บใบเสร็จรับเงินจากผู้รับได้ และข้าพเจ้าได้จ่ายไปในงานของทางบริษัทฯโดยแท้ ตั้งแต่วันที่ ${esc(from)} ถึงวันที่ ${esc(to)}</li></ol>

${signBlock(3, 'ลงชื่อ', 'Signatures', [
    { title: 'ผู้เบิกจ่าย', name: claim.payee_name },
    { title: 'ผู้อนุมัติ', name: approverName(claim), esign: approverEsign(claim) },
  ])}
</section>`;

  return wrapDocument({
    title: `${claim.form_id} — ใบรับรองแทนใบเสร็จรับเงิน`,
    body, extraCss: PETTY_DOC_CSS, fontCss: true,
    footerHtml: footer(claim, 'Receipt Substitute (PC)'),
  });
}

/** แบบฟอร์มขอใช้บริการแกร็บแท็กซี่ (เอกสารประกอบ 1) — พิมพ์จากข้อมูลที่กรอกในใบค่าเดินทาง ให้เซ็นแล้วแนบ */
export function travelRequestFormHtml(opts: VoucherOpts): string {
  const { claim, typeName } = opts;
  const d = (claim.detail ?? {}) as Record<string, unknown>;
  const str = (k: string) => (d[k] === undefined || d[k] === null ? '' : String(d[k]));
  const item = claim.items[0];
  const leg = str('leg');
  const code = item?.ref_no ?? claim.receipt_no ?? '';
  const legRow = (title: string, picked: boolean) =>
    `<tr><td colspan="2"><span class="cbi"><span class="cb${picked ? ' checked' : ''}"></span>${esc(title)}</span></td>` +
    `<td>${picked ? esc(code) : ''}</td><td>${picked ? esc(str('route_from')) : ''}</td><td>${picked ? esc(str('route_to')) : ''}</td></tr>`;
  const depts = DEPARTMENTS.map(x => `<span class="cbi"><span class="cb${x === str('dept') ? ' checked' : ''}"></span>${esc(x)}</span>`).join('');

  const body = `<section class="doc-part">
${docHead({ title: 'แบบฟอร์มขอใช้บริการแกร็บแท็กซี่', english: 'เอกสารประกอบ 1', logoUrl: opts.logoUrl,
    meta: [['เลขที่ใบเบิก', claim.form_id], ['วันที่', thaiDate(item?.event_date ?? claim.expense_date)]] })}

${sec(1, 'ผู้ขอใช้', 'Requester')}
<div class="grid">${field('ผู้ใช้', claim.payee_name)}${field('วันที่', thaiDate(item?.event_date ?? claim.expense_date))}
${field('ประเภทการเบิก', typeName)}${field('ค่าโดยสาร (บาท)', money(Number(claim.amount)))}</div>
<div class="cbs"><span class="lbl">แผนก</span>${depts}</div>
<div class="grid" style="margin-top:6px">${field('เหตุที่ใช้', str('reason'))}${field('บริการ', str('service'))}</div>

${sec(2, 'เที่ยวเดินทาง', 'Trips')}
<table class="items"><thead><tr><th style="width:9mm"></th><th style="width:22mm">เที่ยว</th><th style="width:34mm">รหัส</th><th>จาก</th><th>ไป</th></tr></thead>
<tbody>${legRow('ขาไป', leg === 'ขาไป')}${legRow('ขากลับ', leg === 'ขากลับ')}</tbody></table>

${signBlock(3, 'ลงนาม', 'Signatures', [
    { title: 'ผู้ขอเบิก', name: claim.payee_name },
    { title: 'ผู้อนุมัติ', name: approverName(claim), esign: approverEsign(claim) },
  ])}
</section>`;

  return wrapDocument({
    title: `${claim.form_id} — แบบฟอร์มขอใช้บริการแกร็บแท็กซี่`,
    body, extraCss: PETTY_DOC_CSS, fontCss: true,
    footerHtml: footer(claim, 'Grab/Taxi Request Form (PC)'),
  });
}

// ---------------------------------------------------------------- ใบสรุปรายการประกอบ

type Column = { head: string; cell: (item: PettyClaim['items'][number]) => string; cls?: string };

/** คอลัมน์จาก item_fields ของ spec — `truck` แตกเป็นเบอร์รถ+ทะเบียน · `rate` กลายเป็นจำนวนเงินท้ายตาราง */
function columnsFromSpec(fields: PettySpecField[], unit: string): Column[] {
  const cols: Column[] = [];
  // ยางนับเป็นเส้น: จำนวนและราคาต่อหน่วยอยู่บนใบด้วย · ประเภทที่จำนวนเป็น 1 เสมอ ราคาเท่ายอด ไม่พิมพ์ซ้ำ
  const hasQty = fields.some(f => f.key === 'qty');
  for (const f of fields) {
    if (f.key === 'qty') { cols.push({ head: f.label, cell: i => `${Number(i.qty ?? 1)} ${esc(unit)}`, cls: 'c' }); continue; }
    if (f.key === 'rate') { if (hasQty) cols.push({ head: f.label, cell: i => money(Number(i.rate)), cls: 'a' }); continue; }
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
export function itemSummaryHtml(opts: VoucherOpts & {
  spec: PettySpec | null | undefined;
  /** หน้าแนบไฟล์ต่อท้าย (printShared.attachmentPagesHtml) — มีแค่ใบนี้ ใบอื่นไม่แนบ (ผู้ใช้สั่ง 29/10/2026) */
  attachmentsHtml?: string;
}): string {
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
<div class="grid">${field('จ่ายให้', claim.payee_name)}${field('วงเงินสดย่อย', fundPlaceWithHolder(fund))}
${field('รหัสค่าใช้จ่ายของผู้เบิก (บัญชี)', claimCostCenterLine(claim, fund))}${field('ประเภทการเบิก', typeName)}
${field('เลขที่ใบรับสินค้า (DD)', claim.dd_no)}</div>

${sec(2, 'รายการ', 'Items')}
${content}

${signBlock(3, 'ลงนาม', 'Signatures', [
    { title: 'ผู้เปิดใบ', name: clerkName(claim) },
    { title: 'ผู้อนุมัติ', name: approverName(claim), esign: approverEsign(claim) },
  ])}
</section>${opts.attachmentsHtml ?? ''}`;

  return wrapDocument({
    title: `${claim.form_id} — ใบสรุปรายการ`,
    body, extraCss: PETTY_DOC_CSS, fontCss: true,
    footerHtml: footer(claim, 'Item Summary (PC)'),
  });
}
