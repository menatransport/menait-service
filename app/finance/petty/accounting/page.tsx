'use client';

import { Suspense, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { Landmark, Wallet } from 'lucide-react';
import { MascotLoader } from '@/components/loading';
import { useSessionContext } from '@/app/context/SessionContext';
import type { PettyClaim, PettyExpenseType, PettyFund, PettyRound } from '@/app/finance/types-petty';
import { canSeePettyWorklist, worklistPerms } from '@/lib/finance/petty-access';
import { filterByType, filterRoundsByType, roundTypeHint, typeRoundColumns } from '@/lib/finance/petty-type-filter';
import {
  WORKLIST_ROUND_STATUSES, defaultTab, resolveTab, worklistStats, type WorklistCtx, type WorklistTabKey,
} from '@/lib/finance/petty-worklist';
import { showAlert } from '../../api';
import { getExpenseTypes, getFunds, listAllClaims, listRounds } from '../../petty-api';
import { FinanceCanvas, FinanceHeading, NoAccess, SummaryTiles } from '../../components/FinanceShell';
import { PettySheet } from '../../components/petty/PettySheet';
import { TypeFilter, usePettyTypeFilter } from '../../components/petty/TypeFilter';
import { useRoundTypeTally } from '../../components/petty/useRoundTypeTally';
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
  const typeFilter = usePettyTypeFilter(types);
  const typeCode = typeFilter.code;
  // ใบในรอบที่ผ่านบัญชีแล้ว (ตรวจผ่าน/ปิดแล้ว) — โหลดเมื่อกรองประเภทเท่านั้น ไว้รู้ว่ารอบไหนมีใบประเภทนั้น
  const [loadGen, setLoadGen] = useState(0);
  const [roundClaims, setRoundClaims] = useState<PettyClaim[]>([]);
  const [roundClaimsBusy, setRoundClaimsBusy] = useState(false);
  const roundClaimsGen = useRef(-1);

  // แถบเริ่มต้น: ?tab= จากลิงก์ (เช่น /finance/petty/batches → รอจ่าย) ไม่มีก็ตามแผนก
  useEffect(() => {
    if (loading || tab !== null) return;
    setTab(resolveTab(searchParams.get('tab'), defaultTab(perms)));
  }, [loading, tab, searchParams, perms]);

  const load = useCallback(async () => {
    setBusy(true);
    try {
      const [a, b, r, t, f] = await Promise.all([
        listAllClaims({ view: 'all', status: 'AWAITING_REVIEW' }),
        listAllClaims({ view: 'all', status: 'SENT_BACK' }),
        listRounds('all', undefined, 200),
        getExpenseTypes(), getFunds(true),
      ]);
      setClaims([...a.items, ...b.items]); setRounds(r); setTypes(t); setFunds(f);
      setLoadGen(g => g + 1);
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

  const wantRoundClaims = typeCode !== '' && loadGen > 0;
  useEffect(() => {
    if (!wantRoundClaims || roundClaimsGen.current === loadGen) return;
    const gen = loadGen;
    roundClaimsGen.current = gen;
    setRoundClaimsBusy(true);
    Promise.all([listAllClaims({ view: 'all', status: 'REVIEWED' }), listAllClaims({ view: 'all', status: 'CLOSED' })])
      .then(([x, y]) => { if (roundClaimsGen.current === gen) setRoundClaims([...x.items, ...y.items]); })
      .catch(err => {
        roundClaimsGen.current = -1;
        showAlert({ icon: 'error', title: 'โหลดใบในรอบไม่สำเร็จ', text: (err as Error).message });
      })
      .finally(() => { if (roundClaimsGen.current === gen || roundClaimsGen.current === -1) setRoundClaimsBusy(false); });
  }, [wantRoundClaims, loadGen]);

  // รอบที่หน้านี้โชว์ (ถึงบัญชีแล้ว) — รอบที่ยังอยู่กับหัวหน้าไม่ต้องนับประเภท
  const workRounds = useMemo(() => rounds.filter(r => WORKLIST_ROUND_STATUSES.includes(r.status)), [rounds]);
  const knownClaims = useMemo(() => [...claims, ...roundClaims], [claims, roundClaims]);
  const { tally, loading: tallyBusy } = useRoundTypeTally(knownClaims, workRounds, wantRoundClaims && !roundClaimsBusy, 30);
  const shownClaims = useMemo(() => filterByType(claims, typeCode), [claims, typeCode]);
  const shownRounds = useMemo(() => filterRoundsByType(workRounds, typeCode, tally), [workRounds, typeCode, tally]);
  const typeBusy = typeCode !== '' && (roundClaimsBusy || tallyBusy);

  // ตัวเลขสรุปและตัวเลขบนแถบนับตามประเภทที่เลือก · ยอดของรอบยังเป็นยอดทั้งรอบ
  const stats = useMemo(() => worklistStats(shownClaims, shownRounds, types), [shownClaims, shownRounds, types]);
  const roundNote = useCallback((r: PettyRound) => roundTypeHint(r, typeCode, tally, ctx.typeName), [typeCode, tally, ctx]);
  const exportRoundColumns = useMemo(() => typeRoundColumns(typeCode, ctx.typeName, tally), [typeCode, ctx, tally]);

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
      {typeCode && (
        <p className="text-xs text-white/85">
          เห็นเฉพาะ{typeFilter.name} · แถบที่เป็นรอบ โชว์รอบที่มีใบ{typeFilter.name}อยู่ด้วย ยอดเงินยังเป็นยอดทั้งรอบ
        </p>
      )}
      {tab !== null && (
        <WorklistTable claims={shownClaims} rounds={shownRounds} ctx={ctx} activeTab={tab} onTabChange={setTab}
          loading={busy || loading || typeBusy}
          onOpenClaim={c => openClaim(c.form_id)} onOpenRound={openRound}
          filters={<TypeFilter types={types} value={typeCode} onChange={typeFilter.setCode} onCanvas />}
          roundNote={roundNote} exportRoundColumns={exportRoundColumns} exportTag={typeCode || undefined} />
      )}

      <PettySheet formId={open?.kind === 'claim' ? open.formId : null} isOpen={sheetOpen && open?.kind === 'claim'}
        onClose={() => setSheetOpen(false)} onChanged={() => void load()} onOpenRound={openRoundById} />
      <RoundSheet round={open?.kind === 'round' ? { id: open.id, batch_no: open.batch_no } : null}
        isOpen={sheetOpen && open?.kind === 'round'} onClose={() => setSheetOpen(false)} onChanged={() => void load()}
        onOpenClaim={c => openClaim(c.form_id)} />
    </FinanceCanvas>
  );
}
