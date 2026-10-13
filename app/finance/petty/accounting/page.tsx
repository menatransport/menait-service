'use client';

import { useCallback, useEffect, useState } from 'react';
import { Landmark } from 'lucide-react';
import { MascotLoader } from '@/components/loading';
import { useSessionContext } from '@/app/context/SessionContext';
import type { PettyClaim, PettyExpenseType, PettyFund } from '@/app/finance/types-petty';
import { canReview } from '@/lib/finance/petty-access';
import { quickAction, type PettyTab } from '@/lib/finance/petty-list';
import { formatBaht } from '@/lib/finance/status';
import { showAlert } from '../../api';
import { getExpenseTypes, getFunds, listClaims } from '../../petty-api';
import { FinanceCanvas, FinanceHeading, NoAccess, SummaryTiles } from '../../components/FinanceShell';
import { CoverSheetButton } from '../../components/petty/CoverSheetButton';
import { PettyListView, RowButton } from '../../components/petty/PettyListView';
import { PettySheet } from '../../components/petty/PettySheet';
import { runPettyAction } from '../../components/petty/petty-actions';

const TITLE = 'งานบัญชี เงินสดย่อย';
const CAPTION = 'ตรวจเอกสารที่ผู้อนุมัติส่งมา — ผ่านหรือส่งกลับให้แก้ ได้จากตารางนี้';

const TABS: PettyTab[] = [
  { key: 'review', label: 'รอตรวจ', statuses: ['AWAITING_REVIEW'], reviewed: false },
  { key: 'passed', label: 'ผ่านแล้ว รอปิดรอบ', statuses: ['AWAITING_REVIEW'], reviewed: true },
  { key: 'sentback', label: 'ส่งกลับแก้ไข', statuses: ['SENT_BACK'] },
  { key: 'closed', label: 'คืนยอดแล้ว', statuses: ['CLOSED'] },
  { key: 'all', label: 'ทั้งหมด' },
];

export default function PettyAccountingPage() {
  const { user, loading } = useSessionContext();
  const [claims, setClaims] = useState<PettyClaim[] | null>(null);
  const [types, setTypes] = useState<PettyExpenseType[]>([]);
  const [funds, setFunds] = useState<PettyFund[]>([]);
  const [tab, setTab] = useState('review');
  const [busy, setBusy] = useState<string | null>(null);
  const [openId, setOpenId] = useState<string | null>(null);
  const [sheetOpen, setSheetOpen] = useState(false);
  const allowed = canReview(user);

  const load = useCallback(async () => {
    try {
      // บัญชีเห็นตั้งแต่ส่งบัญชีเป็นต้นไป: รอตรวจ ส่งกลับ ปิดแล้ว
      const [a, b, c, t, f] = await Promise.all([
        listClaims({ view: 'all', status: 'AWAITING_REVIEW', limit: '200' }),
        listClaims({ view: 'all', status: 'SENT_BACK', limit: '200' }),
        listClaims({ view: 'all', status: 'CLOSED', limit: '200' }),
        getExpenseTypes(), getFunds(true),
      ]);
      setClaims([...a.items, ...b.items, ...c.items]); setTypes(t); setFunds(f);
    } catch (err) {
      setClaims([]);
      showAlert({ icon: 'error', title: 'โหลดคิวไม่สำเร็จ', text: (err as Error).message });
    }
  }, []);
  useEffect(() => { if (allowed) void load(); }, [allowed, load]);

  async function review(claim: PettyClaim, pass: boolean) {
    setBusy(claim.form_id);
    try {
      const changed = await runPettyAction(claim, 'review', { pass });
      if (changed) await load();
    } finally { setBusy(null); }
  }

  if (loading) return <MascotLoader />;
  if (!allowed) return <NoAccess text="หน้านี้สำหรับฝ่ายบัญชีเท่านั้น" />;
  if (claims === null) return <MascotLoader />;

  const waiting = claims.filter(c => c.status === 'AWAITING_REVIEW' && !c.reviewed_at);
  const passed = claims.filter(c => c.status === 'AWAITING_REVIEW' && c.reviewed_at);
  const stats = [
    { label: 'รอตรวจ', value: waiting.length },
    { label: 'ยอดรอตรวจ (บาท)', value: formatBaht(waiting.reduce((s, c) => s + c.amount, 0)) },
    { label: 'ผ่านแล้ว รอปิดรอบ', value: passed.length },
    { label: 'ส่งกลับแก้ไข', value: claims.filter(c => c.status === 'SENT_BACK').length, alert: true },
    { label: 'ยังไม่มีเลข DD', value: waiting.filter(c => !c.dd_no).length, alert: true, hint: 'ในคิวรอตรวจ' },
  ];

  const rowAction = (c: PettyClaim) => {
    const q = quickAction(c, 'accounting');
    if (!q) return null;
    const isBusy = busy === c.form_id;
    return (
      <>
        <RowButton onClick={() => void review(c, true)} disabled={isBusy}>{isBusy ? 'กำลังทำ…' : 'ผ่าน'}</RowButton>
        <RowButton tone="ghost" onClick={() => void review(c, false)} disabled={isBusy}>ส่งกลับ</RowButton>
      </>
    );
  };

  return (
    <FinanceCanvas title={TITLE}>
      <FinanceHeading icon={Landmark} title={TITLE} caption={CAPTION} />
      <SummaryTiles items={stats} />
      <PettyListView claims={claims} types={types} funds={funds} tabs={TABS} activeTab={tab} onTabChange={setTab}
        onOpen={c => { setOpenId(c.form_id); setSheetOpen(true); }} exportFileBase="เงินสดย่อย-บัญชี"
        rowAction={rowAction}
        rowNote={c => (c.status === 'AWAITING_REVIEW' && !c.reviewed_at && !c.dd_no ? 'ไม่มี DD' : null)}
        headerAction={<CoverSheetButton claims={waiting} types={types} funds={funds} />} />
      <PettySheet formId={openId} isOpen={sheetOpen} onClose={() => setSheetOpen(false)} onChanged={() => void load()} />
    </FinanceCanvas>
  );
}
