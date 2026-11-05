import type { FinLog } from '@/app/finance/types';

type LogLike = Pick<FinLog, 'action' | 'remark' | 'created_at'>;

/** Reason of the latest RETURN fin log (the banner shown at RETURNED). Empty string when none. */
export function latestReturnRemark(finLogs: LogLike[] | null | undefined): string {
  return latestRemark(finLogs, 'RETURN');
}

/** Reason of the CANCEL fin log (the banner shown at CANCELLED — ตีกลับแบบยกเลิก). Empty string when none. */
export function latestCancelRemark(finLogs: LogLike[] | null | undefined): string {
  return latestRemark(finLogs, 'CANCEL');
}

function latestRemark(finLogs: LogLike[] | null | undefined, action: string): string {
  const returns = (finLogs ?? []).filter(l => l.action === action);
  if (returns.length === 0) return '';
  // equal/missing timestamps keep list order (stable sort), so the last one wins
  const sorted = [...returns].sort((a, b) => (a.created_at ?? '').localeCompare(b.created_at ?? ''));
  return sorted[sorted.length - 1].remark?.trim() ?? '';
}
