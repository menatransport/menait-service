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

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!voucherDate) return showAlert({ icon: 'warning', title: 'กรุณาระบุวันที่ตั้งเบิก' });
    setSaving(true);
    try {
      const saved = await putAction(detail.form_id, 'voucher', {
        voucher_no: voucherNo, voucher_date: voucherDate, is_edit: Boolean(fin),
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
    <Panel title={fin ? 'แก้ไขข้อมูลตั้งเบิก' : 'ตั้งเบิกทำจ่าย'}>
      <form onSubmit={submit} className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <label className="space-y-1 text-sm">เลขที่ใบเบิก
          <Input value={voucherNo} onChange={e => setVoucherNo(e.target.value)} placeholder="เช่น SADV2607-005" disabled={saving} />
        </label>
        <label className="space-y-1 text-sm">วันที่ตั้งเบิก *
          <DateField value={voucherDate} onChange={setVoucherDate} disabled={saving} />
        </label>
        <div className="sm:col-span-2">
          <Button type="submit" disabled={saving} className="w-full bg-[#026a75] hover:bg-[#055058]">
            {saving ? 'กำลังบันทึก...' : 'บันทึกตั้งเบิก'}
          </Button>
        </div>
      </form>
    </Panel>
  );
}
