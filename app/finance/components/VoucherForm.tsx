'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { formatDate, todayBkk } from '@/lib/finance/status';
import { confirmReview, duplicateDocNoWarning, putAction, showAlert, showSuccess } from '../api';
import type { AdvanceDetail } from '../types';
import { DateField } from './DateField';
import { Panel } from './FinanceShell';
import { PayeeTypeBadge } from './PayeeTypeBadge';

const FRESH_VOUCHER_STATUSES = new Set(['RESUBMITTED', 'VOUCHER_REJECTED', 'RETURNED']);

export function VoucherForm({ detail, onSaved }: {
  detail: AdvanceDetail; onSaved: (d: AdvanceDetail) => void;
}) {
  const fin = detail.fin;
  // รอบใหม่หลังตีกลับ/ส่งใหม่ เลขกับวันที่ของรอบก่อนใช้ไม่ได้แล้ว เริ่มว่าง ไม่ให้เผลอบันทึกเลขเดิมซ้ำ
  const fresh = !fin || FRESH_VOUCHER_STATUSES.has(fin.fin_status ?? '');
  const [voucherNo, setVoucherNo] = useState(fresh ? '' : fin?.voucher_no ?? '');
  const [voucherDate, setVoucherDate] = useState((fresh ? null : fin?.voucher_date) ?? todayBkk());
  const [saving, setSaving] = useState(false);
  const rejected = fin?.fin_status === 'VOUCHER_REJECTED';
  // a fin row exists after a return/resubmit/voucher rejection too, but no voucher stands for this round yet
  const editing = Boolean(fin) && !FRESH_VOUCHER_STATUSES.has(fin?.fin_status ?? '');
  const rejectRemark = rejected
    ? [...detail.fin_logs].filter(l => l.action === 'VOUCHER_REJECT')
        .sort((a, b) => (a.created_at ?? '').localeCompare(b.created_at ?? '')).pop()?.remark ?? ''
    : '';

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!voucherDate) return showAlert({ icon: 'warning', title: 'กรุณาระบุวันที่ตั้งเบิก' });
    const warning = await duplicateDocNoWarning('voucher_no', voucherNo, detail.form_id);
    if (!(await confirmReview({
      warning,
      title: editing ? 'ยืนยันแก้ไขข้อมูลตั้งเบิก' : 'ยืนยันบันทึกตั้งเบิก',
      rows: [['เลขที่คำขอ', detail.form_id], ['เลขที่ตั้งเบิก', voucherNo.trim()], ['วันที่ตั้งเบิก', formatDate(voucherDate)]],
    }))) return;
    setSaving(true);
    try {
      const saved = await putAction(detail.form_id, 'voucher', {
        voucher_no: voucherNo.trim() || null, voucher_date: voucherDate, is_edit: detail.status === 'AWAITING_VOUCHER' ? false : Boolean(fin),
      });
      await showSuccess('บันทึกตั้งเบิกแล้ว');
      onSaved(saved);
    } catch (err) {
      showAlert({ icon: 'error', title: 'บันทึกไม่สำเร็จ', text: (err as Error).message });
    } finally {
      setSaving(false);
    }
  };

  return (
    <Panel title={rejected ? 'ตั้งเบิกทำจ่าย (แก้ไขตามที่ตีกลับ)' : editing ? 'แก้ไขข้อมูลตั้งเบิก' : 'ตั้งเบิกทำจ่าย'}>
      {rejected && (
        <div className="mb-4 rounded-lg border border-orange-300 bg-orange-50 px-4 py-3 text-sm text-orange-800">
          การเงินส่งกลับให้แก้: {rejectRemark || '-'}
          {fin?.voucher_no && <span className="block text-xs text-orange-700">เลขที่ตั้งเบิกเดิม {fin.voucher_no}</span>}
        </div>
      )}
      <div className="mb-4"><PayeeTypeBadge payeeType={detail.request.payee_type} withHint /></div>
      <form onSubmit={submit} className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <label className="space-y-1 text-sm">เลขที่ตั้งเบิก
          <Input value={voucherNo} onChange={e => setVoucherNo(e.target.value)} placeholder="เช่น SADV2607-005" disabled={saving} />
        </label>
        <label className="space-y-1 text-sm">วันที่ตั้งเบิก *
          <DateField value={voucherDate} onChange={setVoucherDate} disabled={saving} />
        </label>
        <div className="sm:col-span-2">
          <Button type="submit" disabled={saving} className="w-full h-11 rounded-xl bg-linear-to-r from-brand-600 to-brand-500 hover:from-brand-700 hover:to-brand-600 text-white font-semibold shadow-md hover:shadow-lg transition-all disabled:opacity-60">
            {saving ? 'กำลังบันทึก...' : 'บันทึกตั้งเบิก'}
          </Button>
        </div>
      </form>
    </Panel>
  );
}
