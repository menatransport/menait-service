import { Banknote, CircleCheck, CornerUpLeft, Hourglass, SearchCheck, ThumbsUp, Undo2, type LucideIcon } from 'lucide-react';
import { PETTY_STATUS_LABELS, PETTY_STATUS_STYLES, type PettyStatus } from '@/lib/finance/petty-status';

// ไอคอนชุดเดียวกับป้ายของ Advance (StatusBadge) เพื่อให้สองโมดูลอ่านเหมือนกัน
const ICONS: Record<PettyStatus, LucideIcon> = {
  PENDING_APPROVAL: Hourglass,
  RETURNED: CornerUpLeft,
  APPROVED: ThumbsUp,
  TRANSFERRED: Banknote,
  AWAITING_REVIEW: SearchCheck,
  SENT_BACK: Undo2,
  CLOSED: CircleCheck,
};

export function PettyStatusBadge({ status, note }: { status: PettyStatus; note?: string | null }) {
  const Icon = ICONS[status];
  return (
    <span className="inline-flex flex-wrap items-center gap-1.5">
      <span className={`inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-xs font-medium whitespace-nowrap ${PETTY_STATUS_STYLES[status]}`}>
        {Icon && <Icon className="size-3" />}
        {PETTY_STATUS_LABELS[status]}
      </span>
      {note && (
        <span className="inline-flex items-center rounded-full border border-emerald-300 bg-emerald-50 px-2 py-0.5 text-xs font-medium text-emerald-700 whitespace-nowrap">
          {note}
        </span>
      )}
    </span>
  );
}
