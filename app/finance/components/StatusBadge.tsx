import { STATUS_LABELS, STATUS_STYLES, type AdvanceStatus } from '@/lib/finance/status';

export function StatusBadge({ status, overdue = false }: { status: AdvanceStatus; overdue?: boolean }) {
  return (
    <span className="inline-flex flex-wrap items-center gap-1.5">
      <span className={`inline-flex rounded-full border px-2.5 py-0.5 text-xs font-medium ${STATUS_STYLES[status]}`}>
        {STATUS_LABELS[status]}
      </span>
      {overdue && (
        <span className="inline-flex rounded-full border border-rose-300 bg-rose-100 px-2 py-0.5 text-xs font-semibold text-rose-700">
          เกินกำหนด
        </span>
      )}
    </span>
  );
}
