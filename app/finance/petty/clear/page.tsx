'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { UserCheck } from 'lucide-react';
import { MascotLoader } from '@/components/loading';
import { useSessionContext } from '@/app/context/SessionContext';
import type { PettyRound } from '@/app/finance/types-petty';
import { formatBaht } from '@/lib/finance/status';
import { showAlert } from '../../api';
import { listRounds } from '../../petty-api';
import { FinanceCanvas, FinanceHeading, SummaryTiles } from '../../components/FinanceShell';
import { RowButton } from '../../components/petty/PettyListView';
import { RoundTable } from '../../components/petty/RoundTable';
import { runRoundAction } from '../../components/petty/round-actions';

const TITLE = 'อนุมัติเคลียร์เงินสดย่อย';
const CAPTION = 'รอบที่เจ้าของเงินสดในสายงานของคุณส่งมา เปิดดูใบและเอกสารได้ แล้วอนุมัติหรือไม่อนุมัติทั้งรอบ';

/** คิวของหัวหน้า (ผู้จัดการตามสายงานของเจ้าของเงินสด) — BE คัดให้เฉพาะรอบที่คนนี้กดได้ */
export default function PettyClearPage() {
  const { user, loading } = useSessionContext();
  const [rounds, setRounds] = useState<PettyRound[] | null>(null);
  const [busy, setBusy] = useState<number | null>(null);

  const load = useCallback(async () => {
    try {
      setRounds(await listRounds('clear'));
    } catch (err) {
      setRounds([]);
      showAlert({ icon: 'error', title: 'โหลดคิวไม่สำเร็จ', text: (err as Error).message });
    }
  }, []);
  useEffect(() => { if (user?.employee_id) void load(); }, [user?.employee_id, load]);

  async function act(round: PettyRound, action: 'clear-approve' | 'clear-reject') {
    setBusy(round.id);
    try { if (await runRoundAction(round, action)) await load(); } finally { setBusy(null); }
  }

  if (loading || rounds === null) return <MascotLoader />;

  const stats = [
    { label: 'รอบรออนุมัติเคลียร์', value: rounds.length },
    { label: 'ยอดรวม (บาท)', value: formatBaht(rounds.reduce((s, r) => s + r.total_amount, 0)) },
    { label: 'ใบทั้งหมด', value: rounds.reduce((s, r) => s + (r.claim_count ?? 0), 0) },
  ];

  return (
    <FinanceCanvas title={TITLE}>
      <FinanceHeading icon={UserCheck} title={TITLE} caption={CAPTION} />
      <SummaryTiles items={stats} />
      <RoundTable rounds={rounds} emptyText="ไม่มีรอบที่รอคุณอนุมัติเคลียร์"
        rowAction={r => (
          <>
            <Link href={`/finance/petty/rounds/${r.id}`} className="rounded-lg border border-slate-200 px-2.5 py-1 text-xs font-medium text-ink-700 hover:bg-slate-50">
              เปิดดู
            </Link>
            <RowButton onClick={() => void act(r, 'clear-approve')} disabled={busy === r.id}>
              {busy === r.id ? 'กำลังทำ…' : 'อนุมัติเคลียร์'}
            </RowButton>
            <RowButton tone="ghost" onClick={() => void act(r, 'clear-reject')} disabled={busy === r.id}>ไม่อนุมัติ</RowButton>
          </>
        )} />
    </FinanceCanvas>
  );
}
