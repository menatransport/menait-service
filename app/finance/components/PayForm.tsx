'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { bankLabel, formatAccountNo } from '@/lib/finance/bank';
import { toBkkDate } from '@/lib/finance/dates';
import { CLEAR_DUE_DAYS, addDays, parseAmount } from '@/lib/finance/status';
import { putAction, showAlert, uploadFiles } from '../api';
import type { AdvanceDetail } from '../types';
import { DateField } from './DateField';
import { FilePicker } from './FilePicker';
import { Panel } from './FinanceShell';

export function PayForm({ detail, onSaved }: {
  detail: AdvanceDetail; onSaved: (d: AdvanceDetail) => void;
}) {
  const fin = detail.fin;
  const isEdit = detail.status === 'AWAITING_CLEARING';
  const [paymentDocNo, setPaymentDocNo] = useState(fin?.payment_doc_no ?? '');
  const [purpose, setPurpose] = useState(fin?.purpose ?? detail.request.purpose ?? '');
  const [amount, setAmount] = useState(String(fin?.amount_paid ?? detail.request.amount ?? ''));
  const initialTransfer = fin?.transfer_date ?? toBkkDate(detail.request.use_date);
  const [transferDate, setTransferDate] = useState(initialTransfer);
  const [dueDate, setDueDate] = useState(fin?.clear_due_date ?? (initialTransfer ? addDays(initialTransfer, CLEAR_DUE_DAYS) : ''));
  const [dueTouched, setDueTouched] = useState(Boolean(fin?.clear_due_date));
  const [files, setFiles] = useState<File[]>([]);
  const [saving, setSaving] = useState(false);

  const onTransferDate = (value: string) => {
    setTransferDate(value);
    if (!dueTouched) setDueDate(addDays(value, CLEAR_DUE_DAYS));
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    const amountNum = parseAmount(amount);
    if (amountNum === null || amountNum < 0) return showAlert({ icon: 'warning', title: 'กรุณาระบุยอดเงิน (ไม่ติดลบ)' });
    if (!transferDate) return showAlert({ icon: 'warning', title: 'กรุณาระบุวันที่โอนเงิน' });
    if (dueDate && dueDate < transferDate) return showAlert({ icon: 'warning', title: 'กำหนดการเคลียร์ต้องไม่ก่อนวันที่โอนเงิน' });
    setSaving(true);
    try {
      const saved = await putAction(detail.form_id, 'pay', {
        payment_doc_no: paymentDocNo,
        purpose, amount_paid: amountNum, transfer_date: transferDate, clear_due_date: dueDate || null,
        is_edit: isEdit,
      });
      const failed = await uploadFiles(detail.form_id, files, 'pay');
      setFiles([]);
      await showAlert({
        icon: failed.length ? 'warning' : 'success',
        title: isEdit ? 'แก้ไขข้อมูลการจ่ายแล้ว' : 'บันทึกการจ่ายเงินแล้ว',
        text: failed.length ? `อัปโหลดไม่สำเร็จ: ${failed.join(', ')}` : undefined,
      });
      onSaved(saved);
    } catch (err) {
      showAlert({ icon: 'error', title: 'บันทึกไม่สำเร็จ', text: (err as Error).message });
    } finally {
      setSaving(false);
    }
  };

  return (
    <Panel title={isEdit ? 'แก้ไขข้อมูลการจ่ายเงิน' : 'จ่ายเงิน'}>
      <form onSubmit={submit} className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        {detail.request.account_no && (
          <div className="sm:col-span-2 rounded-xl border border-[#8ce4cb] bg-[#8ce4cb]/10 p-3 text-sm">
            <p className="mb-1 font-semibold text-[#055058]">โอนเข้าบัญชี</p>
            <p>{bankLabel(detail.request.bank)} · <span className="font-mono">{formatAccountNo(detail.request.account_no)}</span>
              <button type="button" className="ml-2 text-xs text-[#026a75] underline" aria-label="คัดลอกเลขที่บัญชี"
                onClick={() => navigator.clipboard?.writeText(detail.request.account_no ?? '')
                  .then(() => showAlert({ icon: 'success', title: 'คัดลอกเลขที่บัญชีแล้ว', timer: 1200, showConfirmButton: false }))
                  .catch(() => showAlert({ icon: 'error', title: 'คัดลอกไม่สำเร็จ' }))}>
                คัดลอก
              </button>
            </p>
            <p className="text-gray-600">ชื่อบัญชี: {detail.request.account_name ?? '-'}</p>
            {detail.request.cost_center && <p className="text-gray-600">ศูนย์ค่าใช้จ่าย: {detail.request.cost_center}</p>}
          </div>
        )}
        <label className="space-y-1 text-sm">เลขที่เอกสารจ่าย
          <Input value={paymentDocNo} onChange={e => setPaymentDocNo(e.target.value)} disabled={saving} />
        </label>
        <label className="space-y-1 text-sm">ยอดเงิน (บาท) *
          <Input inputMode="decimal" value={amount} onChange={e => setAmount(e.target.value)} disabled={saving} />
        </label>
        <label className="space-y-1 text-sm">วันที่โอนเงิน *
          <DateField value={transferDate} onChange={onTransferDate} disabled={saving} />
        </label>
        <label className="space-y-1 text-sm">กำหนดการเคลียร์ (ค่าเริ่มต้น +{CLEAR_DUE_DAYS} วัน)
          <DateField value={dueDate} min={transferDate || undefined} onChange={v => { setDueTouched(true); setDueDate(v); }} disabled={saving} />
        </label>
        <label className="space-y-1 text-sm sm:col-span-2">วัตถุประสงค์
          <Textarea value={purpose} onChange={e => setPurpose(e.target.value)} disabled={saving} />
        </label>
        <div className="sm:col-span-2">
          <p className="mb-1 text-sm">แนบหลักฐานการจ่าย (สลิปโอน)</p>
          <FilePicker files={files} onChange={setFiles} disabled={saving} />
        </div>
        <div className="sm:col-span-2">
          <Button type="submit" disabled={saving} className="w-full bg-[#026a75] hover:bg-[#055058]">
            {saving ? 'กำลังบันทึก...' : isEdit ? 'บันทึกการแก้ไข' : 'บันทึกการจ่ายเงิน'}
          </Button>
        </div>
      </form>
    </Panel>
  );
}
