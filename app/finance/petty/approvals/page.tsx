'use client';

import { useCallback, useEffect, useState } from 'react';
import { BadgeCheck } from 'lucide-react';
import { MascotLoader } from '@/components/loading';
import { useSessionContext } from '@/app/context/SessionContext';
import type { PettyBalance, PettyClaim, PettyExpenseType, PettyFund } from '@/app/finance/types-petty';
import { quickAction, type PettyTab } from '@/lib/finance/petty-list';
import { fundLabel } from '@/lib/finance/petty-fund-label';
import { formatBaht } from '@/lib/finance/status';
import { showAlert } from '../../api';
import { countAttachments, getBalance, getExpenseTypes, getFunds, listClaims } from '../../petty-api';
import { FinanceCanvas, FinanceHeading, Panel, SummaryTiles } from '../../components/FinanceShell';
import { PettyListView, RowButton } from '../../components/petty/PettyListView';
import { PettySheet } from '../../components/petty/PettySheet';
import { runPettyAction } from '../../components/petty/petty-actions';

const TITLE = 'อนุมัติเบิกเงินสดย่อย';
const CAPTION = 'ใบของวงเงินที่คุณถือ — อนุมัติ บันทึกการโอน และส่งบัญชี ได้จากตารางนี้';

const TABS: PettyTab[] = [
  { key: 'pending', label: 'รออนุมัติ', statuses: ['PENDING_APPROVAL'] },
  { key: 'transfer', label: 'รอโอน', statuses: ['APPROVED'] },
  { key: 'submit', label: 'รอส่งบัญชี', statuses: ['TRANSFERRED'] },
  { key: 'sentback', label: 'บัญชีส่งกลับ', statuses: ['SENT_BACK'] },
  { key: 'returned', label: 'ตีกลับผู้เบิก', statuses: ['RETURNED'] },
  { key: 'review', label: 'อยู่ที่บัญชี', statuses: ['AWAITING_REVIEW'] },
  { key: 'closed', label: 'คืนยอดแล้ว', statuses: ['CLOSED'] },
  { key: 'all', label: 'ทั้งหมด' },
];

export default function PettyApprovalsPage() {
  const { user, loading } = useSessionContext();
  const [funds, setFunds] = useState<PettyFund[] | null>(null);
  const [fundId, setFundId] = useState<number | null>(null);
  const [balance, setBalance] = useState<PettyBalance | null>(null);
  const [claims, setClaims] = useState<PettyClaim[] | null>(null);
  const [types, setTypes] = useState<PettyExpenseType[]>([]);
  const [tab, setTab] = useState('pending');
  const [busy, setBusy] = useState<string | null>(null);
  const [ready, setReady] = useState<Record<string, boolean>>({});
  const [openId, setOpenId] = useState<string | null>(null);
  const [sheetOpen, setSheetOpen] = useState(false);

  const load = useCallback(async () => {
    try {
      const [f, page, t] = await Promise.all([getFunds(), listClaims({ view: 'approvals', limit: '200' }), getExpenseTypes()]);
      const mine = f.filter(x => x.holder_employee_id === user?.employee_id);
      setFunds(mine); setClaims(page.items); setTypes(t);
      setFundId(id => id ?? mine[0]?.id ?? null);
    } catch (err) {
      setFunds([]); setClaims([]);
      showAlert({ icon: 'error', title: 'โหลดคิวไม่สำเร็จ', text: (err as Error).message });
    }
  }, [user?.employee_id]);
  useEffect(() => { if (user?.employee_id) void load(); }, [user?.employee_id, load]);
  useEffect(() => { if (fundId) getBalance(fundId).then(setBalance).catch(() => setBalance(null)); }, [fundId, claims]);

  // ป้าย "เอกสารครบ" ในแถวรออนุมัติ — นับไฟล์แนบเทียบ spec (ด่านจริงอยู่ที่ BE ตอนกด)
  useEffect(() => {
    const pending = (claims ?? []).filter(c => c.fund_id === fundId && c.status === 'PENDING_APPROVAL');
    let alive = true;
    (async () => {
      const next: Record<string, boolean> = {};
      for (const c of pending) {
        const spec = types.find(t => t.code === c.expense_type)?.spec;
        const counts = await countAttachments(c.form_id);
        next[c.form_id] = (spec?.attachments ?? []).every(a => !a.required || (counts[a.key] ?? 0) > 0);
      }
      if (alive) setReady(next);
    })();
    return () => { alive = false; };
  }, [claims, fundId, types]);

  async function act(claim: PettyClaim, action: 'approve' | 'return' | 'transfer' | 'submit-accounting') {
    setBusy(claim.form_id);
    try {
      const changed = await runPettyAction(claim, action, { spec: types.find(t => t.code === claim.expense_type)?.spec });
      if (changed) await load();
    } finally { setBusy(null); }
  }

  if (loading || funds === null || claims === null) return <MascotLoader />;
  if (funds.length === 0) {
    return (
      <FinanceCanvas title={TITLE}>
        <FinanceHeading icon={BadgeCheck} title={TITLE} caption={CAPTION} />
        <Panel title="ไม่มีวงเงินสดย่อยที่คุณถือ">
          <p className="text-sm text-ink-600">หน้านี้สำหรับผู้ถือเงินสดย่อย ถ้าควรเห็น ให้ผู้ดูแลระบบตั้งวงเงินให้ชื่อคุณ</p>
        </Panel>
      </FinanceCanvas>
    );
  }

  const ofFund = claims.filter(c => c.fund_id === fundId);
  const count = (...s: PettyClaim['status'][]) => ofFund.filter(c => s.includes(c.status)).length;
  const stats = [
    { label: 'พร้อมอนุมัติ (บาท)', value: balance ? formatBaht(balance.available) : '-', alert: !!balance && balance.available < 0,
      hint: balance ? `Advance ${formatBaht(balance.advance_outstanding)} − ยังไม่คืน ${formatBaht(balance.petty_committed)}` : undefined },
    { label: 'รออนุมัติ', value: count('PENDING_APPROVAL') },
    { label: 'รอโอน', value: count('APPROVED') },
    { label: 'รอส่งบัญชี', value: count('TRANSFERRED') },
    { label: 'บัญชีส่งกลับ', value: count('SENT_BACK'), alert: true },
  ];

  const rowAction = (c: PettyClaim) => {
    const q = quickAction(c, 'holder');
    if (!q) return null;
    const isBusy = busy === c.form_id;
    const notReady = q.action === 'approve' && ready[c.form_id] === false;
    return (
      <>
        <RowButton onClick={() => void act(c, q.action as never)} disabled={isBusy || notReady}
          title={notReady ? 'เอกสารยังไม่ครบ — เปิดใบเพื่อดูว่าขาดอะไร' : undefined}>
          {isBusy ? 'กำลังทำ…' : q.label}
        </RowButton>
        {q.action === 'approve' && <RowButton tone="ghost" onClick={() => void act(c, 'return')} disabled={isBusy}>ตีกลับ</RowButton>}
      </>
    );
  };

  return (
    <FinanceCanvas title={TITLE}>
      <FinanceHeading icon={BadgeCheck} title={TITLE} caption={CAPTION} />
      <SummaryTiles items={stats} />
      <PettyListView claims={ofFund} types={types} funds={funds} tabs={TABS} activeTab={tab} onTabChange={setTab}
        onOpen={c => { setOpenId(c.form_id); setSheetOpen(true); }} exportFileBase="เงินสดย่อย-อนุมัติ"
        rowAction={rowAction}
        rowNote={c => (c.status === 'PENDING_APPROVAL' ? (ready[c.form_id] === true ? 'เอกสารครบ' : ready[c.form_id] === false ? 'เอกสารไม่ครบ' : null) : null)}
        filters={funds.length > 1 ? (
          <select value={fundId ?? ''} onChange={e => setFundId(Number(e.target.value))}
            className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-sm">
            {funds.map(f => <option key={f.id} value={f.id}>{fundLabel(f)}</option>)}
          </select>
        ) : undefined} />
      <PettySheet formId={openId} isOpen={sheetOpen} onClose={() => setSheetOpen(false)} onChanged={() => void load()} />
    </FinanceCanvas>
  );
}
