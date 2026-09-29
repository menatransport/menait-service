'use client';

import { useEffect, useState } from 'react';
import { Printer } from 'lucide-react';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import type { PrintParts } from '@/lib/finance/printShared';

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirm: (parts: PrintParts) => void;
  documentNo?: string;
  /** fin.clear_date exists — Part 2 / ทั้งหมด need it. */
  hasClearing: boolean;
  /** False until the Part 2 document (Task 16b) exists: Part 2 / ทั้งหมด show "เร็วๆ นี้". */
  part2Available?: boolean;
  initial?: PrintParts;
  isPreparing?: boolean;
};

const OPTIONS: { value: PrintParts; title: string; subtitle: string }[] = [
  { value: 'part1', title: 'Part 1 : Cash Advance Request', subtitle: 'ใบคำขอเบิกเงินล่วงหน้า' },
  { value: 'part2', title: 'Part 2 : Advance Clearing', subtitle: 'ใบเคลียร์เงินทดรองจ่าย' },
  { value: 'both', title: 'ทั้งหมด', subtitle: 'Part 1 + Part 2' },
];

export default function PrintDialog({ open, onOpenChange, onConfirm, documentNo, hasClearing, part2Available = false, initial, isPreparing = false }: Props) {
  const part2Ok = hasClearing && part2Available;
  const disabledNote = !hasClearing ? 'ยังไม่มีข้อมูลเคลียร์' : !part2Available ? 'เร็วๆ นี้' : '';
  const enabled = (v: PrintParts) => v === 'part1' || part2Ok;
  const [selected, setSelected] = useState<PrintParts>('part1');

  // Reset on every open: requested option if usable, else ทั้งหมด when clearing exists, else Part 1.
  useEffect(() => {
    if (open) setSelected(initial && enabled(initial) ? initial : part2Ok ? 'both' : 'part1');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, initial, part2Ok]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent showCloseButton={false} className="sm:max-w-sm gap-0 overflow-hidden rounded-md border border-slate-300 bg-white p-0 shadow-2xl">
        <DialogHeader className="border-b border-slate-200 bg-slate-50 px-5 py-3.5">
          <DialogTitle className="flex items-center gap-2 text-[15px] font-semibold tracking-tight text-slate-800">
            <Printer className="h-4 w-4 text-slate-500" />
            พิมพ์เอกสาร
          </DialogTitle>
          <DialogDescription className="text-xs text-slate-500">{documentNo || 'ใบเบิกเงินล่วงหน้า'}</DialogDescription>
        </DialogHeader>

        <div className="divide-y divide-slate-200">
          {OPTIONS.map(option => {
            const ok = enabled(option.value);
            const isActive = selected === option.value;
            return (
              <button
                key={option.value}
                type="button"
                disabled={!ok}
                onClick={() => setSelected(option.value)}
                className={`flex w-full items-center gap-3 px-5 py-3 text-left transition-colors ${
                  !ok ? 'cursor-not-allowed bg-white opacity-50' : isActive ? 'cursor-pointer bg-slate-100' : 'cursor-pointer bg-white hover:bg-slate-50'
                }`}
              >
                <span className={`flex h-4 w-4 shrink-0 items-center justify-center rounded-full border ${isActive ? 'border-slate-800' : 'border-slate-300'}`}>
                  {isActive && <span className="h-2 w-2 rounded-full bg-slate-800" />}
                </span>
                <span className="flex-1">
                  <span className="block text-sm font-medium text-slate-800">{option.title}</span>
                  <span className="block text-xs text-slate-500">{option.subtitle}</span>
                  {!ok && <span className="block text-[11px] text-amber-600">{disabledNote}</span>}
                </span>
              </button>
            );
          })}
        </div>

        <div className="flex items-center justify-between gap-3 border-t border-slate-200 bg-slate-50 px-5 py-3">
          <span className="text-[11px] text-slate-500">แนบหน้ารูปภาพให้อัตโนมัติ</span>
          <div className="flex gap-2">
            <button type="button" onClick={() => onOpenChange(false)} disabled={isPreparing}
              className="cursor-pointer rounded border border-slate-300 bg-white px-4 py-1.5 text-sm font-medium text-slate-700 transition-colors hover:bg-slate-100 disabled:opacity-50">
              ยกเลิก
            </button>
            <button type="button" onClick={() => onConfirm(selected)} disabled={isPreparing}
              className="cursor-pointer rounded bg-slate-800 px-4 py-1.5 text-sm font-medium text-white transition-colors hover:bg-slate-900 disabled:opacity-50">
              {isPreparing ? 'กำลังเตรียม...' : 'พิมพ์'}
            </button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
