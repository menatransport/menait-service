'use client';

import { useCallback, useEffect, useState } from 'react';
import { Landmark } from 'lucide-react';
import { MascotLoader } from '@/components/loading';
import { useSessionContext } from '@/app/context/SessionContext';
import type { PettyClaim, PettyExpenseType, PettyFund, PettyRound } from '@/app/finance/types-petty';
import { canReview } from '@/lib/finance/petty-access';
import { quickAction, type PettyTab } from '@/lib/finance/petty-list';
import { formatBaht } from '@/lib/finance/status';
import { showAlert } from '../../api';
import { getExpenseTypes, getFunds, listClaims, listRounds } from '../../petty-api';
import { FinanceCanvas, FinanceHeading, NoAccess, Panel, SummaryTiles } from '../../components/FinanceShell';
import { PettyListView, RowButton } from '../../components/petty/PettyListView';
import { PettySheet } from '../../components/petty/PettySheet';
import { runPettyAction } from '../../components/petty/petty-actions';
import { RoundTable, type RoundTab } from '../../components/petty/RoundTable';
import { runRoundAction } from '../../components/petty/round-actions';

const TITLE = 'งานบัญชี เงินสดย่อย';
const CAPTION = 'รอบที่หัวหน้าอนุมัติเคลียร์แล้ว — ตรวจทีละใบ ผ่านครบทั้งรอบแล้วตั้งเบิก ใบที่ตีกลับไปให้เจ้าหน้าที่แก้แล้วส่งกลับมาที่นี่';

const ROUND_TABS: RoundTab[] = [
  { key: 'review', label: 'รอตรวจ', statuses: ['AWAITING_REVIEW'] },
  { key: 'voucher', label: 'รอตั้งเบิก', statuses: ['REVIEWED'] },
  { key: 'paying', label: 'ตั้งเบิกแล้ว รอทำจ่าย', statuses: ['VOUCHERED'] },
  { key: 'closed', label: 'ปิดแล้ว', statuses: ['CLOSED'] },
  { key: 'all', label: 'ทั้งหมด' },
];

const CLAIM_TABS: PettyTab[] = [
  { key: 'review', label: 'รอตรวจ', statuses: ['AWAITING_REVIEW'] },
  { key: 'sentback', label: 'ตีกลับ รอเจ้าหน้าที่แก้', statuses: ['SENT_BACK'] },
  { key: 'passed', label: 'ตรวจผ่าน', statuses: ['REVIEWED'] },
  { key: 'all', label: 'ทั้งหมด' },
];

export default function PettyAccountingPage() {
  const { user, loading } = useSessionContext();
  const [rounds, setRounds] = useState<PettyRound[] | null>(null);
  const [claims, setClaims] = useState<PettyClaim[]>([]);
  const [types, setTypes] = useState<PettyExpenseType[]>([]);
  const [funds, setFunds] = useState<PettyFund[]>([]);
  const [roundTab, setRoundTab] = useState('review');
  const [claimTab, setClaimTab] = useState('review');
  const [busy, setBusy] = useState<string | null>(null);
  const [openId, setOpenId] = useState<string | null>(null);
  const [sheetOpen, setSheetOpen] = useState(false);
  const allowed = canReview(user);

  const load = useCallback(async () => {
    try {
      const [r, a, b, c, t, f] = await Promise.all([
        listRounds('all'),
        listClaims({ view: 'all', status: 'AWAITING_REVIEW', limit: '200' }),
        listClaims({ view: 'all', status: 'SENT_BACK', limit: '200' }),
        listClaims({ view: 'all', status: 'REVIEWED', limit: '200' }),
        getExpenseTypes(), getFunds(true),
      ]);
      // รอบที่ยังอยู่กับหัวหน้า / หัวหน้าไม่อนุมัติ ยังไม่ใช่งานบัญชี
      setRounds(r.filter(x => x.status !== 'CLEAR_PENDING' && x.status !== 'CLEAR_REJECTED'));
      setClaims([...a.items, ...b.items, ...c.items]); setTypes(t); setFunds(f);
    } catch (err) {
      setRounds([]);
      showAlert({ icon: 'error', title: 'โหลดคิวไม่สำเร็จ', text: (err as Error).message });
    }
  }, []);
  useEffect(() => { if (allowed) void load(); }, [allowed, load]);

  async function review(claim: PettyClaim, pass: boolean) {
    setBusy(claim.form_id);
    try { if (await runPettyAction(claim, 'review', { pass })) await load(); } finally { setBusy(null); }
  }

  async function voucher(round: PettyRound) {
    setBusy(`r${round.id}`);
    try { if (await runRoundAction(round, 'voucher')) await load(); } finally { setBusy(null); }
  }

  if (loading) return <MascotLoader />;
  if (!allowed) return <NoAccess text="หน้านี้สำหรับฝ่ายบัญชีเท่านั้น" />;
  if (rounds === null) return <MascotLoader />;

  const waiting = claims.filter(c => c.status === 'AWAITING_REVIEW');
  const toVoucher = rounds.filter(r => r.status === 'REVIEWED');
  const stats = [
    { label: 'รอบรอตรวจ', value: rounds.filter(r => r.status === 'AWAITING_REVIEW').length },
    { label: 'ใบรอตรวจ', value: waiting.length, hint: `${formatBaht(waiting.reduce((s, c) => s + c.amount, 0))} บาท` },
    { label: 'รอบรอตั้งเบิก', value: toVoucher.length, hint: `${formatBaht(toVoucher.reduce((s, r) => s + r.total_amount, 0))} บาท` },
    { label: 'ตีกลับ รอเจ้าหน้าที่แก้', value: claims.filter(c => c.status === 'SENT_BACK').length, alert: true },
    { label: 'ยังไม่มีเลข DD', value: waiting.filter(c => !c.dd_no).length, alert: true, hint: 'ในใบรอตรวจ' },
  ];

  const claimAction = (c: PettyClaim) => {
    if (!quickAction(c, 'accounting')) return null;
    const isBusy = busy === c.form_id;
    return (
      <>
        <RowButton onClick={() => void review(c, true)} disabled={isBusy}>{isBusy ? 'กำลังทำ…' : 'ผ่าน'}</RowButton>
        <RowButton tone="ghost" onClick={() => void review(c, false)} disabled={isBusy}>ตีกลับ</RowButton>
      </>
    );
  };

  return (
    <FinanceCanvas title={TITLE}>
      <FinanceHeading icon={Landmark} title={TITLE} caption={CAPTION} />
      <SummaryTiles items={stats} />
      <Panel title="รอบส่งเคลียร์">
        <RoundTable rounds={rounds} tabs={ROUND_TABS} activeTab={roundTab} onTabChange={setRoundTab}
          emptyText="ไม่มีรอบในแท็บนี้"
          rowAction={r => (r.status === 'REVIEWED'
            ? <RowButton onClick={() => void voucher(r)} disabled={busy === `r${r.id}`}>{busy === `r${r.id}` ? 'กำลังทำ…' : 'ตั้งเบิก'}</RowButton>
            : null)} />
      </Panel>
      <div className="mt-6">
        <PettyListView claims={claims} types={types} funds={funds} tabs={CLAIM_TABS} activeTab={claimTab} onTabChange={setClaimTab}
          onOpen={c => { setOpenId(c.form_id); setSheetOpen(true); }} exportFileBase="เงินสดย่อย-บัญชี"
          rowAction={claimAction}
          rowNote={c => (c.status === 'AWAITING_REVIEW' && !c.dd_no ? 'ไม่มี DD' : null)} />
      </div>
      <PettySheet formId={openId} isOpen={sheetOpen} onClose={() => setSheetOpen(false)} onChanged={() => void load()} />
    </FinanceCanvas>
  );
}
