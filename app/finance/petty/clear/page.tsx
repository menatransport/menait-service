'use client';

import { Suspense, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { ClipboardCheck } from 'lucide-react';
import { MascotLoader } from '@/components/loading';
import { PaginationControls } from '@/components/pagination-controls';
import { useSessionContext } from '@/app/context/SessionContext';
import type { PettyClaim, PettyExpenseType } from '@/app/finance/types-petty';
import { pageCount, paginate } from '@/lib/finance/petty-list';
import { filterRoundsByType, roundTypeHint } from '@/lib/finance/petty-type-filter';
import { showAlert } from '../../api';
import { getExpenseTypes, listRounds } from '../../petty-api';
import { FinanceHeading, FinanceShell, Panel } from '../../components/FinanceShell';
import { TypeFilter, usePettyTypeFilter } from '../../components/petty/TypeFilter';
import { useRoundTypeTally } from '../../components/petty/useRoundTypeTally';
import { RoundCard } from '../../components/petty/approvals/RoundCard';
import { decideRound, listClearHistory } from '../../components/petty/approvals/clear-actions';
import {
  clearedByMe, locateRound, parseHeadView, splitByPrimary, tabLabel, type ClearRound, type HeadView, type SubTab,
} from '../../components/petty/approvals/model';
import { EmptyState, HeaderTabs, HintLine, NoticeBar, SubTabs } from '../../components/petty/approvals/ui';

const TITLE = 'อนุมัติเคลียร์เงินสดย่อย';
const CAPTION = 'รอบที่เจ้าของเงินสดในสายงานของคุณส่งมา อนุมัติแล้วรอบไปให้บัญชีตรวจต่อ';
const PAGE_SIZE = 20;
const NO_ROUNDS: ClearRound[] = [];
const NO_CLAIMS: PettyClaim[] = [];

function Loading() {
  return (
    <FinanceShell title={TITLE}>
      <FinanceHeading icon={ClipboardCheck} title={TITLE} caption={CAPTION} />
      <Panel title="รอบรออนุมัติเคลียร์"><div className="py-8"><MascotLoader text="กำลังโหลดรายการ" size={80} /></div></Panel>
    </FinanceShell>
  );
}

/**
 * คิวของหัวหน้า (ผู้จัดการตามสายงานของเจ้าของเงินสด) — วางแบบแถบรออนุมัติเคลียร์ของ Advance
 * แต่การ์ดหนึ่งใบ = หนึ่งรอบ · BE คัดให้เฉพาะรอบที่คนนี้กดได้ · is_primary แยก รอฉันอนุมัติ / อนุมัติแทนได้
 */
function PettyClear() {
  const { user, loading } = useSessionContext();
  const params = useSearchParams();
  const doc = params.get('doc');
  const me = user?.employee_id;
  const [view, setView] = useState<HeadView>(() => parseHeadView(params.get('tab')));
  const [subTab, setSubTab] = useState<SubTab>('mine');
  const [rounds, setRounds] = useState<ClearRound[] | null>(null);
  const [history, setHistory] = useState<ClearRound[] | null>(null);
  const [historyPage, setHistoryPage] = useState(1);
  const [busy, setBusy] = useState<number | null>(null);
  const [notice, setNotice] = useState('');
  const handledDoc = useRef<string | null>(null);
  const [types, setTypes] = useState<PettyExpenseType[]>([]);
  const typeFilter = usePettyTypeFilter(types);
  const typeCode = typeFilter.code;
  useEffect(() => { getExpenseTypes().then(setTypes).catch(() => setTypes([])); }, []);

  // รายการรอบไม่มีใบติดมา — กรองประเภทเมื่อไรค่อยขอรายละเอียดรอบมานับ (คิวหัวหน้าไม่ยาว)
  const pendingTally = useRoundTypeTally(NO_CLAIMS, rounds ?? NO_ROUNDS, typeCode !== '', 200);
  const historyTally = useRoundTypeTally(NO_CLAIMS, history ?? NO_ROUNDS, typeCode !== '' && view === 'history', 200);
  const roundsT = useMemo(() => filterRoundsByType(rounds ?? NO_ROUNDS, typeCode, pendingTally.tally), [rounds, typeCode, pendingTally.tally]);
  const historyT = useMemo(() => filterRoundsByType(history ?? NO_ROUNDS, typeCode, historyTally.tally), [history, typeCode, historyTally.tally]);
  const typeNameOf = (code: string) => types.find(t => t.code === code)?.name_th ?? code;
  useEffect(() => { setHistoryPage(1); }, [typeCode]);

  const load = useCallback(async () => {
    try {
      setRounds(await listRounds('clear') as ClearRound[]);
    } catch (err) {
      setRounds(r => r ?? []);
      showAlert({ icon: 'error', title: 'โหลดคิวไม่สำเร็จ', text: (err as Error).message });
    }
  }, []);
  const loadHistory = useCallback(async () => {
    // กรองคนกดอีกชั้นเสมอ — ถ้า BFF ยังไม่รู้จัก view นี้ จะได้แถบว่าง ไม่ใช่รอบของคนอื่น
    try { setHistory(clearedByMe(await listClearHistory() as ClearRound[], me)); } catch { setHistory([]); }
  }, [me]);
  useEffect(() => { if (me) void load(); }, [me, load]);
  useEffect(() => { if (me && view === 'history') void loadHistory(); }, [me, view, loadHistory]);

  // ลิงก์ ?doc=<id หรือเลขรอบ>: เปิดแถบย่อยที่รอบอยู่แล้วเลื่อนไปหา
  useEffect(() => {
    if (!doc || rounds === null || handledDoc.current === doc) return;
    handledDoc.current = doc;
    const hit = locateRound(doc, rounds);
    if (!hit) { setNotice(`รอบ ${doc} ไม่อยู่ในคิวอนุมัติเคลียร์ของคุณแล้ว อาจมีคนอนุมัติหรือไม่อนุมัติไปก่อน`); return; }
    setView('pending');
    setSubTab(hit.sub);
    setTimeout(() => document.getElementById(`rnd-${hit.id}`)?.scrollIntoView({ behavior: 'smooth', block: 'center' }), 150);
  }, [doc, rounds]);

  async function decide(round: ClearRound, action: 'clear-approve' | 'clear-reject') {
    setBusy(round.id);
    try {
      const out = await decideRound(round, action);
      if (out !== 'cancelled') { await load(); setHistory(null); } // พลาดก็โหลดใหม่ รอบอาจถูกคนอื่นกดไปแล้ว
    } finally { setBusy(null); }
  }

  if (loading || rounds === null) return <Loading />;

  const { mine, delegable } = splitByPrimary(roundsT);
  const typeName = typeFilter.name;
  const pendingBusy = pendingTally.loading;
  const historyBusy = historyTally.loading;
  const typeSelect = <TypeFilter types={types} value={typeCode} onChange={typeFilter.setCode} compact />;
  const shownRaw = subTab === 'mine' ? mine : delegable;
  const isDoc = (r: ClearRound) => !!doc && (r.batch_no === doc || String(r.id) === doc);
  const shown = doc ? [...shownRaw].sort((a, b) => Number(isDoc(b)) - Number(isDoc(a))) : shownRaw;

  return (
    <FinanceShell title={TITLE}>
      <FinanceHeading
        icon={ClipboardCheck}
        title={TITLE}
        caption={CAPTION}
        actions={
          <HeaderTabs value={view} onChange={v => { setView(v); setHistoryPage(1); }} tabs={[
            ['pending', tabLabel('รออนุมัติเคลียร์', roundsT.length)],
            ['history', 'อนุมัติ/ไม่อนุมัติแล้ว'],
          ]} />
        }
      />
      <NoticeBar text={notice} onClose={() => setNotice('')} />

      {view === 'pending' ? (
        <Panel title="รอบรออนุมัติเคลียร์" actions={typeSelect}>
          <SubTabs value={subTab} onChange={setSubTab} tabs={[
            ['mine', `รอฉันอนุมัติ (${mine.length})`],
            ['delegable', `อนุมัติแทนได้ (${delegable.length})`],
          ]} />
          {typeCode && (
            <HintLine>เห็นเฉพาะรอบที่มีใบ{typeName}อยู่ด้วย กดอนุมัติหรือไม่อนุมัติ มีผลกับทุกใบในรอบ</HintLine>
          )}
          {pendingBusy ? (
            <div className="py-8"><MascotLoader text="กำลังดูว่ารอบไหนมีใบประเภทนี้" size={80} /></div>
          ) : shown.length === 0 ? (
            <EmptyState text={typeCode
              ? `ไม่มีรอบที่มีใบ${typeName}${subTab === 'mine' ? 'รอคุณอนุมัติเคลียร์' : 'ที่อนุมัติแทนได้'}`
              : (subTab === 'mine' ? 'ไม่มีรอบที่รอคุณอนุมัติเคลียร์' : 'ไม่มีรอบที่อนุมัติแทนได้')} />
          ) : (
            <div className="space-y-4">
              {shown.map(r => (
                <RoundCard key={r.id} round={r} mode="head-pending" highlight={isDoc(r)} processing={busy === r.id}
                  typeHint={roundTypeHint(r, typeCode, pendingTally.tally, typeNameOf)}
                  onApprove={() => void decide(r, 'clear-approve')} onReject={() => void decide(r, 'clear-reject')} />
              ))}
            </div>
          )}
        </Panel>
      ) : (
        <Panel title="รอบที่อนุมัติ/ไม่อนุมัติแล้ว" actions={typeSelect}>
          {typeCode && <HintLine>เห็นเฉพาะรอบที่มีใบ{typeName}อยู่ · รอบที่ไม่อนุมัติจะไม่ขึ้น เพราะใบหลุดรอบไปแล้ว</HintLine>}
          {history === null || historyBusy ? (
            <div className="py-8"><MascotLoader text="กำลังโหลดรายการ" size={80} /></div>
          ) : historyT.length === 0 ? (
            <EmptyState text={typeCode ? `ยังไม่มีรอบที่มีใบ${typeName}` : 'ยังไม่มีรอบที่คุณอนุมัติหรือไม่อนุมัติ'} />
          ) : (
            <div className="space-y-4">
              {paginate(historyT, historyPage, PAGE_SIZE).map(r => (
                <RoundCard key={r.id} round={r} mode="head-history" typeHint={roundTypeHint(r, typeCode, historyTally.tally, typeNameOf)} />
              ))}
              <div className="flex justify-end pt-2">
                <PaginationControls currentPage={historyPage} totalPages={pageCount(historyT.length, PAGE_SIZE)} onPageChange={setHistoryPage} />
              </div>
            </div>
          )}
        </Panel>
      )}
    </FinanceShell>
  );
}

export default function PettyClearPage() {
  return (
    <Suspense fallback={<Loading />}>
      <PettyClear />
    </Suspense>
  );
}
