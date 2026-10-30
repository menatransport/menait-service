'use client';

import { Suspense, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { Send } from 'lucide-react';
import { MascotLoader } from '@/components/loading';
import { PaginationControls } from '@/components/pagination-controls';
import { useSessionContext } from '@/app/context/SessionContext';
import type { PettyBalance, PettyClaim, PettyExpenseType, PettyFund, PettyRound } from '@/app/finance/types-petty';
import { ApiError } from '@/lib/finance/api-error';
import { pageCount, paginate, paidInRange } from '@/lib/finance/petty-list';
import { fundLabel } from '@/lib/finance/petty-fund-label';
import { filterByType, filterRoundsByType, roundTypeHint } from '@/lib/finance/petty-type-filter';
import { formatBaht, formatDate } from '@/lib/finance/status';
import { showAlert, showSuccess } from '../../api';
import { countAttachments, createRound, getBalance, getExpenseTypes, getFunds, getRound, listAllClaims, listRounds } from '../../petty-api';
import { DateField } from '../../components/DateField';
import { PettySheet } from '../../components/petty/PettySheet';
import { TypeFilter, usePettyTypeFilter } from '../../components/petty/TypeFilter';
import { useRoundTypeTally } from '../../components/petty/useRoundTypeTally';
import { runPettyAction } from '../../components/petty/petty-actions';
import { pettyConfirm, pettyReview } from '../../components/petty/petty-confirm';
import { FIELD_SM, LINE, PettyPage, Section } from '../../components/petty/ui';
import { printRoundCover } from '../../components/petty/round-actions';
import { ClearClaimCard } from '../../components/petty/approvals/ClearClaimCard';
import { HandledClaimCard } from '../../components/petty/approvals/HandledClaimCard';
import { PendingClaimCard } from '../../components/petty/approvals/PendingClaimCard';
import { RoundCard } from '../../components/petty/approvals/RoundCard';
import { listClaimFiles, type ClaimFile } from '../../components/petty/approvals/files-api';
import {
  clearableClaims, handledClaims, locateClaim, parseHolderView, pendingClaims, pickSummary, roundBlocker, tabLabel, usesDd,
  type HolderView,
} from '../../components/petty/approvals/model';
import { BTN_APPROVE, BTN_VIEW, EmptyState, HeaderTabs, HintLine, NoticeBar, SubTabs } from '../../components/petty/approvals/ui';

const TITLE = 'อนุมัติเบิกเงินสดย่อย';
const CAPTION = 'อนุมัติจ่ายใบของวงเงินที่คุณถือ แล้วรวมหลายใบส่งเคลียร์เป็นรอบ';
const PAGE_SIZE = 20;

type HistoryTab = 'claims' | 'rounds';
type ClaimAction = 'approve' | 'return' | 'dd' | 'debt-doc';

const SUCCESS: Record<ClaimAction, [string, string | undefined]> = {
  approve: ['อนุมัติจ่ายแล้ว', 'ใบนี้ไปรอที่แถบ ส่งเคลียร์'],
  return: ['ตีกลับใบแล้ว', 'คนเปิดใบจะเห็นเหตุผล แก้แล้วส่งมาใหม่ได้'],
  dd: ['บันทึกเลข DD แล้ว', undefined],
  'debt-doc': ['บันทึกเลขรับสภาพหนี้แล้ว', undefined],
};

function Loading() {
  return (
    <PettyPage title={TITLE} caption={CAPTION}>
      <Section label="รายการรออนุมัติจ่าย"><div className="py-8"><MascotLoader text="กำลังโหลดรายการ" size={80} /></div></Section>
    </PettyPage>
  );
}

/** หน้าของเจ้าของเงินสด — วางแบบหน้าอนุมัติเบิกเงิน Advance (แถบหัวขวา การ์ดทีละใบ ปุ่มล่างการ์ด) */
function PettyApprovals() {
  const { user, loading } = useSessionContext();
  const params = useSearchParams();
  const doc = params.get('doc');
  const [view, setView] = useState<HolderView>(() => parseHolderView(params.get('tab')));
  const [funds, setFunds] = useState<PettyFund[] | null>(null);
  const [fundId, setFundId] = useState<number | null>(null);
  const [balance, setBalance] = useState<PettyBalance | null>(null);
  const [claims, setClaims] = useState<PettyClaim[] | null>(null);
  const [rounds, setRounds] = useState<PettyRound[]>([]);
  const [types, setTypes] = useState<PettyExpenseType[]>([]);
  const [files, setFiles] = useState<Record<string, ClaimFile[]>>({});
  const [busy, setBusy] = useState<string | null>(null);
  const [selected, setSelected] = useState<number[]>([]);
  // รวมรอบตามช่วงวันที่จ่าย (ผู้ใช้สั่ง 29/10/2026) — เว้นว่าง = ทุกวัน
  const [paidFrom, setPaidFrom] = useState('');
  const [paidTo, setPaidTo] = useState('');
  const [historyTab, setHistoryTab] = useState<HistoryTab>('claims');
  const [historyPage, setHistoryPage] = useState(1);
  const [openId, setOpenId] = useState<string | null>(null);
  const [notice, setNotice] = useState('');
  const handledDoc = useRef<string | null>(null);
  const typeFilter = usePettyTypeFilter(types);
  const typeCode = typeFilter.code;

  const load = useCallback(async () => {
    try {
      const [f, page, t, r] = await Promise.all([
        // ทุกหน้า ไม่ใช่แค่ 200 ใบแรก — กรองประเภทแล้วตัวเลขในแถบจะได้ครบ และรู้ว่ารอบไหนมีใบประเภทอะไร
        getFunds(), listAllClaims({ view: 'approvals' }), getExpenseTypes(), listRounds('mine'),
      ]);
      const mine = f.filter(x => x.holder_employee_id === user?.employee_id);
      setFunds(mine); setClaims(page.items); setTypes(t); setRounds(r);
      setFundId(id => id ?? mine[0]?.id ?? null);
    } catch (err) {
      setFunds(f => f ?? []); setClaims(c => c ?? []);
      showAlert({ icon: 'error', title: 'โหลดรายการไม่สำเร็จ', text: (err as Error).message });
    }
  }, [user?.employee_id]);
  useEffect(() => { if (user?.employee_id) void load(); }, [user?.employee_id, load]);
  useEffect(() => { if (fundId) getBalance(fundId).then(setBalance).catch(() => setBalance(null)); }, [fundId, claims]);
  useEffect(() => { setSelected([]); }, [fundId, view, paidFrom, paidTo, typeCode]);
  useEffect(() => { setHistoryPage(1); }, [historyTab, fundId, typeCode]);

  const specOf = useCallback((code: string) => types.find(t => t.code === code)?.spec, [types]);
  const typeNameOf = (code: string) => types.find(t => t.code === code)?.name_th ?? code;

  const all = useMemo(() => claims ?? [], [claims]);
  const pending = useMemo(() => pendingClaims(all, fundId), [all, fundId]);
  const clearable = useMemo(() => clearableClaims(all, fundId), [all, fundId]);
  const handled = useMemo(() => handledClaims(all, fundId), [all, fundId]);
  const myRounds = useMemo(() => rounds.filter(r => r.fund_id === fundId)
    .sort((a, b) => (b.submitted_at ?? '').localeCompare(a.submitted_at ?? '') || b.id - a.id), [rounds, fundId]);

  // กรองตามประเภทการเบิก — ตัวเลขในแถบนับตามนี้ · รอบโชว์ถ้ามีใบประเภทนั้นอย่างน้อยหนึ่งใบ (ใบในรอบยังครบ ยอดรอบไม่เปลี่ยน)
  // pending/clearable/handled ตัวเต็มยังใช้หาใบจากลิงก์ ?doc= และโหลดไฟล์แนบ (เปลี่ยนประเภทไม่ต้องโหลดไฟล์ใหม่)
  const pendingT = useMemo(() => filterByType(pending, typeCode), [pending, typeCode]);
  const clearableT = useMemo(() => filterByType(clearable, typeCode), [clearable, typeCode]);
  const handledT = useMemo(() => filterByType(handled, typeCode), [handled, typeCode]);
  const { tally, loading: tallyBusy } = useRoundTypeTally(all, myRounds, typeCode !== '');
  const roundsT = useMemo(() => filterRoundsByType(myRounds, typeCode, tally), [myRounds, typeCode, tally]);

  // ไฟล์แนบของใบที่รออนุมัติ — ใช้ทั้งโชว์บนการ์ดและเช็กว่าเอกสารครบไหม (ด่านจริงอยู่ที่ BE ตอนกด)
  const pendingKey = pending.map(c => c.form_id).join(',');
  useEffect(() => {
    let alive = true;
    (async () => {
      const ids = pendingKey ? pendingKey.split(',') : [];
      const rows = await Promise.all(ids.map(async id => [id, await listClaimFiles(id)] as const));
      if (alive) setFiles(Object.fromEntries(rows));
    })();
    return () => { alive = false; };
  }, [pendingKey, claims]);
  // แนบสลิปจากการ์ดแล้วโหลดไฟล์ของใบนั้นใบเดียว ปุ่มอนุมัติจ่ายจะเปิดเองเมื่อเอกสารครบ
  const reloadFiles = useCallback(async (formId: string) => {
    const rows = await listClaimFiles(formId);
    setFiles(f => ({ ...f, [formId]: rows }));
  }, []);

  // ลิงก์ ?doc=<เลขที่ใบ>: ไปแถบที่ใบอยู่ ถ้าผ่านมือไปแล้วบอกว่าไปไหน (แบบหน้าอนุมัติ Advance)
  useEffect(() => {
    if (!doc || claims === null || funds === null || handledDoc.current === doc) return;
    const target = claims.find(c => c.form_id === doc);
    if (target && target.fund_id !== fundId && funds.some(f => f.id === target.fund_id)) { setFundId(target.fund_id); return; }
    handledDoc.current = doc;
    const loc = locateClaim(doc, { pending, clearable, handled });
    setView(loc.view);
    setNotice(loc.notice ?? '');
    // ใบที่ผ่านมือแล้วยกขึ้นบนสุดของแถบ อนุมัติแล้ว (ไม่เลื่อนจอ จะได้เห็นแถบแจ้งด้านบนด้วย)
    if (loc.view === 'history') { setHistoryTab('claims'); setHistoryPage(1); }
    else if (loc.hit) setTimeout(() => document.getElementById(`apv-${doc}`)?.scrollIntoView({ behavior: 'smooth', block: 'center' }), 150);
  }, [doc, claims, funds, fundId, pending, clearable, handled]);

  async function act(claim: PettyClaim, action: ClaimAction) {
    setBusy(`${action}-${claim.form_id}`);
    try {
      if (await runPettyAction(claim, action, { spec: specOf(claim.expense_type) })) {
        const [title, text] = SUCCESS[action];
        await showSuccess(title, text);
        await load();
      }
    } finally { setBusy(null); }
  }

  const inRange = clearableT.filter(c => paidInRange(c, paidFrom, paidTo));
  const tickable = inRange.filter(c => !roundBlocker(c, specOf(c.expense_type)));
  const { picked, sum } = pickSummary(tickable, selected);
  const toggle = (id: number) => setSelected(s => (s.includes(id) ? s.filter(x => x !== id) : [...s, id]));

  async function sendRound() {
    if (!fundId || picked.length === 0) return;
    const fund = funds?.find(f => f.id === fundId);
    const ok = await pettyReview({ title: 'ยืนยันส่งเคลียร์',
      rows: [
        ['วงเงินสดย่อย', fund ? fundLabel(fund) : '-'],
        ['จำนวนใบ', `${picked.length} ใบ`],
        ['ยอดรวม', `${formatBaht(sum)} บาท`],
        ...(paidFrom || paidTo
          ? [['ช่วงวันที่จ่าย', `${paidFrom ? formatDate(paidFrom) : 'แรกสุด'} ถึง ${paidTo ? formatDate(paidTo) : 'ล่าสุด'}`] as [string, string]] : []),
        ['เลขที่ใบ', picked.map(c => c.form_id).join('\n')],
      ],
      note: 'หัวหน้าตามสายงานอนุมัติก่อน แล้วไปบัญชีตรวจ', confirmButtonText: 'ส่งเคลียร์' });
    if (!ok) return;
    setBusy('round');
    try {
      const attachments: Record<string, Record<string, number>> = {};
      for (const c of picked) attachments[c.form_id] = await countAttachments(c.form_id);
      const remark = paidFrom || paidTo ? `จ่ายช่วง ${paidFrom || '-'} ถึง ${paidTo || '-'}` : undefined;
      const round = await createRound({ fund_id: fundId, claim_ids: picked.map(c => c.id), attachments, remark });
      setSelected([]);
      await load();
      const again = await pettyConfirm({ icon: 'success', title: `ส่งรอบ ${round.batch_no} แล้ว`,
        text: 'พิมพ์ใบปะหน้าแนบไปกับเอกสารตัวจริงเลยไหม', confirmButtonText: 'พิมพ์ใบปะหน้า', cancelButtonText: 'ไว้ทีหลัง' }) as { isConfirmed?: boolean };
      if (again?.isConfirmed) printRoundCover(round.claims ? round : await getRound(round.id), types, funds ?? []);
    } catch (err) {
      const api = err instanceof ApiError ? err : null;
      const bad = Array.isArray(api?.body?.claims) ? api!.body!.claims as { form_id: string; missing: { label?: string; key?: string }[] }[] : [];
      const lines = bad.map(b => `• ${b.form_id}: ขาด ${b.missing.map(m => m.label ?? m.key).join(', ')}`);
      showAlert({ icon: 'error', title: api?.message ?? 'ส่งเคลียร์ไม่สำเร็จ', text: lines.length ? lines.join('\n') : (err as Error).message });
    } finally { setBusy(null); }
  }

  async function printCover(round: PettyRound) {
    setBusy(`print-${round.id}`);
    try {
      printRoundCover(round.claims ? round : await getRound(round.id), types, funds ?? []);
    } catch (err) {
      showAlert({ icon: 'error', title: 'เปิดใบปะหน้าไม่สำเร็จ', text: (err as Error).message });
    } finally { setBusy(null); }
  }

  if (loading || funds === null || claims === null) return <Loading />;
  if (funds.length === 0) {
    return (
      <PettyPage title={TITLE} caption={CAPTION}>
        <EmptyState text="ไม่มีวงเงินสดย่อยที่คุณถือ — หน้านี้สำหรับเจ้าของเงินสดย่อย ถ้าคุณควรเห็น ให้ผู้ดูแลระบบตั้งวงเงินเป็นชื่อคุณ" />
      </PettyPage>
    );
  }

  const docFirst = (rows: PettyClaim[]) => (doc ? [...rows].sort((a, b) => Number(b.form_id === doc) - Number(a.form_id === doc)) : rows);
  const shownPending = docFirst(pendingT);
  const shownHandled = docFirst(handledT);
  const historyRows = historyTab === 'claims' ? shownHandled : roundsT;
  const typeName = typeFilter.name;
  const ofType = typeCode ? typeName : '';
  const historyPages = pageCount(historyRows.length, PAGE_SIZE);

  return (
    <PettyPage title={TITLE} caption={CAPTION}
      aside={
        <HeaderTabs value={view} onChange={v => { setView(v); setNotice(''); }} tabs={[
          ['pending', tabLabel('รออนุมัติจ่าย', pendingT.length)],
          ['clear', tabLabel('ส่งเคลียร์', clearableT.length)],
          ['history', 'อนุมัติแล้ว'],
        ]} />
      }>

      {/* ยอดพร้อมอนุมัติ — เก็บไว้ตัวเดียวจากแถบตัวเลขเดิม เพราะเจ้าของเงินสดต้องเห็นก่อนกดอนุมัติจ่าย */}
      <div className={`mb-5 flex flex-wrap items-center gap-x-4 gap-y-2 border-b ${LINE} pb-4`}>
        <div className="flex items-baseline gap-2">
          <span className="text-xs text-ink-500">ยอดพร้อมอนุมัติ</span>
          <span className={`font-display text-lg font-semibold tabular-nums ${balance && balance.available < 0 ? 'text-rose-700' : 'text-ink-900'}`}>
            {balance ? formatBaht(balance.available) : '-'}
          </span>
          <span className="text-xs text-ink-500">บาท</span>
        </div>
        {balance && (
          <span className="text-xs text-ink-500">Advance {formatBaht(balance.advance_outstanding)} − ยังไม่คืน {formatBaht(balance.petty_committed)}</span>
        )}
        <div className="ml-auto flex flex-wrap items-center gap-2">
          <TypeFilter types={types} value={typeCode} onChange={typeFilter.setCode} />
          {funds.length > 1 && (
            <select value={fundId ?? ''} onChange={e => setFundId(Number(e.target.value))} aria-label="เลือกวงเงิน"
              className={FIELD_SM}>
              {funds.map(f => <option key={f.id} value={f.id}>{fundLabel(f)}</option>)}
            </select>
          )}
        </div>
      </div>

      <NoticeBar text={notice} onClose={() => setNotice('')} />

      {view === 'pending' && (
        <Section label="รายการรออนุมัติจ่าย">
          {shownPending.length === 0 ? <EmptyState text={`ไม่มีใบ${ofType}รอคุณอนุมัติจ่าย`} /> : (
            <div className="space-y-4">
              {shownPending.map(c => (
                <PendingClaimCard key={c.id} claim={c} typeName={typeNameOf(c.expense_type)} spec={specOf(c.expense_type)}
                  files={files[c.form_id]} highlight={!!doc && c.form_id === doc}
                  processing={busy === `approve-${c.form_id}` || busy === `return-${c.form_id}`}
                  onView={() => setOpenId(c.form_id)}
                  onReturn={() => void act(c, 'return')} onApprove={() => void act(c, 'approve')}
                  onFilesChanged={() => reloadFiles(c.form_id)} />
              ))}
            </div>
          )}
        </Section>
      )}

      {view === 'clear' && (
        <Section label="ใบที่รอส่งเคลียร์">
          <div className="mb-4 grid gap-3 sm:grid-cols-[1fr_1fr_auto] sm:items-end">
            <div className="space-y-1">
              <p className="text-xs text-gray-500">จ่ายตั้งแต่วันที่</p>
              <DateField value={paidFrom} onChange={setPaidFrom} placeholder="แรกสุด" />
            </div>
            <div className="space-y-1">
              <p className="text-xs text-gray-500">ถึงวันที่</p>
              <DateField value={paidTo} onChange={setPaidTo} min={paidFrom || undefined} placeholder="ล่าสุด" />
            </div>
            <button type="button" onClick={() => { setPaidFrom(''); setPaidTo(''); }} disabled={!paidFrom && !paidTo}
              className={`${BTN_VIEW} h-11 justify-center`}>
              ล้างช่วงวันที่
            </button>
          </div>
          {inRange.length === 0 ? (
            <EmptyState text={clearableT.length === 0 ? `ไม่มีใบ${ofType}รอส่งเคลียร์` : `ไม่มีใบ${ofType}ที่จ่ายในช่วงวันที่นี้`} />
          ) : (
            <>
              <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                <button type="button" onClick={() => setSelected(picked.length === tickable.length ? [] : tickable.map(c => c.id))}
                  disabled={tickable.length === 0} className={BTN_VIEW}>
                  {picked.length === tickable.length && tickable.length > 0 ? 'ไม่เลือกเลย' : `เลือกทุกใบที่ส่งได้ (${tickable.length})`}
                </button>
                <p className="text-xs text-gray-500">รอบหนึ่งรวมได้เฉพาะใบของวงเงินที่คุณถือ</p>
              </div>
              {typeCode && (
                <HintLine>ตอนนี้เห็นเฉพาะใบ{typeName} ถ้าจะรวมหลายประเภทในรอบเดียว เปลี่ยนเป็น ทุกประเภท ก่อน</HintLine>
              )}
              <div className="space-y-3">
                {inRange.map(c => {
                  const spec = specOf(c.expense_type);
                  return (
                    <ClearClaimCard key={c.id} claim={c} typeName={typeNameOf(c.expense_type)} checked={selected.includes(c.id)}
                      blocker={roundBlocker(c, spec)} hasDd={usesDd(spec)} highlight={!!doc && c.form_id === doc}
                      busy={busy === `dd-${c.form_id}`} debtBusy={busy === `debt-doc-${c.form_id}`} onToggle={() => toggle(c.id)}
                      onView={() => setOpenId(c.form_id)} onDd={() => void act(c, 'dd')} onDebtDoc={() => void act(c, 'debt-doc')} />
                  );
                })}
              </div>
              <div className="sticky bottom-0 z-10 -mx-4 mt-4 flex flex-wrap items-center justify-between gap-3 border-t border-[#edf1f7] bg-white/95 px-4 py-3 backdrop-blur sm:-mx-8 sm:px-8">
                <p className="text-sm text-gray-700">
                  เลือก <b className="tabular-nums">{picked.length}</b> ใบ · รวม <b className="tabular-nums text-brand-800">{formatBaht(sum)}</b> บาท
                </p>
                <button type="button" onClick={() => void sendRound()} disabled={busy !== null || picked.length === 0} className={BTN_APPROVE}>
                  <Send className="h-4 w-4" /> {busy === 'round' ? 'กำลังส่ง…' : 'ส่งเคลียร์'}
                </button>
              </div>
            </>
          )}
        </Section>
      )}

      {view === 'history' && (
        <Section label="รายการที่อนุมัติแล้ว">
          <SubTabs value={historyTab} onChange={setHistoryTab} tabs={[
            ['claims', `ใบที่อนุมัติ/ตีกลับแล้ว (${handledT.length})`],
            ['rounds', `รอบที่ส่งเคลียร์ (${roundsT.length})`],
          ]} />
          {historyTab === 'rounds' && typeCode && (
            <HintLine>เห็นเฉพาะรอบที่มีใบ{typeName}อยู่ด้วย ยอดรวมยังเป็นยอดทั้งรอบ</HintLine>
          )}
          {historyTab === 'rounds' && tallyBusy ? (
            <div className="py-8"><MascotLoader text="กำลังดูว่ารอบไหนมีใบประเภทนี้" size={80} /></div>
          ) : historyRows.length === 0 ? (
            <EmptyState text={historyTab === 'claims'
              ? (typeCode ? `ยังไม่มีใบ${typeName}ที่อนุมัติหรือตีกลับ` : 'ยังไม่มีใบที่อนุมัติหรือตีกลับ')
              : (typeCode ? `ยังไม่มีรอบที่มีใบ${typeName}` : 'ยังไม่เคยส่งรอบ')} />
          ) : (
            <div className="space-y-4">
              {historyTab === 'claims'
                ? paginate(shownHandled, historyPage, PAGE_SIZE).map(c => (
                  <HandledClaimCard key={c.id} claim={c} typeName={typeNameOf(c.expense_type)} highlight={!!doc && c.form_id === doc}
                    onView={() => setOpenId(c.form_id)} />
                ))
                : paginate(roundsT, historyPage, PAGE_SIZE).map(r => (
                  <RoundCard key={r.id} round={r} mode="holder" processing={busy === `print-${r.id}`}
                    typeHint={roundTypeHint(r, typeCode, tally, typeNameOf)}
                    onPrint={r.status === 'CLEAR_REJECTED' ? undefined : () => void printCover(r)} />
                ))}
              <div className="flex justify-end pt-2">
                <PaginationControls currentPage={historyPage} totalPages={historyPages} onPageChange={setHistoryPage} />
              </div>
            </div>
          )}
        </Section>
      )}

      <PettySheet formId={openId} isOpen={openId !== null} onClose={() => setOpenId(null)} onChanged={() => void load()} />
    </PettyPage>
  );
}

export default function PettyApprovalsPage() {
  return (
    <Suspense fallback={<Loading />}>
      <PettyApprovals />
    </Suspense>
  );
}
