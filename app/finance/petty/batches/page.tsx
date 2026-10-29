'use client';

import { useCallback, useEffect, useState } from 'react';
import { Wallet } from 'lucide-react';
import { MascotLoader } from '@/components/loading';
import { useSessionContext } from '@/app/context/SessionContext';
import type { PettyRound } from '@/app/finance/types-petty';
import { canCloseBatch } from '@/lib/finance/petty-access';
import { formatBaht } from '@/lib/finance/status';
import { showAlert } from '../../api';
import { listRounds } from '../../petty-api';
import { FinanceCanvas, FinanceHeading, NoAccess, SummaryTiles } from '../../components/FinanceShell';
import { RowButton } from '../../components/petty/PettyListView';
import { RoundTable, type RoundTab } from '../../components/petty/RoundTable';
import { runRoundAction } from '../../components/petty/round-actions';

const TITLE = 'ทำจ่ายเงินสดย่อย';
const CAPTION = 'รอบที่บัญชีตั้งเบิกแล้ว — ทำจ่ายคืนเจ้าของเงินสด แล้วรอบปิดพร้อมทุกใบ ยอดคืนเข้าวงเงินเอง';

const TABS: RoundTab[] = [
  { key: 'paying', label: 'รอทำจ่าย', statuses: ['VOUCHERED'] },
  { key: 'voucher', label: 'รอบัญชีตั้งเบิก', statuses: ['REVIEWED'] },
  { key: 'closed', label: 'จ่ายแล้ว', statuses: ['CLOSED'] },
];

export default function PettyPayPage() {
  const { user, loading } = useSessionContext();
  const [rounds, setRounds] = useState<PettyRound[] | null>(null);
  const [tab, setTab] = useState('paying');
  const [busy, setBusy] = useState<number | null>(null);
  const allowed = canCloseBatch(user);

  const load = useCallback(async () => {
    try {
      setRounds(await listRounds('all', 'REVIEWED,VOUCHERED,CLOSED'));
    } catch (err) {
      setRounds([]);
      showAlert({ icon: 'error', title: 'โหลดข้อมูลไม่สำเร็จ', text: (err as Error).message });
    }
  }, []);
  useEffect(() => { if (allowed) void load(); }, [allowed, load]);

  async function pay(round: PettyRound) {
    setBusy(round.id);
    try { if (await runRoundAction(round, 'pay')) await load(); } finally { setBusy(null); }
  }

  if (loading) return <MascotLoader />;
  if (!allowed) return <NoAccess text="หน้านี้สำหรับฝ่ายการเงินเท่านั้น" />;
  if (rounds === null) return <MascotLoader />;

  const paying = rounds.filter(r => r.status === 'VOUCHERED');
  const stats = [
    { label: 'รอบรอทำจ่าย', value: paying.length },
    { label: 'ยอดรอทำจ่าย (บาท)', value: formatBaht(paying.reduce((s, r) => s + r.total_amount, 0)) },
    { label: 'รอบัญชีตั้งเบิก', value: rounds.filter(r => r.status === 'REVIEWED').length },
    { label: 'จ่ายแล้ว', value: rounds.filter(r => r.status === 'CLOSED').length },
  ];

  return (
    <FinanceCanvas title={TITLE}>
      <FinanceHeading icon={Wallet} title={TITLE} caption={CAPTION} />
      <SummaryTiles items={stats} />
      <RoundTable rounds={rounds} tabs={TABS} activeTab={tab} onTabChange={setTab} emptyText="ไม่มีรอบในแท็บนี้"
        rowAction={r => (r.status === 'VOUCHERED'
          ? <RowButton onClick={() => void pay(r)} disabled={busy === r.id}>{busy === r.id ? 'กำลังทำ…' : 'ทำจ่าย'}</RowButton>
          : null)} />
    </FinanceCanvas>
  );
}
