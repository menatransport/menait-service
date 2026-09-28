'use client';

import Link from 'next/link';
import { ExternalLink } from 'lucide-react';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { FinanceAdvanceDetail } from './FinanceAdvanceDetail';
import { MyAdvanceDetail } from './MyAdvanceDetail';

export function AdvanceSheet({
  mode,
  formId,
  isOpen,
  onClose,
  onChanged,
}: {
  mode: 'finance' | 'mine';
  formId: string | null;
  isOpen: boolean;
  onClose: () => void;
  onChanged?: () => void;
}) {
  const fullPageHref = formId
    ? (mode === 'finance' ? `/finance/${encodeURIComponent(formId)}` : `/finance/advance/${encodeURIComponent(formId)}`)
    : '#';

  return (
    <Sheet open={isOpen} onOpenChange={(v) => { if (!v) onClose(); }}>
      <SheetContent side="right" className="w-full p-0 sm:max-w-2xl flex flex-col h-full">
        <SheetHeader className="border-b border-gray-100 px-5 py-4">
          <div className="flex items-center justify-between gap-3 pr-6">
            <SheetTitle className="text-[#055058]">{formId ?? ''}</SheetTitle>
            {formId && (
              <Link
                href={fullPageHref}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex shrink-0 items-center gap-1 text-xs font-medium text-[#026a75] hover:underline"
              >
                <ExternalLink className="h-3.5 w-3.5" /> เปิดหน้าเต็ม
              </Link>
            )}
          </div>
        </SheetHeader>
        <div className="flex-1 overflow-y-auto px-5 py-4 space-y-4">
          {formId && (mode === 'finance'
            ? <FinanceAdvanceDetail formId={formId} onChanged={onChanged} />
            : <MyAdvanceDetail formId={formId} onChanged={onChanged} />)}
        </div>
      </SheetContent>
    </Sheet>
  );
}
