'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { DateField } from './DateField';
import { Textarea } from '@/components/ui/textarea';
import { formatBaht, settleLabel } from '@/lib/finance/status';
import { putAction, showAlert, showConfirm, uploadFiles } from '../api';
import type { AdvanceDetail } from '../types';
import { FilePicker } from './FilePicker';
import { Panel } from './FinanceShell';

export function ReviewPanel({ detail, onSaved }: { detail: AdvanceDetail; onSaved: (d: AdvanceDetail) => void }) {
  const settle = detail.fin?.settle_amount ?? 0;
  const needsExtraDate = settle < 0;
  const [extraDate, setExtraDate] = useState('');
  const [remark, setRemark] = useState('');
  const [files, setFiles] = useState<File[]>([]);
  const [saving, setSaving] = useState(false);

  const confirm = async () => {
    if (needsExtraDate && !extraDate) return showAlert({ icon: 'warning', title: 'กรุณาระบุวันที่การเงินโอนเงินเพิ่ม' });
    const ok = await showConfirm({ title: 'ยืนยันปิดรายการ?', text: `${detail.form_id} · ${settleLabel(settle)} ${formatBaht(Math.abs(settle))}` });
    if (!ok.isConfirmed) return;
    setSaving(true);
    try {
      const saved = await putAction(detail.form_id, 'confirm', {
        settle_date: needsExtraDate ? extraDate : null,
        expected_clear_submitted_at: detail.fin?.clear_submitted_at ?? null,
      });
      const failed = await uploadFiles(detail.form_id, files, 'check');
      setFiles([]);
      await showAlert({ icon: failed.length ? 'warning' : 'success', title: 'ปิดรายการแล้ว',
        text: failed.length ? `อัปโหลดไม่สำเร็จ: ${failed.join(', ')}` : undefined });
      onSaved(saved);
    } catch (err) {
      showAlert({ icon: 'error', title: 'ปิดรายการไม่สำเร็จ', text: (err as Error).message });
    } finally {
      setSaving(false);
    }
  };

  const sendBack = async () => {
    if (!remark.trim()) return showAlert({ icon: 'warning', title: 'กรุณาระบุเหตุผลที่ส่งกลับ' });
    setSaving(true);
    try {
      const saved = await putAction(detail.form_id, 'send-back', {
        review_remark: remark,
        expected_clear_submitted_at: detail.fin?.clear_submitted_at ?? null,
      });
      setRemark('');
      await showAlert({ icon: 'success', title: 'ส่งกลับให้ผู้เบิกแก้ไขแล้ว' });
      onSaved(saved);
    } catch (err) {
      showAlert({ icon: 'error', title: 'ส่งกลับไม่สำเร็จ', text: (err as Error).message });
    } finally {
      setSaving(false);
    }
  };

  return (
    <Panel title="ตรวจการเคลียร์เงิน">
      <div className="space-y-4">
        <p className="rounded-xl bg-gray-50 px-4 py-3 text-sm">
          {settleLabel(settle)} <span className="font-semibold">{formatBaht(Math.abs(settle))}</span> บาท
        </p>
        {needsExtraDate && (
          <div className="grid gap-4 sm:grid-cols-2">
            <label className="space-y-1 text-sm">วันที่การเงินโอนเงินเพิ่ม *
              <DateField value={extraDate} onChange={setExtraDate} disabled={saving} />
            </label>
            <div>
              <p className="mb-1 text-sm">แนบสลิปโอนเงินเพิ่ม</p>
              <FilePicker files={files} onChange={setFiles} disabled={saving} />
            </div>
          </div>
        )}
        <Button type="button" onClick={confirm} disabled={saving} className="w-full bg-[#026a75] hover:bg-[#055058]">
          ยืนยันปิดรายการ
        </Button>
        <div className="space-y-2 border-t border-gray-100 pt-4">
          <label className="block space-y-1 text-sm">เหตุผลที่ส่งกลับแก้ไข
            <Textarea value={remark} onChange={e => setRemark(e.target.value)} disabled={saving} placeholder="เช่น ใบเสร็จไม่ครบ" />
          </label>
          <Button type="button" variant="outline" onClick={sendBack} disabled={saving} className="w-full border-orange-300 text-orange-700 hover:bg-orange-50">
            ส่งกลับแก้ไข
          </Button>
        </div>
      </div>
    </Panel>
  );
}
