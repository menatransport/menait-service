'use client';

import { useEffect, useState } from 'react';
import { MascotLoader } from '@/components/loading';
import { useSessionContext } from '@/app/context/SessionContext';
import type { PettyBalance, PettyFund } from '@/app/finance/types-petty';
import { canSeeAllClaims } from '@/lib/finance/petty-access';
import { fundSummaryRows, grandTotals, type FundSummaryRow } from '@/lib/finance/petty-funds';
import { showAlert } from '../../api';
import { getBalance, getFunds } from '../../petty-api';
import { EmptyState, LINE, PettyPage, StatRow } from '../../components/petty/ui';

const TITLE = 'ยอดกองทุนเงินสดย่อย';
const CAPTION = 'Advance คงเหลือ · ใบที่ยังไม่คืนยอด · พร้อมอนุมัติ ของทุกกองทุน';
const baht = (n: number | null) => n === null ? '-' : n.toLocaleString('th-TH', { minimumFractionDigits: 2 });

export default function PettyFundsPage() {
  const { user, loading } = useSessionContext();
  const [rows, setRows] = useState<FundSummaryRow[] | null>(null);

  useEffect(() => {
    if (!user) return;
    (async () => {
      try {
        const funds: PettyFund[] = await getFunds(true);
        const balances: Record<number, PettyBalance | undefined> = {};
        await Promise.all(funds.map(async f => {
          try { balances[f.id] = await getBalance(f.id); } catch { balances[f.id] = undefined; }
        }));
        setRows(fundSummaryRows(funds, balances));
      } catch (err) {
        setRows([]);
        showAlert({ icon: 'error', title: 'โหลดยอดกองทุนไม่สำเร็จ', text: (err as Error).message });
      }
    })();
  }, [user]);

  if (loading || !user) return <MascotLoader />;
  if (!canSeeAllClaims(user)) {
    return (
      <PettyPage title={TITLE} caption={CAPTION}>
        <EmptyState title="ไม่มีสิทธิ์เข้าถึง" text="หน้านี้สำหรับฝ่ายบัญชีและการเงิน" />
      </PettyPage>
    );
  }
  if (rows === null) return <MascotLoader />;
  const totals = grandTotals(rows);

  const TH = 'px-3 py-2.5 text-left text-xs font-medium text-ink-500 whitespace-nowrap';
  const negatives = rows.filter(r => r.negative).length;

  return (
    <PettyPage title={TITLE} caption={CAPTION}>
      <StatRow items={[
        { label: 'กองทุน', value: rows.length },
        { label: 'Advance คงเหลือ (บาท)', value: baht(totals.advance_outstanding) },
        { label: 'ยังไม่คืนยอด (บาท)', value: baht(totals.petty_committed) },
        { label: 'พร้อมอนุมัติ (บาท)', value: baht(totals.available) },
        { label: 'ติดลบ', value: negatives },
      ]} />

      {/* มือถือ: แถวซ้อน */}
      <ul className={`divide-y ${LINE} sm:hidden`}>
        {rows.map(r => (
          <li key={r.id} className="py-3">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="text-sm font-semibold text-ink-900">{r.branch_code} · {r.division_code}</p>
                <p className="truncate text-xs text-ink-500">{r.holder}{r.holder !== r.holder_employee_id && ` · ${r.holder_employee_id}`} · {r.is_active ? 'ใช้งาน' : 'ปิดแล้ว'}</p>
              </div>
              <p className={`shrink-0 font-display text-base font-semibold tabular-nums ${r.negative ? 'text-rose-700' : 'text-ink-900'}`}>{baht(r.available)}</p>
            </div>
            <p className="mt-1 text-xs tabular-nums text-ink-500">วงเงิน {baht(r.fund_limit)} · Advance {baht(r.advance_outstanding)} · ยังไม่คืน {r.petty_committed === null ? '-' : baht(r.petty_committed)}</p>
          </li>
        ))}
        {rows.length === 0 && <li className="py-10 text-center text-sm text-ink-500">ยังไม่มีกองทุน</li>}
      </ul>

      <div className="hidden overflow-x-auto sm:block">
        <table className="w-full text-sm">
          <thead className={`border-b ${LINE}`}>
            <tr>
              <th className={TH}>สาขา · ดิวิชัน</th>
              <th className={TH}>เจ้าของเงินสด</th>
              <th className={`${TH} text-right`}>วงเงิน</th>
              <th className={`${TH} text-right`}>Advance คงเหลือ</th>
              <th className={`${TH} text-right`}>ยังไม่คืนยอด</th>
              <th className={`${TH} text-right`}>พร้อมอนุมัติ</th>
              <th className={TH}>สถานะ</th>
            </tr>
          </thead>
          <tbody>
            {rows.map(r => (
              <tr key={r.id} className="border-b border-[#f3f6fa] text-ink-900 hover:bg-[#f9fbfd]">
                <td className="px-3 py-2.5">{r.branch_code} · {r.division_code}</td>
                <td className="px-3 py-2.5">{r.holder}{r.holder !== r.holder_employee_id && <span className="ml-1 text-xs text-ink-500">{r.holder_employee_id}</span>}</td>
                <td className="px-3 py-2.5 text-right tabular-nums text-ink-700">{baht(r.fund_limit)}</td>
                <td className="px-3 py-2.5 text-right tabular-nums">{baht(r.advance_outstanding)}</td>
                <td className="px-3 py-2.5 text-right tabular-nums">{r.petty_committed === null ? '-' : `− ${baht(r.petty_committed)}`}</td>
                <td className={`px-3 py-2.5 text-right font-semibold tabular-nums ${r.negative ? 'text-rose-700' : ''}`}>{baht(r.available)}</td>
                <td className="px-3 py-2.5 text-xs text-ink-500">{r.is_active ? 'ใช้งาน' : 'ปิดแล้ว'}</td>
              </tr>
            ))}
            {rows.length === 0 && <tr><td colSpan={7} className="py-10 text-center text-ink-500">ยังไม่มีกองทุน</td></tr>}
          </tbody>
          {rows.length > 0 && (
            <tfoot className={`border-t ${LINE} font-semibold text-ink-900`}>
              <tr>
                <td className="px-3 py-2.5" colSpan={3}>รวม {rows.length} กองทุน</td>
                <td className="px-3 py-2.5 text-right tabular-nums">{baht(totals.advance_outstanding)}</td>
                <td className="px-3 py-2.5 text-right tabular-nums">− {baht(totals.petty_committed)}</td>
                <td className="px-3 py-2.5 text-right tabular-nums">{baht(totals.available)}</td>
                <td />
              </tr>
            </tfoot>
          )}
        </table>
      </div>
      <p className="mt-4 text-xs text-ink-500">พร้อมอนุมัติ = Advance คงเหลือ − ใบที่อนุมัติแล้วแต่ยังไม่ทำจ่ายคืน · ติดลบได้ แต่ควรเร่งส่งเคลียร์</p>
    </PettyPage>
  );
}
