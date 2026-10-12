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
