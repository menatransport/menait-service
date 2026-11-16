import type { PettyFund } from '@/app/finance/types-petty';
import { COST_CENTER_GROUPS, lockedFundFor } from './petty-cost-centers';

/**
 * ตารางดูล่วงหน้า: แต่ละศูนย์และแผนกเปิดใบแล้วจะได้วงเงินไหน (ผู้ใช้สั่ง 16/11/2026 "หน้า preview ดูวงเงินย่อยของแต่ละแผนก")
 * ใช้ lockedFundFor ตัวเดียวกับหน้าเปิดใบ — ตารางกับของจริงไม่มีทางขัดกัน
 */
export type FundMapVia = 'department' | 'accounting' | 'none';
export type FundMapRow<T> = { center: string; code: string; name: string; fund: T | null; via: FundMapVia };

export function fundMapRows<T extends Pick<PettyFund, 'id' | 'branch_code' | 'division_code'>>(
  funds: readonly T[], expenseType: string | null | undefined,
): FundMapRow<T>[] {
  return COST_CENTER_GROUPS.flatMap(g => g.items.map(cc => {
    const locked = lockedFundFor(funds, cc.code, expenseType);
    return { center: g.center, code: cc.code, name: cc.name, fund: locked.fund, via: locked.via ?? 'none' };
  }));
}

export const FUND_MAP_VIA_LABEL: Record<FundMapVia, string> = {
  department: 'วงเงินของแผนก', accounting: 'ใช้วงเงินบัญชี', none: 'ไม่มีวงเงิน',
};

export function fundMapCounts(rows: readonly { via: FundMapVia }[]): Record<FundMapVia, number> {
  const out: Record<FundMapVia, number> = { department: 0, accounting: 0, none: 0 };
  for (const r of rows) out[r.via] += 1;
  return out;
}
