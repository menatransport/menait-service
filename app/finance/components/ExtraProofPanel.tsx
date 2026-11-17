'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { formatBaht, formatDate, todayBkk } from '@/lib/finance/status';
import { extraProofProblem } from '@/lib/finance/extraProof';
import { confirmReview, putAction, showAlert, showSuccess, uploadFiles } from '../api';
import type { AdvanceDetail } from '../types';
import { DateField } from './DateField';
import { FilePicker } from './FilePicker';
import { Panel } from './FinanceShell';

/** บัญชี (หรือการเงินสายจ่าย): ใบเบิกเพิ่มที่บัญชีปิดแล้ว → โอนเพิ่ม แนบสลิป ใส่วันที่โอน แล้วปิดจริง (ผู้ใช้สั่ง 17/11/2026) */
export function ExtraProofPanel({ detail, onSaved }: { detail: AdvanceDetail; onSaved: (d: AdvanceDetail) => void }) {
  const extra = Math.abs(detail.fin?.settle_amount ?? 0);
  const [date, setDate] = useState(todayBkk());
  const [files, setFiles] = useState<File[]>([]);
  const [saving, setSaving] = useState(false);

  const submit = async () => {
    const problem = extraProofProblem(date, files.length, todayBkk());
    if (problem) return showAlert({ icon: 'warning', title: problem });
    if (!(await confirmReview({
      title: 'ยืนยันโอนเงินเพิ่มแล้ว?',
      rows: [
        ['เลขที่คำขอ', detail.form_id],
        ['ยอดโอนเพิ่ม', `${formatBaht(extra)} บาท`],
        ['วันที่โอน', formatDate(date)],
        ['สลิปที่แนบ', `${files.length} ไฟล์`],
      ],
      note: 'กดแล้วใบนี้ปิดแล้ว ผู้เบิกได้อีเมลแจ้ง',
      confirmButtonText: 'ยืนยัน ปิดรายการ',
    }))) return;
    setSaving(true);
    try {
      // อัปโหลดให้ได้ก่อน ค่อยปิด จะได้ไม่มีใบที่ปิดแล้วแต่ไม่มีสลิป
      const failed = await uploadFiles(detail.form_id, files, 'check');
      if (failed.length) {
        await showAlert({ icon: 'error', title: 'แนบสลิปไม่สำเร็จ ยังไม่ได้ปิดรายการ', text: `อัปโหลดไม่สำเร็จ: ${failed.join(', ')} ลองใหม่อีกครั้ง` });
        return;
      }
      const saved = await putAction(detail.form_id, 'extra-proof', { settle_date: date, file_names: files.map(f => f.name) });
      setFiles([]);
      await showSuccess('แนบหลักฐานแล้ว ปิดรายการเรียบร้อย');
      onSaved(saved);
    } catch (err) {
      showAlert({ icon: 'error', title: 'บันทึกไม่สำเร็จ', text: (err as Error).message });
    } finally {
      setSaving(false);
    }
  };

  return (
    <Panel title="โอนเงินเพิ่มให้ผู้เบิก">
      <div className="space-y-4">
        <p className="rounded-xl bg-orange-50 px-4 py-3 text-sm text-sun-700">
          บัญชีปิดรายการแล้ว ต้องโอนเพิ่ม <span className="font-semibold">{formatBaht(extra)}</span> บาท แนบสลิปแล้วกดยืนยัน
        </p>
        <div className="grid gap-4 sm:grid-cols-2">
          <label className="space-y-1 text-sm">วันที่โอนเงินเพิ่ม *
            <DateField value={date} onChange={setDate} disabled={saving} />
          </label>
          <div>
            <p className="mb-1 text-sm">สลิปโอนเงินเพิ่ม *</p>
            <FilePicker files={files} onChange={setFiles} disabled={saving} />
          </div>
        </div>
        <Button type="button" onClick={submit} disabled={saving} className="w-full h-11 rounded-xl bg-linear-to-r from-brand-600 to-brand-500 hover:from-brand-700 hover:to-brand-600 text-white font-semibold shadow-md hover:shadow-lg transition-all disabled:opacity-60">
          {saving ? 'กำลังบันทึก…' : 'ยืนยันโอนเพิ่มแล้ว'}
        </Button>
      </div>
    </Panel>
  );
}
