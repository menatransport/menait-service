'use client';

import { Suspense, useCallback, useEffect, useRef, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { BadgeCheck, Check, CheckCircle2, Clock, Info, X, XCircle } from 'lucide-react';
import { MascotLoader } from '@/components/loading';
import { Mascot } from '@/components/mascot';
import { useSessionContext } from '@/app/context/SessionContext';
import type { FormValue } from '@/app/mytickets/[id]/types';
import { formatBaht, formatDate } from '@/lib/finance/status';
import { stepBadge } from '@/lib/finance/approvalSteps';
import { fetchJson, showAlert, showConfirm } from '../api';
import type { PendingApprovalItem } from '../types';
import { AttachmentPanel } from '../components/AttachmentPanel';
import { Field, FinanceHeading, FinanceShell, Panel } from '../components/FinanceShell';

type ApvView = 'pending' | 'history';

type ApprovalListItem = {
  form_id: string;
  form_code?: string | null;
  firstname?: string | null;
  lastname?: string | null;
  created_at?: string | null;
  department_name_th?: string | null;
  status_approve?: string | null; // history: 'Approved' | 'Rejected'
  action?: string | null; // history: 'APPROVED' | 'REJECTED'
  action_at?: string | null;
  remark?: string | null;
};

type ApprovalItem = ApprovalListItem & { values?: FormValue[] };

const PURPOSE_LABEL = 'เบิกเงิน Advance สำหรับ';

/** Same picking order as the BE's pick_request_values: exact question_name, then label, then question_type. */
function findValue(values: FormValue[] | undefined, matchers: { name?: string; label?: string; types?: string[] }): FormValue | undefined {
  if (!values?.length) return undefined;
  if (matchers.name) {
    const byName = values.find(v => v.question_name === matchers.name);
    if (byName) return byName;
  }
  if (matchers.label) {
    const byLabel = values.find(v => v.question_label === matchers.label);
    if (byLabel) return byLabel;
  }
  if (matchers.types) return values.find(v => matchers.types!.includes(v.question_type));
  return undefined;
}

const getPurpose = (values?: FormValue[]) =>
  findValue(values, { name: 'adv_purpose', label: PURPOSE_LABEL, types: ['longtext', 'text'] })?.value_text ?? null;
const getAmount = (values?: FormValue[]) =>
  findValue(values, { name: 'adv_amount', types: ['number'] })?.value_number ?? null;
const getUseDate = (values?: FormValue[]) =>
  findValue(values, { name: 'adv_use_date', types: ['datetime', 'date'] })?.value_date ?? null;

const BTN_REJECT = 'inline-flex items-center gap-1.5 rounded-xl border border-rose-200 bg-white px-4 py-2 text-sm font-medium text-rose-600 transition-colors hover:bg-rose-50 disabled:cursor-not-allowed disabled:opacity-50';
const BTN_APPROVE = 'inline-flex items-center gap-1.5 rounded-xl bg-linear-to-r from-brand-600 to-brand-500 px-5 py-2 text-sm font-semibold text-white shadow-md transition-all hover:from-brand-700 hover:to-brand-600 hover:shadow-lg disabled:cursor-not-allowed disabled:opacity-50';
const CARD = 'rounded-2xl border border-gray-100 bg-white p-4 shadow-sm transition-shadow hover:shadow-md sm:p-5';

/** The requested amount is what the approver decides on — give it the most weight on the card. */
function AmountField({ value }: { value: number | null | undefined }) {
  return (
    <div className="min-w-0">
      <p className="text-xs text-gray-500">จำนวนเงินที่ขอ</p>
      <p className="font-display text-xl font-semibold tabular-nums text-brand-800">{formatBaht(value)} <span className="text-xs font-normal text-gray-500">บาท</span></p>
    </div>
  );
}

function EmptyState({ text }: { text: string }) {
  return (
    <div className="flex flex-col items-center gap-2 py-8 text-center">
      <Mascot size={80} />
      <p className="text-sm text-ink-500">{text}</p>
    </div>
  );
}

function ApprovalStatusBadge({ apvView, item }: { apvView: ApvView; item: ApprovalItem }) {
  if (apvView === 'pending') {
    return (
      <span className="inline-flex items-center gap-1 rounded-full border border-amber-200 bg-amber-50 px-2.5 py-0.5 text-xs font-medium text-amber-700">
        <Clock className="h-3 w-3" /> รออนุมัติ
      </span>
    );
  }
  const approved = item.action === 'APPROVED' || item.status_approve === 'Approved';
  return approved ? (
    <span className="inline-flex items-center gap-1 rounded-full border border-emerald-200 bg-emerald-50 px-2.5 py-0.5 text-xs font-medium text-mint-700">
      <CheckCircle2 className="h-3 w-3" /> อนุมัติแล้ว
    </span>
  ) : (
    <span className="inline-flex items-center gap-1 rounded-full border border-rose-200 bg-rose-50 px-2.5 py-0.5 text-xs font-medium text-rose-700">
      <XCircle className="h-3 w-3" /> ไม่อนุมัติ
    </span>
  );
}

function ApprovalCard({
  item, apvView, processing, onApprove, onReject,
}: {
  item: ApprovalItem; apvView: ApvView; processing: boolean; onApprove: () => void; onReject: () => void;
}) {
  const requesterName = `${item.firstname ?? ''} ${item.lastname ?? ''}`.trim() || '-';

  return (
    <div className={CARD}>
      <div className="mb-3 flex flex-wrap items-start justify-between gap-2 border-b border-gray-100 pb-3">
        <div>
          <p className="text-sm font-semibold text-brand-800">{item.form_id}</p>
          <p className="text-xs text-gray-500">{requesterName}{item.department_name_th ? ` · ${item.department_name_th}` : ''}</p>
        </div>
        <ApprovalStatusBadge apvView={apvView} item={item} />
      </div>

      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
        <AmountField value={getAmount(item.values)} />
        <Field label="วันที่ใช้เงิน" value={formatDate(getUseDate(item.values))} />
        <Field label="วันที่ยื่นคำขอ" value={formatDate(item.created_at)} />
        <div className="col-span-2 sm:col-span-3"><Field label={PURPOSE_LABEL} value={getPurpose(item.values)} /></div>
        {apvView === 'history' && (
          <>
            <Field label="วันที่ดำเนินการ" value={formatDate(item.action_at)} />
            <div className="col-span-2 sm:col-span-2"><Field label="หมายเหตุ" value={item.remark} /></div>
          </>
        )}
      </div>

      <div className="mt-4">
        <AttachmentPanel formId={item.form_id} folder="request" />
      </div>

      {apvView === 'pending' && (
        <div className="mt-4 flex justify-end gap-2 border-t border-gray-100 pt-3">
          <button
            type="button"
            disabled={processing}
            onClick={onReject}
            className={BTN_REJECT}
          >
            <X className="h-4 w-4" /> ไม่อนุมัติ
          </button>
          <button
            type="button"
            disabled={processing}
            onClick={onApprove}
            className={BTN_APPROVE}
          >
            <Check className="h-4 w-4" /> อนุมัติ
          </button>
        </div>
      )}
    </div>
  );
}

function PendingCard({
  item, processing, highlight = false, onApprove, onReject,
}: {
  item: PendingApprovalItem; processing: boolean; highlight?: boolean; onApprove: () => void; onReject: () => void;
}) {
  const { requester, request, tier } = item;
  const badge = stepBadge(item.step, item.total_steps);
  const requesterName = requester?.name?.trim() || '-';

  return (
    <div id={`apv-${item.form_id}`} className={`${CARD} ${highlight ? 'ring-2 ring-mint-500' : ''}`}>
      <div className="mb-3 flex flex-wrap items-start justify-between gap-2 border-b border-gray-100 pb-3">
        <div>
          <p className="text-sm font-semibold text-brand-800">{item.form_id}</p>
          <p className="text-xs text-gray-500">{requesterName}{requester?.department ? ` · ${requester.department}` : ''}</p>
        </div>
        <span className="inline-flex items-center gap-1 rounded-full border border-amber-200 bg-amber-50 px-2.5 py-0.5 text-xs font-medium text-amber-700">
          <Clock className="h-3 w-3" /> รออนุมัติ{badge ? ` · ${badge}` : ''}
        </span>
      </div>

      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
        <AmountField value={request.amount} />
        <Field label="วันที่ใช้เงิน" value={formatDate(request.use_date)} />
        <Field label="วันที่ยื่นคำขอ" value={formatDate(item.created_at)} />
        <Field label="ค่าใช้จ่ายรายศูนย์" value={request.cost_center ?? '-'} />
        <div className="col-span-2"><Field label="ขั้นอนุมัติ" value={`ข้อ ${tier.clause} · ${tier.approver_label} — ผู้อนุมัติระดับ ${tier.required_level} ขึ้นไป`} /></div>
        <div className="col-span-2 sm:col-span-3"><Field label={PURPOSE_LABEL} value={request.purpose} /></div>
      </div>

      <div className="mt-4">
        <AttachmentPanel formId={item.form_id} folder="request" />
      </div>

      <div className="mt-4 border-t border-gray-100 pt-3">
        {item.tab === 'delegable' && (
          <p className="mb-2 flex items-center gap-1.5 text-xs text-gray-500"><Info className="h-3.5 w-3.5 text-brand-600" /> อนุมัติแทนได้ — มีผู้มีสิทธิ์ระดับ {tier.required_level}+ ที่ใกล้กว่า</p>
        )}
        <div className="flex justify-end gap-2">
          <button
            type="button"
            disabled={processing}
            onClick={onReject}
            className={BTN_REJECT}
          >
            <X className="h-4 w-4" /> ไม่อนุมัติ
          </button>
          <button
            type="button"
            disabled={processing}
            onClick={onApprove}
            className={BTN_APPROVE}
          >
            <Check className="h-4 w-4" /> อนุมัติ
          </button>
        </div>
      </div>
    </div>
  );
}

function FinanceApprovals() {
  const { user } = useSessionContext();
  const doc = useSearchParams().get('doc');
  const [notice, setNotice] = useState('');
  const handledDoc = useRef<string | null>(null);
  const activeDoc = useRef<string | null>(null);
  const scrollTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Cancels any in-flight lookup / pending scroll when the doc changes or the page unmounts.
  useEffect(() => {
    activeDoc.current = doc;
    return () => {
      activeDoc.current = null;
      if (scrollTimer.current) clearTimeout(scrollTimer.current);
    };
  }, [doc]);
  const [apvView, setApvView] = useState<ApvView>('pending');
  const [items, setItems] = useState<ApprovalItem[]>([]);
  const [pending, setPending] = useState<PendingApprovalItem[]>([]);
  const [pendingTab, setPendingTab] = useState<'mine' | 'delegable'>('mine');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [processingId, setProcessingId] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!user?.employee_id) return;
    setLoading(true);
    setError('');
    try {
      if (apvView === 'pending') {
        setPending(await fetchJson<PendingApprovalItem[]>('/api/finance/approvals'));
        return;
      }
      const viewQS = apvView === 'history' ? '&view=history' : '';
      const res = await fetch(
        `/api/tickets?employee_id=${encodeURIComponent(user.employee_id)}&tab=apv&role=${encodeURIComponent(user.role ?? '')}&scope=advance${viewQS}`,
        { cache: 'no-store' },
      );
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || `เกิดข้อผิดพลาด (${res.status})`);
      const list: ApprovalListItem[] = Array.isArray(data) ? data : [];

      // pending-approvals / approval-history don't carry the form's answered values (or, for
      // pending, the department) — enrich each row the same way mytickets does when opening a
      // ticket's detail: fetch the full submission by form_id.
      const enriched = await Promise.all(list.map(async (it): Promise<ApprovalItem> => {
        try {
          const detailRes = await fetch(`/api/formselect?path=${encodeURIComponent(it.form_id)}`, { cache: 'no-store' });
          const detailData = await detailRes.json();
          const detail = Array.isArray(detailData) ? detailData[0] : null;
          return {
            ...it,
            values: detail?.values ?? [],
            department_name_th: it.department_name_th ?? detail?.department_name_th ?? null,
          };
        } catch {
          return { ...it, values: [] };
        }
      }));

      setItems(enriched);
    } catch (err) {
      setItems([]);
      setPending([]);
      setError(err instanceof Error ? err.message : 'เกิดข้อผิดพลาดในการโหลดข้อมูล');
    } finally {
      setLoading(false);
    }
  }, [user?.employee_id, user?.role, apvView]);

  useEffect(() => { load(); }, [load]);

  // Deep link ?doc=<form_id>: focus the pending card, else explain where the item went.
  useEffect(() => {
    if (!doc || !user?.employee_id || apvView !== 'pending' || loading || error) return;
    if (handledDoc.current === doc) return;
    handledDoc.current = doc;
    const hit = pending.find(p => p.form_id === doc);
    if (hit) {
      setNotice('');
      setPendingTab(hit.tab);
      scrollTimer.current = setTimeout(() => document.getElementById(`apv-${doc}`)?.scrollIntoView({ behavior: 'smooth', block: 'center' }), 100);
      return;
    }
    const notInQueue = `รายการ ${doc} ไม่อยู่ในคิวอนุมัติของคุณ — อาจอนุมัติไปแล้ว หรือระดับ/แผนกของคุณไม่มีสิทธิ์อนุมัติวงเงินนี้`;
    (async () => {
      try {
        const res = await fetch(
          `/api/tickets?employee_id=${encodeURIComponent(user.employee_id)}&tab=apv&role=${encodeURIComponent(user.role ?? '')}&scope=advance&view=history`,
          { cache: 'no-store' },
        );
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data = await res.json();
        if (activeDoc.current !== doc) return;
        const found: ApprovalListItem | undefined = Array.isArray(data) ? data.find((h: ApprovalListItem) => h.form_id === doc) : undefined;
        if (found) {
          const approved = found.action === 'APPROVED' || found.status_approve === 'Approved';
          setNotice(`คุณ${approved ? 'อนุมัติ' : 'ไม่อนุมัติ'}รายการนี้แล้ว เมื่อ ${formatDate(found.action_at)}`);
        } else {
          setNotice(notInQueue);
        }
      } catch {
        if (activeDoc.current === doc) setNotice(`ตรวจสอบสถานะรายการ ${doc} ไม่สำเร็จ ลองรีเฟรช`);
      }
    })();
  }, [doc, user?.employee_id, user?.role, apvView, loading, error, pending]);

  const submitAction = useCallback(async (item: { form_id: string }, remark: string, action: 'approve' | 'reject') => {
    setProcessingId(item.form_id);
    try {
      const res = await fetch('/api/tickets', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ form_id: item.form_id, employee_id: user?.employee_id, action, remark }),
      });
      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        await showAlert({
          icon: 'error',
          title: action === 'approve' ? 'อนุมัติไม่สำเร็จ' : 'ไม่อนุมัติไม่สำเร็จ',
          text: errData?.error || 'เกิดข้อผิดพลาด กรุณาลองใหม่',
        });
        return;
      }
      await showAlert({
        icon: 'success',
        title: action === 'approve' ? 'อนุมัติคำขอสำเร็จ' : 'ไม่อนุมัติคำขอสำเร็จ',
        showConfirmButton: false,
        timer: 1500,
      });
      await load();
    } catch {
      await showAlert({
        icon: 'error',
        title: action === 'approve' ? 'อนุมัติไม่สำเร็จ' : 'ไม่อนุมัติไม่สำเร็จ',
        text: 'เกิดข้อผิดพลาดในการเชื่อมต่อ กรุณาลองใหม่',
      });
    } finally {
      setProcessingId(null);
    }
  }, [user?.employee_id, load]);

  const handleApprove = useCallback(async (item: { form_id: string }) => {
    const result: any = await showConfirm({
      title: 'ยืนยันอนุมัติคำขอเบิกเงิน Advance',
      text: `ฟอร์ม ${item.form_id}`,
      input: 'textarea',
      inputLabel: 'หมายเหตุ (ถ้ามี)',
      inputPlaceholder: 'ระบุหมายเหตุ...',
    });
    if (!result?.isConfirmed) return;
    await submitAction(item, (result.value ?? '').trim(), 'approve');
  }, [submitAction]);

  const handleReject = useCallback(async (item: { form_id: string }) => {
    const result: any = await showConfirm({
      title: 'ยืนยันไม่อนุมัติคำขอเบิกเงิน Advance',
      text: `ฟอร์ม ${item.form_id}`,
      input: 'textarea',
      inputLabel: 'หมายเหตุ (ระบุเหตุผล)',
      inputPlaceholder: 'กรุณาระบุเหตุผลที่ไม่อนุมัติ',
      inputValidator: (value: string) => (!value || !value.trim() ? 'กรุณาระบุหมายเหตุ' : undefined),
    });
    if (!result?.isConfirmed) return;
    await submitAction(item, (result.value ?? '').trim(), 'reject');
  }, [submitAction]);

  return (
    <FinanceShell title="อนุมัติเบิกเงิน Advance">
      <FinanceHeading
        icon={BadgeCheck}
        title="อนุมัติเบิกเงิน Advance"
        caption="อนุมัติตามวงเงินในตารางอำนาจอนุมัติ ข้อ 6"
        actions={
          <div role="tablist" aria-label="มุมมองรายการ" className="v2-glass inline-flex rounded-full p-1">
            {([['pending', 'รออนุมัติ'], ['history', 'อนุมัติ/ไม่อนุมัติแล้ว']] as const).map(([value, label]) => (
              <button
                key={value}
                type="button"
                role="tab"
                aria-selected={apvView === value}
                onClick={() => setApvView(value)}
                className={`rounded-full px-4 py-1.5 text-sm font-medium transition-all cursor-pointer ${apvView === value ? 'bg-linear-to-r from-brand-600 to-brand-500 text-white shadow-md' : 'text-ink-700 hover:text-brand-600'}`}
              >
                {label}
              </button>
            ))}
          </div>
        }
      />
      {notice && (
        <div role="status" className="flex items-start justify-between gap-3 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
          <span>{notice}</span>
          <button type="button" aria-label="ปิด" onClick={() => setNotice('')} className="shrink-0 text-amber-700 hover:text-amber-900">
            <X className="h-4 w-4" />
          </button>
        </div>
      )}
      <Panel title={apvView === 'pending' ? 'รายการรออนุมัติ' : 'รายการอนุมัติ/ไม่อนุมัติแล้ว'}>
        {loading ? (
          <div className="py-8"><MascotLoader text="กำลังโหลดรายการ" size={80} /></div>
        ) : error ? (
          <p className="text-sm text-rose-600">{error}</p>
        ) : apvView === 'pending' ? (
          (() => {
            const mine = pending.filter(p => p.tab === 'mine');
            const delegable = pending.filter(p => p.tab === 'delegable');
            const shownRaw = pendingTab === 'mine' ? mine : delegable;
            const shown = doc ? [...shownRaw].sort((a, b) => Number(b.form_id === doc) - Number(a.form_id === doc)) : shownRaw;
            const pill = (active: boolean) =>
              `rounded-full px-3 py-1.5 text-xs font-medium transition-colors ${active ? 'bg-brand-600 text-white shadow-sm' : 'text-gray-600 hover:text-brand-600'}`;
            return (
              <>
                <div className="mb-4 inline-flex items-center gap-0.5 rounded-full bg-gray-100 p-0.5">
                  <button type="button" onClick={() => setPendingTab('mine')} className={pill(pendingTab === 'mine')}>
                    {`รอฉันอนุมัติ (${mine.length})`}
                  </button>
                  <button type="button" onClick={() => setPendingTab('delegable')} className={pill(pendingTab === 'delegable')}>
                    {`อนุมัติแทนได้ (${delegable.length})`}
                  </button>
                </div>
                {shown.length === 0 ? (
                  <EmptyState text={pendingTab === 'mine' ? 'ไม่มีรายการรอคุณอนุมัติ' : 'ไม่มีรายการที่อนุมัติแทนได้'} />
                ) : (
                  <div className="space-y-4">
                    {shown.map(item => (
                      <PendingCard
                        key={item.form_id}
                        item={item}
                        processing={processingId === item.form_id}
                        highlight={!!doc && item.form_id === doc}
                        onApprove={() => handleApprove(item)}
                        onReject={() => handleReject(item)}
                      />
                    ))}
                  </div>
                )}
              </>
            );
          })()
        ) : items.length === 0 ? (
          <EmptyState text="ไม่มีรายการอนุมัติ/ไม่อนุมัติแล้ว" />
        ) : (
          <div className="space-y-4">
            {items.map(item => (
              <ApprovalCard
                key={item.form_id}
                item={item}
                apvView={apvView}
                processing={processingId === item.form_id}
                onApprove={() => handleApprove(item)}
                onReject={() => handleReject(item)}
              />
            ))}
          </div>
        )}
      </Panel>
    </FinanceShell>
  );
}

export default function FinanceApprovalsPage() {
  return (
    <Suspense fallback={<FinanceShell title="อนุมัติเบิกเงิน Advance"><Panel title="รายการรออนุมัติ"><div className="py-8"><MascotLoader text="กำลังโหลดรายการ" size={80} /></div></Panel></FinanceShell>}>
      <FinanceApprovals />
    </Suspense>
  );
}
