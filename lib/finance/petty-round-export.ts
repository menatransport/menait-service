import type { PettyClaim, PettyExpenseType, PettyRound } from '@/app/finance/types-petty';
import { claimRole, coverRows } from '@/lib/finance/petty-cover';
import { bangkokDate } from '@/lib/finance/petty-doc';
import { PETTY_ROUND_LABELS } from '@/lib/finance/petty-status';

/**
 * Excel รอบที่ส่งเคลียร์ของเจ้าของเงินสด (ผู้ใช้ขอ 25/11/2026 "ส่งเคลียร์ export excel ได้ อิงจากรอบส่งเคลียร์")
 * ชีต รอบ = รอบละแถว · ชีต ใบในรอบ = ใบละแถว เรียงตามรอบ มีรวมต่อรอบ · ยอดชุดเดียวกับใบปะหน้า (ยอดค่าใช้จ่าย / WHT / ยอดจ่ายสุทธิ)
 * ไฟล์นี้ไม่มี fetch — หน้าเว็บขอรายละเอียดรอบมาก่อนแล้วส่ง rounds ที่มี claims เข้ามา
 */

export type RoundWithClaims = PettyRound & { claims: PettyClaim[] };

export const ROUND_SHEET_COLS = [
  'ลำดับ', 'เลขที่รอบ', 'วันที่ส่งเคลียร์', 'สถานะรอบ', 'หัวหน้าที่อนุมัติเคลียร์', 'วันที่อนุมัติเคลียร์',
  'จำนวนใบ', 'ยอดค่าใช้จ่าย', 'WHT', 'ยอดจ่ายสุทธิ', 'เลขที่ตั้งเบิก', 'เลขที่ทำจ่าย',
] as const;

export const CLAIM_SHEET_COLS = [
  'เลขที่รอบ', 'วันที่ส่งเคลียร์', '#', 'เลขที่ใบเบิก', 'ประเภท', 'รายละเอียดค่าใช้จ่าย', 'จ่ายให้', 'ช่วงวันที่', 'ฟลีท', 'พจส./พจร.',
  'รหัสใบสำคัญจ่าย', 'เลขที่ DD', 'ยอดค่าใช้จ่าย', 'WHT', 'ยอดจ่ายสุทธิ',
] as const;

export const ROUND_MONEY_COLS = new Set<string>(['ยอดค่าใช้จ่าย', 'WHT', 'ยอดจ่ายสุทธิ']);

const r2 = (n: number) => Math.round(n * 100) / 100;

function thaiDay(iso: string | null | undefined): string {
  if (!iso) return '';
  const [y, m, d] = iso.slice(0, 10).split('-');
  return y && m && d ? `${d}/${m}/${y}` : '';
}

/** วันส่งเคลียร์ตามเวลาไทย YYYY-MM-DD (submitted_at เป็น timestamp) */
export function submittedDay(round: Pick<PettyRound, 'submitted_at'>): string {
  return round.submitted_at ? bangkokDate(round.submitted_at) : '';
}

/** รอบที่ส่งเคลียร์ในช่วงวันที่ (ปลายเปิดได้) · รอบที่หัวหน้าไม่อนุมัติไม่เอา ใบหลุดรอบไปแล้ว · เรียงเก่าไปใหม่ */
export function roundsInRange<T extends Pick<PettyRound, 'id' | 'status' | 'submitted_at'>>(rounds: readonly T[], from?: string | null, to?: string | null): T[] {
  return rounds
    .filter(r => r.status !== 'CLEAR_REJECTED')
    .filter(r => {
      const day = submittedDay(r);
      if (!day) return !from && !to;
      return (!from || day >= from) && (!to || day <= to);
    })
    .sort((a, b) => submittedDay(a).localeCompare(submittedDay(b)) || a.id - b.id);
}

function totals(claims: readonly PettyClaim[]) {
  const amount = r2(claims.reduce((s, c) => s + Number(c.amount || 0), 0));
  const wht = r2(claims.reduce((s, c) => s + Number(c.wht_amount ?? 0), 0));
  return { amount, wht, net: r2(amount - wht) };
}

const whtCell = (n: number) => (n === 0 ? '' : n);

export function roundSheetAoa(rounds: readonly RoundWithClaims[]): (string | number)[][] {
  const rows = rounds.map((r, i) => {
    const t = totals(r.claims);
    return [i + 1, r.batch_no, thaiDay(submittedDay(r)), PETTY_ROUND_LABELS[r.status] ?? r.status,
      r.clear_approved_by_name ?? r.clear_approved_by ?? '', thaiDay(r.clear_approved_at ? bangkokDate(r.clear_approved_at) : ''),
      r.claims.length, t.amount, whtCell(t.wht), t.net, r.voucher_no ?? '', r.pay_doc_no ?? ''];
  });
  const all = totals(rounds.flatMap(r => r.claims));
  const count = rounds.reduce((s, r) => s + r.claims.length, 0);
  const foot = rounds.length ? [['รวม', `${rounds.length} รอบ`, '', '', '', '', count, all.amount, whtCell(all.wht), all.net, '', '']] : [];
  return [[...ROUND_SHEET_COLS], ...rows, ...foot];
}

const text = (v: unknown) => String(v ?? '').trim();

/** ใบนี้จ่ายค่าอะไร (UAT 26/11/2026 ขอคอลัมน์ "รายละเอียดค่าใช้จ่าย" ใน Excel)
 * รายการ/อาการ/รายการที่ทำ ของทุกแถวไม่ซ้ำ · ทางด่วน/เดินทางใช้ เส้นทาง (+ เหตุที่ใช้) · ค่าชั่งบอกจำนวนครั้ง */
export function expenseDetailText(claim: Pick<PettyClaim, 'items' | 'detail' | 'expense_type'>): string {
  const remarks = [...new Set((claim.items ?? []).map(i => text(i.remark)).filter(Boolean))];
  if (remarks.length) return remarks.join(', ');
  const d = claim.detail ?? {};
  const from = text(d.route_from), to = text(d.route_to);
  const route = from || to ? `${from || '-'} → ${to || '-'}` : '';
  const reason = text(d.reason);
  if (route || reason) return [route, reason].filter(Boolean).join(' · ');
  if (claim.expense_type === 'WEIGH' && claim.items?.length) return `ชั่งน้ำหนัก ${claim.items.length} ครั้ง`;
  return '';
}

export function claimSheetAoa(rounds: readonly RoundWithClaims[], types: readonly PettyExpenseType[]): (string | number)[][] {
  const out: (string | number)[][] = [[...CLAIM_SHEET_COLS]];
  for (const r of rounds) {
    const day = thaiDay(submittedDay(r));
    coverRows({ clerk: '', claims: r.claims, total: 0 }, types).forEach((row, i) => {
      out.push([r.batch_no, day, row.no, row.formId, row.typeName, expenseDetailText(r.claims[i]) || '-', row.payee, row.period, row.fleet, claimRole(r.claims[i]) || '-',
        row.code || '-', row.ddNo, row.amount, whtCell(row.wht), row.net]);
    });
    const t = totals(r.claims);
    out.push([`รวมรอบ ${r.batch_no}`, '', '', `${r.claims.length} ใบ`, '', '', '', '', '', '', '', '', t.amount, whtCell(t.wht), t.net]);
  }
  return out;
}

export async function exportRoundsXlsx(rounds: readonly RoundWithClaims[], types: readonly PettyExpenseType[], fileName: string): Promise<void> {
  const XLSX = await import('xlsx');
  const book = XLSX.utils.book_new();
  const sheet = (aoa: (string | number)[][], widths: number[]) => {
    const ws = XLSX.utils.aoa_to_sheet(aoa);
    aoa[0].forEach((head, c) => {
      if (!ROUND_MONEY_COLS.has(String(head))) return;
      for (let r = 1; r < aoa.length; r += 1) {
        const ref = XLSX.utils.encode_cell({ r, c });
        if (ws[ref] && typeof ws[ref].v === 'number') ws[ref].z = '#,##0.00';
      }
    });
    ws['!cols'] = widths.map(wch => ({ wch }));
    return ws;
  };
  XLSX.utils.book_append_sheet(book, sheet(roundSheetAoa(rounds), [6, 18, 14, 22, 24, 16, 9, 14, 10, 14, 16, 16]), 'รอบส่งเคลียร์');
  XLSX.utils.book_append_sheet(book, sheet(claimSheetAoa(rounds, types), [22, 14, 5, 18, 20, 36, 26, 22, 8, 10, 14, 16, 14, 10, 14]), 'ใบในรอบ');
  XLSX.writeFile(book, fileName);
}
