'use client';

import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { ArrowDown, ArrowUp, Calendar, Check, FileSpreadsheet, FileText, Filter, Search, User, X } from 'lucide-react';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { MonthRangeFilter, currentMonth, shiftMonths } from '@/components/month-range-filter';
import { PaginationControls } from '@/components/pagination-controls';
import { EXPORT_COLUMNS, exportAdvancesXlsx, type ExportColumn } from '@/lib/finance/export';
import { bankLabel, formatAccountNo } from '@/lib/finance/bank';
import {
  ADVANCE_EXPORT_PAGE_SIZE, ADVANCE_PAGE_SIZE, buildAdvanceQuery, combineTabs, fetchAllAdvances, nextTabKey, splitTabKey,
  tabCount, totalPages,
  type AdvancePage, type AdvanceSummary, type ScopeFilter, type TabFilter,
} from '@/lib/finance/advanceQuery';
import {
  DATE_FILTER_COLUMNS, MONEY_FILTER_COLUMNS, OVERDUE_FILTER, applyColumnFilters, hasColumnFilters, settleText,
  type ColumnFilters,
} from '@/lib/finance/columnFilters';
import { STATUS_LABELS, formatBaht, formatDate, todayBkk, type AdvanceStatus } from '@/lib/finance/status';
import { fetchJson, showAlert } from '../api';
import type { AdvanceItem } from '../types';
import { StatusBadge } from './StatusBadge';
import { CopyTextButton } from './CopyTextButton';

const TH = 'px-4 py-3 text-left text-sm font-semibold text-gray-700 whitespace-nowrap';
const TD = 'px-4 py-3 text-sm whitespace-nowrap';
// finance queue: 9 compact columns so the table fits a laptop width inside the card
const FTH = 'px-3 py-3 text-left text-xs font-semibold text-gray-700 whitespace-nowrap';
const FTD = 'px-3 py-2.5 text-sm whitespace-nowrap align-top';

const settleTone = (amount: number | null | undefined) => (amount !== null && amount !== undefined && amount < 0 ? 'text-orange-700' : 'text-brand-700');

// ตารางฝ่ายการเงินใช้คอลัมน์ชุดเดียวกับ Excel (EXPORT_COLUMNS) ทั้งชื่อและลำดับ — เพิ่มคอลัมน์ที่ export แล้ว TypeScript จะบังคับให้มีช่องตรงนี้ด้วย
const MONEY_COLS = new Set<ExportColumn>(['ยอดเงิน', 'ยอดใช้จริง', 'ยอดเงินโอนคืนบริษัท']);
const dash = (v: string | number | null | undefined) => (v === null || v === undefined || v === '' ? '-' : v);
const FIN_CELLS: Record<ExportColumn, (item: AdvanceItem, no: number) => ReactNode> = {
  'ลำดับ': (_, no) => no,
  'เลขที่คำขอเบิกเงิน': it => <span className="font-medium text-brand-800">{it.form_id}</span>,
  'ผู้เบิก': it => it.requester.name ?? it.requester.employee_id,
  'แผนก': it => dash(it.requester.department),
  'ศูนย์': it => dash(it.requester.site_code ?? it.requester.site),
  'สถานะ': it => <StatusBadge status={it.status} overdue={it.overdue} />,
  'เลขที่ตั้งเบิก': it => dash(it.fin?.voucher_no),
  'วันที่ตั้งเบิก': it => formatDate(it.fin?.voucher_date),
  'เลขที่ทำจ่าย': it => dash(it.fin?.payment_doc_no),
  'วันที่ใช้เงิน': it => formatDate(it.request.use_date),
  'วัตถุประสงค์': it => {
    const text = it.fin?.purpose ?? it.request.purpose;
    return (
      <div className="flex max-w-[18rem] items-center gap-1">
        <span className="truncate" title={text ?? undefined}>{dash(text)}</span>
        {text && <CopyTextButton text={text} compact />}
      </div>
    );
  },
  'ยอดเงิน': it => formatBaht(it.fin?.amount_paid ?? it.request.amount),
  'วันที่โอนเงิน': it => formatDate(it.fin?.transfer_date),
  'กำหนดการเคลียร์': it => formatDate(it.fin?.clear_due_date),
  'วันที่ส่งเอกสารเคลียร์': it => formatDate(it.fin?.clear_date),
  'ยอดใช้จริง': it => (it.fin?.amount_actual === null || it.fin?.amount_actual === undefined ? '-' : formatBaht(it.fin.amount_actual)),
  'เลขที่เอกสารเคลียร์เงิน': it => dash(it.fin?.clear_doc_no),
  'ยอดเงินโอนคืนบริษัท': it => {
    const text = settleText(it.fin?.settle_amount);
    return text ? <span className={`font-medium ${settleTone(it.fin?.settle_amount)}`}>{text}</span> : '-';
  },
  'วันที่โอนเงินคืนบริษัท': it => formatDate(it.fin?.settle_date),
  'หมายเหตุ': it => <div className="max-w-[14rem] truncate" title={it.fin?.remark ?? undefined}>{dash(it.fin?.remark)}</div>,
  'ศูนย์ค่าใช้จ่าย': it => dash(it.request.cost_center),
  'ธนาคาร': it => (it.request.bank ? bankLabel(it.request.bank) : '-'),
  'เลขที่บัญชี': it => (it.request.account_no ? formatAccountNo(it.request.account_no) : '-'),
  'ชื่อบัญชี': it => dash(it.request.account_name),
};

export interface AdvanceListTab extends TabFilter {
  key: string;
  label: string;
  /** tabs next to each other with the same group sit in one box and can be picked together (the value is its aria-label) */
  group?: string;
}

const SEARCH_DEBOUNCE_MS = 300;

// ช่องกรองใต้หัวคอลัมน์ (ตารางฝ่ายการเงิน)
const FILTER_INPUT = 'w-full rounded-md border bg-white px-2 py-1 text-xs font-normal text-gray-800 placeholder:text-gray-400 focus:outline-none focus:ring-1 focus:ring-brand-600/40';
const filterTone = (active: boolean) => (active ? 'border-brand-600 ring-1 ring-brand-600/30' : 'border-gray-300');
const WIDE_FILTER_COLS = new Set<ExportColumn>(['ผู้เบิก', 'วัตถุประสงค์', 'หมายเหตุ', 'ชื่อบัญชี', 'แผนก']);
const filterPlaceholder = (col: ExportColumn) =>
  MONEY_FILTER_COLUMNS.has(col) ? 'เช่น >5000' : DATE_FILTER_COLUMNS.has(col) ? 'วว/ดด/ปปปป' : 'ค้นหา';

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
  const [deptFilter, setDeptFilter] = useState('all');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');
  const [showFilters, setShowFilters] = useState(false);
  // ตัวกรองรายคอลัมน์ (กรองในเบราว์เซอร์) แผนก/ศูนย์ค่าใช้จ่ายยังใช้ ccFilter/deptFilter ที่ส่งให้ BE
  const [colFilters, setColFilters] = useState<ColumnFilters>({});
  const [debouncedCols, setDebouncedCols] = useState<ColumnFilters>({});
  // เปลี่ยนแท็บ = เริ่มที่ไม่มีตัวกรองเสมอ (ผู้ใช้สั่ง 29/10/2026) ช่วงเดือนกับการเรียงคงไว้
  // ปรับ state ระหว่าง render ไม่ใช่ useEffect: fetch แรกของแท็บใหม่ต้องไม่ติดตัวกรองของแท็บเก่า (ค่าที่หน่วงไว้ก็ล้างด้วย)
  // กดเพิ่ม/เอาออกสถานะในกลุ่มก็นับเป็นเปลี่ยนแท็บ
  const [filtersTab, setFiltersTab] = useState(activeTab);
  if (filtersTab !== activeTab) {
    setFiltersTab(activeTab);
    setSearch(''); setDebouncedQ(''); setCcFilter('all'); setDeptFilter('all'); setColFilters({}); setDebouncedCols({});
  }
  const [allRows, setAllRows] = useState<{ key: string; items: AdvanceItem[] } | null>(null);
  // page is keyed by the filter signature, so any tab/filter/sort change is page 1 in the same render (one fetch)
  const [pageState, setPageState] = useState<{ key: string; page: number }>({ key: '', page: 1 });

  const [rows, setRows] = useState<AdvanceItem[]>([]);
  const [total, setTotal] = useState(0);
  const [summary, setSummary] = useState<AdvanceSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [exporting, setExporting] = useState(false);
  // distinct filter values for the current scope, from the server (response.options)
  const [ccOpts, setCcOpts] = useState<string[]>([]);
  const [deptOpts, setDeptOpts] = useState<string[]>([]);
  const reqSeq = useRef(0);

  const handleMonthRangeChange = useCallback((s: string, e: string) => {
    setStartMonth(s);
    setEndMonth(e);
  }, []);

  // แท็บในกลุ่มเดียวกันเลือกพร้อมกันได้ (ผู้ใช้สั่ง 30/10/2026): key 'clearing,sentback' = ทุกใบในสองแท็บนั้น
  const pickedKeys = useMemo(() => new Set(splitTabKey(activeTab)), [activeTab]);
  const activeTabDef = useMemo<AdvanceListTab | undefined>(() => {
    const picked = tabs.filter(t => pickedKeys.has(t.key));
    if (picked.length <= 1) return picked[0] ?? tabs[0];
    return { key: activeTab, label: picked.map(t => t.label).join(' + '), group: picked[0].group, ...combineTabs(picked) };
  }, [tabs, activeTab, pickedKeys]);
  // ติดกันและ group เดียวกัน = กล่องเดียว
  const segments = useMemo(() => {
    const out: { group?: string; tabs: AdvanceListTab[] }[] = [];
    for (const t of tabs) {
      const last = out[out.length - 1];
      if (t.group && last?.group === t.group) last.tabs.push(t);
      else out.push({ group: t.group, tabs: [t] });
    }
    return out;
  }, [tabs]);

  // search is debounced; any change of search resets to page 1 once it applies
  useEffect(() => {
    const t = setTimeout(() => setDebouncedQ(search), SEARCH_DEBOUNCE_MS);
    return () => clearTimeout(t);
  }, [search]);
  useEffect(() => {
    const t = setTimeout(() => setDebouncedCols(colFilters), SEARCH_DEBOUNCE_MS);
    return () => clearTimeout(t);
  }, [colFilters]);
  // มีช่องกรองรายคอลัมน์ = ดึงทุกใบในแท็บ/ช่วงเดือนนี้มากรองและแบ่งหน้าเอง (BE กรองให้แค่ค้นหา เดือน แผนก ศูนย์ค่าใช้จ่าย)
  // แท็บที่รวมเกินกำหนดกับสถานะอื่น (match) ก็ต้องดึงทุกใบ เพราะ BE รวมสองอย่างนี้ให้ไม่ได้
  const clientMode = !!activeTabDef?.match || (mode === 'finance' && hasColumnFilters(debouncedCols));

  const scope = useMemo<ScopeFilter>(
    () => ({ q: debouncedQ, startMonth, endMonth, costCenter: mode === 'finance' ? ccFilter : 'all', department: mode === 'finance' ? deptFilter : 'all', sort: sortOrder }),
    [debouncedQ, startMonth, endMonth, ccFilter, deptFilter, sortOrder, mode],
  );
  useEffect(() => { onScopeChange?.(scope); }, [scope, onScopeChange]);

  const filterKey = useMemo(
    () => JSON.stringify([activeTab, scope, clientMode ? debouncedCols : null]),
    [activeTab, scope, clientMode, debouncedCols],
  );
  // ชุดข้อมูลทั้งหมดของแท็บ+ขอบเขตนี้ ใช้ซ้ำได้ตอนพิมพ์ช่องกรองเพิ่ม ไม่ต้องดึงใหม่
  const allKey = useMemo(() => JSON.stringify([activeTab, scope, refreshKey]), [activeTab, scope, refreshKey]);
  const allRowsKey = allRows?.key;
  const currentPage = pageState.key === filterKey ? pageState.page : 1;
  const setCurrentPage = useCallback((page: number) => setPageState({ key: filterKey, page }), [filterKey]);

  const listUrl = useCallback(
    (query: string) => `/api/finance/advances?${mode === 'mine' ? 'mine=1&' : ''}${query}`,
    [mode],
  );

  useEffect(() => {
    if (!activeTabDef) return;
    if (clientMode) {
      if (allRowsKey === allKey) return;
      const seq = ++reqSeq.current;
      setLoading(true);
      fetchAllAdvances(q => fetchJson<AdvancePage>(listUrl(q)), scope, activeTabDef, ADVANCE_EXPORT_PAGE_SIZE, first => {
        if (seq !== reqSeq.current) return;
        setSummary(first.summary);
        onSummary?.(first.summary);
        if (first.options) { setCcOpts(first.options.cost_centers ?? []); setDeptOpts(first.options.departments ?? []); }
      })
        .then(items => {
          if (seq !== reqSeq.current) return;
          setAllRows({ key: allKey, items });
          setLoading(false);
        })
        .catch(err => {
          if (seq !== reqSeq.current) return;
          setAllRows({ key: allKey, items: [] });
          setLoading(false);
          showAlert({ icon: 'error', title: 'โหลดข้อมูลไม่สำเร็จ', text: err.message });
        });
      return;
    }
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
        if (res.options) { setCcOpts(res.options.cost_centers ?? []); setDeptOpts(res.options.departments ?? []); }
        setLoading(false);
      })
      .catch(err => {
        if (seq !== reqSeq.current) return;
        setRows([]);
        setTotal(0);
        setLoading(false);
        showAlert({ icon: 'error', title: 'โหลดข้อมูลไม่สำเร็จ', text: err.message });
      });
  }, [activeTabDef, scope, currentPage, setCurrentPage, listUrl, refreshKey, onSummary, clientMode, allKey, allRowsKey]);

  const withSelected = (opts: string[], sel: string) => (sel !== 'all' && !opts.includes(sel) ? [...opts, sel].sort() : opts);
  const ccOptions = useMemo(() => withSelected(ccOpts, ccFilter), [ccOpts, ccFilter]);
  const deptOptions = useMemo(() => withSelected(deptOpts, deptFilter), [deptOpts, deptFilter]);

  const filteredAll = useMemo(
    () => (clientMode && allRows && allRows.key === allKey ? applyColumnFilters(allRows.items, debouncedCols) : null),
    [clientMode, allRows, allKey, debouncedCols],
  );
  const shownTotal = filteredAll ? filteredAll.length : total;
  const pages = totalPages(shownTotal, ADVANCE_PAGE_SIZE);
  const page = Math.min(currentPage, pages);
  const colFilterActive = mode === 'finance' && hasColumnFilters(colFilters);
  const hasActiveFilters = search.trim() !== '' || (mode === 'finance' && (ccFilter !== 'all' || deptFilter !== 'all')) || colFilterActive;
  const paginated = filteredAll ? filteredAll.slice((page - 1) * ADVANCE_PAGE_SIZE, page * ADVANCE_PAGE_SIZE) : rows;

  const statusFilter = colFilters['สถานะ'] ?? '';
  const statusOptions = useMemo(() => {
    const keys = (activeTabDef?.status?.length ? activeTabDef.status : Object.keys(STATUS_LABELS)) as AdvanceStatus[];
    return statusFilter && statusFilter !== OVERDUE_FILTER && !keys.includes(statusFilter as AdvanceStatus)
      ? [...keys, statusFilter as AdvanceStatus] : keys;
  }, [activeTabDef, statusFilter]);

  const setColFilter = (col: ExportColumn, value: string) => setColFilters(f => ({ ...f, [col]: value }));
  const toggleSort = () => setSortOrder(o => (o === 'desc' ? 'asc' : 'desc'));
  const clearFilters = () => { setSearch(''); setCcFilter('all'); setDeptFilter('all'); setColFilters({}); };

  const renderColumnFilter = (col: ExportColumn) => {
    if (col === 'ลำดับ') {
      return hasActiveFilters ? (
        <button type="button" onClick={clearFilters} title="ล้างตัวกรองทั้งหมด" aria-label="ล้างตัวกรองทั้งหมด"
          className="flex size-6 items-center justify-center rounded-md text-gray-500 hover:bg-red-50 hover:text-red-600 cursor-pointer">
          <X size={14} />
        </button>
      ) : null;
    }
    const label = `กรอง${col}`;
    if (col === 'แผนก' || col === 'ศูนย์ค่าใช้จ่าย') {
      const isDept = col === 'แผนก';
      const value = isDept ? deptFilter : ccFilter;
      return (
        <select aria-label={label} value={value} onChange={e => (isDept ? setDeptFilter : setCcFilter)(e.target.value)}
          className={`${FILTER_INPUT} ${filterTone(value !== 'all')} cursor-pointer ${isDept ? 'min-w-36' : 'min-w-28'}`}>
          <option value="all">ทั้งหมด</option>
          {(isDept ? deptOptions : ccOptions).map(o => <option key={o} value={o}>{o}</option>)}
        </select>
      );
    }
    if (col === 'สถานะ') {
      return (
        <select aria-label={label} value={statusFilter} onChange={e => setColFilter(col, e.target.value)}
          className={`${FILTER_INPUT} ${filterTone(statusFilter !== '')} min-w-32 cursor-pointer`}>
          <option value="">ทั้งหมด</option>
          {statusOptions.map(s => <option key={s} value={s}>{STATUS_LABELS[s] ?? s}</option>)}
          <option value={OVERDUE_FILTER}>เกินกำหนด</option>
        </select>
      );
    }
    const value = colFilters[col] ?? '';
    return (
      <input type="text" aria-label={label} value={value} placeholder={filterPlaceholder(col)}
        onChange={e => setColFilter(col, e.target.value)}
        className={`${FILTER_INPUT} ${filterTone(value.trim() !== '')} ${WIDE_FILTER_COLS.has(col) ? 'min-w-36' : 'min-w-24'}`} />
    );
  };
  const tabLabel = (t: AdvanceListTab) => {
    const count = tabCount(t, summary);
    return `${t.label}${count === null ? '' : ` (${count})`}`;
  };

  const handleExport = async () => {
    if (!exportFileBase || !activeTabDef || exporting) return;
    setExporting(true);
    try {
      // มีช่องกรองรายคอลัมน์ = ส่งออกเฉพาะใบที่เห็นหลังกรอง
      const all = filteredAll ?? await fetchAllAdvances(q => fetchJson<AdvancePage>(listUrl(q)), scope, activeTabDef);
      exportAdvancesXlsx(all, `${exportFileBase}-${splitTabKey(activeTab).join('+')}-${todayBkk()}.xlsx`);
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
          {segments.map(seg => (seg.group ? (
            // ปุ่มกดสลับ ไม่ใช่ TabsTrigger: Radix เลือกได้ทีละแท็บและเลือกตามโฟกัสลูกศร ซึ่งจะไปสลับสถานะเอง
            <div key={`group:${seg.group}`} role="group" aria-label={seg.group} title="กดได้หลายสถานะพร้อมกัน"
              className="flex h-full shrink-0 items-center gap-0.5 rounded-full border border-white/25 bg-white/5 px-0.5">
              {seg.tabs.map(t => {
                const on = pickedKeys.has(t.key);
                return (
                  <button key={t.key} type="button" aria-pressed={on} onClick={() => onTabChange(nextTabKey(tabs, activeTab, t.key))}
                    className={`inline-flex h-[calc(100%-2px)] shrink-0 items-center gap-1 rounded-full px-4 text-sm font-medium whitespace-nowrap transition-all cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/60 ${on ? 'bg-white text-brand-700 shadow-md' : 'text-white/70 hover:text-white'}`}>
                    {on && <Check size={14} aria-hidden="true" />}
                    {tabLabel(t)}
                  </button>
                );
              })}
            </div>
          ) : seg.tabs.map(t => (
            <TabsTrigger
              key={t.key}
              value={t.key}
              className="shrink-0 px-5 py-2 rounded-full text-white/70 font-medium transition-all data-[state=active]:bg-white data-[state=active]:text-brand-700 data-[state=active]:shadow-md hover:text-white"
            >
              {tabLabel(t)}
            </TabsTrigger>
          ))))}
        </TabsList>

        <MonthRangeFilter startMonth={startMonth} endMonth={endMonth} onChange={handleMonthRangeChange} compact />
      </div>

      <section className="bg-white rounded-2xl shadow-xl border border-white/30 overflow-hidden relative">
        <div className="p-4 lg:p-5 bg-brand-800">
          <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-3">
            <div className="flex items-center justify-between lg:justify-start gap-4">
              <div>
                <h2 className="text-lg lg:text-xl text-white font-semibold">{activeTabDef?.label ?? ''}</h2>
                <p className="text-white/70 text-xs lg:text-sm mt-0.5">
                  {filteredAll && allRows && hasColumnFilters(debouncedCols) ? `${shownTotal} จาก ${allRows.items.length} รายการ` : `${shownTotal} รายการ`}
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
                  placeholder="ค้นหา เลขที่คำขอเบิกเงิน / ผู้เบิก / เลขที่ตั้งเบิก / วัตถุประสงค์"
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
                  className={`flex xl:hidden items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium transition-all cursor-pointer ${showFilters || hasActiveFilters ? 'bg-white text-brand-800' : 'bg-white/10 text-white hover:bg-white/20 border border-white/20'}`}
                >
                  <Filter size={14} /> <span>ตัวกรอง</span>
                </button>
              )}
              {mode === 'finance' && hasActiveFilters && (
                <button
                  type="button"
                  onClick={clearFilters}
                  className="hidden xl:flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium bg-white text-brand-800 transition-all cursor-pointer hover:bg-white/90"
                >
                  <X size={14} /> <span>ล้างตัวกรอง</span>
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
                  disabled={!shownTotal || exporting}
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
                disabled={!shownTotal || exporting}
                className="flex items-center justify-center w-9 h-9 rounded-lg bg-emerald-600 text-white disabled:opacity-60 cursor-pointer"
              >
                <FileSpreadsheet size={16} />
              </button>
            )}
          </div>
        </div>

        {/* Finance-mode filter row */}
        {/* จอแคบ (การ์ด) ใช้แถบนี้ จอกว้างกรองที่ใต้หัวคอลัมน์ */}
        {mode === 'finance' && showFilters && (
          <div className="xl:hidden p-3 lg:p-4 bg-linear-to-r from-gray-50 to-gray-100 border-b border-gray-200">
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
              <div className="flex flex-col sm:flex-row sm:items-center gap-2">
                <span className="text-xs font-medium text-gray-500 shrink-0">แผนก</span>
                <select
                  value={deptFilter}
                  onChange={e => setDeptFilter(e.target.value)}
                  className={`px-3 py-1.5 rounded-lg text-sm border bg-white cursor-pointer focus:outline-none transition-colors ${deptFilter !== 'all' ? 'border-brand-600 text-brand-600 font-medium ring-1 ring-brand-600/30' : 'border-gray-300 text-gray-700 hover:border-gray-400'}`}
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
                      <div className="flex items-center gap-1.5">
                        <p className="font-semibold text-gray-800 text-sm truncate">{item.fin?.purpose ?? item.request.purpose ?? '-'}</p>
                        {(item.fin?.purpose ?? item.request.purpose) && <CopyTextButton text={(item.fin?.purpose ?? item.request.purpose)!} compact />}
                      </div>
                      {mode === 'finance' && (
                        <p className="text-xs text-gray-500 flex items-center gap-1 mt-0.5">
                          <User size={11} /> {item.requester.name ?? item.requester.employee_id}
                        </p>
                      )}
                      {mode === 'finance' && (
                        <p className="text-xs text-gray-500 mt-0.5">ศูนย์ค่าใช้จ่าย: {item.request.cost_center ?? '-'}</p>
                      )}
                      {mode === 'finance' && (item.fin?.voucher_no || item.fin?.clear_doc_no) && (
                        <p className="text-xs text-gray-500 mt-0.5">
                          ตั้งเบิก: {item.fin?.voucher_no ?? '-'} · เอกสารเคลียร์เงิน: {item.fin?.clear_doc_no ?? '-'}
                        </p>
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
        {/* finance: 24 columns (same as Excel) scroll sideways on ≥1280px, with a filter box under every header; narrower screens use the cards above */}
        <div className={`hidden ${mode === 'finance' ? 'xl:block' : 'lg:block'} overflow-x-auto ${loading ? 'min-h-52' : ''}`}>
          <table className="w-full">
            <thead className="bg-gray-100">
              <tr>
                {mode === 'finance' ? (
                  EXPORT_COLUMNS.map(col => (
                    <th key={col} className={`${FTH} ${MONEY_COLS.has(col) ? 'text-right' : ''}`}>{col}</th>
                  ))
                ) : (
                  <>
                    <th className={TH}>เลขที่คำขอเบิกเงิน</th>
                    <th className={TH}>วัตถุประสงค์</th>
                    <th className={`${TH} text-right`}>ยอดเงิน</th>
                    <th className={TH}>วันที่ใช้เงิน</th>
                    <th className={TH}>กำหนดการเคลียร์</th>
                    <th className={TH}>สถานะ</th>
                  </>
                )}
              </tr>
              {mode === 'finance' && (
                <tr className="bg-gray-50 border-t border-gray-200">
                  {EXPORT_COLUMNS.map(col => (
                    <th key={col} className="px-2 py-1.5 text-left align-top">{renderColumnFilter(col)}</th>
                  ))}
                </tr>
              )}
            </thead>
            <tbody className="divide-y divide-gray-100">
              {!loading && paginated.length === 0 ? (
                <tr>
                  <td colSpan={mode === 'finance' ? EXPORT_COLUMNS.length : 6} className="px-6 py-16 text-center text-gray-500">
                    <FileText size={56} className="mx-auto mb-4 text-gray-300" />
                    <p className="text-lg">ไม่มีรายการ</p>
                  </td>
                </tr>
              ) : paginated.map((item, i) => (
                <tr
                  key={item.form_id}
                  onClick={() => onOpen(item)}
                  className={`cursor-pointer hover:bg-gray-50 transition-colors ${item.overdue ? 'bg-rose-50/60' : ''}`}
                >
                  {mode === 'finance' ? (
                    EXPORT_COLUMNS.map(col => (
                      <td key={col} className={`${FTD} ${MONEY_COLS.has(col) ? 'text-right tabular-nums' : ''}`}>
                        {FIN_CELLS[col](item, (page - 1) * ADVANCE_PAGE_SIZE + i + 1)}
                      </td>
                    ))
                  ) : (
                    <>
                      <td className={`${TD} font-medium text-brand-800`}>{item.form_id}</td>
                      <td className={`${TD} max-w-xs`}>
                        <div className="flex items-center gap-1">
                          <span className="truncate">{item.fin?.purpose ?? item.request.purpose ?? '-'}</span>
                          {(item.fin?.purpose ?? item.request.purpose) && <CopyTextButton text={(item.fin?.purpose ?? item.request.purpose)!} compact />}
                        </div>
                      </td>
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
          <PaginationControls currentPage={page} totalPages={pages} onPageChange={setCurrentPage} />
        </div>
      </section>
    </Tabs>
  );
}
