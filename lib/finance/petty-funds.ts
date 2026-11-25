import type { PettyBalance, PettyFund } from '@/app/finance/types-petty';
import { round2 } from '@/lib/finance/status';

export type FundSummaryRow = {
  id: number; branch_code: string; division_code: string; holder: string; holder_employee_id: string;
  fund_limit: number | null; is_active: boolean;
  advance_outstanding: number | null; petty_committed: number | null; available: number | null;
  negative: boolean;
};

/** หน้าสรุปยอดกองทุน: หนึ่งแถวต่อกองทุน เรียงสาขา-ดิวิชัน · ยอดมาจาก /funds/{id}/balance (ไม่มี = null) */
export function fundSummaryRows(funds: readonly PettyFund[], balances: Record<number, PettyBalance | undefined>): FundSummaryRow[] {
  return [...funds]
    .sort((a, b) => `${a.branch_code}-${a.division_code}`.localeCompare(`${b.branch_code}-${b.division_code}`))
    .map(f => {
      const b = balances[f.id];
      return {
        id: f.id, branch_code: f.branch_code, division_code: f.division_code,
        holder: f.holder_name ?? f.holder_employee_id, holder_employee_id: f.holder_employee_id,
        fund_limit: f.fund_limit, is_active: f.is_active,
        advance_outstanding: b ? b.advance_outstanding : null,
        petty_committed: b ? b.petty_committed : null,
        available: b ? b.available : null,
        negative: !!b && b.available < 0,
      };
    });
}

export function grandTotals(rows: readonly FundSummaryRow[]): { advance_outstanding: number; petty_committed: number; available: number } {
  const sum = (pick: (r: FundSummaryRow) => number | null) =>
    round2(rows.reduce((s, r) => s + (pick(r) ?? 0), 0));
  return { advance_outstanding: sum(r => r.advance_outstanding), petty_committed: sum(r => r.petty_committed), available: sum(r => r.available) };
}

export type HolderSummaryRow = {
  holder: string; holder_employee_id: string; funds: string[];
  fund_limit: number; petty_committed: number; left_in_limit: number;
  advance_outstanding: number; available: number; negative: boolean;
};

/**
 * สรุปรายเจ้าของเงินสด (ผู้ใช้ขอ 25/11/2026 "เหลือเท่าไหร่") — รวมทุกวงเงินที่คนนั้นถือ เฉพาะวงเงินที่ใช้งาน
 * เหลือในวงเงิน = วงเงิน − ใบที่อนุมัติจ่ายแล้วแต่ยังไม่คืนยอด (ไม่อิง Advance) · เรียงตาม % ที่เหลือ น้อยไปมาก
 */
export function holderSummaryRows(rows: readonly FundSummaryRow[]): HolderSummaryRow[] {
  const byHolder = new Map<string, HolderSummaryRow>();
  for (const r of rows) {
    if (!r.is_active) continue;
    const h = byHolder.get(r.holder_employee_id) ?? {
      holder: r.holder, holder_employee_id: r.holder_employee_id, funds: [],
      fund_limit: 0, petty_committed: 0, left_in_limit: 0, advance_outstanding: 0, available: 0, negative: false,
    };
    h.funds.push(`${r.branch_code} · ${r.division_code}`);
    h.fund_limit = round2(h.fund_limit + (r.fund_limit ?? 0));
    h.petty_committed = round2(h.petty_committed + (r.petty_committed ?? 0));
    h.advance_outstanding = round2(h.advance_outstanding + (r.advance_outstanding ?? 0));
    h.available = round2(h.available + (r.available ?? 0));
    h.left_in_limit = round2(h.fund_limit - h.petty_committed);
    h.negative = h.left_in_limit < 0;
    byHolder.set(r.holder_employee_id, h);
  }
  // เรียงตามสัดส่วนที่เหลือ (ใช้ไปเยอะสุดขึ้นก่อน) — เรียงตามบาทจะเอาวงเงินเล็กที่ยังไม่ได้ใช้ขึ้นก่อนเสมอ
  const share = (h: HolderSummaryRow) => (h.fund_limit > 0 ? h.left_in_limit / h.fund_limit : 1);
  return [...byHolder.values()].sort((a, b) => share(a) - share(b) || a.left_in_limit - b.left_in_limit || a.holder.localeCompare(b.holder));
}
