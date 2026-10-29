'use client';

import Link from 'next/link';
import { ExternalLink, Layers } from 'lucide-react';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import type { PettyClaim } from '@/app/finance/types-petty';
import { RoundDetail } from './RoundDetail';

/** แผงด้านข้างของรอบส่งเคลียร์ — แบบ AdvanceSheet: หัวแผง + ลิงก์เปิดหน้าเต็ม + เนื้อหาเดียวกับหน้าเต็ม */
export function RoundSheet({ round, isOpen, onClose, onChanged, onOpenClaim }: {
  round: { id: number; batch_no: string } | null;
  isOpen: boolean;
  onClose: () => void;
  onChanged?: () => void;
  onOpenClaim: (claim: PettyClaim) => void;
}) {
  return (
    <Sheet open={isOpen} onOpenChange={v => { if (!v) onClose(); }}>
      <SheetContent side="right" className="flex h-full w-full flex-col p-0 sm:max-w-2xl">
        <SheetHeader className="border-b border-gray-100 px-5 py-4">
          <div className="flex items-center justify-between gap-3 pr-6">
            <div className="flex min-w-0 items-center gap-3">
              <div className="v2-tile-mint flex size-9 shrink-0 items-center justify-center rounded-xl"><Layers className="size-4" /></div>
              <div className="min-w-0">
                <p className="text-[11px] font-medium uppercase tracking-wide text-gray-400">รอบส่งเคลียร์เงินสดย่อย</p>
                <SheetTitle className="truncate font-display text-brand-800">{round?.batch_no ?? ''}</SheetTitle>
              </div>
            </div>
            {round && (
              <Link href={`/finance/petty/rounds/${round.id}`} target="_blank" rel="noopener noreferrer"
                className="inline-flex shrink-0 items-center gap-1 text-xs font-medium text-brand-600 hover:underline">
                <ExternalLink className="h-3.5 w-3.5" /> เปิดหน้าเต็ม
              </Link>
            )}
          </div>
        </SheetHeader>
        <div className="flex-1 space-y-4 overflow-y-auto px-5 py-4">
          {round && isOpen && <RoundDetail roundId={round.id} onChanged={onChanged} onOpenClaim={onOpenClaim} />}
        </div>
      </SheetContent>
    </Sheet>
  );
}
