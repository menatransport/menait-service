'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { CLEAR_DUE_DAYS, addDays, parseAmount } from '@/lib/finance/status';
import { putAction, showAlert, uploadFiles } from '../api';
import type { AdvanceDetail, FinAccount } from '../types';
import { FilePicker } from './FilePicker';
import { Panel } from './FinanceShell';

export function PayForm({ detail, accounts, onSaved }: {
  detail: AdvanceDetail; accounts: FinAccount[]; onSaved: (d: AdvanceDetail) => void;
}) {
  const fin = detail.fin;
  const [accCode, setAccCode] = useState(fin?.acc_code ?? '');
  const [voucherNo, setVoucherNo] = useState(fin?.voucher_no ?? '');
  const [voucherDate, setVoucherDate] = useState(fin?.voucher_date ?? '');
  const [paymentDocNo, setPaymentDocNo] = useState(fin?.payment_doc_no ?? '');
  const [purpose, setPurpose] = useState(fin?.purpose ?? detail.request.purpose ?? '');
  const [amount, setAmount] = useState(String(fin?.amount_paid ?? detail.request.amount ?? ''));
  const [transferDate, setTransferDate] = useState(fin?.transfer_date ?? '');
  const [dueDate, setDueDate] = useState(fin?.clear_due_date ?? '');
  const [dueTouched, setDueTouched] = useState(Boolean(fin));
  const [files, setFiles] = useState<File[]>([]);
  const [saving, setSaving] = useState(false);

  const onTransferDate = (value: string) => {
    setTransferDate(value);
    if (!dueTouched) setDueDate(addDays(value, CLEAR_DUE_DAYS));
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    const amountNum = parseAmount(amount);
    if (!accCode) return showAlert({ icon: 'warning', title: 'กรุณาเลือกรหัสบัญชี' });
    if (amountNum === null || amountNum < 0) return showAlert({ icon: 'warning', title: 'กรุณาระบุยอดเงิน (ไม่ติดลบ)' });
    if (!transferDate) return showAlert({ icon: 'warning', title: 'กรุณาระบุวันที่โอนเงิน' });
    if (dueDate && dueDate < transferDate) return showAlert({ icon: 'warning', title: 'กำหนดการเคลียร์ต้องไม่ก่อนวันที่โอนเงิน' });
    setSaving(true);
    try {
      const saved = await putAction(detail.form_id, 'pay', {
        acc_code: accCode, voucher_no: voucherNo, voucher_date: voucherDate || null, payment_doc_no: paymentDocNo,
        purpose, amount_paid: amountNum, transfer_date: transferDate, clear_due_date: dueDate || null,
      });
      const failed = await uploadFiles(detail.form_id, files, 'pay');
      setFiles([]);
      await showAlert({
        icon: failed.length ? 'warning' : 'success',
        title: fin ? 'แก้ไขข้อมูลการจ่ายแล้ว' : 'บันทึกการจ่ายเงินแล้ว',
        text: failed.length ? `อัปโหลดไม่สำเร็จ: ${failed.join(', ')}` : undefined,
      });
      onSaved(saved);
    } catch (err) {
      showAlert({ icon: 'error', title: 'บันทึกไม่สำเร็จ', text: (err as Error).message });
    } finally {
      setSaving(false);
    }
  };

  const activeAccounts = accounts.filter(a => a.is_active || a.acc_code === accCode);

  return (
    <Panel title={fin ? 'แก้ไขข้อมูลการจ่ายเงิน' : 'บันทึกการจ่ายเงิน'}>
      <form onSubmit={submit} className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <label className="space-y-1 text-sm sm:col-span-2">รหัสบัญชี (เงินสดย่อยที่จ่าย) *
          <select value={accCode} onChange={e => setAccCode(e.target.value)} disabled={saving}
            className="h-11 w-full rounded-xl border border-gray-200 bg-white px-3 text-sm">
            <option value="">— เลือกบัญชี —</option>
            {activeAccounts.map(a => <option key={a.acc_code} value={a.acc_code}>{a.acc_code} {a.acc_name}</option>)}
          </select>
        </label>
        <label className="space-y-1 text-sm">เลขที่ใบเบิก
          <Input value={voucherNo} onChange={e => setVoucherNo(e.target.value)} placeholder="เช่น SADV2607-005" disabled={saving} />
        </label>
        <label className="space-y-1 text-sm">วันที่ตั้งเบิก
          <Input type="date" value={voucherDate} onChange={e => setVoucherDate(e.target.value)} disabled={saving} />
        </label>
        <label className="space-y-1 text-sm">เลขที่เอกสารจ่าย
          <Input value={paymentDocNo} onChange={e => setPaymentDocNo(e.target.value)} disabled={saving} />
        </label>
        <label className="space-y-1 text-sm">ยอดเงิน (บาท) *
          <Input inputMode="decimal" value={amount} onChange={e => setAmount(e.target.value)} disabled={saving} />
        </label>
        <label className="space-y-1 text-sm">วันที่โอนเงิน *
          <Input type="date" value={transferDate} onChange={e => onTransferDate(e.target.value)} disabled={saving} />
        </label>
        <label className="space-y-1 text-sm">กำหนดการเคลียร์ (ค่าเริ่มต้น +{CLEAR_DUE_DAYS} วัน)
          <Input type="date" value={dueDate} onChange={e => { setDueTouched(true); setDueDate(e.target.value); }} disabled={saving} />
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
            {saving ? 'กำลังบันทึก...' : fin ? 'บันทึกการแก้ไข' : 'บันทึกการจ่ายเงิน'}
          </Button>
        </div>
      </form>
    </Panel>
  );
}
