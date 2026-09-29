'use client';

import { useState } from 'react';
import { Printer } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { buildCashAdvanceHtml, PRINTABLE_STATUSES, toCashAdvanceData } from '@/lib/finance/cashAdvanceForm';
import { attachmentPagesHtml, openPrintWindow, type PrintFile, type PrintParts } from '@/lib/finance/printShared';
import { showAlert } from '../api';
import { FOLDER_LABELS } from '../labels';
import type { AdvanceDetail } from '../types';
import PrintDialog from './PrintDialog';

// Flip to true when Part 2 (Task 16b) can be built; until then the dialog shows "เร็วๆ นี้" for Part 2 / ทั้งหมด.
const PART2_AVAILABLE = false;

export function PrintDocumentButton({ detail, initial }: { detail: AdvanceDetail; initial?: PrintParts }) {
  const [open, setOpen] = useState(false);
  const [preparing, setPreparing] = useState(false);
  if (!PRINTABLE_STATUSES.includes(detail.status)) return null;

  const fetchFiles = async (): Promise<PrintFile[]> => {
    const res = await fetch(`/api/uploads3?form_id=${encodeURIComponent(detail.form_id)}`, { cache: 'no-store' });
    if (!res.ok) throw new Error(`โหลดไฟล์แนบไม่สำเร็จ (${res.status})`);
    const data = await res.json().catch(() => ({ files: [] }));
    return (data.files ?? []) as PrintFile[];
  };

  const onConfirm = async (parts: PrintParts) => {
    if (parts !== 'part1') return; // Part 2 / ทั้งหมด arrive with Task 16b
    setPreparing(true);
    try {
      const files = await fetchFiles();
      const html = buildCashAdvanceHtml(toCashAdvanceData(detail), {
        logoUrl: `${window.location.origin}/mena.png`,
        attachmentsHtml: attachmentPagesHtml(files, ['request', 'pay'], FOLDER_LABELS),
      });
      if (!openPrintWindow(html)) showAlert({ icon: 'error', title: 'เบราว์เซอร์บล็อกหน้าต่างพิมพ์' });
      else setOpen(false);
    } catch (err) {
      showAlert({ icon: 'error', title: 'พิมพ์ไม่ได้', text: err instanceof Error ? err.message : String(err) });
    } finally {
      setPreparing(false);
    }
  };

  return (
    <div className="flex justify-end">
      <Button type="button" variant="outline" size="sm" onClick={() => setOpen(true)}>
        <Printer className="mr-1 h-4 w-4" />พิมพ์เอกสาร
      </Button>
      <PrintDialog open={open} onOpenChange={setOpen} onConfirm={onConfirm} documentNo={detail.form_id}
        hasClearing={Boolean(detail.fin?.clear_date)} part2Available={PART2_AVAILABLE} initial={initial} isPreparing={preparing} />
    </div>
  );
}
