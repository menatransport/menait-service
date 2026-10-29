'use client';

import { FileText, PencilLine } from 'lucide-react';
import { Checkbox } from '@/components/ui/checkbox';
import type { PettyClaim } from '@/app/finance/types-petty';
import { formatDate } from '@/lib/finance/status';
import { Field } from '../../FinanceShell';
import { openerName } from './PendingClaimCard';
import { BTN_VIEW, CARD, HintLine, Money } from './ui';

/** ใบที่อนุมัติจ่ายแล้วในแถบส่งเคลียร์ — ติ๊กเข้ารอบ · ใส่/แก้ DD (เฉพาะประเภทที่มี DD) */
export function ClearClaimCard({ claim, typeName, checked, blocker, hasDd, highlight, busy, onToggle, onView, onDd }: {
  claim: PettyClaim; typeName: string; checked: boolean; blocker: string | null; hasDd: boolean;
  highlight: boolean; busy: boolean; onToggle: () => void; onView: () => void; onDd: () => void;
}) {
  const id = `pick-${claim.id}`;
  return (
    <div id={`apv-${claim.form_id}`} className={`${CARD} ${checked ? 'border-brand-200 bg-brand-50/40' : ''} ${highlight ? 'ring-2 ring-mint-500' : ''}`}>
      <div className="flex items-start gap-3">
        <Checkbox id={id} checked={checked} disabled={!!blocker} onCheckedChange={onToggle}
          aria-label={`เลือกใบ ${claim.form_id}`}
          className="mt-0.5 size-5 rounded-md border-gray-300 data-[state=checked]:border-brand-600 data-[state=checked]:bg-brand-600 data-[state=checked]:text-white" />
        <div className="min-w-0 flex-1">
          <label htmlFor={id} className={`mb-3 flex flex-wrap items-start justify-between gap-2 border-b border-gray-100 pb-3 ${blocker ? '' : 'cursor-pointer'}`}>
            <span>
              <span className="block text-sm font-semibold text-brand-800">{claim.form_id}</span>
              <span className="block text-xs text-gray-500">{openerName(claim)}</span>
            </span>
            <span className="inline-flex items-center rounded-full border border-brand-200 bg-brand-50 px-2.5 py-0.5 text-xs font-medium text-brand-700">
              อนุมัติจ่ายแล้ว
            </span>
          </label>
          <div className={`grid grid-cols-2 gap-4 ${hasDd ? 'sm:grid-cols-5' : 'sm:grid-cols-4'}`}>
            <Money label="จำนวนเงิน" value={claim.amount} strong />
            <Field label="ประเภท" value={typeName} />
            <Field label="จ่ายให้" value={claim.payee_name ?? '-'} />
            <Field label="จ่ายเมื่อ" value={formatDate(claim.transfer_date)} />
            {hasDd && <Field label="เลข DD" value={claim.dd_no ?? <span className="text-gray-400">ยังไม่มี</span>} />}
          </div>
          <div className="mt-4 border-t border-gray-100 pt-3">
            {blocker && <HintLine tone="warn">{blocker} ใบนี้ยังติ๊กเข้ารอบไม่ได้</HintLine>}
            <div className="flex flex-wrap justify-end gap-2">
              <button type="button" onClick={onView} className={`${BTN_VIEW} mr-auto`}>
                <FileText className="h-4 w-4" /> ดูรายละเอียดทั้งหมด
              </button>
              {hasDd && (
                <button type="button" onClick={onDd} disabled={busy} className={BTN_VIEW}>
                  <PencilLine className="h-4 w-4" /> {busy ? 'กำลังบันทึก…' : claim.dd_no ? 'แก้ DD' : 'ใส่ DD'}
                </button>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
