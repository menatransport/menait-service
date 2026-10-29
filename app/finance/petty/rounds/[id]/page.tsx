'use client';

import { useCallback, useEffect, useState, type ReactNode } from 'react';
import { useParams } from 'next/navigation';
import { FileStack, Layers } from 'lucide-react';
import { MascotLoader } from '@/components/loading';
import { useSessionContext } from '@/app/context/SessionContext';
import type { PettyClaim, PettyExpenseType, PettyFund, PettyRound } from '@/app/finance/types-petty';
import { canCloseBatch, canReview, canVoucher } from '@/lib/finance/petty-access';
import { quickAction, type PettyTab } from '@/lib/finance/petty-list';
import { formatBaht, formatDate } from '@/lib/finance/status';
import { getExpenseTypes, getFunds, getRound } from '../../../petty-api';
import { Field, FinanceCanvas, FinanceHeading, NoAccess, Panel } from '../../../components/FinanceShell';
import { PettyListView, RowButton } from '../../../components/petty/PettyListView';
import { PettySheet } from '../../../components/petty/PettySheet';
import { runPettyAction } from '../../../components/petty/petty-actions';
import { RoundStatusBadge } from '../../../components/petty/RoundTable';
import { printRoundCover, runRoundAction } from '../../../components/petty/round-actions';

const TABS: PettyTab[] = [
  { key: 'all', label: 'ทั้งหมด' },
  { key: 'review', label: 'รอบัญชีตรวจ', statuses: ['AWAITING_REVIEW'] },
  { key: 'sentback', label: 'ตีกลับรอแก้', statuses: ['SENT_BACK'] },
  { key: 'passed', label: 'ตรวจผ่าน', statuses: ['REVIEWED', 'CLOSED'] },
];

const at = (iso: string | null) => (iso ? new Date(iso).toLocaleString('th-TH', { dateStyle: 'medium', timeStyle: 'short' }) : '-');

/** รอบส่งเคลียร์หนึ่งรอบ — ใบในรอบ ใบปะหน้า และปุ่มตามบทบาท (หัวหน้า / บัญชี / การเงิน) */
export default function PettyRoundPage() {
  const { user, loading } = useSessionContext();
  const params = useParams<{ id: string }>();
  const id = Number(params?.id);
  const [round, setRound] = useState<PettyRound | null>(null);
  const [types, setTypes] = useState<PettyExpenseType[]>([]);
  const [funds, setFunds] = useState<PettyFund[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [tab, setTab] = useState('all');
  const [busy, setBusy] = useState<string | null>(null);
  const [openId, setOpenId] = useState<string | null>(null);
  const [sheetOpen, setSheetOpen] = useState(false);

  const load = useCallback(async () => {
    try {
      const [r, t, f] = await Promise.all([getRound(id), getExpenseTypes(), getFunds(true)]);
      setRound(r); setTypes(t); setFunds(f);
    } catch (err) {
      setError((err as Error).message);
    }
  }, [id]);
  useEffect(() => { if (Number.isInteger(id) && id > 0) void load(); }, [id, load]);

  async function roundAct(action: 'clear-approve' | 'clear-reject' | 'voucher' | 'pay') {
    if (!round) return;
    setBusy(action);
    try { if (await runRoundAction(round, action)) await load(); } finally { setBusy(null); }
  }

  async function review(claim: PettyClaim, pass: boolean) {
    setBusy(claim.form_id);
    try { if (await runPettyAction(claim, 'review', { pass })) await load(); } finally { setBusy(null); }
  }

  if (loading) return <MascotLoader />;
  if (!Number.isInteger(id) || id <= 0) return <NoAccess text="เลขรอบไม่ถูกต้อง" />;
  if (error) return <NoAccess text={error} />;
  if (!round) return <MascotLoader />;

  const claims = round.claims ?? [];
  const btn = (label: string, onClick: () => void, key: string, tone: 'primary' | 'ghost' = 'primary') => (
    <button key={key} type="button" onClick={onClick} disabled={busy !== null}
      className={`rounded-lg px-4 py-2 text-sm font-medium transition-colors disabled:opacity-40 ${tone === 'ghost' ? 'border border-slate-200 text-ink-700 hover:bg-slate-50' : 'bg-brand-600 text-white hover:bg-brand-700'}`}>
      {busy === key ? 'กำลังทำ…' : label}
    </button>
  );
  const buttons: ReactNode[] = [];
  if (round.can_clear && round.status === 'CLEAR_PENDING') {
    buttons.push(btn('อนุมัติเคลียร์', () => void roundAct('clear-approve'), 'clear-approve'));
    buttons.push(btn('ไม่อนุมัติ', () => void roundAct('clear-reject'), 'clear-reject', 'ghost'));
  }
  if (canVoucher(user) && round.status === 'REVIEWED') buttons.push(btn('ตั้งเบิก', () => void roundAct('voucher'), 'voucher'));
  if (canCloseBatch(user) && round.status === 'VOUCHERED') buttons.push(btn('ทำจ่ายและปิดรอบ', () => void roundAct('pay'), 'pay'));

  const waiting = claims.filter(c => c.status === 'AWAITING_REVIEW' || c.status === 'SENT_BACK').length;
  const note = round.status === 'AWAITING_REVIEW' && waiting > 0
    ? `ยังเหลือ ${waiting} ใบที่บัญชียังไม่ผ่าน — ผ่านครบทั้งรอบแล้วจึงตั้งเบิกได้` : null;

  const rowAction = (c: PettyClaim) => {
    if (!canReview(user) || !quickAction(c, 'accounting')) return null;
    const isBusy = busy === c.form_id;
    return (
      <>
        <RowButton onClick={() => void review(c, true)} disabled={isBusy}>{isBusy ? 'กำลังทำ…' : 'ผ่าน'}</RowButton>
        <RowButton tone="ghost" onClick={() => void review(c, false)} disabled={isBusy}>ตีกลับ</RowButton>
      </>
    );
  };

  return (
    <FinanceCanvas title={`รอบ ${round.batch_no}`}>
      <FinanceHeading icon={Layers} title={`รอบส่งเคลียร์ ${round.batch_no}`}
        caption={`${round.holder_name ?? round.holder_employee_id ?? '-'} · ${round.branch_code ?? '-'} · ${round.division_code ?? '-'}`}
        actions={(
          <span className="flex items-center gap-2">
            <RoundStatusBadge status={round.status} />
            <button type="button" onClick={() => printRoundCover(round, types, funds)}
              className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-sm">
              <FileStack className="h-4 w-4" /> ใบปะหน้า
            </button>
          </span>
        )} />

      {round.status === 'CLEAR_REJECTED' && (
        <div className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-800">
          หัวหน้าไม่อนุมัติ: {round.clear_reject_reason ?? '-'} · ใบกลับไปรอส่งเคลียร์ เจ้าของเงินสดจัดรอบใหม่ได้
        </div>
      )}

      <Panel title="สรุปรอบ">
        <div className="grid gap-3 sm:grid-cols-3">
          <Field label="ยอดรวม" value={`${formatBaht(round.total_amount)} บาท · ${claims.length} ใบ`} />
          <Field label="ส่งเคลียร์เมื่อ" value={at(round.submitted_at)} />
          <Field label="หัวหน้าที่อนุมัติได้" value={round.clear_required_level ? `ระดับ ${round.clear_required_level} ขึ้นไป ตามสายงานของเจ้าของเงินสด` : '-'} />
          <Field label="หัวหน้าตัดสิน" value={round.clear_approved_by_name ?? round.clear_approved_by ?? '-'} />
          <Field label="ตัดสินเมื่อ" value={at(round.clear_approved_at)} />
          <Field label="เลขที่ใบตั้งเบิก" value={round.voucher_no ?? '-'} />
          <Field label="วันที่ทำจ่าย" value={formatDate(round.pay_date) || '-'} />
          <Field label="ปิดรอบเมื่อ" value={at(round.closed_at)} />
        </div>
        {(buttons.length > 0 || note) && (
          <div className="mt-3 flex flex-wrap items-center gap-2 border-t border-slate-100 pt-3">
            {buttons}
            {note && <span className="text-xs text-ink-500">{note}</span>}
          </div>
        )}
      </Panel>

      <PettyListView claims={claims} types={types} funds={funds} tabs={TABS} activeTab={tab} onTabChange={setTab}
        onOpen={c => { setOpenId(c.form_id); setSheetOpen(true); }} exportFileBase={`เงินสดย่อย-${round.batch_no}`}
        rowAction={rowAction} />
      <PettySheet formId={openId} isOpen={sheetOpen} onClose={() => setSheetOpen(false)} onChanged={() => void load()} />
    </FinanceCanvas>
  );
}
