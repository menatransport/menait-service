'use client';

import type { PettyBalance } from '@/app/finance/types-petty';
import { Info } from './ui';

const baht = (n: number) => n.toLocaleString('th-TH', { minimumFractionDigits: 2 });

export function BalanceCard({ balance }: { balance: PettyBalance }) {
  const negative = balance.available < 0;
  return (
    <div>
      <dl className="grid gap-3 sm:grid-cols-3">
        <Info label="ยอด Advance คงเหลือ" value={<span className="tabular-nums">{baht(balance.advance_outstanding)}</span>} />
        <Info label="ใบที่ยังไม่คืนยอด" value={<span className="tabular-nums">− {baht(balance.petty_committed)}</span>} />
        <Info label="พร้อมอนุมัติ" value={<span className={`font-display text-xl font-semibold tabular-nums ${negative ? 'text-rose-700' : ''}`}>{baht(balance.available)}</span>} />
      </dl>
      {negative && <p className="mt-2 text-sm text-rose-700">ติดลบ — อนุมัติได้ แต่ควรเร่งส่งเคลียร์</p>}
      {balance.fund_limit !== null && <p className="mt-1 text-xs text-ink-500">วงเงินกองทุน {baht(balance.fund_limit)}</p>}
    </div>
  );
}
