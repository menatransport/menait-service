'use client';

import { useCallback, useEffect, useState } from 'react';
import { Wallet } from 'lucide-react';
import { MascotLoader } from '@/components/loading';
import { useSessionContext } from '@/app/context/SessionContext';
import { canCloseBatch } from '@/lib/finance/petty-access';
import type { PettyClaim, PettyExpenseType, PettyFund } from '@/app/finance/types-petty';
import { fetchJson, showAlert, showConfirm } from '../../api';
import { closeBatch, getExpenseTypes, getFunds, listClaims } from '../../petty-api';
import { FinanceCanvas, FinanceHeading, NoAccess, Panel } from '../../components/FinanceShell';
import { ClaimTable } from '../../components/petty/ClaimTable';

const TITLE = 'ปิดรอบคืนยอดเงินสดย่อย';
const CAPTION = 'เลือกใบที่บัญชีตรวจผ่านแล้ว แล้วปิดรอบเพื่อคืนยอดให้ผู้อนุมัติ';

type Batch = { id: number; batch_no: string; fund_id: number; total_amount: number; closed_by: string | null; closed_at: string; remark: string | null };

export default function PettyBatchesPage() {
  const { user, loading } = useSessionContext();
  const [funds, setFunds] = useState<PettyFund[]>([]);
  const [fundId, setFundId] = useState<number | null>(null);
  const [claims, setClaims] = useState<PettyClaim[] | null>(null);
  const [types, setTypes] = useState<PettyExpenseType[]>([]);
  const [selected, setSelected] = useState<number[]>([]);
  const [batches, setBatches] = useState<Batch[]>([]);
  const [busy, setBusy] = useState(false);

  const allowed = canCloseBatch(user);

  const load = useCallback(async () => {
    try {
      const [f, page, t, b] = await Promise.all([
        getFunds(),
        listClaims({ view: 'all', status: 'AWAITING_REVIEW', limit: '200' }),
        getExpenseTypes(),
        fetchJson<Batch[]>('/api/finance/petty/batches'),
      ]);
      setFunds(f); setClaims(page.items); setTypes(t); setBatches(b);
      if (f.length && fundId === null) setFundId(f[0].id);
    } catch (err) {
      setClaims([]);
      showAlert({ icon: 'error', title: 'โหลดข้อมูลไม่สำเร็จ', text: (err as Error).message });
    }
  }, [fundId]);

  useEffect(() => { if (allowed) void load(); }, [allowed, load]);
  useEffect(() => { setSelected([]); }, [fundId]);

  // บัญชีกด "ผ่าน" แล้วใบจะมี reviewed_at — การเงินปิดรอบได้เฉพาะใบที่ผ่านแล้ว
  const ready = (claims ?? []).filter(c => c.fund_id === fundId && c.reviewed_at !== null);
  const pick = ready.filter(c => selected.includes(c.id));
  const sum = pick.reduce((s, c) => s + c.amount, 0);

  async function close() {
    if (!fundId || pick.length === 0) return;
    const res = await showConfirm({
      title: 'ปิดรอบและคืนยอด',
      text: `ปิด ${pick.length} ใบ รวม ${sum.toLocaleString('th-TH', { minimumFractionDigits: 2 })} บาท — ยอดนี้จะคืนเข้ายอดคงเหลือของผู้อนุมัติ`,
      confirmButtonText: 'ปิดรอบ',
    }) as { isConfirmed?: boolean };
    if (!res?.isConfirmed) return;
    setBusy(true);
    try {
      const batch = await closeBatch({ fund_id: fundId, claim_ids: pick.map(c => c.id) });
      showAlert({ icon: 'success', title: `ปิดรอบ ${batch.batch_no} แล้ว`,
        text: `คืนยอด ${batch.total_amount.toLocaleString('th-TH', { minimumFractionDigits: 2 })} บาท` });
      setSelected([]);
      await load();
    } catch (err) {
      showAlert({ icon: 'error', title: 'ปิดรอบไม่สำเร็จ', text: (err as Error).message });
      await load();
    } finally { setBusy(false); }
  }

  if (loading) return <MascotLoader />;
  if (!allowed) return <NoAccess text="หน้านี้สำหรับฝ่ายการเงินเท่านั้น" />;
  if (claims === null) return <MascotLoader />;

  return (
    <FinanceCanvas title={TITLE}>
      <FinanceHeading icon={Wallet} title={TITLE} caption={CAPTION} />

      <div className="mb-3">
        <label className="text-sm">กองทุน
          <select value={fundId ?? ''} onChange={e => setFundId(Number(e.target.value))}
            className="ml-2 rounded-lg border border-slate-200 px-2 py-1.5">
            {funds.map(f => <option key={f.id} value={f.id}>สาขา {f.branch_code} · {f.division_code}</option>)}
          </select>
        </label>
      </div>

      <Panel title={`ใบที่พร้อมปิดรอบ (${ready.length})`}>
        <ClaimTable claims={ready} types={types} selectable selected={selected} onSelect={setSelected} />
        <div className="mt-3 flex flex-wrap items-center justify-between gap-2 rounded-lg bg-slate-50 px-3 py-2">
          <span className="text-sm">
            เลือก {pick.length} ใบ · รวม{' '}
            <strong className="tabular-nums">{sum.toLocaleString('th-TH', { minimumFractionDigits: 2 })}</strong> บาท
          </span>
          <button type="button" disabled={busy || pick.length === 0} onClick={() => void close()}
            className="rounded-lg bg-brand-600 px-4 py-2 text-sm text-white disabled:opacity-40">
            {busy ? 'กำลังปิดรอบ…' : 'ปิดรอบและคืนยอด'}
          </button>
        </div>
      </Panel>

      <Panel title="ประวัติรอบ">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="text-left text-ink-500">
              <tr><th className="py-2">รอบที่</th><th className="py-2 text-right">ยอดคืน</th>
                <th className="py-2">ปิดโดย</th><th className="py-2">เมื่อ</th></tr>
            </thead>
            <tbody>
              {batches.map(b => (
                <tr key={b.id} className="border-t border-slate-100">
                  <td className="py-2">{b.batch_no}</td>
                  <td className="py-2 text-right tabular-nums">
                    {b.total_amount.toLocaleString('th-TH', { minimumFractionDigits: 2 })}
                  </td>
                  <td className="py-2">{b.closed_by ?? '-'}</td>
                  <td className="py-2">{new Date(b.closed_at).toLocaleString('th-TH')}</td>
                </tr>
              ))}
              {batches.length === 0 && (
                <tr><td colSpan={4} className="py-6 text-center text-ink-400">ยังไม่มีรอบที่ปิด</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </Panel>
    </FinanceCanvas>
  );
}
