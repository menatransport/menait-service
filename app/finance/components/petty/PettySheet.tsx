'use client';

import Link from 'next/link';
import { ExternalLink, Receipt } from 'lucide-react';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { ClaimDetail } from './worklist/ClaimDetail';

/**
 * แผงข้างของใบเงินสดย่อย — แบบเดียวกับ AdvanceSheet: เปิดจากแถวในตาราง กดเปลี่ยนสถานะได้ในนี้
 * กว้างกว่า Advance หนึ่งขั้น (3xl) เพราะตารางรายการรถในใบกว้าง
 */
export function PettySheet({ formId, isOpen, onClose, onChanged, onOpenRound }: {
  formId: string | null; isOpen: boolean; onClose: () => void; onChanged?: () => void;
  /** หน้างานเงินสดย่อย: กด "ดูรอบส่งเคลียร์" แล้วเปิดแผงรอบแทน · ไม่ส่ง = ลิงก์ไปหน้ารอบ */
  onOpenRound?: (batchId: number) => void;
}) {
  return (
    <Sheet open={isOpen} onOpenChange={v => { if (!v) onClose(); }}>
      <SheetContent side="right" className="flex h-full w-full flex-col p-0 sm:max-w-3xl">
        <SheetHeader className="border-b border-gray-100 px-5 py-4">
          <div className="flex items-center justify-between gap-3 pr-6">
            <div className="flex min-w-0 items-center gap-3">
              <div className="v2-tile-mint flex size-9 shrink-0 items-center justify-center rounded-xl"><Receipt className="size-4" /></div>
              <div className="min-w-0">
                <p className="text-[11px] font-medium uppercase tracking-wide text-gray-400">ใบเบิกเงินสดย่อย</p>
                <SheetTitle className="truncate font-display text-brand-800">{formId ?? ''}</SheetTitle>
              </div>
            </div>
            {formId && (
              <Link href={`/finance/petty/${encodeURIComponent(formId)}`} target="_blank" rel="noopener noreferrer"
                className="inline-flex shrink-0 items-center gap-1 text-xs font-medium text-brand-600 hover:underline">
                <ExternalLink className="h-3.5 w-3.5" /> เปิดหน้าเต็ม
              </Link>
            )}
          </div>
        </SheetHeader>
        <div className="flex-1 space-y-4 overflow-y-auto px-5 py-4">
          {formId && isOpen && <ClaimDetail formId={formId} onChanged={onChanged} onOpenRound={onOpenRound} />}
        </div>
      </SheetContent>
    </Sheet>
  );
}
