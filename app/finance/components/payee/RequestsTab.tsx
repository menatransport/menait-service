'use client';

import { useEffect, useState } from 'react';
import { ExternalLink, FileText } from 'lucide-react';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import { MascotLoader } from '@/components/loading';
import { formatAccountNo } from '@/lib/finance/bank';
import { formatDate } from '@/lib/finance/status';
import type { PayeeRequest } from '@/lib/finance/payee';
import { fetchJson, showAlert, showConfirm } from '../../api';
import { Field } from '../FinanceShell';

type PayeeFile = { key: string; fileName: string; url: string };

const BTN_REJECT = 'inline-flex items-center gap-1.5 rounded-xl border border-rose-200 bg-white px-4 py-2 text-sm font-medium text-rose-600 transition-colors hover:bg-rose-50 disabled:cursor-not-allowed disabled:opacity-50';
const BTN_APPROVE = 'inline-flex items-center gap-1.5 rounded-xl bg-linear-to-r from-brand-600 to-brand-500 px-5 py-2 text-sm font-semibold text-white shadow-md transition-all hover:from-brand-700 hover:to-brand-600 hover:shadow-lg disabled:cursor-not-allowed disabled:opacity-50';

const currentText = (r: PayeeRequest) =>
  r.current_account ? `เปลี่ยนจาก ${formatAccountNo(r.current_account.account_no)} (${r.current_account.account_name})` : null;

export function RequestsTab({ requests, loading, onOpen }: {
  requests: PayeeRequest[] | null; loading: boolean; onOpen: (id: number) => void;
}) {
  if (loading) return <div className="py-12"><MascotLoader text="กำลังโหลดคำขอ" size={80} /></div>;
  if (!requests?.length) {
    return (
      <div className="px-6 py-16 text-center text-gray-500">
        <FileText size={56} className="mx-auto mb-4 text-gray-300" />
        <p className="text-lg">ไม่มีคำขอรอตรวจ</p>
      </div>
    );
  }
  return (
    <ul className="divide-y divide-gray-100">
      {requests.map(r => (
        <li key={r.id}>
          <button type="button" onClick={() => onOpen(r.id)} className="grid w-full gap-2 px-4 py-3 text-left transition-colors hover:bg-gray-50 sm:grid-cols-[1.2fr_1.5fr_auto] sm:items-center lg:px-5">
            <div className="min-w-0">
              <p className="font-medium text-gray-800">{r.employee_name ?? r.employee_id}</p>
              <p className="text-xs text-gray-500">{r.employee_id}{r.department ? ` · ${r.department}` : ''}</p>
            </div>
            <div className="min-w-0">
              <p className="text-sm font-medium tabular-nums text-brand-800">{formatAccountNo(r.account_no)}</p>
              <p className="truncate text-xs text-gray-600">{r.account_name}</p>
              {currentText(r) && <p className="text-xs text-amber-700">{currentText(r)}</p>}
            </div>
            <p className="text-xs text-gray-500 sm:text-right">ส่งเมื่อ {formatDate(r.created_at)}</p>
          </button>
        </li>
      ))}
    </ul>
  );
}

/** Detail + approve / reject for one request (also reached by the ?request= deep link). */
export function RequestReviewDialog({ requestId, onClose, onChanged }: {
  requestId: number | null; onClose: () => void; onChanged: () => void | Promise<void>;
}) {
  const [req, setReq] = useState<PayeeRequest | null>(null);
  const [files, setFiles] = useState<PayeeFile[] | null>(null);
  const [error, setError] = useState('');
  const [rejecting, setRejecting] = useState(false);
  const [reason, setReason] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    setReq(null); setFiles(null); setError(''); setRejecting(false); setReason('');
    if (requestId === null) return;
    let live = true;
    fetchJson<PayeeRequest>(`/api/finance/payee-requests/${requestId}`)
      .then(r => { if (live) setReq(r); })
      .catch(e => { if (live) setError(e.message); });
    fetchJson<{ files: PayeeFile[] }>(`/api/finance/payee-requests/${requestId}/files`)
      .then(r => { if (live) setFiles(r.files ?? []); })
      .catch(() => { if (live) setFiles([]); });
    return () => { live = false; };
  }, [requestId]);

  const pending = req?.status === 'PENDING';

  const act = async (kind: 'approve' | 'reject') => {
    if (!req) return;
    if (kind === 'reject' && !reason.trim()) { await showAlert({ icon: 'warning', title: 'กรุณาระบุเหตุผลที่ไม่อนุมัติ' }); return; }
    const res = await showConfirm(kind === 'approve'
      ? { icon: 'question', title: 'อนุมัติบัญชีนี้?', text: `${req.employee_name ?? req.employee_id} · ${formatAccountNo(req.account_no)}` }
      : { icon: 'warning', title: 'ไม่อนุมัติคำขอนี้?', text: reason.trim() });
    if (!res.isConfirmed) return;
    setBusy(true);
    try {
      await fetchJson(`/api/finance/payee-requests/${req.id}/${kind}`, {
        method: 'PUT',
        ...(kind === 'reject' ? { body: JSON.stringify({ review_remark: reason.trim() }) } : {}),
      });
      onClose();
      try { await onChanged(); } catch { /* lists show their own error state */ }
      await showAlert({ icon: 'success', title: kind === 'approve' ? 'อนุมัติแล้ว' : 'ไม่อนุมัติคำขอแล้ว' });
    } catch (err) {
      await showAlert({ icon: 'error', title: 'ดำเนินการไม่สำเร็จ', text: (err as Error).message });
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog open={requestId !== null} onOpenChange={o => { if (!o) onClose(); }}>
      <DialogContent className="max-h-[92vh] overflow-y-auto rounded-2xl sm:max-w-lg">
        <DialogHeader className="text-left">
          <DialogTitle className="text-lg font-semibold text-brand-800">คำขอบัญชีรับเงิน #{requestId}</DialogTitle>
          <DialogDescription className="text-xs text-gray-500">ตรวจสมุดบัญชีที่แนบกับข้อมูลที่ขอ ก่อนอนุมัติเข้า Master</DialogDescription>
        </DialogHeader>

        {error && <p className="rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}
        {!req && !error && <p className="py-6 text-center text-sm text-gray-500">กำลังโหลด...</p>}

        {req && (
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <Field label="พนักงาน" value={req.employee_name ?? req.employee_id} />
              <Field label="แผนก" value={req.department ?? '-'} />
              <Field label="เลขที่บัญชี (K-Bank)" value={formatAccountNo(req.account_no)} />
              <Field label="ชื่อบัญชี" value={req.account_name} />
              <Field label="ส่งเมื่อ" value={formatDate(req.created_at)} />
              {req.remark && <Field label="หมายเหตุจากผู้ขอ" value={req.remark} />}
            </div>
            {currentText(req) && (
              <p className="rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800">{currentText(req)}</p>
            )}
            {!pending && (
              <p className="rounded-xl border border-gray-200 bg-gray-50 px-3 py-2 text-sm text-gray-700">
                คำขอนี้ไม่อยู่ในสถานะรอตรวจแล้ว ({req.status}){req.review_remark ? ` · ${req.review_remark}` : ''}
              </p>
            )}

            <div>
              <p className="mb-1.5 text-xs font-semibold text-gray-600">ไฟล์แนบ (bookbank)</p>
              {files === null ? <p className="text-sm text-gray-500">กำลังโหลดไฟล์...</p>
                : files.length === 0 ? <p className="text-sm text-gray-500">ไม่มีไฟล์แนบ</p>
                : (
                  <ul className="space-y-1.5">
                    {files.map(f => (
                      <li key={f.key}>
                        <a href={f.url} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1.5 text-sm text-brand-700 underline-offset-2 hover:underline">
                          <ExternalLink className="size-3.5" />{f.fileName}
                        </a>
                      </li>
                    ))}
                  </ul>
                )}
            </div>

            {pending && rejecting && (
              <div>
                <label htmlFor="payee-reject-reason" className="mb-1 block text-xs font-semibold text-gray-600">เหตุผลที่ไม่อนุมัติ (จำเป็น)</label>
                <Textarea id="payee-reject-reason" value={reason} onChange={e => setReason(e.target.value)} rows={3} maxLength={500} />
              </div>
            )}

            {pending && (
              <div className="flex flex-wrap justify-end gap-2 pt-1">
                {rejecting ? (
                  <>
                    <button type="button" className="rounded-xl px-4 py-2 text-sm text-gray-600 hover:bg-gray-100" onClick={() => { setRejecting(false); setReason(''); }} disabled={busy}>ยกเลิก</button>
                    <button type="button" className={BTN_REJECT} onClick={() => act('reject')} disabled={busy || !reason.trim()}>ยืนยันไม่อนุมัติ</button>
                  </>
                ) : (
                  <>
                    <button type="button" className={BTN_REJECT} onClick={() => setRejecting(true)} disabled={busy}>ไม่อนุมัติ</button>
                    <button type="button" className={BTN_APPROVE} onClick={() => act('approve')} disabled={busy}>อนุมัติ</button>
                  </>
                )}
              </div>
            )}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
