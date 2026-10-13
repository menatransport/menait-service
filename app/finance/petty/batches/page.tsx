'use client';

import { useCallback, useEffect, useState } from 'react';
import { Wallet } from 'lucide-react';
import { MascotLoader } from '@/components/loading';
import { useSessionContext } from '@/app/context/SessionContext';
import { canCloseBatch } from '@/lib/finance/petty-access';
import type { PettyClaim, PettyExpenseType, PettyFund } from '@/app/finance/types-petty';
import type { PettyTab } from '@/lib/finance/petty-list';
import { fundLabel, fundLabelWithHolder } from '@/lib/finance/petty-fund-label';
import { formatBaht } from '@/lib/finance/status';
import { fetchJson, showAlert, showConfirm } from '../../api';
import { closeBatch, getExpenseTypes, getFunds, listClaims } from '../../petty-api';
import { FinanceCanvas, FinanceHeading, NoAccess, Panel, SummaryTiles } from '../../components/FinanceShell';
import { PettyListView } from '../../components/petty/PettyListView';
import { PettySheet } from '../../components/petty/PettySheet';

const TITLE = 'ปิดรอบคืนยอดเงินสดย่อย';
const CAPTION = 'ติ๊กใบที่บัญชีตรวจผ่านแล้ว กดปิดรอบ ยอดจะคืนเข้าวงเงินของผู้อนุมัติ';

type Batch = { id: number; batch_no: string; fund_id: number; total_amount: number; closed_by: string | null; closed_at: string; remark: string | null };

const TABS: PettyTab[] = [
  { key: 'ready', label: 'พร้อมปิดรอบ', statuses: ['AWAITING_REVIEW'], reviewed: true },
  { key: 'waiting', label: 'บัญชียังไม่ตรวจ', statuses: ['AWAITING_REVIEW'], reviewed: false },
  { key: 'closed', label: 'คืนยอดแล้ว', statuses: ['CLOSED'] },
];

export default function PettyBatchesPage() {
  const { user, loading } = useSessionContext();
  const [funds, setFunds] = useState<PettyFund[]>([]);
  const [fundId, setFundId] = useState<number | null>(null);
  const [claims, setClaims] = useState<PettyClaim[] | null>(null);
  const [types, setTypes] = useState<PettyExpenseType[]>([]);
  const [selected, setSelected] = useState<number[]>([]);
  const [batches, setBatches] = useState<Batch[]>([]);
  const [tab, setTab] = useState('ready');
  const [busy, setBusy] = useState(false);
  const [openId, setOpenId] = useState<string | null>(null);
  const [sheetOpen, setSheetOpen] = useState(false);
  const allowed = canCloseBatch(user);

  const load = useCallback(async () => {
    try {
      const [f, a, c, t, b] = await Promise.all([
        getFunds(true),
        listClaims({ view: 'all', status: 'AWAITING_REVIEW', limit: '200' }),
        listClaims({ view: 'all', status: 'CLOSED', limit: '200' }),
        getExpenseTypes(),
        fetchJson<Batch[]>('/api/finance/petty/batches'),
      ]);
      setFunds(f); setClaims([...a.items, ...c.items]); setTypes(t); setBatches(b);
      // เริ่มที่กองทุนที่มีใบพร้อมปิดรอบมากสุด ไม่ใช่กองทุนแรกในรายการ
      const weight = (fundId: number) => a.items.filter(x => x.fund_id === fundId).reduce((n, x) => n + (x.reviewed_at ? 2 : 1), 0);
      const best = [...f].sort((x, y) => weight(y.id) - weight(x.id))[0];
      setFundId(id => id ?? best?.id ?? null);
    } catch (err) {
      setClaims([]);
      showAlert({ icon: 'error', title: 'โหลดข้อมูลไม่สำเร็จ', text: (err as Error).message });
    }
  }, []);
  useEffect(() => { if (allowed) void load(); }, [allowed, load]);
  useEffect(() => { setSelected([]); }, [fundId, tab]);

  const ofFund = (claims ?? []).filter(c => c.fund_id === fundId);
  const ready = ofFund.filter(c => c.status === 'AWAITING_REVIEW' && c.reviewed_at);
  const pick = ready.filter(c => selected.includes(c.id));
  const sum = pick.reduce((s, c) => s + c.amount, 0);

  async function close() {
    if (!fundId || pick.length === 0) return;
    const res = await showConfirm({ title: 'ปิดรอบและคืนยอด',
      text: `ปิด ${pick.length} ใบ รวม ${formatBaht(sum)} บาท — ยอดนี้จะคืนเข้ายอดคงเหลือของผู้อนุมัติ`, confirmButtonText: 'ปิดรอบ' }) as { isConfirmed?: boolean };
    if (!res?.isConfirmed) return;
    setBusy(true);
    try {
      const batch = await closeBatch({ fund_id: fundId, claim_ids: pick.map(c => c.id) });
      showAlert({ icon: 'success', title: `ปิดรอบ ${batch.batch_no} แล้ว`, text: `คืนยอด ${formatBaht(batch.total_amount)} บาท` });
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

  const fund = funds.find(f => f.id === fundId);
  const stats = [
    { label: 'พร้อมปิดรอบ', value: ready.length, hint: fund ? fundLabel(fund) : undefined },
    { label: 'ยอดพร้อมคืน (บาท)', value: formatBaht(ready.reduce((s, c) => s + c.amount, 0)) },
    { label: 'บัญชียังไม่ตรวจ', value: ofFund.filter(c => c.status === 'AWAITING_REVIEW' && !c.reviewed_at).length },
    { label: 'รอบที่ปิดแล้ว', value: batches.filter(b => b.fund_id === fundId).length },
  ];

  return (
    <FinanceCanvas title={TITLE}>
      <FinanceHeading icon={Wallet} title={TITLE} caption={CAPTION} />
      <SummaryTiles items={stats} />
      <PettyListView claims={ofFund} types={types} funds={funds} tabs={TABS} activeTab={tab} onTabChange={setTab}
        onOpen={c => { setOpenId(c.form_id); setSheetOpen(true); }} exportFileBase="เงินสดย่อย-ปิดรอบ"
        selectable={tab === 'ready'} selected={selected} onSelect={setSelected}
        filters={(
          <select value={fundId ?? ''} onChange={e => setFundId(Number(e.target.value))}
            className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-sm">
            {funds.map(f => <option key={f.id} value={f.id}>{fundLabelWithHolder(f)}</option>)}
          </select>
        )}
        footer={tab === 'ready' ? (
          <span className="flex flex-wrap items-center gap-3 text-sm">
            <span>เลือก {pick.length} ใบ · รวม <strong className="tabular-nums">{formatBaht(sum)}</strong> บาท</span>
            <button type="button" disabled={busy || pick.length === 0} onClick={() => void close()}
              className="rounded-lg bg-brand-600 px-4 py-2 text-sm font-medium text-white disabled:opacity-40">
              {busy ? 'กำลังปิดรอบ…' : 'ปิดรอบและคืนยอด'}
            </button>
          </span>
        ) : undefined} />

      <div className="mt-6">
        <Panel title="ประวัติรอบ">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="text-left text-ink-500">
                <tr><th className="px-2 py-2">รอบที่</th><th className="px-2 py-2">วงเงินสดย่อย</th><th className="px-2 py-2 text-right">ยอดคืน</th><th className="px-2 py-2">ปิดโดย</th><th className="px-2 py-2">เมื่อ</th></tr>
              </thead>
              <tbody>
                {batches.map(b => {
                  const f = funds.find(x => x.id === b.fund_id);
                  return (
                    <tr key={b.id} className="border-t border-slate-100">
                      <td className="px-2 py-2 font-medium text-brand-800">{b.batch_no}</td>
                      <td className="px-2 py-2">{f ? `${f.branch_code} · ${f.division_code}` : b.fund_id}</td>
                      <td className="px-2 py-2 text-right tabular-nums">{formatBaht(b.total_amount)}</td>
                      <td className="px-2 py-2">{b.closed_by ?? '-'}</td>
                      <td className="px-2 py-2">{new Date(b.closed_at).toLocaleString('th-TH')}</td>
                    </tr>
                  );
                })}
                {batches.length === 0 && <tr><td colSpan={5} className="py-6 text-center text-ink-400">ยังไม่มีรอบที่ปิด</td></tr>}
              </tbody>
            </table>
          </div>
        </Panel>
      </div>
      <PettySheet formId={openId} isOpen={sheetOpen} onClose={() => setSheetOpen(false)} onChanged={() => void load()} />
    </FinanceCanvas>
  );
}
