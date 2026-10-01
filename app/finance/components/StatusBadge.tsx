import { Banknote, CircleCheck, CircleX, FilePen, Hourglass, ReceiptText, SearchCheck, TriangleAlert, Undo2, type LucideIcon } from 'lucide-react';
import { STATUS_LABELS, STATUS_STYLES, type AdvanceStatus } from '@/lib/finance/status';

const STATUS_ICONS: Record<AdvanceStatus, LucideIcon> = {
  PENDING_APPROVAL: Hourglass,
  REJECTED: CircleX,
  AWAITING_VOUCHER: FilePen,
  AWAITING_PAYMENT: Banknote,
  AWAITING_CLEARING: ReceiptText,
  SENT_BACK: Undo2,
  AWAITING_REVIEW: SearchCheck,
  CLOSED: CircleCheck,
};

export function StatusBadge({ status, overdue = false }: { status: AdvanceStatus; overdue?: boolean }) {
  const Icon = STATUS_ICONS[status];
  return (
    <span className="inline-flex flex-wrap items-center gap-1.5">
      <span className={`inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-xs font-medium whitespace-nowrap ${STATUS_STYLES[status]}`}>
        {Icon && <Icon className="size-3" />}
        {STATUS_LABELS[status]}
      </span>
      {overdue && (
        <span className="inline-flex items-center gap-1 rounded-full border border-rose-300 bg-rose-100 px-2 py-0.5 text-xs font-semibold text-rose-700 whitespace-nowrap">
          <TriangleAlert className="size-3" />
          เกินกำหนด
        </span>
      )}
    </span>
  );
}
