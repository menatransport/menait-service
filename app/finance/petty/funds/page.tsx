'use client';

import { useEffect, useState } from 'react';
import { Wallet } from 'lucide-react';
import { MascotLoader } from '@/components/loading';
import { useSessionContext } from '@/app/context/SessionContext';
import type { PettyBalance, PettyFund } from '@/app/finance/types-petty';
import { canSeeAllClaims } from '@/lib/finance/petty-access';
import { fundSummaryRows, grandTotals, type FundSummaryRow } from '@/lib/finance/petty-funds';
import { showAlert } from '../../api';
import { getBalance, getFunds } from '../../petty-api';
import { FinanceCanvas, FinanceHeading, Panel } from '../../components/FinanceShell';

const TITLE = 'ยอดกองทุนเงินสดย่อย';
const CAPTION = 'ทุกกองทุนในสายตาการเงิน — ยอด Advance คงเหลือ ใบที่ยังไม่คืนยอด และยอดที่พร้อมอนุมัติ';
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
      <FinanceCanvas title={TITLE}>
        <FinanceHeading icon={Wallet} title={TITLE} caption={CAPTION} />
        <Panel title="สิทธิ์การเข้าถึง"><p className="text-sm text-ink-600">หน้านี้สำหรับฝ่ายบัญชีและการเงิน</p></Panel>
      </FinanceCanvas>
    );
  }
  if (rows === null) return <MascotLoader />;
  const totals = grandTotals(rows);

  return (
    <FinanceCanvas title={TITLE}>
      <FinanceHeading icon={Wallet} title={TITLE} caption={CAPTION} />
      <Panel title="กองทุนทั้งหมด">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="text-left text-ink-500">
              <tr>
                <th className="py-2">สาขา · ดิวิชัน</th>
                <th className="py-2">เจ้าของเงินสด</th>
                <th className="py-2 text-right">วงเงิน</th>
                <th className="py-2 text-right">Advance คงเหลือ</th>
                <th className="py-2 text-right">ยังไม่คืนยอด</th>
                <th className="py-2 text-right">พร้อมอนุมัติ</th>
                <th className="py-2">สถานะ</th>
              </tr>
            </thead>
            <tbody>
              {rows.map(r => (
                <tr key={r.id} className={`border-t border-slate-100 ${r.negative ? 'bg-rose-50' : ''}`}>
                  <td className="py-2">{r.branch_code} · {r.division_code}</td>
                  <td className="py-2">{r.holder}{r.holder !== r.holder_employee_id && <span className="ml-1 text-xs text-ink-400">{r.holder_employee_id}</span>}</td>
                  <td className="py-2 text-right tabular-nums">{baht(r.fund_limit)}</td>
                  <td className="py-2 text-right tabular-nums">{baht(r.advance_outstanding)}</td>
                  <td className="py-2 text-right tabular-nums">{r.petty_committed === null ? '-' : `− ${baht(r.petty_committed)}`}</td>
                  <td className={`py-2 text-right tabular-nums font-medium ${r.negative ? 'text-rose-700' : ''}`}>{baht(r.available)}</td>
                  <td className="py-2 text-xs text-ink-500">{r.is_active ? 'ใช้งาน' : 'ปิดแล้ว'}</td>
                </tr>
              ))}
              {rows.length === 0 && <tr><td colSpan={7} className="py-6 text-center text-ink-400">ยังไม่มีกองทุน</td></tr>}
            </tbody>
            {rows.length > 0 && (
              <tfoot className="border-t border-slate-200 font-medium">
                <tr>
                  <td className="py-2" colSpan={3}>รวม {rows.length} กองทุน</td>
                  <td className="py-2 text-right tabular-nums">{baht(totals.advance_outstanding)}</td>
                  <td className="py-2 text-right tabular-nums">− {baht(totals.petty_committed)}</td>
                  <td className="py-2 text-right tabular-nums">{baht(totals.available)}</td>
                  <td />
                </tr>
              </tfoot>
            )}
          </table>
        </div>
        <p className="mt-3 text-xs text-ink-400">ยอดพร้อมอนุมัติ = Advance คงเหลือ − ใบที่อนุมัติจ่ายแล้วแต่การเงินยังไม่ทำจ่ายคืน · ติดลบได้ แต่ควรเร่งส่งเคลียร์เป็นรอบ</p>
      </Panel>
    </FinanceCanvas>
  );
}
