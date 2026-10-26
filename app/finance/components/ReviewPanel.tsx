'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { DateField } from './DateField';
import { Textarea } from '@/components/ui/textarea';
import { formatBaht, formatDate, settleLabel, todayBkk } from '@/lib/finance/status';
import { CLEAR_DOC_NO_MAX, clearDocNoError } from '@/lib/finance/docNo';
import { confirmReview, confirmUniqueDocNo, putAction, showAlert, uploadFiles } from '../api';
import type { AdvanceDetail } from '../types';
import { FilePicker } from './FilePicker';
import { Panel } from './FinanceShell';

export function ReviewPanel({ detail, onSaved, canSendBack = true, canClose = true }:
  { detail: AdvanceDetail; onSaved: (d: AdvanceDetail) => void; canSendBack?: boolean; canClose?: boolean }) {
  const settle = detail.fin?.settle_amount ?? 0;
  const needsExtraDate = settle < 0;
  const [extraDate, setExtraDate] = useState('');
  const [clearDocNo, setClearDocNo] = useState(detail.fin?.clear_doc_no ?? '');
  // ปิดรายการได้เมื่อรับเอกสารตัวจริงแล้ว พร้อมวันที่รับ (ผู้ใช้สั่ง 21/10/2026)
  const [received, setReceived] = useState(Boolean(detail.fin?.original_received_date));
  const [receivedDate, setReceivedDate] = useState(detail.fin?.original_received_date ?? '');
  const [remark, setRemark] = useState('');
  const [files, setFiles] = useState<File[]>([]);
  const [saving, setSaving] = useState(false);

  const onReceived = (checked: boolean) => {
    setReceived(checked);
    if (checked && !receivedDate) setReceivedDate(todayBkk());
  };

  const confirm = async () => {
    if (needsExtraDate && !extraDate) return showAlert({ icon: 'warning', title: 'กรุณาระบุวันที่การเงินโอนเงินเพิ่ม' });
    if (needsExtraDate && files.length === 0) return showAlert({ icon: 'warning', title: 'กรุณาแนบสลิปโอนเงินเพิ่ม' });
    if (!received || !receivedDate) return showAlert({ icon: 'warning', title: 'กรุณาติ๊กรับเอกสารตัวจริงแล้ว และใส่วันที่รับ' });
    if (receivedDate > todayBkk()) return showAlert({ icon: 'warning', title: 'วันที่รับเอกสารตัวจริงต้องไม่เกินวันนี้' });
    const docError = clearDocNoError(clearDocNo);
    if (docError) return showAlert({ icon: 'warning', title: docError });
    if (!(await confirmUniqueDocNo('clear_doc_no', clearDocNo, detail.form_id))) return;
    if (!(await confirmReview({
      title: 'ยืนยันปิดรายการ?',
      rows: [
        ['เลขที่คำขอ', detail.form_id],
        [settleLabel(settle), `${formatBaht(Math.abs(settle))} บาท`],
        ...(needsExtraDate ? [['วันที่การเงินโอนเงินเพิ่ม', formatDate(extraDate)] as [string, string]] : []),
        ['เลขที่เอกสารเคลียร์เงิน', clearDocNo.trim()],
        ['วันที่รับเอกสารตัวจริง', formatDate(receivedDate)],
        ['ไฟล์ที่แนบ', files.length ? `${files.length} ไฟล์` : 'ไม่มี'],
      ],
      note: 'ปิดรายการแล้วแก้ไขไม่ได้',
      confirmButtonText: 'ยืนยันปิดรายการ',
    }))) return;
    setSaving(true);
    try {
      // สลิปโอนเงินเพิ่มบังคับแนบ: อัปโหลดให้ได้ก่อน ค่อยปิดรายการ จะได้ไม่มีใบที่ปิดแล้วแต่ไม่มีสลิป
      const failed = await uploadFiles(detail.form_id, files, 'check');
      if (failed.length) {
        await showAlert({ icon: 'error', title: 'แนบสลิปไม่สำเร็จ ยังไม่ได้ปิดรายการ', text: `อัปโหลดไม่สำเร็จ: ${failed.join(', ')} ลองใหม่อีกครั้ง` });
        return;
      }
      const saved = await putAction(detail.form_id, 'confirm', {
        clear_doc_no: clearDocNo.trim(),
        original_received_date: receivedDate,
        settle_date: needsExtraDate ? extraDate : null,
        expected_clear_submitted_at: detail.fin?.clear_submitted_at ?? null,
      });
      setFiles([]);
      await showAlert({ icon: 'success', title: 'ปิดรายการแล้ว' });
      onSaved(saved);
    } catch (err) {
      showAlert({ icon: 'error', title: 'ปิดรายการไม่สำเร็จ', text: (err as Error).message });
    } finally {
      setSaving(false);
    }
  };

  const sendBack = async () => {
    if (!remark.trim()) return showAlert({ icon: 'warning', title: 'กรุณาระบุเหตุผลที่ส่งกลับ' });
    if (!(await confirmReview({
      title: 'ส่งกลับให้ผู้เบิกแก้ไข?',
      rows: [['เลขที่คำขอ', detail.form_id], ['เหตุผลที่ส่งกลับ', remark.trim()]],
      confirmButtonText: 'ยืนยันส่งกลับ',
    }))) return;
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
              <p className="mb-1 text-sm">แนบสลิปโอนเงินเพิ่ม *</p>
              <FilePicker files={files} onChange={setFiles} disabled={saving} />
            </div>
          </div>
        )}
        <div className="grid gap-4 sm:grid-cols-2">
          <label className="flex items-center gap-2 self-end pb-2 text-sm font-medium">
            <input type="checkbox" checked={received} onChange={e => onReceived(e.target.checked)} disabled={saving}
              className="h-4 w-4 cursor-pointer accent-brand-600" />
            รับเอกสารตัวจริงแล้ว *
          </label>
          <label className="space-y-1 text-sm">วันที่รับเอกสารตัวจริง *
            <DateField value={receivedDate} onChange={setReceivedDate} disabled={saving || !received} />
          </label>
        </div>
        <label className="block space-y-1 text-sm">เลขที่เอกสารเคลียร์เงิน *
          <Input value={clearDocNo} onChange={e => setClearDocNo(e.target.value.replace(/\s/g, ''))} maxLength={CLEAR_DOC_NO_MAX}
            placeholder="เช่น CL69100001" disabled={saving} />
        </label>
        {canClose && (
          <Button type="button" onClick={confirm} disabled={saving} className="w-full h-11 rounded-xl bg-linear-to-r from-brand-600 to-brand-500 hover:from-brand-700 hover:to-brand-600 text-white font-semibold shadow-md hover:shadow-lg transition-all disabled:opacity-60">
            ยืนยันปิดรายการ
          </Button>
        )}
        {canSendBack && (
          <div className="space-y-2 border-t border-gray-100 pt-4">
            <label className="block space-y-1 text-sm">เหตุผลที่ส่งกลับแก้ไข
              <Textarea value={remark} onChange={e => setRemark(e.target.value)} disabled={saving} placeholder="เช่น ใบเสร็จไม่ครบ" />
            </label>
            <Button type="button" variant="outline" onClick={sendBack} disabled={saving} className="w-full h-11 rounded-xl border-orange-300 text-sun-700 hover:bg-orange-50">
              ส่งกลับแก้ไข
            </Button>
          </div>
        )}
      </div>
    </Panel>
  );
}
