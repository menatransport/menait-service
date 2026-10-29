'use client';

import { useCallback, useEffect, useState } from 'react';
import { BadgeCheck } from 'lucide-react';
import { MascotLoader } from '@/components/loading';
import { useSessionContext } from '@/app/context/SessionContext';
import type { PettyBalance, PettyClaim, PettyExpenseType, PettyFund, PettyRound } from '@/app/finance/types-petty';
import { ApiError } from '@/lib/finance/api-error';
import { quickAction, type PettyTab } from '@/lib/finance/petty-list';
import { fundLabel } from '@/lib/finance/petty-fund-label';
import { formatBaht } from '@/lib/finance/status';
import { showAlert, showConfirm } from '../../api';
import { countAttachments, createRound, getBalance, getExpenseTypes, getFunds, getRound, listClaims, listRounds } from '../../petty-api';
import { FinanceCanvas, FinanceHeading, Panel, SummaryTiles } from '../../components/FinanceShell';
import { PettyListView, RowButton } from '../../components/petty/PettyListView';
import { PettySheet } from '../../components/petty/PettySheet';
import { runPettyAction } from '../../components/petty/petty-actions';
import { RoundTable } from '../../components/petty/RoundTable';
import { printRoundCover } from '../../components/petty/round-actions';

const TITLE = 'อนุมัติเบิกเงินสดย่อย';
const CAPTION = 'ใบของวงเงินที่คุณถือ — อนุมัติจ่าย แล้วติ๊กหลายใบส่งเคลียร์เป็นรอบให้หัวหน้าอนุมัติ';

const TABS: PettyTab[] = [
  { key: 'pending', label: 'รออนุมัติจ่าย', statuses: ['PENDING_APPROVAL'] },
  { key: 'clear', label: 'รอส่งเคลียร์', statuses: ['APPROVED'] },
  { key: 'head', label: 'รอหัวหน้าอนุมัติ', statuses: ['CLEAR_PENDING'] },
  { key: 'acc', label: 'อยู่ที่บัญชี', statuses: ['AWAITING_REVIEW', 'REVIEWED'] },
  { key: 'sentback', label: 'บัญชีตีกลับ', statuses: ['SENT_BACK'] },
  { key: 'returned', label: 'ตีกลับผู้เบิก', statuses: ['RETURNED'] },
  { key: 'closed', label: 'ปิดแล้ว', statuses: ['CLOSED'] },
  { key: 'all', label: 'ทั้งหมด' },
];

const usesDd = (spec: PettyExpenseType['spec'] | undefined) => (spec?.prints ?? []).includes('DD');

export default function PettyApprovalsPage() {
  const { user, loading } = useSessionContext();
  const [funds, setFunds] = useState<PettyFund[] | null>(null);
  const [fundId, setFundId] = useState<number | null>(null);
  const [balance, setBalance] = useState<PettyBalance | null>(null);
  const [claims, setClaims] = useState<PettyClaim[] | null>(null);
  const [rounds, setRounds] = useState<PettyRound[]>([]);
  const [types, setTypes] = useState<PettyExpenseType[]>([]);
  const [tab, setTab] = useState('pending');
  const [busy, setBusy] = useState<string | null>(null);
  const [ready, setReady] = useState<Record<string, boolean>>({});
  const [selected, setSelected] = useState<number[]>([]);
  const [openId, setOpenId] = useState<string | null>(null);
  const [sheetOpen, setSheetOpen] = useState(false);

  // ลิงก์ "ไปส่งเคลียร์เป็นรอบ" จากหน้าใบส่ง ?tab=clear มา (อ่านเองแทน useSearchParams จะได้ไม่ต้องห่อ Suspense)
  useEffect(() => {
    const want = new URLSearchParams(window.location.search).get('tab');
    if (want && TABS.some(t => t.key === want)) setTab(want);
  }, []);

  const load = useCallback(async () => {
    try {
      const [f, page, t, r] = await Promise.all([
        getFunds(), listClaims({ view: 'approvals', limit: '200' }), getExpenseTypes(), listRounds('mine'),
      ]);
      const mine = f.filter(x => x.holder_employee_id === user?.employee_id);
      setFunds(mine); setClaims(page.items); setTypes(t); setRounds(r);
      setFundId(id => id ?? mine[0]?.id ?? null);
    } catch (err) {
      setFunds([]); setClaims([]);
      showAlert({ icon: 'error', title: 'โหลดคิวไม่สำเร็จ', text: (err as Error).message });
    }
  }, [user?.employee_id]);
  useEffect(() => { if (user?.employee_id) void load(); }, [user?.employee_id, load]);
  useEffect(() => { if (fundId) getBalance(fundId).then(setBalance).catch(() => setBalance(null)); }, [fundId, claims]);
  useEffect(() => { setSelected([]); }, [fundId, tab]);

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

  const specOf = (c: PettyClaim) => types.find(t => t.code === c.expense_type)?.spec;

  async function act(claim: PettyClaim, action: 'approve' | 'return' | 'dd') {
    setBusy(claim.form_id);
    try {
      if (await runPettyAction(claim, action, { spec: specOf(claim) })) await load();
    } finally { setBusy(null); }
  }

  const ofFund = (claims ?? []).filter(c => c.fund_id === fundId);
  const pick = ofFund.filter(c => c.status === 'APPROVED' && selected.includes(c.id));
  const sum = pick.reduce((s, c) => s + c.amount, 0);

  async function sendRound() {
    if (!fundId || pick.length === 0) return;
    const res = await showConfirm({ title: 'ส่งเคลียร์เป็นรอบ',
      text: `${pick.length} ใบ รวม ${formatBaht(sum)} บาท · ส่งให้ผู้จัดการตามสายงานอนุมัติเคลียร์ แล้วไปบัญชีตรวจ`,
      confirmButtonText: 'ส่งเคลียร์' }) as { isConfirmed?: boolean };
    if (!res?.isConfirmed) return;
    setBusy('round');
    try {
      const attachments: Record<string, Record<string, number>> = {};
      for (const c of pick) attachments[c.form_id] = await countAttachments(c.form_id);
      const round = await createRound({ fund_id: fundId, claim_ids: pick.map(c => c.id), attachments });
      setSelected([]);
      await load();
      const again = await showConfirm({ icon: 'success', title: `ส่งรอบ ${round.batch_no} แล้ว`,
        text: 'พิมพ์ใบปะหน้าแนบไปกับเอกสารตัวจริงเลยไหม', confirmButtonText: 'พิมพ์ใบปะหน้า', cancelButtonText: 'ไว้ทีหลัง' }) as { isConfirmed?: boolean };
      if (again?.isConfirmed) printRoundCover(round.claims ? round : await getRound(round.id), types, funds ?? []);
    } catch (err) {
      const api = err instanceof ApiError ? err : null;
      const bad = Array.isArray(api?.body?.claims) ? api!.body!.claims as { form_id: string; missing: { label?: string; key?: string }[] }[] : [];
      const lines = bad.map(b => `• ${b.form_id}: ขาด ${b.missing.map(m => m.label ?? m.key).join(', ')}`);
      showAlert({ icon: 'error', title: api?.message ?? 'ส่งเคลียร์ไม่สำเร็จ', text: lines.length ? lines.join('\n') : (err as Error).message });
    } finally { setBusy(null); }
  }

  if (loading || funds === null || claims === null) return <MascotLoader />;
  if (funds.length === 0) {
    return (
      <FinanceCanvas title={TITLE}>
        <FinanceHeading icon={BadgeCheck} title={TITLE} caption={CAPTION} />
        <Panel title="ไม่มีวงเงินสดย่อยที่คุณถือ">
          <p className="text-sm text-ink-600">หน้านี้สำหรับเจ้าของเงินสดย่อย ถ้าควรเห็น ให้ผู้ดูแลระบบตั้งวงเงินให้ชื่อคุณ</p>
        </Panel>
      </FinanceCanvas>
    );
  }

  const count = (...s: PettyClaim['status'][]) => ofFund.filter(c => s.includes(c.status)).length;
  const stats = [
    { label: 'พร้อมอนุมัติ (บาท)', value: balance ? formatBaht(balance.available) : '-', alert: !!balance && balance.available < 0,
      hint: balance ? `Advance ${formatBaht(balance.advance_outstanding)} − ยังไม่คืน ${formatBaht(balance.petty_committed)}` : undefined },
    { label: 'รออนุมัติจ่าย', value: count('PENDING_APPROVAL') },
    { label: 'รอส่งเคลียร์', value: count('APPROVED') },
    { label: 'รอหัวหน้าอนุมัติ', value: count('CLEAR_PENDING') },
    { label: 'บัญชีตีกลับ', value: count('SENT_BACK'), alert: true },
  ];

  const rowAction = (c: PettyClaim) => {
    const isBusy = busy === c.form_id;
    if (c.status === 'APPROVED' && usesDd(specOf(c))) {
      return <RowButton tone={c.dd_no ? 'ghost' : 'primary'} onClick={() => void act(c, 'dd')} disabled={isBusy}>{c.dd_no ? 'แก้ DD' : 'ใส่ DD'}</RowButton>;
    }
    const q = quickAction(c, 'holder');
    if (!q) return null;
    const notReady = q.action === 'approve' && ready[c.form_id] === false;
    return (
      <>
        <RowButton onClick={() => void act(c, 'approve')} disabled={isBusy || notReady}
          title={notReady ? 'เอกสารยังไม่ครบ — เปิดใบเพื่อดูว่าขาดอะไร' : undefined}>
          {isBusy ? 'กำลังทำ…' : q.label}
        </RowButton>
        <RowButton tone="ghost" onClick={() => void act(c, 'return')} disabled={isBusy}>ตีกลับ</RowButton>
      </>
    );
  };

  const rowNote = (c: PettyClaim) => {
    if (c.status === 'PENDING_APPROVAL') return ready[c.form_id] === true ? 'เอกสารครบ' : ready[c.form_id] === false ? 'เอกสารไม่ครบ' : null;
    if (c.status === 'APPROVED' && usesDd(specOf(c)) && !c.dd_no) return 'ยังไม่มี DD';
    return null;
  };

  return (
    <FinanceCanvas title={TITLE}>
      <FinanceHeading icon={BadgeCheck} title={TITLE} caption={CAPTION} />
      <SummaryTiles items={stats} />
      <PettyListView claims={ofFund} types={types} funds={funds} tabs={TABS} activeTab={tab} onTabChange={setTab}
        onOpen={c => { setOpenId(c.form_id); setSheetOpen(true); }} exportFileBase="เงินสดย่อย-อนุมัติ"
        rowAction={rowAction} rowNote={rowNote}
        selectable={tab === 'clear'} selected={selected} onSelect={setSelected}
        footer={tab === 'clear' ? (
          <span className="flex flex-wrap items-center gap-3 text-sm">
            <span>เลือก {pick.length} ใบ · รวม <strong className="tabular-nums">{formatBaht(sum)}</strong> บาท</span>
            <button type="button" disabled={busy !== null || pick.length === 0} onClick={() => void sendRound()}
              className="rounded-lg bg-brand-600 px-4 py-2 text-sm font-medium text-white disabled:opacity-40">
              {busy === 'round' ? 'กำลังส่ง…' : 'ส่งเคลียร์เป็นรอบ'}
            </button>
          </span>
        ) : undefined}
        filters={funds.length > 1 ? (
          <select value={fundId ?? ''} onChange={e => setFundId(Number(e.target.value))}
            className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-sm">
            {funds.map(f => <option key={f.id} value={f.id}>{fundLabel(f)}</option>)}
          </select>
        ) : undefined} />

      <div className="mt-6">
        <Panel title="รอบที่ส่งเคลียร์แล้ว">
          <RoundTable rounds={rounds.filter(r => r.fund_id === fundId)} emptyText="ยังไม่เคยส่งรอบ" />
        </Panel>
      </div>
      <PettySheet formId={openId} isOpen={sheetOpen} onClose={() => setSheetOpen(false)} onChanged={() => void load()} />
    </FinanceCanvas>
  );
}
