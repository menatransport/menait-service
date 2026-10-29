'use client';

import { Suspense, useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { Landmark, Wallet } from 'lucide-react';
import { MascotLoader } from '@/components/loading';
import { useSessionContext } from '@/app/context/SessionContext';
import type { PettyClaim, PettyExpenseType, PettyFund, PettyRound } from '@/app/finance/types-petty';
import { canSeePettyWorklist, worklistPerms } from '@/lib/finance/petty-access';
import { defaultTab, resolveTab, worklistStats, type WorklistCtx, type WorklistTabKey } from '@/lib/finance/petty-worklist';
import { showAlert } from '../../api';
import { getExpenseTypes, getFunds, listClaims, listRounds } from '../../petty-api';
import { FinanceCanvas, FinanceHeading, NoAccess, SummaryTiles } from '../../components/FinanceShell';
import { PettySheet } from '../../components/petty/PettySheet';
import { RoundSheet } from '../../components/petty/worklist/RoundSheet';
import { WorklistTable } from '../../components/petty/worklist/WorklistTable';

const TITLE = 'งานเงินสดย่อย';

type Open = { kind: 'claim'; formId: string } | { kind: 'round'; id: number; batch_no: string } | null;

/**
 * งานเงินสดย่อย — หน้าเดียวของบัญชีและการเงิน แบบ "งานเบิกเงิน Advance" (/finance)
 * ตัวเลขสรุป → แถบตามสถานะ → ตารางเดียว → คลิกแถวเปิดแผงด้านข้าง · ซ่อนปุ่มตามแผนก ด่านจริงอยู่ที่ BE
 */
export default function PettyWorkPage() {
  return (
    <Suspense fallback={<MascotLoader />}>
      <PettyWork />
    </Suspense>
  );
}

function PettyWork() {
  const { user, loading } = useSessionContext();
  const searchParams = useSearchParams();
  const allowed = canSeePettyWorklist(user);
  const perms = worklistPerms(user);
  const [tab, setTab] = useState<WorklistTabKey | null>(null);
  const [claims, setClaims] = useState<PettyClaim[]>([]);
  const [rounds, setRounds] = useState<PettyRound[]>([]);
  const [types, setTypes] = useState<PettyExpenseType[]>([]);
  const [funds, setFunds] = useState<PettyFund[]>([]);
  const [busy, setBusy] = useState(true);
  const [open, setOpen] = useState<Open>(null);
  const [sheetOpen, setSheetOpen] = useState(false);

  // แถบเริ่มต้น: ?tab= จากลิงก์ (เช่น /finance/petty/batches → รอจ่าย) ไม่มีก็ตามแผนก
  useEffect(() => {
    if (loading || tab !== null) return;
    setTab(resolveTab(searchParams.get('tab'), defaultTab(perms)));
  }, [loading, tab, searchParams, perms]);

  const load = useCallback(async () => {
    setBusy(true);
    try {
      const [a, b, r, t, f] = await Promise.all([
        listClaims({ view: 'all', status: 'AWAITING_REVIEW', limit: '200' }),
        listClaims({ view: 'all', status: 'SENT_BACK', limit: '200' }),
        listRounds('all', undefined, 200),
        getExpenseTypes(), getFunds(true),
      ]);
      setClaims([...a.items, ...b.items]); setRounds(r); setTypes(t); setFunds(f);
    } catch (err) {
      showAlert({ icon: 'error', title: 'โหลดข้อมูลไม่สำเร็จ', text: (err as Error).message });
    } finally {
      setBusy(false);
    }
  }, []);
  useEffect(() => { if (allowed) void load(); }, [allowed, load]);

  const ctx = useMemo<WorklistCtx>(() => {
    const roundNos = new Map(rounds.map(r => [r.id, r.batch_no]));
    return {
      typeName: code => types.find(t => t.code === code)?.name_th ?? code,
      fundOf: id => funds.find(f => f.id === id),
      roundNo: id => (id === null ? null : roundNos.get(id) ?? null),
    };
  }, [rounds, types, funds]);

  const stats = useMemo(() => worklistStats(claims, rounds, types), [claims, rounds, types]);

  const openClaim = (formId: string) => { setOpen({ kind: 'claim', formId }); setSheetOpen(true); };
  const openRound = (round: { id: number; batch_no: string }) => { setOpen({ kind: 'round', id: round.id, batch_no: round.batch_no }); setSheetOpen(true); };
  const openRoundById = (id: number) => openRound({ id, batch_no: rounds.find(r => r.id === id)?.batch_no ?? '' });

  if (!loading && !allowed) {
    return (
      <FinanceCanvas title={TITLE} width="max-w-lg">
        <NoAccess text="หน้านี้สำหรับฝ่ายบัญชีและการเงิน" />
      </FinanceCanvas>
    );
  }

  return (
    <FinanceCanvas title={TITLE}>
      <FinanceHeading icon={Landmark} title={TITLE} caption="ตรวจใบ ตั้งเบิก และจ่ายเงินคืนเจ้าของเงินสด"
        actions={(
          <Link href="/finance/petty/funds" className="v2-glass inline-flex items-center gap-2 rounded-xl px-4 py-2 text-sm font-medium text-ink-900 transition-shadow hover:shadow-md">
            <Wallet className="size-4" />
            ยอดกองทุนเงินสดย่อย
          </Link>
        )}
      />
      <SummaryTiles items={stats} />
      {tab !== null && (
        <WorklistTable claims={claims} rounds={rounds} ctx={ctx} activeTab={tab} onTabChange={setTab} loading={busy || loading}
          onOpenClaim={c => openClaim(c.form_id)} onOpenRound={openRound} />
      )}

      <PettySheet formId={open?.kind === 'claim' ? open.formId : null} isOpen={sheetOpen && open?.kind === 'claim'}
        onClose={() => setSheetOpen(false)} onChanged={() => void load()} onOpenRound={openRoundById} />
      <RoundSheet round={open?.kind === 'round' ? { id: open.id, batch_no: open.batch_no } : null}
        isOpen={sheetOpen && open?.kind === 'round'} onClose={() => setSheetOpen(false)} onChanged={() => void load()}
        onOpenClaim={c => openClaim(c.form_id)} />
    </FinanceCanvas>
  );
}
