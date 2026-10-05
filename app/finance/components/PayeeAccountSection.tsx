'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { AlertCircle, Landmark, Paperclip, RefreshCw } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { BANKS, bankLabel, accountNoError, formatAccountNo } from '@/lib/finance/bank';
import { checkPayeeFiles, PAYEE_SELF, PAYEE_SUPPLIER, selfPayeeState, type PayeeMe, type SelfPayeeState } from '@/lib/finance/payee';
import { fetchJson, showAlert, showConfirm, uploadPayeeFiles } from '../api';
import { RequestPayeeDialog } from './RequestPayeeDialog';

export type PayeeSectionStatus = { loaded: boolean; state: SelfPayeeState };

const fmtDate = (iso: string | null) => {
  if (!iso) return '-';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '-';
  return d.toLocaleDateString('th-TH', { day: '2-digit', month: '2-digit', year: '2-digit', timeZone: 'Asia/Bangkok' });
};

const inputCls = 'w-full rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm focus:border-brand-600 focus:outline-none';

/** "บัญชีรับเงิน" section of the ADV new-request page: own account (Master) or supplier account. */
export function PayeeAccountSection({ errors, onPayeeChange, onStatusChange, fullName, disabled }: {
  errors: Record<string, string>;
  onPayeeChange: (patch: Record<string, any>) => void;
  onStatusChange: (s: PayeeSectionStatus) => void;
  fullName: string;
  disabled?: boolean;
}) {
  const [type, setType] = useState<string>(PAYEE_SELF);
  const [me, setMe] = useState<PayeeMe | null>(null);
  const [loadError, setLoadError] = useState('');
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [supplier, setSupplier] = useState({ bank: '', no: '', name: '' });
  const attachRef = useRef<HTMLInputElement>(null);
  const attachingRef = useRef(false);

  const loadMe = useCallback(async () => {
    setLoading(true);
    setLoadError('');
    try {
      setMe(await fetchJson<PayeeMe>('/api/finance/payee-accounts/me'));
    } catch (err) {
      setLoadError((err as Error).message || 'โหลดบัญชีรับเงินไม่สำเร็จ');
    } finally {
      setLoading(false);
    }
  }, []);
  useEffect(() => { loadMe(); }, [loadMe]);

  const state = selfPayeeState(me);
  const loaded = !loading && !loadError;
  useEffect(() => { onStatusChange({ loaded, state }); }, [loaded, state, onStatusChange]);

  // Mirror the choice into the page values (the BE overwrites SELF values from the master anyway).
  const account = me?.account?.status === 'ACTIVE' ? me.account : null;
  useEffect(() => {
    if (type === PAYEE_SELF) {
      onPayeeChange({
        adv_payee_type: PAYEE_SELF,
        adv_bank: account?.bank ?? '',
        adv_account_no: account?.account_no ?? '',
        adv_account_name: account?.account_name ?? '',
      });
    } else {
      onPayeeChange({
        adv_payee_type: PAYEE_SUPPLIER,
        adv_bank: supplier.bank,
        adv_account_no: supplier.no,
        adv_account_name: supplier.name,
      });
    }
  }, [type, account, supplier, onPayeeChange]);

  const cancelRequest = async () => {
    if (!me?.request) return;
    const ok = await showConfirm({ icon: 'warning', title: 'ยกเลิกคำขอบัญชีรับเงิน?', text: 'ต้องการยกเลิกคำขอที่ส่งไปแล้วหรือไม่' });
    if (!ok.isConfirmed) return;
    setBusy(true);
    try {
      await fetchJson(`/api/finance/payee-requests/${me.request.id}/cancel`, { method: 'PUT' });
      await loadMe();
    } catch (err) {
      await showAlert({ icon: 'error', title: 'ยกเลิกคำขอไม่สำเร็จ', text: (err as Error).message });
    } finally {
      setBusy(false);
    }
  };

  const attachMore = async (list: FileList | null) => {
    const picked = Array.from(list ?? []);
    if (!me?.request || !picked.length || attachingRef.current) return;
    const { valid, warnings } = checkPayeeFiles(picked);
    const files = valid.map(i => picked[i]);
    if (warnings.length) await showAlert({ icon: 'warning', title: 'บางไฟล์แนบไม่ได้', text: warnings.join('\n') });
    if (!files.length) return;
    attachingRef.current = true;
    setBusy(true);
    try {
      const failed = await uploadPayeeFiles(me.request.id, files);
      await showAlert(failed.length
        ? { icon: 'warning', title: 'อัปโหลดไฟล์ไม่สำเร็จ', text: failed.join(', ') }
        : { icon: 'success', title: 'แนบไฟล์เพิ่มแล้ว' });
    } finally {
      attachingRef.current = false;
      setBusy(false);
    }
  };

  const req = me?.request ?? null;
  const reqDetail = req && (
    <p className="text-xs text-gray-600 break-words">
      {bankLabel(req.bank)} · {formatAccountNo(req.account_no)} · {req.account_name}
    </p>
  );

  const pendingBox = req && (
    <div className="rounded-xl bg-amber-50 px-3 py-2.5 space-y-2">
      <p className="text-sm font-medium text-amber-800">ส่งคำขอแล้ว รอบัญชีตรวจสอบ (ส่งเมื่อ {fmtDate(req.created_at)})</p>
      {reqDetail}
      <div className="flex flex-wrap gap-2">
        <button type="button" disabled={busy} onClick={cancelRequest}
          className="rounded-lg border border-rose-200 bg-white px-3 py-1.5 text-xs font-medium text-rose-700 disabled:opacity-60">ยกเลิกคำขอ</button>
        <button type="button" disabled={busy} onClick={() => attachRef.current?.click()}
          className="inline-flex items-center gap-1 rounded-lg border border-gray-200 bg-white px-3 py-1.5 text-xs font-medium text-gray-700 disabled:opacity-60">
          <Paperclip className="w-3.5 h-3.5" />แนบไฟล์เพิ่ม
        </button>
        <input ref={attachRef} type="file" multiple accept="image/jpeg,image/png,image/webp,application/pdf" className="hidden"
          onChange={(e) => { attachMore(e.target.files); e.target.value = ''; }} />
      </div>
    </div>
  );

  const radio = (value: string, label: string) => (
    <label className={`flex items-center gap-2 rounded-xl border px-3 py-2.5 text-sm cursor-pointer ${type === value ? 'border-brand-600 bg-brand-50 text-brand-800 font-medium' : 'border-gray-200 bg-white text-gray-700'} ${disabled ? 'opacity-60' : ''}`}>
      <input type="radio" name="adv_payee_type" value={value} checked={type === value} disabled={disabled}
        onChange={() => setType(value)} className="accent-brand-600" />
      {label}
    </label>
  );

  const selfBody = () => {
    if (loading) return <p className="rounded-xl bg-gray-50 px-3 py-2.5 text-sm text-gray-500">กำลังโหลดบัญชีรับเงิน...</p>;
    if (loadError) {
      return (
        <div className="flex flex-wrap items-center gap-2 rounded-xl bg-rose-50 px-3 py-2.5 text-sm text-rose-700">
          <AlertCircle className="w-4 h-4 shrink-0" />
          <span className="min-w-0 break-words">โหลดบัญชีรับเงินไม่สำเร็จ: {loadError}</span>
          <button type="button" onClick={loadMe} className="inline-flex items-center gap-1 font-medium underline underline-offset-2">
            <RefreshCw className="w-3.5 h-3.5" />ลองอีกครั้ง
          </button>
        </div>
      );
    }
    if (state === 'ready' || state === 'ready_change_pending') {
      return (
        <div className="rounded-xl bg-mint-300/25 px-3 py-2.5 text-sm space-y-1">
          <p className="font-medium text-brand-800 break-words">
            ธนาคารกสิกรไทย · {formatAccountNo(account!.account_no)} · {account!.account_name}
          </p>
          {state === 'ready_change_pending' ? (
            <>
              <p className="text-xs text-amber-700">มีคำขอเปลี่ยนบัญชีรอตรวจสอบ</p>
              {req && pendingBox}
            </>
          ) : (
            <p className="text-xs text-gray-500">
              หากต้องการเปลี่ยนบัญชี{' '}
              <button type="button" disabled={disabled || busy} onClick={() => setDialogOpen(true)}
                className="text-brand-600 underline underline-offset-2">ขอเปลี่ยนบัญชี</button>
            </p>
          )}
        </div>
      );
    }
    if (state === 'pending' && req) return pendingBox;
    return (
      <div className="rounded-xl bg-amber-50 px-3 py-2.5 space-y-2">
        {state === 'rejected' && req ? (
          <>
            <p className="text-sm font-medium text-rose-700">คำขอบัญชีรับเงินถูกปฏิเสธ</p>
            {reqDetail}
            <p className="text-xs text-gray-700 break-words">เหตุผล: {req.review_remark || '-'}</p>
          </>
        ) : (
          <p className="text-sm font-medium text-amber-800">ยังไม่มีบัญชีรับเงินในระบบ</p>
        )}
        <button type="button" disabled={disabled || busy} onClick={() => setDialogOpen(true)}
          className="rounded-lg bg-brand-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-brand-700 disabled:opacity-60">
          {state === 'rejected' ? 'ขอใหม่อีกครั้ง' : 'ขอเพิ่มบัญชีรับเงิน'}
        </button>
      </div>
    );
  };

  const supplierBody = () => (
    <div className="space-y-3">
      <div>
        <label className="mb-1.5 block text-sm font-medium text-gray-700">ธนาคาร <span className="text-rose-600">*</span></label>
        <select value={supplier.bank} disabled={disabled} className={inputCls}
          onChange={(e) => setSupplier(s => ({ ...s, bank: e.target.value }))}>
          <option value="">เลือกธนาคาร</option>
          {Object.entries(BANKS).map(([k, b]) => <option key={k} value={k}>{b.label}</option>)}
        </select>
        {errors.adv_bank && <p className="mt-1 text-xs text-rose-600">{errors.adv_bank}</p>}
      </div>
      <div>
        <label className="mb-1.5 block text-sm font-medium text-gray-700">เลขที่บัญชี <span className="text-rose-600">*</span></label>
        <Input value={supplier.no} inputMode="numeric" disabled={disabled}
          onChange={(e) => setSupplier(s => ({ ...s, no: e.target.value }))} />
        {(errors.adv_account_no || (supplier.no && accountNoError(supplier.bank, supplier.no))) && (
          <p className="mt-1 text-xs text-rose-600">{errors.adv_account_no || accountNoError(supplier.bank, supplier.no)}</p>
        )}
      </div>
      <div>
        <label className="mb-1.5 block text-sm font-medium text-gray-700">ชื่อบัญชี <span className="text-rose-600">*</span></label>
        <Input value={supplier.name} disabled={disabled}
          onChange={(e) => setSupplier(s => ({ ...s, name: e.target.value }))} />
        {errors.adv_account_name && <p className="mt-1 text-xs text-rose-600">{errors.adv_account_name}</p>}
      </div>
    </div>
  );

  return (
    <div className="space-y-3">
      <p className="border-t border-gray-100 pt-5 flex items-center gap-2 text-sm font-semibold text-brand-800">
        <Landmark className="w-4 h-4 text-mint-600" /> บัญชีรับเงิน
      </p>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
        {radio(PAYEE_SELF, 'บัญชีตัวเอง')}
        {radio(PAYEE_SUPPLIER, 'บัญชี Supplier')}
      </div>
      {type === PAYEE_SELF ? selfBody() : supplierBody()}
      <RequestPayeeDialog open={dialogOpen} onOpenChange={setDialogOpen} defaultName={fullName} onDone={loadMe} />
    </div>
  );
}
