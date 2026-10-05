'use client';

import { useEffect, useRef, useState } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { formatAccountNo, normalizeAccountNo } from '@/lib/finance/bank';
import { checkPayeeFiles, kbankAccountError, PAYEE_MAX_FILES, type PayeeRequest } from '@/lib/finance/payee';
import { fetchJson, showAlert, uploadPayeeFiles } from '../api';
import { FilePicker } from './FilePicker';

/** Dialog: request a new (or changed) K-Bank own-account payee. Calls onDone after the request is created. */
export function RequestPayeeDialog({ open, onOpenChange, defaultName, onDone }: {
  open: boolean; onOpenChange: (open: boolean) => void; defaultName: string; onDone: () => void | Promise<void>;
}) {
  const [accountNo, setAccountNo] = useState('');
  const [accountName, setAccountName] = useState(defaultName);
  const [remark, setRemark] = useState('');
  const [files, setFiles] = useState<File[]>([]);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);

  const nameRef = useRef(defaultName);
  nameRef.current = defaultName;
  const submittingRef = useRef(false);
  const wasOpen = useRef(false);
  useEffect(() => {
    if (open && !wasOpen.current) { setAccountNo(''); setAccountName(nameRef.current); setRemark(''); setFiles([]); setErrors({}); }
    wasOpen.current = open;
  }, [open]);

  const liveAccountError = accountNo && kbankAccountError(accountNo) ? kbankAccountError(accountNo) : null;

  const submit = async () => {
    if (submittingRef.current) return;
    const next: Record<string, string> = {};
    const accErr = kbankAccountError(accountNo);
    if (accErr) next.account_no = accErr;
    if (!accountName.trim()) next.account_name = 'กรุณาระบุชื่อบัญชี';
    if (files.length < 1) next.files = 'กรุณาแนบ bookbank อย่างน้อย 1 ไฟล์';
    else if (files.length > PAYEE_MAX_FILES) next.files = `แนบไฟล์ได้ไม่เกิน ${PAYEE_MAX_FILES} ไฟล์`;
    else { const { warnings } = checkPayeeFiles(files); if (warnings.length) next.files = warnings.join(' / '); }
    setErrors(next);
    if (Object.keys(next).length) return;

    submittingRef.current = true;
    setBusy(true);
    let created: PayeeRequest;
    try {
      created = await fetchJson<PayeeRequest>('/api/finance/payee-requests', {
        method: 'POST',
        body: JSON.stringify({ account_no: normalizeAccountNo(accountNo), account_name: accountName.trim(), remark: remark.trim() }),
      });
    } catch (err) {
      submittingRef.current = false;
      setBusy(false);
      await showAlert({ icon: 'error', title: 'ส่งคำขอไม่สำเร็จ', text: (err as Error).message });
      return;
    }
    const failed = await uploadPayeeFiles(created.id, files);
    onOpenChange(false);
    try { await onDone(); } catch { /* the section shows its own retry state */ }
    submittingRef.current = false;
    setBusy(false);
    if (failed.length) {
      await showAlert({ icon: 'warning', title: 'อัปโหลดไฟล์ไม่สำเร็จ กรุณาแนบไฟล์เพิ่มจากกล่องคำขอ', text: failed.join(', ') });
    } else {
      await showAlert({ icon: 'success', title: 'ส่งคำขอแล้ว รอบัญชีตรวจสอบ' });
    }
  };

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!busy) onOpenChange(o); }}>
      <DialogContent className="max-h-[92vh] overflow-y-auto rounded-2xl sm:max-w-lg">
        <DialogHeader className="text-left">
          <DialogTitle className="text-lg font-semibold text-brand-800">ขอเพิ่มบัญชีรับเงิน</DialogTitle>
          <DialogDescription className="text-xs text-gray-500">บัญชีกสิกรไทยของตัวเอง — ส่งให้บัญชีตรวจสอบก่อนใช้งาน</DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div>
            <label className="mb-1.5 block text-sm font-medium text-gray-700">เลขที่บัญชีกสิกรไทย <span className="text-rose-600">*</span></label>
            <Input value={accountNo} inputMode="numeric" disabled={busy} placeholder="เช่น 123-4-56789-0"
              onChange={(e) => { setAccountNo(e.target.value); setErrors(p => ({ ...p, account_no: '' })); }} />
            {(errors.account_no || liveAccountError) && <p className="mt-1 text-xs text-rose-600">{errors.account_no || liveAccountError}</p>}
            {!liveAccountError && accountNo && <p className="mt-1 text-xs text-gray-400">{formatAccountNo(accountNo)}</p>}
          </div>
          <div>
            <label className="mb-1.5 block text-sm font-medium text-gray-700">ชื่อบัญชี <span className="text-rose-600">*</span></label>
            <Input value={accountName} disabled={busy}
              onChange={(e) => { setAccountName(e.target.value); setErrors(p => ({ ...p, account_name: '' })); }} />
            {errors.account_name && <p className="mt-1 text-xs text-rose-600">{errors.account_name}</p>}
          </div>
          <div>
            <p className="mb-1.5 text-sm font-medium text-gray-700">แนบ bookbank <span className="text-rose-600">*</span></p>
            <FilePicker files={files} onChange={(f) => { setFiles(f); setErrors(p => ({ ...p, files: '' })); }} disabled={busy} />
            {errors.files && <p className="mt-1 text-xs text-rose-600">{errors.files}</p>}
          </div>
          <div>
            <label className="mb-1.5 block text-sm font-medium text-gray-700">หมายเหตุ</label>
            <Input value={remark} disabled={busy} onChange={(e) => setRemark(e.target.value)} />
          </div>
          <Button type="button" onClick={submit} disabled={busy}
            className="w-full h-11 bg-linear-to-r from-brand-600 to-brand-500 hover:from-brand-700 hover:to-brand-600 text-white font-semibold rounded-xl disabled:opacity-60">
            {busy ? 'กำลังส่ง...' : 'ส่งคำขอ'}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
