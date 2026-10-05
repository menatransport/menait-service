import type { FinLog } from '@/app/finance/types';

/** Reason of the latest RETURN fin log (the banner shown at RETURNED). Empty string when none. */
export function latestReturnRemark(finLogs: Pick<FinLog, 'action' | 'remark' | 'created_at'>[] | null | undefined): string {
  const returns = (finLogs ?? []).filter(l => l.action === 'RETURN');
  if (returns.length === 0) return '';
  // equal/missing timestamps keep list order (stable sort), so the last one wins
  const sorted = [...returns].sort((a, b) => (a.created_at ?? '').localeCompare(b.created_at ?? ''));
  return sorted[sorted.length - 1].remark?.trim() ?? '';
}
