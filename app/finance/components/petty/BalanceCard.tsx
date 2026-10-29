'use client';

import type { PettyBalance } from '@/app/finance/types-petty';

const baht = (n: number) => n.toLocaleString('th-TH', { minimumFractionDigits: 2 });

export function BalanceCard({ balance }: { balance: PettyBalance }) {
  const negative = balance.available < 0;
  return (
    <div className={`rounded-2xl border p-4 ${negative ? 'border-rose-200 bg-rose-50' : 'border-slate-200 bg-white'}`}>
      <div className="grid gap-3 sm:grid-cols-3">
        <Figure label="ยอด Advance คงเหลือ" value={baht(balance.advance_outstanding)} />
        <Figure label="ใบที่ยังไม่คืนยอด" value={`− ${baht(balance.petty_committed)}`} />
        <Figure label="พร้อมอนุมัติ" value={baht(balance.available)} strong />
      </div>
      {negative && (
        <p className="mt-3 text-sm text-rose-700">
          ติดลบอยู่ อนุมัติต่อได้ แต่ควรเร่งส่งเคลียร์เป็นรอบ ให้การเงินทำจ่ายคืน
        </p>
      )}
      {balance.fund_limit !== null && (
        <p className="mt-2 text-xs text-ink-400">วงเงินกองทุน {baht(balance.fund_limit)}</p>
      )}
    </div>
  );
}

function Figure({ label, value, strong = false }: { label: string; value: string; strong?: boolean }) {
  return (
    <div>
      <p className="text-xs text-ink-500">{label}</p>
      <p className={`tabular-nums ${strong ? 'text-2xl font-medium' : 'text-lg'}`}>{value}</p>
    </div>
  );
}
