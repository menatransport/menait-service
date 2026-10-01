'use client';

import { useState } from 'react';
import { Printer } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { buildCashAdvanceHtml, PRINTABLE_STATUSES, toCashAdvanceData } from '@/lib/finance/cashAdvanceForm';
import { buildClearingHtml, buildCombinedHtml, toClearingData } from '@/lib/finance/clearingForm';
import { attachmentPagesHtml, openPrintWindow, type PrintFile, type PrintParts } from '@/lib/finance/printShared';
import { showAlert } from '../api';
import { FOLDER_LABELS } from '../labels';
import type { AdvanceDetail } from '../types';
import PrintDialog from './PrintDialog';

/** `label` = tooltip + aria-label of the trigger (e.g. which document the clearing panel prints). */
export function PrintDocumentButton({ detail, initial, compact = false, label }: { detail: AdvanceDetail; initial?: PrintParts; compact?: boolean; label?: string }) {
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
    setPreparing(true);
    try {
      const files = await fetchFiles();
      const logoUrl = `${window.location.origin}/mena.png`;
      const att1 = attachmentPagesHtml(files, ['request', 'pay'], FOLDER_LABELS);
      const att2 = attachmentPagesHtml(files, ['clear', 'check'], FOLDER_LABELS);
      const cash = toCashAdvanceData(detail);
      const html = parts === 'part1' ? buildCashAdvanceHtml(cash, { logoUrl, attachmentsHtml: att1 })
        : parts === 'part2' ? buildClearingHtml(toClearingData(detail), { logoUrl, attachmentsHtml: att2 })
        : buildCombinedHtml(cash, toClearingData(detail), { logoUrl, part1AttachmentsHtml: att1, part2AttachmentsHtml: att2 });
      if (!openPrintWindow(html)) showAlert({ icon: 'error', title: 'เบราว์เซอร์บล็อกหน้าต่างพิมพ์' });
      else setOpen(false);
    } catch (err) {
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
      <PrintDialog open={open} onOpenChange={setOpen} onConfirm={onConfirm} documentNo={detail.form_id}
        hasClearing={Boolean(detail.fin?.clear_date)} part2Available initial={initial} isPreparing={preparing} />
  );
  return compact ? <>{trigger}{dialog}</> : <div className="flex justify-end">{trigger}{dialog}</div>;
}
