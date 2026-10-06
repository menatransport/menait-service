'use client';

import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { Calendar, FileSpreadsheet, FileText, Filter, Search, User, X } from 'lucide-react';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { MonthRangeFilter, currentMonth, shiftMonths } from '@/components/month-range-filter';
import { PaginationControls } from '@/components/pagination-controls';
import { exportAdvancesXlsx } from '@/lib/finance/export';
import {
  ADVANCE_PAGE_SIZE, buildAdvanceQuery, fetchAllAdvances, tabCount, totalPages,
  type AdvancePage, type AdvanceSummary, type ScopeFilter, type TabFilter,
} from '@/lib/finance/advanceQuery';
import { formatBaht, formatDate, settleLabel, todayBkk } from '@/lib/finance/status';
import { fetchJson, showAlert } from '../api';
import type { AdvanceItem } from '../types';
import { StatusBadge } from './StatusBadge';

const TH = 'px-4 py-3 text-left text-sm font-semibold text-gray-700 whitespace-nowrap';
const TD = 'px-4 py-3 text-sm whitespace-nowrap';
// finance queue: 9 compact columns so the table fits a laptop width inside the card
const FTH = 'px-3 py-3 text-left text-xs font-semibold text-gray-700 whitespace-nowrap';
const FTD = 'px-3 py-2.5 text-sm whitespace-nowrap align-top';

/** Settlement after clearing: "รับคืน 500.00 บาท" (employee returns) / "เบิกเพิ่ม 450.00 บาท" (company pays more). */
function settleText(amount: number | null | undefined): string | null {
  if (amount === null || amount === undefined) return null;
  if (amount === 0) return 'พอดี';
  return `${settleLabel(amount)} ${formatBaht(Math.abs(amount))} บาท`;
}
const settleTone = (amount: number | null | undefined) => (amount !== null && amount !== undefined && amount < 0 ? 'text-orange-700' : 'text-brand-700');

export interface AdvanceListTab extends TabFilter {
  key: string;
  label: string;
}

const SEARCH_DEBOUNCE_MS = 300;

export function AdvanceListView({
  mode,
  tabs,
  activeTab,
  onTabChange,
  onOpen,
  headerAction,
  exportFileBase,
  refreshKey = 0,
  onSummary,
  onScopeChange,
}: {
  mode: 'finance' | 'mine';
  tabs: AdvanceListTab[];
  activeTab: string;
  onTabChange: (key: string) => void;
  onOpen: (item: AdvanceItem) => void;
  headerAction?: ReactNode;
  exportFileBase?: string;
  /** bump to refetch the current page (after an action changed an advance) */
  refreshKey?: number;
  onSummary?: (summary: AdvanceSummary) => void;
  /** current scope (search/month/cost center) so the parent can build matching bulk queries */
  onScopeChange?: (scope: ScopeFilter) => void;
}) {
  // Default range = last 12 months up to the current month (finance must not lose older open advances)
  const [startMonth, setStartMonth] = useState<string>(() => shiftMonths(11));
  const [endMonth, setEndMonth] = useState<string>(() => currentMonth());
  const [search, setSearch] = useState('');
  const [debouncedQ, setDebouncedQ] = useState('');
  const [ccFilter, setCcFilter] = useState('all');
  const [showFilters, setShowFilters] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);

  const [rows, setRows] = useState<AdvanceItem[]>([]);
  const [total, setTotal] = useState(0);
  const [summary, setSummary] = useState<AdvanceSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [exporting, setExporting] = useState(false);
  // cost centers seen so far (the server only returns one page, so the options accumulate)
  const [ccSeen, setCcSeen] = useState<string[]>([]);
  const reqSeq = useRef(0);

  const handleMonthRangeChange = useCallback((s: string, e: string) => {
    setStartMonth(s);
    setEndMonth(e);
  }, []);

  const activeTabDef = tabs.find(t => t.key === activeTab) ?? tabs[0];

  // search is debounced; any change of search resets to page 1 once it applies
  useEffect(() => {
    const t = setTimeout(() => setDebouncedQ(search), SEARCH_DEBOUNCE_MS);
    return () => clearTimeout(t);
  }, [search]);

  const scope = useMemo<ScopeFilter>(
    () => ({ q: debouncedQ, startMonth, endMonth, costCenter: mode === 'finance' ? ccFilter : 'all' }),
    [debouncedQ, startMonth, endMonth, ccFilter, mode],
  );
  useEffect(() => { onScopeChange?.(scope); }, [scope, onScopeChange]);

  // Reset to page 1 whenever the tab, search, filters or month range change
  useEffect(() => { setCurrentPage(1); }, [activeTab, debouncedQ, ccFilter, startMonth, endMonth]);

  const listUrl = useCallback(
    (query: string) => `/api/finance/advances?${mode === 'mine' ? 'mine=1&' : ''}${query}`,
    [mode],
  );

  useEffect(() => {
    if (!activeTabDef) return;
    const seq = ++reqSeq.current;
    setLoading(true);
    fetchJson<AdvancePage>(listUrl(buildAdvanceQuery(scope, activeTabDef, currentPage, ADVANCE_PAGE_SIZE)))
      .then(res => {
        if (seq !== reqSeq.current) return; // a newer request superseded this one
        const lastPage = totalPages(res.total, ADVANCE_PAGE_SIZE);
        if (res.items.length === 0 && currentPage > lastPage) { setCurrentPage(lastPage); return; }
        setRows(res.items);
        setTotal(res.total);
        setSummary(res.summary);
        onSummary?.(res.summary);
        setCcSeen(prev => {
          const next = new Set(prev);
          res.items.forEach(i => { if (i.request.cost_center) next.add(i.request.cost_center); });
          return next.size === prev.length ? prev : Array.from(next).sort();
        });
        setLoading(false);
      })
      .catch(err => {
        if (seq !== reqSeq.current) return;
        setRows([]);
        setTotal(0);
        setLoading(false);
        showAlert({ icon: 'error', title: 'โหลดข้อมูลไม่สำเร็จ', text: err.message });
      });
  }, [activeTabDef, scope, currentPage, listUrl, refreshKey, onSummary]);

  const ccOptions = useMemo(
    () => (ccFilter !== 'all' && !ccSeen.includes(ccFilter) ? [...ccSeen, ccFilter].sort() : ccSeen),
    [ccSeen, ccFilter],
  );

  const pages = totalPages(total, ADVANCE_PAGE_SIZE);
  const hasActiveFilters = search.trim() !== '' || (mode === 'finance' && ccFilter !== 'all');
  const paginated = rows;

  const clearFilters = () => { setSearch(''); setCcFilter('all'); };
  const handleExport = async () => {
    if (!exportFileBase || !activeTabDef || exporting) return;
    setExporting(true);
    try {
      const all = await fetchAllAdvances(q => fetchJson<AdvancePage>(listUrl(q)), scope, activeTabDef);
      exportAdvancesXlsx(all, `${exportFileBase}-${activeTab}-${todayBkk()}.xlsx`);
    } catch (err) {
      showAlert({ icon: 'error', title: 'ส่งออก Excel ไม่สำเร็จ', text: (err as Error).message });
    } finally {
      setExporting(false);
    }
  };

  return (
    <Tabs value={activeTab} onValueChange={onTabChange}>
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between mb-6">
        <TabsList className="max-w-full overflow-x-auto justify-start bg-gray-800/50 backdrop-blur-sm p-1 rounded-full">
          {tabs.map(t => {
            const count = tabCount(t, summary);
            return (
              <TabsTrigger
                key={t.key}
                value={t.key}
                className="shrink-0 px-5 py-2 rounded-full text-white/70 font-medium transition-all data-[state=active]:bg-white data-[state=active]:text-brand-700 data-[state=active]:shadow-md hover:text-white"
              >
                {t.label}{count === null ? '' : ` (${count})`}
              </TabsTrigger>
            );
          })}
        </TabsList>

        <MonthRangeFilter startMonth={startMonth} endMonth={endMonth} onChange={handleMonthRangeChange} />
      </div>

      <section className="bg-white rounded-2xl shadow-xl border border-white/30 overflow-hidden relative">
        <div className="p-4 lg:p-5 bg-brand-800">
          <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-3">
            <div className="flex items-center justify-between lg:justify-start gap-4">
              <div>
                <h2 className="text-lg lg:text-xl text-white font-semibold">{activeTabDef?.label ?? ''}</h2>
                <p className="text-white/70 text-xs lg:text-sm mt-0.5">
                  {`${total} รายการ`}
                </p>
              </div>

              <div className="flex lg:hidden items-center gap-2">
                {mode === 'finance' && (
                  <button
                    type="button"
                    onClick={() => setShowFilters(v => !v)}
                    className={`flex items-center justify-center w-9 h-9 rounded-lg transition-all cursor-pointer ${showFilters || hasActiveFilters ? 'bg-white text-brand-800' : 'bg-white/10 text-white hover:bg-white/20'}`}
                  >
                    <Filter size={16} />
                  </button>
                )}
              </div>
            </div>

            <div className="hidden lg:flex items-center gap-2">
              <div className="relative">
                <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-white/60" />
                <input
                  type="text"
                  placeholder="ค้นหา เลขที่เอกสาร / ผู้เบิก / เลขที่ใบเบิก / วัตถุประสงค์"
                  value={search}
                  onChange={e => setSearch(e.target.value)}
                  className="w-64 pl-8 pr-8 py-1.5 text-sm bg-white/10 border border-white/20 rounded-lg text-white placeholder:text-white/50 focus:outline-none focus:bg-white/20 focus:border-white/40 transition-all"
                />
                {search && (
                  <button type="button" onClick={() => setSearch('')} className="absolute right-2 top-1/2 -translate-y-1/2 text-white/60 hover:text-white cursor-pointer">
                    <X size={12} />
                  </button>
                )}
              </div>

              {mode === 'finance' && (
                <button
                  type="button"
                  onClick={() => setShowFilters(v => !v)}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium transition-all cursor-pointer ${showFilters || hasActiveFilters ? 'bg-white text-brand-800' : 'bg-white/10 text-white hover:bg-white/20 border border-white/20'}`}
                >
                  <Filter size={14} /> <span>ตัวกรอง</span>
                </button>
              )}

              {headerAction}

              {exportFileBase && (
                <button
                  type="button"
                  onClick={handleExport}
                  disabled={!total || exporting}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium bg-emerald-600 text-white hover:bg-emerald-500 transition-all cursor-pointer disabled:opacity-60 disabled:cursor-not-allowed"
                >
                  <FileSpreadsheet size={14} /> <span>{exporting ? 'กำลังส่งออก...' : 'Excel'}</span>
                </button>
              )}
            </div>
          </div>

          {/* Mobile search + actions row */}
          <div className="mt-3 flex lg:hidden flex-wrap items-center gap-2">
            <div className="relative flex-1 min-w-36">
              <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-white/60" />
              <input
                type="text"
                placeholder="ค้นหา..."
                value={search}
                onChange={e => setSearch(e.target.value)}
                className="w-full pl-9 pr-9 py-2 text-sm bg-white/10 border border-white/20 rounded-xl text-white placeholder:text-white/50 focus:outline-none focus:bg-white/20 focus:border-white/40 transition-all"
              />
              {search && (
                <button type="button" onClick={() => setSearch('')} className="absolute right-3 top-1/2 -translate-y-1/2 text-white/60 hover:text-white cursor-pointer">
                  <X size={14} />
                </button>
              )}
            </div>
            {headerAction}
            {exportFileBase && (
              <button
                type="button"
                onClick={handleExport}
                disabled={!total || exporting}
                className="flex items-center justify-center w-9 h-9 rounded-lg bg-emerald-600 text-white disabled:opacity-60 cursor-pointer"
              >
                <FileSpreadsheet size={16} />
              </button>
            )}
          </div>
        </div>

        {/* Finance-mode filter row */}
        {mode === 'finance' && showFilters && (
          <div className="p-3 lg:p-4 bg-linear-to-r from-gray-50 to-gray-100 border-b border-gray-200">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
              <div className="flex flex-col sm:flex-row sm:items-center gap-2">
                <span className="text-xs font-medium text-gray-500 shrink-0">ศูนย์ค่าใช้จ่าย</span>
                <select
                  value={ccFilter}
                  onChange={e => setCcFilter(e.target.value)}
                  className={`px-3 py-1.5 rounded-lg text-sm border bg-white cursor-pointer focus:outline-none transition-colors ${ccFilter !== 'all' ? 'border-brand-600 text-brand-600 font-medium ring-1 ring-brand-600/30' : 'border-gray-300 text-gray-700 hover:border-gray-400'}`}
                >
                  <option value="all">ศูนย์ค่าใช้จ่ายทั้งหมด</option>
                  {ccOptions.map(c => <option key={c} value={c}>{c}</option>)}
                </select>
              </div>
              {hasActiveFilters && (
                <button type="button" onClick={clearFilters} className="flex items-center gap-1.5 px-3 py-1.5 text-sm text-gray-500 hover:text-red-600 hover:bg-red-50 rounded-lg cursor-pointer transition-colors">
                  <X size={14} /> ล้างตัวกรอง
                </button>
              )}
            </div>
          </div>
        )}

        {loading && (
          <div className="absolute inset-0 bg-white/75 backdrop-blur-sm flex items-center justify-center z-10">
            <div className="flex flex-col items-center gap-4">
              <div className="w-12 h-12 border-4 border-brand-200 border-t-brand-600 rounded-full animate-spin" />
              <p className="text-gray-700 font-medium">กำลังค้นหาข้อมูล...</p>
            </div>
          </div>
        )}

        {/* Mobile cards */}
        <div className={`block ${mode === 'finance' ? 'xl:hidden' : 'lg:hidden'} ${loading ? 'min-h-52' : ''}`}>
          {!loading && paginated.length === 0 ? (
            <div className="p-12 text-center text-gray-500">
              <FileText size={56} className="mx-auto mb-4 text-gray-300" />
              <p className="text-lg">ไม่มีรายการ</p>
            </div>
          ) : (
            <div className="divide-y divide-gray-100">
              {paginated.map(item => (
                <div
                  key={item.form_id}
                  onClick={() => onOpen(item)}
                  className={`p-4 active:bg-gray-100 transition-colors cursor-pointer ${item.overdue ? 'bg-rose-50/60' : ''}`}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0 flex-1">
                      <p className="text-xs text-brand-600 font-medium">{item.form_id}</p>
                      <p className="font-semibold text-gray-800 text-sm truncate">{item.fin?.purpose ?? item.request.purpose ?? '-'}</p>
                      {mode === 'finance' && (
                        <p className="text-xs text-gray-500 flex items-center gap-1 mt-0.5">
                          <User size={11} /> {item.requester.name ?? item.requester.employee_id}
                        </p>
                      )}
                      {mode === 'finance' && (
                        <p className="text-xs text-gray-500 mt-0.5">ศูนย์ค่าใช้จ่าย: {item.request.cost_center ?? '-'}</p>
                      )}
                      {mode === 'finance' && (
                        <p className="text-xs text-gray-500 mt-0.5">
                          วันที่โอนเงินคืนบริษัท: {formatDate(item.fin?.settle_date)}
                          {settleText(item.fin?.settle_amount) && <span className={`ml-1 font-medium ${settleTone(item.fin?.settle_amount)}`}>· {settleText(item.fin?.settle_amount)}</span>}
                        </p>
                      )}
                    </div>
                    <StatusBadge status={item.status} overdue={item.overdue} />
                  </div>
                  <div className="flex items-center justify-between mt-2 text-xs text-gray-500">
                    <span>{formatBaht(item.fin?.amount_paid ?? item.request.amount)}</span>
                    <span className="flex items-center gap-1"><Calendar size={11} /> {formatDate(item.fin?.clear_due_date)}</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Desktop table */}
        {/* finance: 9 columns need ≥1280px; narrower screens use the cards above */}
        <div className={`hidden ${mode === 'finance' ? 'xl:block' : 'lg:block'} overflow-x-auto ${loading ? 'min-h-52' : ''}`}>
          <table className="w-full">
            <thead className="bg-gray-100">
              <tr>
                {mode === 'finance' ? (
                  <>
                    <th className={FTH}>เลขที่เอกสาร</th>
                    <th className={FTH}>ผู้เบิก</th>
                    <th className={FTH}>ศูนย์ค่าใช้จ่าย</th>
                    <th className={FTH}>วัตถุประสงค์</th>
                    <th className={`${FTH} text-right`}>ยอดเงิน</th>
                    <th className={FTH}>วันที่ใช้เงิน</th>
                    <th className="px-3 py-3 text-left text-xs font-semibold text-gray-700 leading-tight">วันที่โอนเงิน<br />คืนบริษัท</th>
                    <th className={FTH}>กำหนดเคลียร์</th>
                    <th className={FTH}>สถานะ</th>
                  </>
                ) : (
                  <>
                    <th className={TH}>เลขที่เอกสาร</th>
                    <th className={TH}>วัตถุประสงค์</th>
                    <th className={`${TH} text-right`}>ยอดเงิน</th>
                    <th className={TH}>วันที่ใช้เงิน</th>
                    <th className={TH}>กำหนดการเคลียร์</th>
                    <th className={TH}>สถานะ</th>
                  </>
                )}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {!loading && paginated.length === 0 ? (
                <tr>
                  <td colSpan={mode === 'finance' ? 9 : 6} className="px-6 py-16 text-center text-gray-500">
                    <FileText size={56} className="mx-auto mb-4 text-gray-300" />
                    <p className="text-lg">ไม่มีรายการ</p>
                  </td>
                </tr>
              ) : paginated.map(item => (
                <tr
                  key={item.form_id}
                  onClick={() => onOpen(item)}
                  className={`cursor-pointer hover:bg-gray-50 transition-colors ${item.overdue ? 'bg-rose-50/60' : ''}`}
                >
                  {mode === 'finance' ? (
                    <>
                      <td className={`${FTD} font-medium text-brand-800`}>{item.form_id}</td>
                      <td className="px-3 py-2.5 text-sm align-top">
                        <div className="min-w-44 max-w-60">
                          <p className="font-medium text-gray-800 leading-snug">{item.requester.name ?? item.requester.employee_id}</p>
                          <p className="text-xs text-gray-500 leading-snug">
                            {[item.requester.department, item.requester.site_code ?? item.requester.site].filter(Boolean).join(' · ') || '-'}
                          </p>
                        </div>
                      </td>
                      <td className={FTD}>{item.request.cost_center ?? '-'}</td>
                      <td className="px-3 py-2.5 text-sm align-top">
                        <div className="max-w-[9rem] xl:max-w-[15rem] 2xl:max-w-[24rem] truncate" title={item.fin?.purpose ?? item.request.purpose ?? undefined}>
                          {item.fin?.purpose ?? item.request.purpose ?? '-'}
                        </div>
                      </td>
                      <td className={`${FTD} text-right tabular-nums`}>{formatBaht(item.fin?.amount_paid ?? item.request.amount)}</td>
                      <td className={`${FTD} tabular-nums`}>{formatDate(item.request.use_date)}</td>
                      <td className={`${FTD} tabular-nums`}>
                        <p>{formatDate(item.fin?.settle_date)}</p>
                        {settleText(item.fin?.settle_amount) && (
                          <p className={`text-xs font-medium ${settleTone(item.fin?.settle_amount)}`}>{settleText(item.fin?.settle_amount)}</p>
                        )}
                      </td>
                      <td className={`${FTD} tabular-nums`}>{formatDate(item.fin?.clear_due_date)}</td>
                      <td className="px-3 py-2.5 align-top w-36"><StatusBadge status={item.status} overdue={item.overdue} /></td>
                    </>
                  ) : (
                    <>
                      <td className={`${TD} font-medium text-brand-800`}>{item.form_id}</td>
                      <td className={`${TD} max-w-xs truncate`}>{item.fin?.purpose ?? item.request.purpose ?? '-'}</td>
                      <td className={`${TD} text-right`}>{formatBaht(item.fin?.amount_paid ?? item.request.amount)}</td>
                      <td className={TD}>{formatDate(item.request.use_date)}</td>
                      <td className={TD}>{formatDate(item.fin?.clear_due_date)}</td>
                      <td className={TD}><StatusBadge status={item.status} overdue={item.overdue} /></td>
                    </>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="flex justify-end p-4 border-t border-gray-100">
          <PaginationControls currentPage={currentPage} totalPages={pages} onPageChange={setCurrentPage} />
        </div>
      </section>
    </Tabs>
  );
}
