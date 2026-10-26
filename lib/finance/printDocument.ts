import type { AdvanceDetail } from '@/app/finance/types';
import { buildCashAdvanceHtml, toCashAdvanceData } from './cashAdvanceForm';
import { buildClearingHtml, buildCombinedHtml, toClearingData } from './clearingForm';
import { attachmentPagesHtml, type PrintFile, type PrintParts } from './printShared';

/**
 * Folders printed as image pages after Part 2. Part 1 prints its form page only, no attachments
 * (ผู้ใช้แจ้ง 26/10/2026: ใบคำขอเบิกพิมพ์หน้าเดียวพอ ไม่ต้องมีหลักฐาน).
 */
export const PART2_ATTACHMENT_FOLDERS = ['clear', 'check'];

/** Part 1 alone prints no attachments, so it skips loading the file list. */
export const printNeedsFiles = (parts: PrintParts) => parts !== 'part1';

export function buildPrintHtml(
  detail: AdvanceDetail, parts: PrintParts, files: PrintFile[], opts: { logoUrl: string; labels: Record<string, string> },
): string {
  const { logoUrl } = opts;
  if (parts === 'part1') return buildCashAdvanceHtml(toCashAdvanceData(detail), { logoUrl });
  const att2 = attachmentPagesHtml(files, PART2_ATTACHMENT_FOLDERS, opts.labels);
  const clearing = toClearingData(detail);
  return parts === 'part2'
    ? buildClearingHtml(clearing, { logoUrl, attachmentsHtml: att2 })
    : buildCombinedHtml(toCashAdvanceData(detail), clearing, { logoUrl, part2AttachmentsHtml: att2 });
}
