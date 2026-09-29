'use client';

import { useCallback, useEffect, useState } from 'react';
import { CheckCircle2, Clock, XCircle } from 'lucide-react';
import { useSessionContext } from '@/app/context/SessionContext';
import type { FormValue } from '@/app/mytickets/[id]/types';
import { formatBaht, formatDate } from '@/lib/finance/status';
import { fetchJson, showAlert, showConfirm } from '../api';
import type { PendingApprovalItem } from '../types';
import { AttachmentPanel } from '../components/AttachmentPanel';
import { Field, FinanceShell, Panel } from '../components/FinanceShell';

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
    <span className="inline-flex items-center gap-1 rounded-full border border-emerald-200 bg-emerald-50 px-2.5 py-0.5 text-xs font-medium text-emerald-700">
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
    <div className="rounded-2xl border border-gray-100 bg-white p-4 shadow-sm sm:p-5">
      <div className="mb-3 flex flex-wrap items-start justify-between gap-2 border-b border-gray-100 pb-3">
        <div>
          <p className="text-sm font-semibold text-[#055058]">{item.form_id}</p>
          <p className="text-xs text-gray-500">{requesterName}{item.department_name_th ? ` · ${item.department_name_th}` : ''}</p>
        </div>
        <ApprovalStatusBadge apvView={apvView} item={item} />
      </div>

      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
        <Field label="จำนวนเงินที่ขอ" value={formatBaht(getAmount(item.values))} />
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
            className="rounded-xl border border-rose-200 bg-white px-4 py-2 text-sm font-medium text-rose-600 transition-colors hover:bg-rose-50 disabled:cursor-not-allowed disabled:opacity-50"
          >
            ไม่อนุมัติ
          </button>
          <button
            type="button"
            disabled={processing}
            onClick={onApprove}
            className="rounded-xl bg-[#026a75] px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-[#055058] disabled:cursor-not-allowed disabled:opacity-50"
          >
            อนุมัติ
          </button>
        </div>
      )}
    </div>
  );
}

function PendingCard({
  item, processing, onApprove, onReject,
}: {
  item: PendingApprovalItem; processing: boolean; onApprove: () => void; onReject: () => void;
}) {
  const { requester, request, tier } = item;
  const requesterName = requester?.name?.trim() || '-';

  return (
    <div className="rounded-2xl border border-gray-100 bg-white p-4 shadow-sm sm:p-5">
      <div className="mb-3 flex flex-wrap items-start justify-between gap-2 border-b border-gray-100 pb-3">
        <div>
          <p className="text-sm font-semibold text-[#055058]">{item.form_id}</p>
          <p className="text-xs text-gray-500">{requesterName}{requester?.department ? ` · ${requester.department}` : ''}</p>
        </div>
        <span className="inline-flex items-center gap-1 rounded-full border border-amber-200 bg-amber-50 px-2.5 py-0.5 text-xs font-medium text-amber-700">
          <Clock className="h-3 w-3" /> รออนุมัติ
        </span>
      </div>

      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
        <Field label="จำนวนเงินที่ขอ" value={formatBaht(request.amount)} />
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
          <p className="mb-2 text-xs text-gray-500">อนุมัติแทนได้ — มีผู้มีสิทธิ์ระดับ {tier.required_level}+ ที่ใกล้กว่า</p>
        )}
        <div className="flex justify-end gap-2">
          <button
            type="button"
            disabled={processing}
            onClick={onReject}
            className="rounded-xl border border-rose-200 bg-white px-4 py-2 text-sm font-medium text-rose-600 transition-colors hover:bg-rose-50 disabled:cursor-not-allowed disabled:opacity-50"
          >
            ไม่อนุมัติ
          </button>
          <button
            type="button"
            disabled={processing}
            onClick={onApprove}
            className="rounded-xl bg-[#026a75] px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-[#055058] disabled:cursor-not-allowed disabled:opacity-50"
          >
            อนุมัติ
          </button>
        </div>
      </div>
    </div>
  );
}

export default function FinanceApprovalsPage() {
  const { user } = useSessionContext();
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
      <Panel
        title={apvView === 'pending' ? 'รายการรออนุมัติ' : 'รายการอนุมัติ/ไม่อนุมัติแล้ว'}
        actions={
          <div className="flex items-center gap-0.5 rounded-full bg-gray-100 p-0.5">
            <button
              type="button"
              onClick={() => setApvView('pending')}
              className={`rounded-full px-3 py-1.5 text-xs font-medium transition-colors ${apvView === 'pending' ? 'bg-[#026a75] text-white shadow-sm' : 'text-gray-600 hover:text-[#026a75]'}`}
            >
              รออนุมัติ
            </button>
            <button
              type="button"
              onClick={() => setApvView('history')}
              className={`rounded-full px-3 py-1.5 text-xs font-medium transition-colors ${apvView === 'history' ? 'bg-[#026a75] text-white shadow-sm' : 'text-gray-600 hover:text-[#026a75]'}`}
            >
              อนุมัติ/ไม่อนุมัติแล้ว
            </button>
          </div>
        }
      >
        {loading ? (
          <p className="text-sm text-gray-400">กำลังโหลด...</p>
        ) : error ? (
          <p className="text-sm text-rose-600">{error}</p>
        ) : apvView === 'pending' ? (
          (() => {
            const mine = pending.filter(p => p.tab === 'mine');
            const delegable = pending.filter(p => p.tab === 'delegable');
            const shown = pendingTab === 'mine' ? mine : delegable;
            const pill = (active: boolean) =>
              `rounded-full px-3 py-1.5 text-xs font-medium transition-colors ${active ? 'bg-[#026a75] text-white shadow-sm' : 'text-gray-600 hover:text-[#026a75]'}`;
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
                  <p className="text-sm text-gray-500">{pendingTab === 'mine' ? 'ไม่มีรายการรอคุณอนุมัติ' : 'ไม่มีรายการที่อนุมัติแทนได้'}</p>
                ) : (
                  <div className="space-y-4">
                    {shown.map(item => (
                      <PendingCard
                        key={item.form_id}
                        item={item}
                        processing={processingId === item.form_id}
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
          <p className="text-sm text-gray-500">ไม่มีรายการอนุมัติ/ไม่อนุมัติแล้ว</p>
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
