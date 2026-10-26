'use client';

import { useRef, useState } from 'react';
import { Printer } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { buildCashAdvanceHtml, PRINTABLE_STATUSES, toCashAdvanceData } from '@/lib/finance/cashAdvanceForm';
import { buildClearingHtml, buildCombinedHtml, toClearingData } from '@/lib/finance/clearingForm';
import { attachmentPagesHtml, openPrintWindow, type PrintFile, type PrintParts } from '@/lib/finance/printShared';
import { showAlert } from '../api';
import { FOLDER_LABELS } from '../labels';
import type { AdvanceDetail } from '../types';
import PrintDialog from './PrintDialog';

/** Radix Dialog ปิดด้วยแอนิเมชัน 200ms — รอให้ปิดเสร็จก่อนเปิดหน้าพิมพ์ */
const DIALOG_CLOSE_MS = 250;

/** `label` = tooltip + aria-label of the trigger (e.g. which document the clearing panel prints). */
export function PrintDocumentButton({ detail, initial, compact = false, label }: { detail: AdvanceDetail; initial?: PrintParts; compact?: boolean; label?: string }) {
  const [open, setOpen] = useState(false);
  const [preparing, setPreparing] = useState(false);
  // เพิ่มทุกครั้งที่ปิด Dialog: งานเตรียมเอกสารที่ค้างอยู่รู้ว่าผู้ใช้กดยกเลิกแล้ว ไม่ต้องพิมพ์ต่อ
  const runId = useRef(0);
  if (!PRINTABLE_STATUSES.includes(detail.status)) return null;

  const fetchFiles = async (): Promise<PrintFile[]> => {
    const res = await fetch(`/api/uploads3?form_id=${encodeURIComponent(detail.form_id)}`, { cache: 'no-store' });
    if (!res.ok) throw new Error(`โหลดไฟล์แนบไม่สำเร็จ (${res.status})`);
    const data = await res.json().catch(() => ({ files: [] }));
    return (data.files ?? []) as PrintFile[];
  };

  const onOpenChange = (next: boolean) => {
    if (!next) runId.current += 1;
    setOpen(next);
  };

  const onConfirm = async (parts: PrintParts) => {
    const id = ++runId.current;
    setPreparing(true);
    try {
      const files = await fetchFiles();
      if (id !== runId.current) return;
      const logoUrl = `${window.location.origin}/mena.png`;
      const att1 = attachmentPagesHtml(files, ['request', 'pay'], FOLDER_LABELS);
      const att2 = attachmentPagesHtml(files, ['clear', 'check'], FOLDER_LABELS);
      const cash = toCashAdvanceData(detail);
      const html = parts === 'part1' ? buildCashAdvanceHtml(cash, { logoUrl, attachmentsHtml: att1 })
        : parts === 'part2' ? buildClearingHtml(toClearingData(detail), { logoUrl, attachmentsHtml: att2 })
        : buildCombinedHtml(cash, toClearingData(detail), { logoUrl, part1AttachmentsHtml: att1, part2AttachmentsHtml: att2 });
      // ปิด Dialog ให้เสร็จก่อนค่อยเปิดหน้าพิมพ์ (บั๊ก 26/10/2026: หน้าพรีวิวพิมพ์ของเบราว์เซอร์หยุดหน้าเว็บไว้
      // กลางแอนิเมชันปิด Dialog เลยค้างทับหน้าจอ กดออกไม่ได้)
      setOpen(false);
      await new Promise(resolve => setTimeout(resolve, DIALOG_CLOSE_MS));
      if (id !== runId.current) return;
      if (!openPrintWindow(html)) showAlert({ icon: 'error', title: 'เปิดหน้าพิมพ์ไม่ได้', text: 'ลองรีเฟรชหน้าแล้วกดพิมพ์อีกครั้ง' });
    } catch (err) {
      if (id !== runId.current) return;
      showAlert({ icon: 'error', title: 'พิมพ์ไม่ได้', text: err instanceof Error ? err.message : String(err) });
    } finally {
      setPreparing(false);
    }
  };

  const trigger = (
    <Button type="button" variant="outline" size="sm" onClick={() => setOpen(true)} title={label} aria-label={label}>
      <Printer className="mr-1 h-4 w-4" />{compact ? 'พิมพ์' : 'พิมพ์เอกสาร'}
    </Button>
  );
  const dialog = (
      <PrintDialog open={open} onOpenChange={onOpenChange} onConfirm={onConfirm} documentNo={detail.form_id}
        hasClearing={Boolean(detail.fin?.clear_date)} part2Available initial={initial} isPreparing={preparing} />
  );
  return compact ? <>{trigger}{dialog}</> : <div className="flex justify-end">{trigger}{dialog}</div>;
}
