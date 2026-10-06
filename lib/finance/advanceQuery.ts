import type { AdvanceItem } from '@/app/finance/types';

export const ADVANCE_PAGE_SIZE = 20;
export const ADVANCE_EXPORT_PAGE_SIZE = 200;

export interface AdvanceSummary {
  counts: Record<string, number>;
  overdue: number;
  outstanding_amount: number;
}

export interface AdvancePage {
  items: AdvanceItem[];
  total: number;
  page: number;
  page_size: number;
  summary: AdvanceSummary;
}

/** A tab is a server filter: a derived-status list, overdue=true, or neither (all). */
export interface TabFilter {
  status?: string[];
  overdue?: boolean;
}

export interface ScopeFilter {
  q?: string;
  startMonth?: string; // 'YYYY-MM'
  endMonth?: string; // 'YYYY-MM'
  costCenter?: string; // '' / 'all' = none
}

/** Last day of 'YYYY-MM' as 'YYYY-MM-DD' ('' when the month is malformed). */
export function monthEnd(ym: string): string {
  const m = /^(\d{4})-(\d{2})$/.exec(ym);
  if (!m) return '';
  const last = new Date(Date.UTC(Number(m[1]), Number(m[2]), 0)).getUTCDate();
  return `${ym}-${String(last).padStart(2, '0')}`;
}

export function monthStart(ym: string): string {
  return /^\d{4}-\d{2}$/.test(ym) ? `${ym}-01` : '';
}

/** Scope params (no status/overdue/page): shared by the page fetch, the summary and the overdue-id fetch. */
export function scopeParams(scope: ScopeFilter): URLSearchParams {
  const sp = new URLSearchParams();
  const q = scope.q?.trim();
  if (q) sp.set('q', q);
  if (scope.startMonth) { const d = monthStart(scope.startMonth); if (d) sp.set('date_from', d); }
  if (scope.endMonth) { const d = monthEnd(scope.endMonth); if (d) sp.set('date_to', d); }
  if (scope.costCenter && scope.costCenter !== 'all') sp.set('cost_center', scope.costCenter);
  return sp;
}

export function buildAdvanceQuery(
  scope: ScopeFilter, tab: TabFilter, page: number, pageSize: number, extra: Record<string, string> = {},
): string {
  const sp = scopeParams(scope);
  if (tab.status?.length) sp.set('status', tab.status.join(','));
  if (tab.overdue) sp.set('overdue', 'true');
  sp.set('page', String(page));
  sp.set('page_size', String(pageSize));
  for (const [k, v] of Object.entries(extra)) sp.set(k, v);
  return sp.toString();
}

/** Tab badge count from the scope-wide summary (summary ignores the status/overdue filter). */
export function tabCount(tab: TabFilter, summary: AdvanceSummary | null | undefined): number | null {
  if (!summary) return null;
  if (tab.overdue) return summary.overdue;
  const counts = summary.counts ?? {};
  const keys = tab.status?.length ? tab.status : Object.keys(counts);
  return keys.reduce((n, k) => n + (counts[k] ?? 0), 0);
}

export function totalPages(total: number, pageSize: number): number {
  return Math.max(1, Math.ceil(total / pageSize));
}

/** Fetches every page sequentially (page_size 200 by default) for the given filters. */
export async function fetchAllAdvances(
  getPage: (query: string) => Promise<AdvancePage>,
  scope: ScopeFilter,
  tab: TabFilter,
  pageSize = ADVANCE_EXPORT_PAGE_SIZE,
): Promise<AdvanceItem[]> {
  const all: AdvanceItem[] = [];
  let page = 1;
  let pages = 1;
  do {
    const res = await getPage(buildAdvanceQuery(scope, tab, page, pageSize));
    all.push(...res.items);
    pages = totalPages(res.total, pageSize);
    if (res.items.length === 0) break;
    page += 1;
  } while (page <= pages);
  return all;
}
