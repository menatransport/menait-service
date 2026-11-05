import type { AdvanceItem } from '@/app/finance/types';

/** Query params the /api/finance/advances proxy forwards to the BE (paged list mode). */
export const LIST_PARAMS = [
  'page', 'page_size', 'status', 'overdue', 'q', 'date_from', 'date_to', 'cost_center', 'department', 'sort',
] as const;

export function pickListParams(sp: { get(name: string): string | null }): Record<string, string | null> {
  return Object.fromEntries(LIST_PARAMS.map(k => [k, sp.get(k)]));
}

export const MAX_EXPORT_PAGES = 100;

export const ADVANCE_PAGE_SIZE = 20;
export const ADVANCE_EXPORT_PAGE_SIZE = 200;

export interface AdvanceSummary {
  counts: Record<string, number>;
  overdue: number;
  outstanding_amount: number;
  /** outstanding_amount split by status (BE 30/10/2026 on; missing from an older BE) */
  outstanding_by_status?: Record<string, number>;
  /** money of the overdue advances, already inside outstanding_amount */
  overdue_amount?: number;
  /** overdue tickets and money per status (only AWAITING_CLEARING / SENT_BACK can be overdue; missing from an older BE) */
  overdue_by_status?: Record<string, { count: number; amount: number }>;
}

export interface AdvancePage {
  items: AdvanceItem[];
  total: number;
  page: number;
  page_size: number;
  summary: AdvanceSummary;
  options?: { cost_centers: string[]; departments: string[] };
}

/** A tab is a server filter: a derived-status list, overdue=true, or neither (all). */
export interface TabFilter {
  status?: string[];
  overdue?: boolean;
  /** narrows the server rows in the browser (set by combineTabs only; a tab with it must load every page) */
  match?: (item: AdvanceItem) => boolean;
}

/** The only statuses the BE can flag overdue (derive_status: fin PAID / SENT_BACK past clear_due_date). */
export const OVERDUE_STATUSES = ['AWAITING_CLEARING', 'SENT_BACK'];

/** Ticked options ride on their tab's key: 'clear' = the whole tab, 'clear:overdue,review' = only those options. */
export function parseTabKey(key: string): { tab: string; picks: string[] } {
  const i = key.indexOf(':');
  return i < 0 ? { tab: key, picks: [] } : { tab: key.slice(0, i), picks: key.slice(i + 1).split(',').filter(Boolean) };
}

/** The key after ticking or unticking one option of a tab (options kept in tab order; none or all ticked = the whole tab). */
export function toggleTabOption(tab: { key: string; options?: { key: string }[] }, activeKey: string, option: string): string {
  const current = parseTabKey(activeKey);
  const picked = current.tab === tab.key ? current.picks : [];
  const next = picked.includes(option) ? picked.filter(k => k !== option) : [...picked, option];
  const order = (tab.options ?? []).map(o => o.key);
  const ticked = order.filter(k => next.includes(k));
  return ticked.length === 0 || ticked.length === order.length ? tab.key : `${tab.key}:${ticked.join(',')}`;
}

/**
 * Several picked tabs = every advance in any of them, each once. Each one is a status list or overdue alone.
 * Overdue is a flag, not a status, so the BE cannot OR it with other statuses: when the picked statuses do not
 * already cover every overdue advance, ask for those statuses plus the overdue ones and keep the union in the browser.
 */
export function combineTabs(picked: TabFilter[]): TabFilter {
  if (picked.length === 1) return picked[0];
  if (picked.length === 0 || picked.some(t => !t.status?.length && !t.overdue)) return {};
  const statuses = [...new Set(picked.flatMap(t => (t.overdue ? [] : t.status ?? [])))];
  if (!picked.some(t => t.overdue)) return { status: statuses };
  if (statuses.length === 0) return { overdue: true };
  if (OVERDUE_STATUSES.every(s => statuses.includes(s))) return { status: statuses };
  return {
    status: [...statuses, ...OVERDUE_STATUSES.filter(s => !statuses.includes(s))],
    match: item => item.overdue || statuses.includes(item.status),
  };
}

export interface ScopeFilter {
  q?: string;
  startMonth?: string; // 'YYYY-MM'
  endMonth?: string; // 'YYYY-MM'
  costCenter?: string; // '' / 'all' = none
  department?: string; // '' / 'all' = none
  sort?: 'asc' | 'desc';
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
  if (scope.department && scope.department !== 'all') sp.set('department', scope.department);
  if (scope.sort) sp.set('sort', scope.sort);
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
  /** called with page 1 (summary + filter options) */
  onFirstPage?: (res: AdvancePage) => void,
): Promise<AdvanceItem[]> {
  // offset paging over a live list can repeat rows: dedupe by form_id
  const byId = new Map<string, AdvanceItem>();
  let page = 1;
  let pages = 1;
  do {
    const res = await getPage(buildAdvanceQuery(scope, tab, page, pageSize));
    if (page === 1) onFirstPage?.(res);
    for (const it of res.items) if (!byId.has(it.form_id)) byId.set(it.form_id, it);
    pages = totalPages(res.total, pageSize);
    if (res.items.length === 0) break;
    page += 1;
  } while (page <= pages && page <= MAX_EXPORT_PAGES);
  const items = Array.from(byId.values());
  return tab.match ? items.filter(tab.match) : items;
}
