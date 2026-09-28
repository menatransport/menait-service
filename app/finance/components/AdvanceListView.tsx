'use client';

import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react';
import { ArrowDown, ArrowUp, Calendar, FileSpreadsheet, FileText, Filter, Search, User, X } from 'lucide-react';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { MonthRangeFilter, currentMonth, shiftMonths, ymToNum } from '@/components/month-range-filter';
import { PaginationControls } from '@/components/pagination-controls';
import { exportAdvancesXlsx } from '@/lib/finance/export';
import { formatBaht, formatDate, todayBkk, toBkkYM } from '@/lib/finance/status';
import type { AdvanceItem } from '../types';
import { StatusBadge } from './StatusBadge';

const ITEMS_PER_PAGE = 10;

const TH = 'px-4 py-3 text-left text-sm font-semibold text-gray-700 whitespace-nowrap';
const TD = 'px-4 py-3 text-sm whitespace-nowrap';

export interface AdvanceListTab {
  key: string;
  label: string;
  match: (item: AdvanceItem) => boolean;
}

export function AdvanceListView({
  mode,
  items,
  loading,
  tabs,
  activeTab,
  onTabChange,
  onOpen,
  headerAction,
  exportFileBase,
}: {
  mode: 'finance' | 'mine';
  items: AdvanceItem[] | null;
  loading: boolean;
  tabs: AdvanceListTab[];
  activeTab: string;
  onTabChange: (key: string) => void;
  onOpen: (item: AdvanceItem) => void;
  headerAction?: ReactNode;
  exportFileBase?: string;
}) {
  // Default range = last 12 months up to the current month (finance must not lose older open advances)
  const [startMonth, setStartMonth] = useState<string>(() => shiftMonths(11));
  const [endMonth, setEndMonth] = useState<string>(() => currentMonth());
  const [search, setSearch] = useState('');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');
  const [accFilter, setAccFilter] = useState('all');
  const [deptFilter, setDeptFilter] = useState('all');
  const [showFilters, setShowFilters] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);

  const handleMonthRangeChange = useCallback((s: string, e: string) => {
    setStartMonth(s);
    setEndMonth(e);
  }, []);

  const monthFiltered = useMemo(() => {
    const all = items ?? [];
    const lo = ymToNum(startMonth);
    const hi = ymToNum(endMonth);
    return all.filter(i => {
      const ym = toBkkYM(i.created_at);
      if (!ym) return true; // never drop items we can't date — finance must not lose older open advances
      const n = ymToNum(ym);
      return n >= lo && n <= hi;
    });
  }, [items, startMonth, endMonth]);

  const activeTabDef = tabs.find(t => t.key === activeTab) ?? tabs[0];

  const tabItems = useMemo(
    () => (activeTabDef ? monthFiltered.filter(activeTabDef.match) : monthFiltered),
    [monthFiltered, activeTabDef],
  );

  const accOptions = useMemo(() => {
    const seen = new Map<string, string>();
    tabItems.forEach(i => {
      if (i.fin?.acc_code && !seen.has(i.fin.acc_code)) seen.set(i.fin.acc_code, i.fin.acc_name ?? i.fin.acc_code);
    });
    return Array.from(seen, ([value, name]) => ({ value, label: `${value} ${name}` }));
  }, [tabItems]);

  const deptOptions = useMemo(() => {
    const seen = new Set<string>();
    tabItems.forEach(i => { if (i.requester.department) seen.add(i.requester.department); });
    return Array.from(seen);
  }, [tabItems]);

  const hasActiveFilters = search.trim() !== '' || (mode === 'finance' && (accFilter !== 'all' || deptFilter !== 'all'));

  const processedData = useMemo(() => {
    let result = [...tabItems];
    if (mode === 'finance' && accFilter !== 'all') result = result.filter(i => i.fin?.acc_code === accFilter);
    if (mode === 'finance' && deptFilter !== 'all') result = result.filter(i => i.requester.department === deptFilter);
    if (search.trim()) {
      const q = search.trim().toLowerCase();
      result = result.filter(i =>
        i.form_id.toLowerCase().includes(q)
        || (i.requester.name ?? '').toLowerCase().includes(q)
        || (i.fin?.voucher_no ?? '').toLowerCase().includes(q)
        || (i.fin?.purpose ?? i.request.purpose ?? '').toLowerCase().includes(q));
    }
    result.sort((a, b) => {
      const da = a.created_at ? new Date(a.created_at).getTime() : 0;
      const db = b.created_at ? new Date(b.created_at).getTime() : 0;
      return sortOrder === 'desc' ? db - da : da - db;
    });
    return result;
  }, [tabItems, mode, accFilter, deptFilter, search, sortOrder]);

  const totalPages = Math.max(1, Math.ceil(processedData.length / ITEMS_PER_PAGE));
  const paginated = useMemo(() => {
    const start = (currentPage - 1) * ITEMS_PER_PAGE;
    return processedData.slice(start, start + ITEMS_PER_PAGE);
  }, [processedData, currentPage]);

  // Reset to page 1 whenever the tab, search, filters or month range change
  useEffect(() => { setCurrentPage(1); }, [activeTab, search, accFilter, deptFilter, startMonth, endMonth]);

  const toggleSort = () => setSortOrder(o => (o === 'desc' ? 'asc' : 'desc'));
  const clearFilters = () => { setSearch(''); setAccFilter('all'); setDeptFilter('all'); };
  const handleExport = () => {
    if (!exportFileBase) return;
    exportAdvancesXlsx(processedData, `${exportFileBase}-${activeTab}-${todayBkk()}.xlsx`);
  };

  return (
    <Tabs value={activeTab} onValueChange={onTabChange}>
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between mb-6">
        <TabsList className="max-w-full overflow-x-auto justify-start bg-gray-800/50 backdrop-blur-sm p-1 rounded-full">
          {tabs.map(t => {
            const count = monthFiltered.filter(t.match).length;
            return (
              <TabsTrigger
                key={t.key}
                value={t.key}
                className="shrink-0 px-5 py-2 rounded-full text-white/70 font-medium transition-all data-[state=active]:bg-white data-[state=active]:text-teal-700 data-[state=active]:shadow-md hover:text-white"
              >
                {t.label} ({count})
              </TabsTrigger>
            );
          })}
        </TabsList>

        <MonthRangeFilter startMonth={startMonth} endMonth={endMonth} onChange={handleMonthRangeChange} />
      </div>

      <section className="bg-white rounded-2xl shadow-xl border border-white/30 overflow-hidden relative">
        <div className="p-4 lg:p-5 bg-[#04555e]">
          <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-3">
            <div className="flex items-center justify-between lg:justify-start gap-4">
              <div>
                <h2 className="text-lg lg:text-xl text-white font-semibold">{activeTabDef?.label ?? ''}</h2>
                <p className="text-white/70 text-xs lg:text-sm mt-0.5">
                  {hasActiveFilters ? `แสดง ${processedData.length} จาก ${tabItems.length} รายการ` : `${processedData.length} รายการ`}
                </p>
              </div>

              <div className="flex lg:hidden items-center gap-2">
                <button
                  type="button"
                  onClick={toggleSort}
                  className="flex items-center justify-center w-9 h-9 rounded-lg bg-white/10 text-white hover:bg-white/20 transition-all cursor-pointer"
                  title={sortOrder === 'desc' ? 'เรียงจากใหม่ไปเก่า' : 'เรียงจากเก่าไปใหม่'}
                >
                  {sortOrder === 'desc' ? <ArrowDown size={16} /> : <ArrowUp size={16} />}
                </button>
                {mode === 'finance' && (
                  <button
                    type="button"
                    onClick={() => setShowFilters(v => !v)}
                    className={`flex items-center justify-center w-9 h-9 rounded-lg transition-all cursor-pointer ${showFilters || hasActiveFilters ? 'bg-white text-[#04555e]' : 'bg-white/10 text-white hover:bg-white/20'}`}
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
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium transition-all cursor-pointer ${showFilters || hasActiveFilters ? 'bg-white text-[#04555e]' : 'bg-white/10 text-white hover:bg-white/20 border border-white/20'}`}
                >
                  <Filter size={14} /> <span>ตัวกรอง</span>
                </button>
              )}

              <button
                type="button"
                onClick={toggleSort}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium bg-white/10 text-white hover:bg-white/20 border border-white/20 transition-all cursor-pointer"
                title="เรียงตามวันที่สร้าง"
              >
                {sortOrder === 'desc' ? <ArrowDown size={14} /> : <ArrowUp size={14} />} <span>วันที่สร้าง</span>
              </button>

              {headerAction}

              {exportFileBase && (
                <button
                  type="button"
                  onClick={handleExport}
                  disabled={!processedData.length}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium bg-emerald-600 text-white hover:bg-emerald-500 transition-all cursor-pointer disabled:opacity-60 disabled:cursor-not-allowed"
                >
                  <FileSpreadsheet size={14} /> <span>Excel</span>
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
                disabled={!processedData.length}
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
                <span className="text-xs font-medium text-gray-500 shrink-0">บัญชี</span>
                <select
                  value={accFilter}
                  onChange={e => setAccFilter(e.target.value)}
                  className={`px-3 py-1.5 rounded-lg text-sm border bg-white cursor-pointer focus:outline-none transition-colors ${accFilter !== 'all' ? 'border-[#026a75] text-[#026a75] font-medium ring-1 ring-[#026a75]/30' : 'border-gray-300 text-gray-700 hover:border-gray-400'}`}
                >
                  <option value="all">ทุกบัญชี</option>
                  {accOptions.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                </select>
              </div>
              <div className="flex flex-col sm:flex-row sm:items-center gap-2">
                <span className="text-xs font-medium text-gray-500 shrink-0">แผนก</span>
                <select
                  value={deptFilter}
                  onChange={e => setDeptFilter(e.target.value)}
                  className={`px-3 py-1.5 rounded-lg text-sm border bg-white cursor-pointer focus:outline-none transition-colors ${deptFilter !== 'all' ? 'border-[#026a75] text-[#026a75] font-medium ring-1 ring-[#026a75]/30' : 'border-gray-300 text-gray-700 hover:border-gray-400'}`}
                >
                  <option value="all">ทุกแผนก</option>
                  {deptOptions.map(d => <option key={d} value={d}>{d}</option>)}
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
              <div className="w-12 h-12 border-4 border-emerald-200 border-t-emerald-500 rounded-full animate-spin" />
              <p className="text-gray-700 font-medium">กำลังค้นหาข้อมูล...</p>
            </div>
          </div>
        )}

        {/* Mobile cards */}
        <div className={`block lg:hidden ${loading ? 'min-h-52' : ''}`}>
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
                      <p className="text-xs text-[#026a75] font-medium">{item.form_id}</p>
                      <p className="font-semibold text-gray-800 text-sm truncate">{item.fin?.purpose ?? item.request.purpose ?? '-'}</p>
                      {mode === 'finance' && (
                        <p className="text-xs text-gray-500 flex items-center gap-1 mt-0.5">
                          <User size={11} /> {item.requester.name ?? item.requester.employee_id}
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
        <div className={`hidden lg:block ${loading ? 'min-h-52' : ''}`}>
          <table className="w-full">
            <thead className="bg-gray-100">
              <tr>
                {mode === 'finance' ? (
                  <>
                    <th className={TH}>ลำดับ</th>
                    <th className={TH}>เลขที่เอกสาร</th>
                    <th className={TH}>ผู้เบิก</th>
                    <th className={TH}>แผนก</th>
                    <th className={TH}>ศูนย์</th>
                    <th className={TH}>วัตถุประสงค์</th>
                    <th className={`${TH} text-right`}>ยอดเงิน</th>
                    <th className={TH}>วันที่ใช้เงิน</th>
                    <th className={TH}>กำหนดการเคลียร์</th>
                    <th className={TH}>สถานะ</th>
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
                  <td colSpan={mode === 'finance' ? 10 : 6} className="px-6 py-16 text-center text-gray-500">
                    <FileText size={56} className="mx-auto mb-4 text-gray-300" />
                    <p className="text-lg">ไม่มีรายการ</p>
                  </td>
                </tr>
              ) : paginated.map((item, idx) => (
                <tr
                  key={item.form_id}
                  onClick={() => onOpen(item)}
                  className={`cursor-pointer hover:bg-gray-50 transition-colors ${item.overdue ? 'bg-rose-50/60' : ''}`}
                >
                  {mode === 'finance' ? (
                    <>
                      <td className={TD}>{(currentPage - 1) * ITEMS_PER_PAGE + idx + 1}</td>
                      <td className={`${TD} font-medium text-[#055058]`}>{item.form_id}</td>
                      <td className={TD}>{item.requester.name ?? item.requester.employee_id}</td>
                      <td className={TD}>{item.requester.department ?? '-'}</td>
                      <td className={TD}>{item.requester.site_code ?? item.requester.site ?? '-'}</td>
                      <td className={`${TD} max-w-xs truncate`}>{item.fin?.purpose ?? item.request.purpose ?? '-'}</td>
                      <td className={`${TD} text-right`}>{formatBaht(item.fin?.amount_paid ?? item.request.amount)}</td>
                      <td className={TD}>{formatDate(item.request.use_date)}</td>
                      <td className={TD}>{formatDate(item.fin?.clear_due_date)}</td>
                      <td className={TD}><StatusBadge status={item.status} overdue={item.overdue} /></td>
                    </>
                  ) : (
                    <>
                      <td className={`${TD} font-medium text-[#055058]`}>{item.form_id}</td>
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
          <PaginationControls currentPage={currentPage} totalPages={totalPages} onPageChange={setCurrentPage} />
        </div>
      </section>
    </Tabs>
  );
}
