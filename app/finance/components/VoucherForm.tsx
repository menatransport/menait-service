'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { todayBkk } from '@/lib/finance/status';
import { putAction, showAlert } from '../api';
import type { AdvanceDetail } from '../types';
import { DateField } from './DateField';
import { Panel } from './FinanceShell';

export function VoucherForm({ detail, onSaved }: {
  detail: AdvanceDetail; onSaved: (d: AdvanceDetail) => void;
}) {
  const fin = detail.fin;
  const [voucherNo, setVoucherNo] = useState(fin?.voucher_no ?? '');
  const [voucherDate, setVoucherDate] = useState(fin?.voucher_date ?? todayBkk());
  const [saving, setSaving] = useState(false);
  const rejected = fin?.fin_status === 'VOUCHER_REJECTED';
  const rejectRemark = rejected
    ? [...detail.fin_logs].filter(l => l.action === 'VOUCHER_REJECT')
        .sort((a, b) => (a.created_at ?? '').localeCompare(b.created_at ?? '')).pop()?.remark ?? ''
    : '';

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!voucherDate) return showAlert({ icon: 'warning', title: 'กรุณาระบุวันที่ตั้งเบิก' });
    setSaving(true);
    try {
      const saved = await putAction(detail.form_id, 'voucher', {
        voucher_no: voucherNo, voucher_date: voucherDate, is_edit: detail.status === 'AWAITING_VOUCHER' ? false : Boolean(fin),
      });
      await showAlert({ icon: 'success', title: 'บันทึกตั้งเบิกแล้ว' });
      onSaved(saved);
    } catch (err) {
      showAlert({ icon: 'error', title: 'บันทึกไม่สำเร็จ', text: (err as Error).message });
    } finally {
      setSaving(false);
    }
  };

  return (
    <Panel title={rejected ? 'ตั้งเบิกทำจ่าย (แก้ไขตามที่ตีกลับ)' : fin ? 'แก้ไขข้อมูลตั้งเบิก' : 'ตั้งเบิกทำจ่าย'}>
      {rejected && (
        <div className="mb-4 rounded-lg border border-orange-300 bg-orange-50 px-4 py-3 text-sm text-orange-800">
          การเงินตีกลับ: {rejectRemark || '-'}
        </div>
      )}
      <form onSubmit={submit} className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <label className="space-y-1 text-sm">เลขที่ใบเบิก
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
