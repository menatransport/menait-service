import type { PettyClaim, PettyExpenseType } from '@/app/finance/types-petty';
import { bahtText } from '@/lib/finance/bahtText';
import { round2 } from '@/lib/finance/status';
import { bangkokDate, docHead, field, PETTY_LANDSCAPE_CSS, sec, signBlock, thaiDate } from '@/lib/finance/petty-doc';
import { printableDocs, requiredDocs } from '@/lib/finance/petty-preset';
import { documentControlFooter, esc, money, printedNow, wrapDocument, type ESign } from '@/lib/finance/printShared';
import { fundCostCenterLine } from '@/lib/finance/petty-cost-centers';
import { claimExpenseCode, expenseCodeLabel } from '@/lib/finance/petty-expense-code';
import { fleetShortOf } from '@/lib/finance/petty-report';

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
  period: string; amount: number; code: string; fleet: string; wht: number; net: number;
};

const whtOf = (c: PettyClaim) => round2(Number(c.wht_amount ?? 0));
const netOf = (c: PettyClaim) => round2(c.amount - whtOf(c));

/** พจส. / พจร. ของใบ จากแถวรายการ (ใบหัวเดียวใช้ detail) · ไม่มีคนขับ = '' */
export function claimRole(claim: Pick<PettyClaim, 'items' | 'detail'>): string {
  const roles = new Set((claim.items ?? []).map(i => String(i.driver_role ?? '').trim()).filter(Boolean));
  const head = String(claim.detail?.driver_role ?? '').trim();
  if (head) roles.add(head);
  return [...roles].sort().join('+');
}

export type CoverPart = ClerkGroup & { fleet: string; role: string };

/**
 * ใบปะหน้า 1 แผ่นต่อฟลีท × พจส./พจร. (ผู้ใช้สั่ง 25/11/2026) — บัญชีลงรหัสใบสำคัญจ่ายแยกกองได้เลย
 * เรียงฟลีทตามตัวอักษร ใบไม่มีรถไว้ท้าย · ใบในแผ่นคงลำดับเดิม
 */
export function splitByFleetRole(group: ClerkGroup): CoverPart[] {
  const parts = new Map<string, CoverPart>();
  for (const claim of group.claims) {
    const fleet = fleetShortOf(claim);
    const role = claimRole(claim);
    const key = `${fleet}|${role}`;
    const part = parts.get(key) ?? { clerk: group.clerk, claims: [], total: 0, fleet, role };
    part.claims.push(claim);
    part.total = round2(part.total + claim.amount);
    parts.set(key, part);
  }
  const rank = (p: CoverPart) => `${p.fleet ? 0 : 1}|${p.fleet}|${p.role ? 0 : 1}|${p.role}`;
  return [...parts.values()].sort((a, b) => rank(a).localeCompare(rank(b)));
}

/** ป้ายฟลีทของแผ่น เช่น "ML · พจส." · ไม่มีรถ = "ไม่มีรถ" */
export function partLabel(part: Pick<CoverPart, 'fleet' | 'role'>): string {
  return [part.fleet || 'ไม่มีรถ', part.role].filter(Boolean).join(' · ');
}

/** สรุปยอดตามรหัสใบสำคัญจ่าย (ข้อ 8 ผู้ใช้สั่ง 7/11/2026 "ใบสำคัญจ่ายแยกตามรหัส") — บัญชีลงบัญชีแยกกอง */
export type CodeRow = { code: string; label: string; count: number; amount: number; wht: number; net: number };
export function codeSummary(group: ClerkGroup): CodeRow[] {
  const buckets = new Map<string, CodeRow>();
  for (const claim of group.claims) {
    const code = claimExpenseCode(claim) || '-';
    const row = buckets.get(code) ?? { code, label: expenseCodeLabel(code) || 'ไม่ระบุรหัส', count: 0, amount: 0, wht: 0, net: 0 };
    row.count += 1;
    row.amount = round2(row.amount + claim.amount);
    row.wht = round2(row.wht + whtOf(claim));
    row.net = round2(row.net + netOf(claim));
    buckets.set(code, row);
  }
  return [...buckets.values()].sort((a, b) => a.code.localeCompare(b.code));
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
    code: claimExpenseCode(claim),
    fleet: fleetShortOf(claim) || '-',
    wht: whtOf(claim),
    net: netOf(claim),
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

/** สรุปยอดท้ายตารางแบบบรรทัดเดียว ไม่ใช้กล่องยอดใหญ่ (ผู้ใช้สั่ง 25/11/2026) */
const COVER_SUM_CSS = `
.cover-sum { margin: 4px 0 2px; padding: 4px 8px; border-top: 1px solid var(--line); font-size: 11.5px; text-align: right; }
.cover-sum span { margin-left: 6px; color: var(--muted); }`;

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
  /** ตรา e-Signature ช่องลงนาม (เหมือนใบสำคัญจ่าย 16/11/2026) — ไม่มี = ช่องว่างให้เซ็นมือ */
  stamps?: { sender?: ESign | null; head?: ESign | null; accounting?: ESign | null };
  logoUrl?: string | null;
  /** เวลาที่พิมพ์ (ใส่ในเทสต์) — วันที่บนใบคิดตามเวลาไทย */
  now?: Date;
}): string {
  const isRound = opts.mode === 'round';
  const ref = opts.batchNo ?? opts.group.claims[0]?.form_id ?? '-';
  const today = thaiDate(bangkokDate((opts.now ?? new Date()).toISOString()));
  const parts = splitByFleetRole(opts.group);  // 1 แผ่นต่อฟลีท × พจส./พจร. (25/11/2026)
  const body = parts.map((part, i) => coverPart(part, i, parts.length)).join('\n');

  function coverPart(part: CoverPart, index: number, count: number): string {
  const rows = coverRows(part, opts.types);
  const codes = codeSummary(part);  // แยกตามรหัสใบสำคัญจ่าย (ข้อ 8)
  const amount = round2(rows.reduce((s, r) => s + r.amount, 0));
  const wht = round2(rows.reduce((s, r) => s + r.wht, 0));
  const net = round2(rows.reduce((s, r) => s + r.net, 0));
  // กล่องมุมขวาบนไม่มีฟลีท (ผู้ใช้สั่ง 25/11/2026) — ฟลีทดูได้จากคอลัมน์ในตาราง
  const meta: [string, string][] = [['รหัสใบสำคัญจ่าย', codes.map(c => c.code).join(', ')], ['อ้างอิง', ref], ['วันที่', today]];
  if (count > 1) meta.push(['แผ่น', `${index + 1}/${count}`]);
  const whtCell = (n: number) => (n > 0 ? money(n) : '-');

  return `<section class="doc-part">
${docHead({ title: 'ใบปะหน้าเอกสารเบิกเงินสดย่อย', english: '(Petty Cash Cover Sheet)', logoUrl: opts.logoUrl, meta })}

${sec(1, 'ผู้ส่งเอกสาร', 'Sender')}
<div class="grid">${field(isRound ? 'เจ้าของเงินสด (ผู้อนุมัติจ่าย)' : 'เจ้าหน้าที่ผู้เปิดใบ', opts.clerkName)}${field('ส่งถึง', 'ฝ่ายบัญชีและการเงิน')}
${field('สาขา · แผนก', fundCostCenterLine({ branch_code: opts.branchCode, division_code: opts.divisionCode }) || `${opts.branchCode} · ${opts.divisionCode}`)}${field(isRound ? 'รอบส่งเคลียร์' : 'รอบคืนยอด', opts.batchNo ?? '-')}</div>

${sec(2, 'รายการใบเบิก', 'Documents')}
<table class="items" style="margin-top:0"><thead><tr><th>รหัสใบสำคัญจ่าย</th><th class="c" style="width:16mm">จำนวนใบ</th>
<th class="a" style="width:28mm">ยอดค่าใช้จ่าย</th><th class="a" style="width:22mm">WHT</th><th class="a" style="width:28mm">ยอดจ่ายสุทธิ</th></tr></thead>
<tbody>${codes.map(c => `<tr><td>${esc(c.label)}</td><td class="c">${c.count}</td><td class="a">${money(c.amount)}</td>` +
    `<td class="a">${whtCell(c.wht)}</td><td class="a">${money(c.net)}</td></tr>`).join('')}
${codes.length > 1 ? `<tr><td><b>รวม</b></td><td class="c">${rows.length}</td><td class="a">${money(amount)}</td><td class="a">${whtCell(wht)}</td><td class="a">${money(net)}</td></tr>` : ''}</tbody></table>
<table class="items"><thead><tr><th class="c" style="width:8mm">#</th><th style="width:34mm">เลขที่ใบเบิก</th><th>ประเภท</th>
<th>จ่ายให้</th><th style="width:34mm">ช่วงวันที่</th><th style="width:14mm">ฟลีท</th><th style="width:28mm">เลขที่ DD</th>
<th class="a" style="width:28mm">ยอดจ่ายสุทธิ</th></tr></thead>
<tbody>${rows.map(r => `<tr><td class="c">${r.no}</td><td class="nw">${esc(r.formId)}</td><td>${esc(r.typeName)}</td><td>${esc(r.payee)}</td>` +
    `<td>${esc(r.period)}</td><td class="nw">${esc(r.fleet)}</td><td>${esc(r.ddNo)}</td><td class="a">${money(r.net)}</td></tr>`).join('')}</tbody></table>
<div class="cover-sum">รวม ${rows.length} ใบ · ยอดค่าใช้จ่าย ${money(amount)} · WHT ${whtCell(wht)} · <b>ยอดจ่ายสุทธิ ${money(net)} บาท</b>
<span>(${esc(bahtText(net))})</span></div>

${sec(3, 'รายการเอกสารที่ต้องรวบรวม', 'Checklist')}
${checklistHtml(part, opts.types)}

${signBlock(4, 'ลงนาม', 'Signatures', isRound
    ? [
      { title: 'ผู้ส่งเอกสาร (เจ้าของเงินสด)', name: opts.clerkName, esign: opts.stamps?.sender },
      { title: 'หัวหน้าอนุมัติเคลียร์', name: opts.clearApproverName ?? '', esign: opts.stamps?.head },
      { title: 'ผู้รับเอกสาร (บัญชี)', name: opts.stamps?.accounting?.name ?? '', esign: opts.stamps?.accounting },
    ]
    : [
      { title: 'ผู้ส่งเอกสาร', name: opts.clerkName },
      { title: 'ผู้รับเอกสาร (บัญชี)', name: '' },
    ])}
</section>`;
  }

  return wrapDocument({
    title: `ใบปะหน้าเงินสดย่อย ${opts.clerkName}`,
    body, extraCss: PETTY_LANDSCAPE_CSS + COVER_SUM_CSS, fontCss: true,  // แนวนอน (ผู้ใช้สั่ง 7/11/2026)
    footerHtml: documentControlFooter({
      ref, name: 'Petty Cash Cover Sheet (PC)', owner: opts.clerkName,
      approvedBy: '', approvedDate: '', printed: printedNow(),
    }),
  });
}

/** ตราลงนามของรอบจากประวัติรอบ: ส่งเคลียร์ (เจ้าของเงินสด) · อนุมัติเคลียร์ (หัวหน้า) · ตั้งเบิก (บัญชีรับเอกสาร) — ref = เลขรอบ */
export function roundStamps(round: {
  batch_no: string; holder_name?: string | null; submitted_at?: string | null;
  clear_approved_by_name?: string | null; clear_approved_at?: string | null;
  logs?: readonly { action: string; actor_name: string | null; at: string | null }[] | null;
}): { sender: ESign | null; head: ESign | null; accounting: ESign | null } {
  const ref = round.batch_no;
  const log = (action: string) => [...(round.logs ?? [])].reverse().find(l => l.action === action && l.at);
  const submit = log('SUBMIT_ROUND');
  const voucher = log('VOUCHER');
  const stamp = (name: string | null | undefined, at: string | null | undefined): ESign | null =>
    name && at ? { name, timestamp: at, ref } : null;
  return {
    sender: stamp(submit?.actor_name ?? round.holder_name, submit?.at ?? round.submitted_at),
    head: stamp(round.clear_approved_by_name, round.clear_approved_at),
    accounting: stamp(voucher?.actor_name, voucher?.at),
  };
}
