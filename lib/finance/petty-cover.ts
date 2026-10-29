import type { PettyClaim, PettyExpenseType } from '@/app/finance/types-petty';
import { bahtText } from '@/lib/finance/bahtText';
import { round2 } from '@/lib/finance/status';
import { bangkokDate, docHead, field, PETTY_DOC_CSS, sec, signBlock, thaiDate, totalBox } from '@/lib/finance/petty-doc';
import { printableDocs, requiredDocs } from '@/lib/finance/petty-preset';
import { documentControlFooter, esc, money, printedNow, wrapDocument } from '@/lib/finance/printShared';

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

/** รอบส่งเคลียร์ทั้งรอบเป็นกลุ่มเดียว ในชื่อเจ้าของเงินสด (flow v2: ส่งบัญชีแยกตามผู้อนุมัติ) */
export function roundGroup(round: { holder_employee_id: string | null; claims: readonly PettyClaim[] }): ClerkGroup {
  return {
    clerk: round.holder_employee_id ?? '-',
    claims: [...round.claims],
    total: round.claims.reduce((sum, c) => round2(sum + c.amount), 0),
  };
}

/** ชื่อเจ้าหน้าที่ของกลุ่ม — จากใบใบแรกที่มีชื่อ ไม่มีก็รหัส */
export function clerkNameOf(group: ClerkGroup): string {
  return group.claims.find(c => c.created_by_name)?.created_by_name ?? group.clerk;
}

export type CoverRow = {
  no: number; formId: string; typeName: string; payee: string; ddNo: string;
  period: string; amount: number;
};

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

/** checklist ต่อใบ: เอกสารที่ระบบพิมพ์ให้ + หลักฐานที่ spec บังคับ — เจ้าหน้าที่ติ๊กตอนรวบรวมก่อนส่งบัญชี */
export function checklistHtml(group: ClerkGroup, types: readonly PettyExpenseType[]): string {
  const box = (label: string) => `<span class="cbi"><span class="cb"></span>${esc(label)}</span>`;
  const rows = group.claims.map(claim => {
    const spec = types.find(t => t.code === claim.expense_type)?.spec ?? null;
    const printed = printableDocs(spec).map(box).join('');
    const attached = requiredDocs(spec).filter(d => d.required).map(d => box(d.label)).join('');
    return `<tr><td class="nw">${esc(claim.form_id)}</td><td><div class="cbs" style="margin:0">${printed}</div></td><td><div class="cbs" style="margin:0">${attached}</div></td></tr>`;
  }).join('');
  return `<table class="items"><thead><tr><th style="width:34mm">เลขที่ใบเบิก</th><th>เอกสารที่พิมพ์จากระบบ</th><th>หลักฐานที่ต้องแนบ</th></tr></thead><tbody>${rows}</tbody></table>`;
}

/** ใบปะหน้าส่งบัญชี — โครงและสไตล์เดียวกับใบ Advance */
export function coverSheetHtml(opts: {
  group: ClerkGroup;
  types: readonly PettyExpenseType[];
  clerkName: string;
  branchCode: string;
  divisionCode: string;
  batchNo?: string | null;
  /** 'round' = ใบปะหน้าของรอบส่งเคลียร์ (ผู้ส่ง = เจ้าของเงินสด มีช่องหัวหน้าอนุมัติเคลียร์) */
  mode?: 'clerk' | 'round';
  clearApproverName?: string | null;
  logoUrl?: string | null;
  /** เวลาที่พิมพ์ (ใส่ในเทสต์) — วันที่บนใบคิดตามเวลาไทย */
  now?: Date;
}): string {
  const rows = coverRows(opts.group, opts.types);
  const isRound = opts.mode === 'round';
  const ref = opts.batchNo ?? opts.group.claims[0]?.form_id ?? '-';
  const today = thaiDate(bangkokDate((opts.now ?? new Date()).toISOString()));

  const body = `<section class="doc-part">
${docHead({ title: 'ใบปะหน้าเอกสารเบิกเงินสดย่อย', english: '(Petty Cash Cover Sheet)', logoUrl: opts.logoUrl,
    meta: [['อ้างอิง', ref], ['วันที่', today]] })}

${sec(1, 'ผู้ส่งเอกสาร', 'Sender')}
<div class="grid">${field(isRound ? 'เจ้าของเงินสด (ผู้อนุมัติจ่าย)' : 'เจ้าหน้าที่ผู้เปิดใบ', opts.clerkName)}${field('ส่งถึง', 'ฝ่ายบัญชีและการเงิน')}
${field('สาขา · แผนก', `${opts.branchCode} · ${opts.divisionCode}`)}${field(isRound ? 'รอบส่งเคลียร์' : 'รอบคืนยอด', opts.batchNo ?? '-')}</div>

${sec(2, 'ใบเบิกที่ส่งมาด้วย', 'Documents')}
<table class="items"><thead><tr><th class="c" style="width:8mm">#</th><th style="width:34mm">เลขที่ใบเบิก</th><th>ประเภท</th>
<th>จ่ายให้</th><th style="width:36mm">ช่วงวันที่</th><th style="width:28mm">เลขที่ DD</th><th class="a" style="width:26mm">จำนวนเงิน</th></tr></thead>
<tbody>${rows.map(r => `<tr><td class="c">${r.no}</td><td class="nw">${esc(r.formId)}</td><td>${esc(r.typeName)}</td><td>${esc(r.payee)}</td>` +
    `<td>${esc(r.period)}</td><td>${esc(r.ddNo)}</td><td class="a">${money(r.amount)}</td></tr>`).join('')}</tbody></table>
<div class="sum"><div class="dates">${field('จำนวนใบ', `${rows.length} ใบ`)}</div>
${totalBox('รวมทั้งสิ้น', money(opts.group.total), bahtText(opts.group.total))}</div>

${sec(3, 'รายการเอกสารที่ต้องรวบรวม', 'Checklist')}
${checklistHtml(opts.group, opts.types)}

${signBlock(4, 'ลงนาม', 'Signatures', isRound
    ? [
      { title: 'ผู้ส่งเอกสาร (เจ้าของเงินสด)', name: opts.clerkName },
      { title: 'หัวหน้าอนุมัติเคลียร์', name: opts.clearApproverName ?? '' },
      { title: 'ผู้รับเอกสาร (บัญชี)', name: '' },
    ]
    : [
      { title: 'ผู้ส่งเอกสาร', name: opts.clerkName },
      { title: 'ผู้รับเอกสาร (บัญชี)', name: '' },
    ])}
</section>`;

  return wrapDocument({
    title: `ใบปะหน้าเงินสดย่อย ${opts.clerkName}`,
    body, extraCss: PETTY_DOC_CSS, fontCss: true,
    footerHtml: documentControlFooter({
      ref, name: 'Petty Cash Cover Sheet (PC)', owner: opts.clerkName,
      approvedBy: '', approvedDate: '', printed: printedNow(),
    }),
  });
}
