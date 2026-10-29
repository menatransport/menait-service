'use client';

import { useCallback, useMemo, useState, type ReactNode } from 'react';
import { ArrowDown, ArrowUp, FileSpreadsheet, FileText, Filter, Search, User, X } from 'lucide-react';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { MonthRangeFilter, currentMonth, shiftMonths } from '@/components/month-range-filter';
import { PaginationControls } from '@/components/pagination-controls';
import type { PettyClaim, PettyRound } from '@/app/finance/types-petty';
import type { PettyRoundStatus, PettyStatus } from '@/lib/finance/petty-status';
import {
  CLAIM_COLUMNS, CLAIM_STATUS_LABELS, ROUND_COLUMNS, ROUND_STATUS_LABELS, WORKLIST_ROUND_STATUSES, WORKLIST_TABS,
  hasWorklistFilters, inMonthRange, matchesWorklistFilters, rowsForTab, searchWorklist, sortWorklist, worklistCounts,
  worklistSheetRows, type WorklistColumn, type WorklistCtx, type WorklistKind, type WorklistTabKey,
} from '@/lib/finance/petty-worklist';
import { formatBaht, todayBkk } from '@/lib/finance/status';
import { showAlert } from '../../../api';
import { ClaimBadge, RoundBadge } from './StatusBadges';

const PAGE_SIZE = 20;
// ชุด class เดียวกับตารางฝ่ายการเงินของ Advance (AdvanceListView)
const FTH = 'px-3 py-3 text-left text-xs font-semibold text-gray-700 whitespace-nowrap';
const FTD = 'px-3 py-2.5 text-sm whitespace-nowrap align-top';
const FILTER_INPUT = 'w-full rounded-md border bg-white px-2 py-1 text-xs font-normal text-gray-800 placeholder:text-gray-400 focus:outline-none focus:ring-1 focus:ring-brand-600/40';
const filterTone = (active: boolean) => (active ? 'border-brand-600 ring-1 ring-brand-600/30' : 'border-gray-300');
const SELECT_TONE = (active: boolean) => `px-3 py-1.5 rounded-lg text-sm border bg-white cursor-pointer focus:outline-none transition-colors ${active ? 'border-brand-600 text-brand-600 font-medium ring-1 ring-brand-600/30' : 'border-gray-300 text-gray-700 hover:border-gray-400'}`;

type Filters = Record<string, string>;
type AnyRow = PettyClaim | PettyRound;

/**
 * ตารางเดียวของหน้างานเงินสดย่อย — โครงเดียวกับ AdvanceListView โหมดการเงิน: แถบสถานะมีตัวเลข · ช่วงเดือน
 * · หัวการ์ดน้ำเงินเข้ม (ค้นหา ตัวกรอง เรียง Excel) · ช่องกรองใต้หัวคอลัมน์ทุกช่อง · การ์ดบนจอแคบกว่า 1280px
 * แถวเป็นใบหรือรอบตามแถบ · ไม่มีปุ่มในแถว คลิกแถวเปิดแผงด้านข้าง
 */
export function WorklistTable({ claims, rounds, ctx, activeTab, onTabChange, loading, onOpenClaim, onOpenRound }: {
  claims: PettyClaim[];
  rounds: PettyRound[];
  ctx: WorklistCtx;
  activeTab: WorklistTabKey;
  onTabChange: (key: WorklistTabKey) => void;
  loading: boolean;
  onOpenClaim: (claim: PettyClaim) => void;
  onOpenRound: (round: PettyRound) => void;
}) {
  const [startMonth, setStartMonth] = useState<string>(() => shiftMonths(11));
  const [endMonth, setEndMonth] = useState<string>(() => currentMonth());
  const [search, setSearch] = useState('');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');
  const [showFilters, setShowFilters] = useState(false);
  // ช่องกรองแยกตามชนิดแถว (คอลัมน์ของใบกับรอบไม่เหมือนกัน)
  const [filters, setFilters] = useState<Record<WorklistKind, Filters>>({ claim: {}, round: {} });
  const [pageState, setPageState] = useState<{ key: string; page: number }>({ key: '', page: 1 });

  const tab = WORKLIST_TABS.find(t => t.key === activeTab) ?? WORKLIST_TABS[0];
  const kind = tab.kind;
  const columns = (kind === 'claim' ? CLAIM_COLUMNS : ROUND_COLUMNS) as WorklistColumn<AnyRow>[];
  const colFilters = filters[kind];
  const counts = useMemo(() => worklistCounts(claims, rounds), [claims, rounds]);

  const handleMonthRangeChange = useCallback((s: string, e: string) => { setStartMonth(s); setEndMonth(e); }, []);

  const tabRows = useMemo(() => rowsForTab(activeTab, claims, rounds).rows as AnyRow[], [activeTab, claims, rounds]);
  const scoped = useMemo(
    () => tabRows.filter(r => inMonthRange(kind, r, startMonth, endMonth) && searchWorklist(kind, r, search, ctx)),
    [tabRows, kind, startMonth, endMonth, search, ctx],
  );
  const filtered = useMemo(
    () => sortWorklist(scoped.filter(r => matchesWorklistFilters(r, columns, colFilters, ctx)), sortOrder),
    [scoped, columns, colFilters, ctx, sortOrder],
  );

  const filterKey = JSON.stringify([activeTab, startMonth, endMonth, search, colFilters, sortOrder]);
  const pages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const page = Math.min(pageState.key === filterKey ? pageState.page : 1, pages);
  const setPage = (p: number) => setPageState({ key: filterKey, page: p });
  const shown = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  const colFilterActive = hasWorklistFilters(colFilters);
  const hasActiveFilters = search.trim() !== '' || colFilterActive;
  const setColFilter = (label: string, value: string) => setFilters(f => ({ ...f, [kind]: { ...f[kind], [label]: value } }));
  const clearFilters = () => { setSearch(''); setFilters(f => ({ ...f, [kind]: {} })); };
  const toggleSort = () => setSortOrder(o => (o === 'desc' ? 'asc' : 'desc'));

  const statusOptions: string[] = kind === 'claim'
    ? (tab.claimStatuses ?? [])
    : (tab.roundStatuses ?? WORKLIST_ROUND_STATUSES);
  const statusLabel = (s: string) => (kind === 'claim' ? CLAIM_STATUS_LABELS[s as PettyStatus] : ROUND_STATUS_LABELS[s as PettyRoundStatus]) ?? s;
  // ตัวเลือก สาขา/แผนก จากข้อมูลในแถบนี้ (แถบตัวกรองบนจอแคบ เหมือนศูนย์ค่าใช้จ่าย/แผนกของ Advance)
  const optionsOf = (label: string) => {
    const col = columns.find(c => c.label === label);
    return col ? [...new Set(tabRows.map(r => col.text(r, ctx)).filter(Boolean))].sort() : [];
  };

  const [exporting, setExporting] = useState(false);
  const handleExport = async () => {
    if (exporting || filtered.length === 0) return;
    setExporting(true);
    try {
      const XLSX = await import('xlsx');
      const sheet = XLSX.utils.json_to_sheet(worklistSheetRows(kind, filtered, ctx), { header: columns.map(c => c.label) });
      const book = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(book, sheet, kind === 'claim' ? 'ใบเบิก' : 'รอบ');
      XLSX.writeFile(book, `เงินสดย่อย-${activeTab}-${todayBkk()}.xlsx`);
    } catch (err) {
      showAlert({ icon: 'error', title: 'ส่งออก Excel ไม่สำเร็จ', text: (err as Error).message });
    } finally {
      setExporting(false);
    }
  };

  const open = (row: AnyRow) => (kind === 'claim' ? onOpenClaim(row as PettyClaim) : onOpenRound(row as PettyRound));

  const renderFilter = (col: WorklistColumn<AnyRow>) => {
    if (col.label === 'ลำดับ') {
      return hasActiveFilters ? (
        <button type="button" onClick={clearFilters} title="ล้างตัวกรองทั้งหมด" aria-label="ล้างตัวกรองทั้งหมด"
          className="flex size-6 cursor-pointer items-center justify-center rounded-md text-gray-500 hover:bg-red-50 hover:text-red-600">
          <X size={14} />
        </button>
      ) : null;
    }
    const value = colFilters[col.label] ?? '';
    const label = `กรอง${col.label}`;
    if (col.label === 'สถานะ') {
      return (
        <select aria-label={label} value={value} onChange={e => setColFilter(col.label, e.target.value)}
          className={`${FILTER_INPUT} ${filterTone(value !== '')} min-w-32 cursor-pointer`}>
          <option value="">ทั้งหมด</option>
          {statusOptions.map(s => <option key={s} value={s}>{statusLabel(s)}</option>)}
        </select>
      );
    }
    return (
      <input type="text" aria-label={label} value={value} onChange={e => setColFilter(col.label, e.target.value)}
        placeholder={col.money ? 'เช่น >5000' : col.date ? 'วว/ดด/ปปปป' : 'ค้นหา'}
        className={`${FILTER_INPUT} ${filterTone(value.trim() !== '')} ${col.wide ? 'min-w-36' : 'min-w-24'}`} />
    );
  };

  const renderCell = (col: WorklistColumn<AnyRow>, row: AnyRow, no: number): ReactNode => {
    if (col.label === 'ลำดับ') return no;
    if (col.label === 'สถานะ') return kind === 'claim' ? <ClaimBadge status={(row as PettyClaim).status} /> : <RoundBadge status={(row as PettyRound).status} />;
    const text = col.text(row, ctx);
    if (col.label === 'เลขที่ใบเบิก' || col.label === 'เลขที่รอบ') return <span className="font-medium text-brand-800">{text}</span>;
    if (!text) return '-';
    if (col.wide) return <div className="max-w-[14rem] truncate" title={text}>{text}</div>;
    return text;
  };

  const placeholder = kind === 'claim' ? 'ค้นหา เลขที่ใบเบิก / ผู้เปิดใบ / จ่ายให้ / DD' : 'ค้นหา เลขที่รอบ / เจ้าของเงินสด / เลขที่ตั้งเบิก';
  const totalAmount = filtered.reduce((s, r) => s + (kind === 'claim' ? (r as PettyClaim).amount : (r as PettyRound).total_amount), 0);

  return (
    <Tabs value={activeTab} onValueChange={v => onTabChange(v as WorklistTabKey)}>
      <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <TabsList className="max-w-full justify-start overflow-x-auto rounded-full bg-gray-800/50 p-1 backdrop-blur-sm">
          {WORKLIST_TABS.map(t => (
            <TabsTrigger key={t.key} value={t.key}
              className="shrink-0 rounded-full px-5 py-2 font-medium text-white/70 transition-all hover:text-white data-[state=active]:bg-white data-[state=active]:text-brand-700 data-[state=active]:shadow-md">
              {t.label} ({counts[t.key]})
            </TabsTrigger>
          ))}
        </TabsList>
        <MonthRangeFilter startMonth={startMonth} endMonth={endMonth} onChange={handleMonthRangeChange} compact />
      </div>

      <section className="relative overflow-hidden rounded-2xl border border-white/30 bg-white shadow-xl">
        <div className="bg-brand-800 p-4 lg:p-5">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
            <div className="flex items-center justify-between gap-4 lg:justify-start">
              <div>
                <h2 className="text-lg font-semibold text-white lg:text-xl">{tab.label}</h2>
                <p className="mt-0.5 text-xs text-white/70 lg:text-sm">
                  {colFilterActive ? `${filtered.length} จาก ${scoped.length}` : filtered.length} {kind === 'claim' ? 'ใบ' : 'รอบ'}
                  {' · '}รวม {formatBaht(totalAmount)} บาท
                </p>
              </div>
              <div className="flex items-center gap-2 lg:hidden">
                <button type="button" onClick={toggleSort} title={sortOrder === 'desc' ? 'เรียงจากใหม่ไปเก่า' : 'เรียงจากเก่าไปใหม่'}
                  className="flex h-9 w-9 cursor-pointer items-center justify-center rounded-lg bg-white/10 text-white transition-all hover:bg-white/20">
                  {sortOrder === 'desc' ? <ArrowDown size={16} /> : <ArrowUp size={16} />}
                </button>
                <button type="button" onClick={() => setShowFilters(v => !v)} aria-label="ตัวกรอง"
                  className={`flex h-9 w-9 cursor-pointer items-center justify-center rounded-lg transition-all ${showFilters || hasActiveFilters ? 'bg-white text-brand-800' : 'bg-white/10 text-white hover:bg-white/20'}`}>
                  <Filter size={16} />
                </button>
              </div>
            </div>

            <div className="hidden items-center gap-2 lg:flex">
              <div className="relative">
                <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-white/60" />
                <input type="text" placeholder={placeholder} value={search} onChange={e => setSearch(e.target.value)}
                  className="w-64 rounded-lg border border-white/20 bg-white/10 py-1.5 pl-8 pr-8 text-sm text-white transition-all placeholder:text-white/50 focus:border-white/40 focus:bg-white/20 focus:outline-none" />
                {search && (
                  <button type="button" onClick={() => setSearch('')} className="absolute right-2 top-1/2 -translate-y-1/2 cursor-pointer text-white/60 hover:text-white">
                    <X size={12} />
                  </button>
                )}
              </div>
              <button type="button" onClick={() => setShowFilters(v => !v)}
                className={`flex cursor-pointer items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm font-medium transition-all xl:hidden ${showFilters || hasActiveFilters ? 'bg-white text-brand-800' : 'border border-white/20 bg-white/10 text-white hover:bg-white/20'}`}>
                <Filter size={14} /> <span>ตัวกรอง</span>
              </button>
              {hasActiveFilters && (
                <button type="button" onClick={clearFilters}
                  className="hidden cursor-pointer items-center gap-1.5 rounded-lg bg-white px-3 py-1.5 text-sm font-medium text-brand-800 transition-all hover:bg-white/90 xl:flex">
                  <X size={14} /> <span>ล้างตัวกรอง</span>
                </button>
              )}
              <button type="button" onClick={toggleSort} title="เรียงตามวันที่สร้าง"
                className="flex cursor-pointer items-center gap-1.5 rounded-lg border border-white/20 bg-white/10 px-3 py-1.5 text-sm font-medium text-white transition-all hover:bg-white/20">
                {sortOrder === 'desc' ? <ArrowDown size={14} /> : <ArrowUp size={14} />} <span>วันที่สร้าง</span>
              </button>
              <button type="button" onClick={() => void handleExport()} disabled={filtered.length === 0 || exporting}
                className="flex cursor-pointer items-center gap-1.5 rounded-lg bg-emerald-600 px-3 py-1.5 text-sm font-medium text-white transition-all hover:bg-emerald-500 disabled:cursor-not-allowed disabled:opacity-60">
                <FileSpreadsheet size={14} /> <span>{exporting ? 'กำลังส่งออก...' : 'Excel'}</span>
              </button>
            </div>
          </div>

          {/* มือถือ: ค้นหา + Excel */}
          <div className="mt-3 flex flex-wrap items-center gap-2 lg:hidden">
            <div className="relative min-w-36 flex-1">
              <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-white/60" />
              <input type="text" placeholder="ค้นหา..." value={search} onChange={e => setSearch(e.target.value)}
                className="w-full rounded-xl border border-white/20 bg-white/10 py-2 pl-9 pr-9 text-sm text-white transition-all placeholder:text-white/50 focus:border-white/40 focus:bg-white/20 focus:outline-none" />
              {search && (
                <button type="button" onClick={() => setSearch('')} className="absolute right-3 top-1/2 -translate-y-1/2 cursor-pointer text-white/60 hover:text-white">
                  <X size={14} />
                </button>
              )}
            </div>
            <button type="button" onClick={() => void handleExport()} disabled={filtered.length === 0 || exporting} aria-label="Excel"
              className="flex h-9 w-9 cursor-pointer items-center justify-center rounded-lg bg-emerald-600 text-white disabled:opacity-60">
              <FileSpreadsheet size={16} />
            </button>
          </div>
        </div>

        {/* จอแคบ (การ์ด) ใช้แถบนี้ จอกว้างกรองที่ใต้หัวคอลัมน์ */}
        {showFilters && (
          <div className="border-b border-gray-200 bg-linear-to-r from-gray-50 to-gray-100 p-3 lg:p-4 xl:hidden">
            <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center">
              {(['สาขา', 'แผนก'] as const).map(label => (
                <div key={label} className="flex flex-col gap-2 sm:flex-row sm:items-center">
                  <span className="shrink-0 text-xs font-medium text-gray-500">{label}</span>
                  <select value={colFilters[label] ?? ''} onChange={e => setColFilter(label, e.target.value)}
                    className={SELECT_TONE(!!colFilters[label])}>
                    <option value="">ทั้งหมด</option>
                    {optionsOf(label).map(o => <option key={o} value={o}>{o}</option>)}
                  </select>
                </div>
              ))}
              <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
                <span className="shrink-0 text-xs font-medium text-gray-500">สถานะ</span>
                <select value={colFilters['สถานะ'] ?? ''} onChange={e => setColFilter('สถานะ', e.target.value)}
                  className={SELECT_TONE(!!colFilters['สถานะ'])}>
                  <option value="">ทั้งหมด</option>
                  {statusOptions.map(s => <option key={s} value={s}>{statusLabel(s)}</option>)}
                </select>
              </div>
              {hasActiveFilters && (
                <button type="button" onClick={clearFilters} className="flex cursor-pointer items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm text-gray-500 transition-colors hover:bg-red-50 hover:text-red-600">
                  <X size={14} /> ล้างตัวกรอง
                </button>
              )}
            </div>
          </div>
        )}

        {loading && (
          <div className="absolute inset-0 z-10 flex items-center justify-center bg-white/75 backdrop-blur-sm">
            <div className="flex flex-col items-center gap-4">
              <div className="h-12 w-12 animate-spin rounded-full border-4 border-brand-200 border-t-brand-600" />
              <p className="font-medium text-gray-700">กำลังค้นหาข้อมูล...</p>
            </div>
          </div>
        )}

        {/* การ์ด (จอแคบกว่า 1280px) */}
        <div className={`block xl:hidden ${loading ? 'min-h-52' : ''}`}>
          {!loading && shown.length === 0 ? <Empty /> : (
            <div className="divide-y divide-gray-100">
              {shown.map(row => kind === 'claim'
                ? <ClaimCard key={`c${row.id}`} claim={row as PettyClaim} ctx={ctx} onOpen={() => open(row)} />
                : <RoundCard key={`r${row.id}`} round={row as PettyRound} onOpen={() => open(row)} />)}
            </div>
          )}
        </div>

        {/* ตาราง (จอ 1280px ขึ้นไป) — คอลัมน์ชุดเดียวกับ Excel มีช่องกรองใต้หัวคอลัมน์ทุกช่อง */}
        <div className={`hidden overflow-x-auto xl:block ${loading ? 'min-h-52' : ''}`}>
          <table className="w-full">
            <thead className="bg-gray-100">
              <tr>
                {columns.map(col => <th key={col.label} className={`${FTH} ${col.money ? 'text-right' : ''}`}>{col.label}</th>)}
              </tr>
              <tr className="border-t border-gray-200 bg-gray-50">
                {columns.map(col => <th key={col.label} className="px-2 py-1.5 text-left align-top">{renderFilter(col)}</th>)}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {!loading && shown.length === 0 ? (
                <tr><td colSpan={columns.length}><Empty /></td></tr>
              ) : shown.map((row, i) => (
                <tr key={`${kind}${row.id}`} onClick={() => open(row)} className="cursor-pointer transition-colors hover:bg-gray-50">
                  {columns.map(col => (
                    <td key={col.label} className={`${FTD} ${col.money ? 'text-right tabular-nums' : ''}`}>
                      {renderCell(col, row, (page - 1) * PAGE_SIZE + i + 1)}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="flex justify-end border-t border-gray-100 p-4">
          <PaginationControls currentPage={page} totalPages={pages} onPageChange={setPage} />
        </div>
      </section>
    </Tabs>
  );
}

function Empty() {
  return (
    <div className="px-6 py-16 text-center text-gray-500">
      <FileText size={56} className="mx-auto mb-4 text-gray-300" />
      <p className="text-lg">ไม่มีรายการ</p>
    </div>
  );
}

function ClaimCard({ claim, ctx, onOpen }: { claim: PettyClaim; ctx: WorklistCtx; onOpen: () => void }) {
  const period = CLAIM_COLUMNS.find(c => c.label === 'ช่วงวันที่')!.text(claim, ctx);
  const roundNo = ctx.roundNo(claim.batch_id);
  return (
    <div onClick={onOpen} className="cursor-pointer p-4 transition-colors active:bg-gray-100">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0 flex-1">
          <p className="text-xs font-medium text-brand-600">{claim.form_id}</p>
          <p className="truncate text-sm font-semibold text-gray-800">{ctx.typeName(claim.expense_type)} · {claim.payee_name ?? '-'}</p>
          <p className="mt-0.5 flex items-center gap-1 text-xs text-gray-500"><User size={11} /> {claim.created_by_name ?? claim.created_by}</p>
          <p className="mt-0.5 text-xs text-gray-500">ช่วงวันที่: {period || '-'} · DD: {claim.dd_no ?? '-'}</p>
          {claim.status === 'SENT_BACK' && claim.review_remark && (
            <p className="mt-0.5 truncate text-xs text-orange-700">เหตุผล: {claim.review_remark}</p>
          )}
        </div>
        <ClaimBadge status={claim.status} />
      </div>
      <div className="mt-2 flex items-center justify-between text-xs text-gray-500">
        <span>{formatBaht(claim.amount)}</span>
        <span>{roundNo ? `รอบ ${roundNo}` : ''}</span>
      </div>
    </div>
  );
}

function RoundCard({ round, onOpen }: { round: PettyRound; onOpen: () => void }) {
  return (
    <div onClick={onOpen} className="cursor-pointer p-4 transition-colors active:bg-gray-100">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0 flex-1">
          <p className="text-xs font-medium text-brand-600">{round.batch_no}</p>
          <p className="truncate text-sm font-semibold text-gray-800">{round.holder_name ?? round.holder_employee_id ?? '-'}</p>
          <p className="mt-0.5 text-xs text-gray-500">สาขา {round.branch_code ?? '-'} · แผนก {round.division_code ?? '-'}</p>
          {(round.voucher_no || round.pay_doc_no) && (
            <p className="mt-0.5 text-xs text-gray-500">ตั้งเบิก: {round.voucher_no ?? '-'} · ทำจ่าย: {round.pay_doc_no ?? '-'}</p>
          )}
        </div>
        <RoundBadge status={round.status} />
      </div>
      <div className="mt-2 flex items-center justify-between text-xs text-gray-500">
        <span>{formatBaht(round.total_amount)}</span>
        <span>{round.claim_count ?? round.claims?.length ?? '-'} ใบ</span>
      </div>
    </div>
  );
}
