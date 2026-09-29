'use client';

import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { computeSettle, formatBaht, parseAmount, settleLabel } from '@/lib/finance/status';
import { fetchJson, putAction, showAlert, uploadFiles } from '../api';
import { CLEAR_ATTACHMENT_REQUIRED } from '../labels';
import type { AdvanceDetail, AttachmentFile } from '../types';
import { DateField } from './DateField';
import { FilePicker } from './FilePicker';
import { Panel } from './FinanceShell';

export function ClearForm({ detail, onSaved }: { detail: AdvanceDetail; onSaved: (d: AdvanceDetail) => void }) {
  const fin = detail.fin!;
  const [clearDate, setClearDate] = useState(fin.clear_date ?? '');
  const [actual, setActual] = useState(fin.amount_actual !== null ? String(fin.amount_actual) : '');
  const [clearDocNo, setClearDocNo] = useState(fin.clear_doc_no ?? '');
  const [settleDate, setSettleDate] = useState(fin.settle_date ?? '');
  const [remark, setRemark] = useState(fin.remark ?? '');
  const [files, setFiles] = useState<File[]>([]);
  const [saving, setSaving] = useState(false);
  const [existingClear, setExistingClear] = useState(0);
  useEffect(() => {
    fetchJson<{ files?: AttachmentFile[] } | AttachmentFile[]>(`/api/uploads3?form_id=${encodeURIComponent(detail.form_id)}`)
      .then(data => {
        const list = Array.isArray(data) ? data : data.files ?? [];
        setExistingClear(list.filter(f => f.folder === 'clear').length);
      })
      .catch(() => setExistingClear(0));
  }, [detail.form_id]);

  const actualNum = parseAmount(actual);
  const settle = actualNum === null ? null : computeSettle(fin.amount_paid ?? 0, actualNum);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!clearDate) return showAlert({ icon: 'warning', title: 'กรุณาระบุวันที่ส่งเอกสารเคลียร์' });
    if (actualNum === null || actualNum < 0) return showAlert({ icon: 'warning', title: 'กรุณาระบุยอดใช้จริง (ไม่ติดลบ)' });
    if (settle !== null && settle > 0 && !settleDate) {
      return showAlert({ icon: 'warning', title: 'มียอดต้องคืนบริษัท', text: 'กรุณาระบุวันที่โอนเงินคืน' });
    }
    if (files.length === 0 && existingClear === 0) return showAlert({ icon: 'warning', title: CLEAR_ATTACHMENT_REQUIRED });
    setSaving(true);
    try {
      const failed = await uploadFiles(detail.form_id, files, 'clear');
      if (failed.length) {
        await showAlert({ icon: 'error', title: 'อัปโหลดไฟล์ไม่สำเร็จ ยังไม่ได้ส่งเคลียร์', text: failed.join(', ') });
        return;
      }
      const saved = await putAction(detail.form_id, 'clear', {
        clear_date: clearDate,
        amount_actual: actualNum,
        clear_doc_no: clearDocNo,
        settle_date: settle !== null && settle > 0 ? settleDate : null,
        remark,
      });
      setFiles([]);
      await showAlert({ icon: 'success', title: 'ส่งเคลียร์เงินแล้ว รอการเงินตรวจ' });
      onSaved(saved);
    } catch (err) {
      showAlert({ icon: 'error', title: 'บันทึกไม่สำเร็จ', text: (err as Error).message });
    } finally {
      setSaving(false);
    }
  };

  return (
    <Panel title="เคลียร์เงิน (ผู้เบิกกรอก)">
      <form onSubmit={submit} className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <label className="space-y-1 text-sm">วันที่ส่งเอกสารเคลียร์ *
          <DateField value={clearDate} onChange={setClearDate} disabled={saving} />
        </label>
        <label className="space-y-1 text-sm">ยอดใช้จริง (บาท) *
          <Input inputMode="decimal" value={actual} onChange={e => setActual(e.target.value)} placeholder="0.00" disabled={saving} />
        </label>
        <label className="space-y-1 text-sm">เอกสารเคลียร์ (เลขที่/รายการ)
          <Input value={clearDocNo} onChange={e => setClearDocNo(e.target.value)} disabled={saving} />
        </label>
        <div className="space-y-1 text-sm">
          <p>รับคืน (เบิกเพิ่ม) — คำนวณอัตโนมัติ</p>
          <p className={`rounded-xl border px-4 py-2.5 font-semibold ${settle !== null && settle < 0 ? 'text-orange-700' : 'text-[#026a75]'}`}>
            {settle === null ? '-' : `${settleLabel(settle)} ${formatBaht(Math.abs(settle))}`}
          </p>
        </div>
        {settle !== null && settle > 0 && (
          <label className="space-y-1 text-sm">วันที่โอนเงินคืน *
            <DateField value={settleDate} onChange={setSettleDate} disabled={saving} />
          </label>
        )}
        {settle !== null && settle < 0 && (
          <p className="text-xs text-orange-700 sm:col-span-2">ใช้เกินยอดที่เบิก การเงินจะโอนส่วนต่างให้และบันทึกวันที่โอนตอนตรวจ</p>
        )}
        <label className="space-y-1 text-sm sm:col-span-2">หมายเหตุ
          <Textarea value={remark} onChange={e => setRemark(e.target.value)} disabled={saving} />
        </label>
        <div className="sm:col-span-2">
          <p className="mb-1 text-sm">แนบใบเสร็จ / สลิปคืนเงิน *</p>
          {existingClear > 0 && <p className="text-xs text-gray-500">มีไฟล์แนบแล้ว {existingClear} ไฟล์ (แนบเพิ่มได้)</p>}
          <FilePicker files={files} onChange={setFiles} disabled={saving} />
        </div>
        <div className="sm:col-span-2">
          <Button type="submit" disabled={saving} className="w-full bg-[#026a75] hover:bg-[#055058]">
            {saving ? 'กำลังบันทึก...' : 'ส่งเคลียร์เงิน'}
          </Button>
        </div>
      </form>
    </Panel>
  );
}
