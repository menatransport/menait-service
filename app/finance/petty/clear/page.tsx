'use client';

import { Suspense, useCallback, useEffect, useRef, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { ClipboardCheck } from 'lucide-react';
import { MascotLoader } from '@/components/loading';
import { PaginationControls } from '@/components/pagination-controls';
import { useSessionContext } from '@/app/context/SessionContext';
import { pageCount, paginate } from '@/lib/finance/petty-list';
import { showAlert } from '../../api';
import { listRounds } from '../../petty-api';
import { FinanceHeading, FinanceShell, Panel } from '../../components/FinanceShell';
import { RoundCard } from '../../components/petty/approvals/RoundCard';
import { decideRound, listClearHistory } from '../../components/petty/approvals/clear-actions';
import {
  clearedByMe, locateRound, parseHeadView, splitByPrimary, tabLabel, type ClearRound, type HeadView, type SubTab,
} from '../../components/petty/approvals/model';
import { EmptyState, HeaderTabs, NoticeBar, SubTabs } from '../../components/petty/approvals/ui';

const TITLE = 'อนุมัติเคลียร์เงินสดย่อย';
const CAPTION = 'รอบที่เจ้าของเงินสดในสายงานของคุณส่งมา อนุมัติแล้วรอบไปให้บัญชีตรวจต่อ';
const PAGE_SIZE = 20;

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

  const { mine, delegable } = splitByPrimary(rounds);
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
            ['pending', tabLabel('รออนุมัติเคลียร์', rounds.length)],
            ['history', 'อนุมัติ/ไม่อนุมัติแล้ว'],
          ]} />
        }
      />
      <NoticeBar text={notice} onClose={() => setNotice('')} />

      {view === 'pending' ? (
        <Panel title="รอบรออนุมัติเคลียร์">
          <SubTabs value={subTab} onChange={setSubTab} tabs={[
            ['mine', `รอฉันอนุมัติ (${mine.length})`],
            ['delegable', `อนุมัติแทนได้ (${delegable.length})`],
          ]} />
          {shown.length === 0 ? (
            <EmptyState text={subTab === 'mine' ? 'ไม่มีรอบที่รอคุณอนุมัติเคลียร์' : 'ไม่มีรอบที่อนุมัติแทนได้'} />
          ) : (
            <div className="space-y-4">
              {shown.map(r => (
                <RoundCard key={r.id} round={r} mode="head-pending" highlight={isDoc(r)} processing={busy === r.id}
                  onApprove={() => void decide(r, 'clear-approve')} onReject={() => void decide(r, 'clear-reject')} />
              ))}
            </div>
          )}
        </Panel>
      ) : (
        <Panel title="รอบที่อนุมัติ/ไม่อนุมัติแล้ว">
          {history === null ? (
            <div className="py-8"><MascotLoader text="กำลังโหลดรายการ" size={80} /></div>
          ) : history.length === 0 ? (
            <EmptyState text="ยังไม่มีรอบที่คุณอนุมัติหรือไม่อนุมัติ" />
          ) : (
            <div className="space-y-4">
              {paginate(history, historyPage, PAGE_SIZE).map(r => <RoundCard key={r.id} round={r} mode="head-history" />)}
              <div className="flex justify-end pt-2">
                <PaginationControls currentPage={historyPage} totalPages={pageCount(history.length, PAGE_SIZE)} onPageChange={setHistoryPage} />
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
