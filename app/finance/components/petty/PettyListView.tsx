'use client';

import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { ArrowDown, ArrowUp, ChevronLeft, ChevronRight, FileSpreadsheet, Search, X } from 'lucide-react';
import type { PettyClaim, PettyExpenseType, PettyFund } from '@/app/finance/types-petty';
import { exportPettyXlsx } from '@/lib/finance/petty-export';
import {
  activeFilterKeys, applyFilters, createdDate, createdTime, distinctOptions, periodText, pettyColumns, sortRows,
  type FilterState, type PettyColumnKey, type SortState,
} from '@/lib/finance/petty-grid';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { matchesSearch, matchesTab, pageCount, paginate, tabCounts, type PettyTab } from '@/lib/finance/petty-list';
import { formatBaht, formatDate, todayBkk } from '@/lib/finance/status';
import { ColumnHeader } from './ColumnFilter';
import { PettyStatusBadge } from './PettyStatusBadge';
import { Button, FIELD_SM, LINE, UnderlineTabs, buttonClass } from './ui';

const PAGE_SIZES = [20, 50, 100];
const DEFAULT_SORT: SortState = { key: 'form_id', dir: 'desc' };
const TH = 'px-3 py-2.5 text-left text-xs align-middle';
const TD = 'px-3 py-3 text-sm align-top text-ink-900';
const CELL_CLASS: Record<PettyColumnKey, string> = {
  form_id: `${TD} font-medium`, created: `${TD} text-ink-700`, creator: TD, type: TD, payee: TD,
  period: `${TD} whitespace-nowrap tabular-nums text-ink-700`, amount: `${TD} whitespace-nowrap text-right font-medium tabular-nums`,
  dd: `${TD} text-ink-700`, status: 'px-3 py-3 align-top',
};

/** ลำดับคอลัมน์: ระบุใบ → ใบนี้คืออะไร/เท่าไร → ตอนนี้อยู่ไหน */
const ORDER: PettyColumnKey[] = ['form_id', 'created', 'creator', 'type', 'payee', 'period', 'amount', 'dd', 'status'];
/** ความกว้างคอลัมน์ (px, table-fixed) — 0 = ยืดรับพื้นที่ที่เหลือ (จ่ายให้ / หมายเหตุ) */
const WIDTH: Record<PettyColumnKey, number> = {
  form_id: 148, created: 132, creator: 168, type: 132, payee: 0, period: 180,
  amount: 136, dd: 100, status: 188,
};
const FLEX_MIN = 170;
const SORT_LABELS: Partial<Record<PettyColumnKey, [string, string]>> = {
  form_id: ['เก่า → ใหม่', 'ใหม่ → เก่า'],
  created: ['เปิดก่อน → หลัง', 'เปิดหลัง → ก่อน'],
  period: ['วันที่เก่า → ใหม่', 'วันที่ใหม่ → เก่า'],
  amount: ['น้อย → มาก', 'มาก → น้อย'],
  status: ['ตามขั้นตอน (ต้น → ท้าย)', 'ตามขั้นตอน (ท้าย → ต้น)'],
};

/**
 * ตารางรายการเงินสดย่อย — แท็บเส้นใต้มีตัวเลข · ค้นหา/Excel · หัวคอลัมน์กรองแบบ Excel (เรียง + ติ๊กค่า)
 * · คลิกแถวเปิดแผงข้าง · ปุ่มลัดต่อแถว (ผู้เรียกกำหนด) · ติ๊กเลือกได้ (ปิดรอบ) · วางในแผ่นขาวของ PettyPage
 * รายการทั้งหมดโหลดมาก่อนแล้ว (≤200 ใบต่อมุมมอง) กรอง/ค้น/แบ่งหน้าในเครื่อง
 */
export function PettyListView({
  claims, types, funds = [], tabs, activeTab, onTabChange, onOpen, loading = false,
  headerAction, filters, exportFileBase, rowAction, rowNote, selectable = false, selected = [], onSelect, footer, toolbarExtra,
  hideColumns = [], variant = 'sheet',
}: {
  claims: PettyClaim[];
  types: PettyExpenseType[];
  funds?: PettyFund[];
  tabs: PettyTab[];
  activeTab: string;
  onTabChange: (key: string) => void;
  onOpen: (claim: PettyClaim) => void;
  loading?: boolean;
  /** ปุ่มเพิ่มในแถบเครื่องมือ (เช่น ใบปะหน้า) */
  headerAction?: ReactNode;
  /** ตัวเลือกเพิ่มข้างแท็บ (เช่น เลือกกองทุน) */
  filters?: ReactNode;
  exportFileBase?: string;
  /** ปุ่มลัดในแถว — คืน null ถ้าใบนี้ไม่มีอะไรให้กด */
  rowAction?: (claim: PettyClaim) => ReactNode;
  /** ป้ายเล็กข้างสถานะ (เช่น "เอกสารครบ" / "ขาด 2") */
  rowNote?: (claim: PettyClaim) => string | null | undefined;
  selectable?: boolean;
  selected?: number[];
  onSelect?: (ids: number[]) => void;
  /** แถบล่าง (เช่น สรุปยอดที่เลือก + ปุ่มปิดรอบ) */
  footer?: ReactNode;
  /** แถวตัวกรองเพิ่มใต้แท็บ (เช่น ช่วงวันที่จ่าย) */
  toolbarExtra?: ReactNode;
  /** ซ่อนคอลัมน์ที่ไม่มีประโยชน์ในหน้านั้น (เช่น ผู้เปิดใบ ในหน้าใบของฉัน) */
  hideColumns?: PettyColumnKey[];
  /** sheet = วางในแผ่นขาวของ PettyPage · canvas = บนพื้นน้ำเงินของ FinanceCanvas แบบหน้า Advance (แท็บ pill + การ์ดหัวน้ำเงินเข้ม) */
  variant?: 'sheet' | 'canvas';
}) {
  const canvas = variant === 'canvas';
  const [search, setSearch] = useState('');
  const [sort, setSort] = useState<SortState>(DEFAULT_SORT);
  const [colFilters, setColFilters] = useState<FilterState>({});
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(PAGE_SIZES[0]);
  const [exporting, setExporting] = useState(false);

  const tab = tabs.find(t => t.key === activeTab) ?? tabs[0];
  const columns = useMemo(() => {
    const typeName = (code: string) => types.find(t => t.code === code)?.name_th ?? code;
    return pettyColumns(typeName);
  }, [types]);
  const typeName = (code: string) => types.find(t => t.code === code)?.name_th ?? code;
  const col = (key: string) => columns.find(c => c.key === key)!;
  const counts = useMemo(() => tabCounts(claims, tabs), [claims, tabs]);
  const visible = ORDER.filter(k => !hideColumns.includes(k));
  const tableMinWidth = visible.reduce((w, k) => w + (WIDTH[k] || FLEX_MIN), FLEX_MIN /* หมายเหตุ */)
    + (selectable ? 44 : 0) + (rowAction ? 140 : 0);

  // แท็บ + ค้นหา → ฐานของตัวกรองหัวคอลัมน์ (รายการติ๊กของแต่ละคอลัมน์ขึ้นตามตัวกรองคอลัมน์อื่น แบบ Excel)
  const base = useMemo(
    () => claims.filter(c => matchesTab(c, tab) && matchesSearch(c, search, typeName(c.expense_type))),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [claims, tab, search, types],
  );
  // ตัวกรอง/การเรียงของคอลัมน์ที่ซ่อนอยู่ไม่นับ
  const visibleKey = visible.join();
  const liveFilters = useMemo(
    () => Object.fromEntries(Object.entries(colFilters).filter(([k]) => visible.includes(k as PettyColumnKey))),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [colFilters, visibleKey],
  );
  const liveSort = visible.includes(sort.key as PettyColumnKey) ? sort : DEFAULT_SORT;
  const rows = useMemo(() => {
    const sortCol = columns.find(c => c.key === liveSort.key) ?? columns[0];
    return sortRows(applyFilters(base, columns, liveFilters), sortCol, liveSort.dir);
  }, [base, columns, liveFilters, liveSort.key, liveSort.dir]);
  const optionsFor = (key: string) => distinctOptions(applyFilters(base, columns, liveFilters, key), col(key));

  const pages = pageCount(rows.length, pageSize);
  useEffect(() => { setPage(1); }, [activeTab, search, sort, colFilters, pageSize]);
  useEffect(() => { if (page > pages) setPage(pages); }, [page, pages]);
  const shown = paginate(rows, page, pageSize);

  const activeKeys = activeFilterKeys(liveFilters);
  const setFilter = (key: string, values: string[]) => setColFilters(f => ({ ...f, [key]: values }));
  const clearAll = () => { setColFilters({}); setSearch(''); };

  const allShownSelected = selectable && shown.length > 0 && shown.every(c => selected.includes(c.id));
  const toggleAll = () => {
    if (!onSelect) return;
    onSelect(allShownSelected ? selected.filter(id => !shown.some(c => c.id === id)) : [...new Set([...selected, ...shown.map(c => c.id)])]);
  };
  const toggle = (id: number) => onSelect?.(selected.includes(id) ? selected.filter(x => x !== id) : [...selected, id]);

  async function handleExport() {
    if (!exportFileBase || exporting) return;
    setExporting(true);
    try { await exportPettyXlsx(rows, types, funds, `${exportFileBase}-${activeTab}-${todayBkk()}.xlsx`); }
    finally { setExporting(false); }
  }

  /** หมายเหตุของใบ — เหตุตีกลับ / วันจ่าย / ผลตรวจ */
  const notes = (c: PettyClaim): { text: string; strong?: boolean }[] => [
    c.status === 'RETURNED' && c.return_reason ? { text: `ตีกลับ: ${c.return_reason}`, strong: true } : null,
    c.status === 'SENT_BACK' && c.review_remark ? { text: `บัญชี: ${c.review_remark}`, strong: true } : null,
    c.transfer_date && c.status !== 'RETURNED' ? { text: `จ่าย ${formatDate(c.transfer_date)}` } : null,
    c.reviewed_at && c.status === 'AWAITING_REVIEW' ? { text: 'บัญชีผ่านแล้ว รอปิดรอบ' } : null,
  ].filter((n): n is { text: string; strong?: boolean } => !!n);

  const head = (key: PettyColumnKey, align: 'left' | 'right' = 'left') => (
    <th key={key} scope="col" style={WIDTH[key] ? { width: WIDTH[key] } : undefined} className={TH} aria-sort={liveSort.key === key ? (liveSort.dir === 'asc' ? 'ascending' : 'descending') : undefined}>
      <ColumnHeader label={col(key).label} align={align}
        sortDir={liveSort.key === key ? liveSort.dir : null} onSort={dir => setSort({ key, dir })} sortLabels={SORT_LABELS[key]}
        options={optionsFor(key)} selected={colFilters[key]} onApply={v => setFilter(key, v)} />
    </th>
  );

  /** เนื้อหาเซลล์ต่อคอลัมน์ */
  const cell = (key: PettyColumnKey, c: PettyClaim): ReactNode => {
    const dash = <span className="text-ink-300">-</span>;
    switch (key) {
      case 'form_id': return (
        <button type="button" onClick={e => { e.stopPropagation(); onOpen(c); }}
          className="whitespace-nowrap underline-offset-2 hover:text-brand-700 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-600/30">
          {c.form_id}
        </button>
      );
      case 'created': {
        const d = createdDate(c);
        return d ? <><p className="tabular-nums">{formatDate(d)}</p><p className="text-xs tabular-nums text-ink-500">{createdTime(c)} น.</p></> : dash;
      }
      case 'creator': return (
        <>
          <p className="truncate leading-snug" title={c.created_by_name ?? c.created_by}>{c.created_by_name ?? c.created_by}</p>
          {c.created_by_name && <p className="text-xs leading-snug text-ink-500">{c.created_by}</p>}
        </>
      );
      case 'type': return <p className="truncate" title={typeName(c.expense_type)}>{typeName(c.expense_type)}</p>;
      case 'payee': return <p className="line-clamp-2 break-words leading-snug" title={c.payee_name ?? undefined}>{c.payee_name ?? dash}</p>;
      case 'period': return periodText(c);
      case 'amount': return formatBaht(c.amount);
      case 'dd': return <p className="truncate" title={c.dd_no ?? undefined}>{c.dd_no ?? dash}</p>;
      case 'status': return <PettyStatusBadge status={c.status} note={rowNote?.(c)} />;
    }
  };

  const firstRow = rows.length === 0 ? 0 : (page - 1) * pageSize + 1;
  const lastRow = Math.min(page * pageSize, rows.length);
  const filtered = activeKeys.length > 0 || !!search;
  const total = formatBaht(rows.reduce((s, c) => s + c.amount, 0));

  const searchBox = (
    <div className={`relative min-w-0 ${canvas ? 'flex-1 lg:flex-none' : 'basis-full sm:basis-auto sm:flex-none'}`}>
      <Search size={14} className={`pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 ${canvas ? 'text-white/60' : 'text-ink-300'}`} aria-hidden />
      <input type="search" value={search} onChange={e => setSearch(e.target.value)} aria-label="ค้นหาใบเบิก"
        placeholder="ค้นเลขที่ใบ / ผู้เปิดใบ / จ่ายให้ / DD"
        className={canvas
          ? 'w-full rounded-lg border border-white/20 bg-white/10 py-2 pl-8 pr-8 text-sm text-white placeholder:text-white/50 transition-colors focus:border-white/40 focus:bg-white/20 focus:outline-none sm:w-72 [&::-webkit-search-cancel-button]:hidden'
          : `${FIELD_SM} w-full py-2 pl-8 pr-8 sm:w-72`} />
      {search && (
        <button type="button" onClick={() => setSearch('')} aria-label="ล้างคำค้น"
          className={`absolute right-2 top-1/2 -translate-y-1/2 ${canvas ? 'text-white/60 hover:text-white' : 'text-ink-300 hover:text-ink-900'}`}>
          <X size={13} />
        </button>
      )}
    </div>
  );

  const newestFirst = !(sort.key === 'form_id' && sort.dir === 'asc');
  const toggleNewest = () => setSort(s => ({ key: 'form_id', dir: s.key === 'form_id' && s.dir === 'desc' ? 'asc' : 'desc' }));
  const SortIcon = newestFirst ? ArrowDown : ArrowUp;

  const exportBtn = exportFileBase && (
    <button type="button" onClick={() => void handleExport()} disabled={rows.length === 0 || exporting} title="ส่งออกตามตัวกรองที่เห็นอยู่"
      className={canvas
        ? 'inline-flex min-h-9 items-center gap-1.5 rounded-lg bg-emerald-600 px-3 text-sm font-medium text-white transition-colors hover:bg-emerald-500 disabled:cursor-not-allowed disabled:opacity-60'
        : buttonClass('secondary', 'md', 'min-h-9 px-3')}>
      <FileSpreadsheet size={14} className={canvas ? '' : 'text-ink-500'} /> {exporting ? 'กำลังส่งออก…' : 'Excel'}
    </button>
  );

  const chips = activeKeys.length > 0 && (
    <div className={`flex flex-wrap items-center gap-1.5 ${canvas ? `border-b ${LINE} bg-[#f7f9fc] px-4 py-2.5 lg:px-5` : 'mt-3'}`}>
      <span className="mr-1 text-xs text-ink-500">กรองอยู่:</span>
      {activeKeys.map(key => {
        const vals = colFilters[key];
        return (
          <span key={key} className="inline-flex max-w-full items-center gap-1 rounded-md border border-[#dbe4f3] bg-white py-0.5 pl-2 pr-1 text-xs text-ink-700">
            <span className="font-semibold text-ink-900">{col(key).label}:</span>
            <span className="max-w-64 truncate" title={vals.join(', ')}>{vals.length > 2 ? `${vals.slice(0, 2).join(', ')} +${vals.length - 2}` : vals.join(', ')}</span>
            <button type="button" onClick={() => setFilter(key, [])} aria-label={`ล้างตัวกรอง ${col(key).label}`}
              className="rounded p-0.5 text-ink-300 hover:bg-[#f2f5fa] hover:text-ink-900">
              <X size={12} />
            </button>
          </span>
        );
      })}
      <button type="button" onClick={clearAll} className="ml-1 text-xs font-medium text-brand-700 hover:underline">ล้างทั้งหมด</button>
    </div>
  );

  const body = (
    <div className={`relative ${canvas ? '' : 'mt-3'} ${loading ? 'min-h-52' : ''}`}>
      {loading && (
        <div className="absolute inset-0 z-10 flex items-center justify-center bg-white/75">
          <div className="h-9 w-9 animate-spin rounded-full border-[3px] border-[#dbe4f3] border-t-brand-600" aria-label="กำลังโหลด" />
        </div>
      )}

      {/* มือถือ: แถวซ้อน */}
      <ul className={`divide-y ${LINE} lg:hidden ${canvas ? '' : `border-y ${LINE}`}`}>
        {!loading && shown.length === 0 ? <li><Empty filtered={filtered} onClear={clearAll} /></li> : shown.map(c => (
          <li key={c.id} className={canvas ? 'px-4 py-3 active:bg-[#f7f9fc]' : 'py-3'}>
            <div className="flex items-start gap-3">
              {selectable && (
                <input type="checkbox" checked={selected.includes(c.id)} onChange={() => toggle(c.id)} aria-label={`เลือกใบ ${c.form_id}`}
                  className="mt-1 size-4 accent-brand-600" />
              )}
              <button type="button" onClick={() => onOpen(c)} className="min-w-0 flex-1 text-left">
                <span className="flex items-start justify-between gap-2">
                  <span className="min-w-0">
                    <span className={`block text-xs font-medium ${canvas ? 'text-brand-600' : 'text-ink-500'}`}>{c.form_id}</span>
                    <span className="block truncate text-sm font-semibold text-ink-900">{typeName(c.expense_type)} · {c.payee_name ?? '-'}</span>
                    <span className="mt-0.5 block text-xs text-ink-500">
                      {!hideColumns.includes('creator') && <>{c.created_by_name ?? c.created_by} · </>}{periodText(c)}
                    </span>
                    {createdDate(c) && (
                      <span className="mt-0.5 block text-xs text-ink-500">
                        เปิด {formatDate(createdDate(c))} {createdTime(c)} น.
                      </span>
                    )}
                  </span>
                  <span className="block shrink-0 text-right font-display text-sm font-semibold tabular-nums text-ink-900">{formatBaht(c.amount)}</span>
                </span>
                <span className="mt-1.5 flex flex-wrap items-center gap-1.5">
                  <PettyStatusBadge status={c.status} note={rowNote?.(c)} />
                </span>
                {notes(c).map(n => <span key={n.text} className={`mt-1 block text-xs ${n.strong ? 'text-ink-700' : 'text-ink-500'}`}>{n.text}</span>)}
              </button>
            </div>
            {rowAction && <div className="mt-2 flex flex-wrap justify-end gap-1.5">{rowAction(c)}</div>}
          </li>
        ))}
      </ul>

      {/* เดสก์ท็อป: ตาราง กว้างคงที่ต่อคอลัมน์ ไม่เบียด — จอแคบเลื่อนแนวนอนในกรอบ */}
      <div className={`hidden overflow-x-auto lg:block ${canvas ? '' : `rounded-xl border ${LINE}`}`}>
        <table className="w-full table-fixed border-collapse" style={{ minWidth: tableMinWidth }}>
          <thead className={`border-b ${LINE} ${canvas ? 'bg-[#eef2f8]' : 'bg-[#f7f9fc]'}`}>
            <tr>
              {selectable && (
                <th scope="col" className="w-11 px-3 py-2.5 align-middle">
                  <input type="checkbox" checked={allShownSelected} onChange={toggleAll} aria-label="เลือกทั้งหน้า" className="size-4 accent-brand-600" />
                </th>
              )}
              {visible.map(k => head(k, k === 'amount' ? 'right' : 'left'))}
              <th scope="col" className={`${TH} min-w-40 font-semibold text-ink-700`}>หมายเหตุ</th>
              {rowAction && <th scope="col" className={`${TH} w-[140px] text-right font-semibold text-ink-700`}>ทำรายการ</th>}
            </tr>
          </thead>
          <tbody>
            {!loading && shown.length === 0 ? (
              <tr><td colSpan={visible.length + 1 + (selectable ? 1 : 0) + (rowAction ? 1 : 0)}><Empty filtered={filtered} onClear={clearAll} /></td></tr>
            ) : shown.map(c => {
              const on = selectable && selected.includes(c.id);
              return (
                <tr key={c.id} onClick={() => onOpen(c)}
                  className={`cursor-pointer border-b border-[#f0f3f8] transition-colors last:border-b-0 ${on ? 'bg-brand-50/50' : 'hover:bg-[#f9fbfd]'}`}>
                  {selectable && (
                    <td className="px-3 py-3 align-top" onClick={e => e.stopPropagation()}>
                      <input type="checkbox" checked={on} onChange={() => toggle(c.id)} aria-label={`เลือกใบ ${c.form_id}`} className="size-4 accent-brand-600" />
                    </td>
                  )}
                  {visible.map(k => <td key={k} className={CELL_CLASS[k]}>{cell(k, c)}</td>)}
                  <td className="px-3 py-3 align-top text-xs leading-snug">
                    {notes(c).length === 0 ? <span className="text-ink-300">-</span> : notes(c).map(n => (
                      <p key={n.text} className={`line-clamp-2 break-words ${n.strong ? 'text-ink-700' : 'text-ink-500'}`} title={n.text}>{n.text}</p>
                    ))}
                  </td>
                  {rowAction && (
                    <td className="px-3 py-3 text-right align-top" onClick={e => e.stopPropagation()}>
                      <span className="inline-flex flex-wrap justify-end gap-1.5">{rowAction(c)}</span>
                    </td>
                  )}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );

  const pager = (
    <div className={`flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between ${canvas ? `border-t ${LINE} px-4 py-3 lg:px-5` : 'mt-4'}`}>
      <div className="min-w-0">{footer}</div>
      <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-sm text-ink-700">
        <label className="inline-flex items-center gap-2">
          <span className="text-ink-500">แสดง</span>
          <select value={pageSize} onChange={e => setPageSize(Number(e.target.value))} className={`${FIELD_SM} py-1`} aria-label="จำนวนแถวต่อหน้า">
            {PAGE_SIZES.map(n => <option key={n} value={n}>{n}</option>)}
          </select>
          <span className="text-ink-500">แถว</span>
        </label>
        <span className="tabular-nums text-ink-500">{firstRow}–{lastRow} จาก {rows.length}</span>
        <div className="inline-flex items-center gap-1">
          <Button size="sm" className="min-h-8 px-2" disabled={page <= 1} onClick={() => setPage(p => p - 1)} aria-label="หน้าก่อน">
            <ChevronLeft size={15} />
          </Button>
          <span className="min-w-16 text-center tabular-nums">{page} / {pages}</span>
          <Button size="sm" className="min-h-8 px-2" disabled={page >= pages} onClick={() => setPage(p => p + 1)} aria-label="หน้าถัดไป">
            <ChevronRight size={15} />
          </Button>
        </div>
      </div>
    </div>
  );

  if (canvas) {
    return (
      <div className="space-y-4">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <PillTabs tabs={tabs} active={activeTab} onChange={onTabChange} counts={loading ? {} : counts} label="สถานะใบ" />
          {filters && <div className="shrink-0">{filters}</div>}
        </div>

        <section className="relative overflow-hidden rounded-2xl bg-white shadow-xl">
          <div className="flex flex-col gap-3 bg-brand-800 p-4 lg:flex-row lg:items-center lg:justify-between lg:p-5">
            <div className="flex items-center justify-between gap-3">
              <div className="min-w-0">
                <h2 className="font-display text-lg font-semibold text-white lg:text-xl">{tab.label}</h2>
                <p className="mt-0.5 text-xs text-white/70 lg:text-sm">
                  <span className="font-semibold text-white">{rows.length}</span> ใบ · รวม{' '}
                  <span className="font-semibold tabular-nums text-white">{total}</span> บาท
                  {rows.length !== base.length && <> (จาก {base.length} ใบ)</>}
                </p>
              </div>
              {/* มือถือไม่มีหัวตาราง — ปุ่มเรียงตามลำดับที่เปิดใบ */}
              <button type="button" onClick={toggleNewest} title={newestFirst ? 'ล่าสุดก่อน' : 'เก่าก่อน'} aria-label={newestFirst ? 'เรียงล่าสุดก่อน' : 'เรียงเก่าก่อน'}
                className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-white/10 text-white transition-colors hover:bg-white/20 lg:hidden">
                <SortIcon size={16} />
              </button>
            </div>
            <div className="flex items-center gap-2">
              {searchBox}
              {headerAction}
              {exportBtn}
            </div>
          </div>
          {toolbarExtra && <div className={`border-b ${LINE} px-4 py-3 lg:px-5`}>{toolbarExtra}</div>}
          {chips}
          {body}
          {pager}
        </section>
      </div>
    );
  }

  return (
    <div>
      <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
        <div className="min-w-0 flex-1">
          <UnderlineTabs tabs={tabs} active={activeTab} onChange={onTabChange} counts={counts} label="สถานะใบ" />
        </div>
        {filters && <div className="shrink-0">{filters}</div>}
      </div>

      {toolbarExtra && <div className="mt-4">{toolbarExtra}</div>}

      <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-sm text-ink-700">
          <span className="font-semibold text-ink-900">{rows.length}</span> ใบ · รวม{' '}
          <span className="font-semibold tabular-nums text-ink-900">{total}</span> บาท
          {rows.length !== base.length && <span className="text-ink-500"> (จาก {base.length} ใบ)</span>}
        </p>
        <div className="flex flex-wrap items-center gap-2">
          {searchBox}
          {/* มือถือไม่มีหัวตาราง — ปุ่มเรียงตามลำดับที่เปิดใบ */}
          <Button size="md" title="เรียงตามลำดับที่เปิดใบ" className="min-h-9 px-3 lg:hidden" onClick={toggleNewest}>
            <SortIcon size={14} className="text-ink-500" />
            {newestFirst ? 'ล่าสุดก่อน' : 'เก่าก่อน'}
          </Button>
          {headerAction}
          {exportBtn}
        </div>
      </div>

      {chips}
      {body}
      {pager}
    </div>
  );
}

/**
 * แท็บบนพื้นน้ำเงิน (แบบหน้า Advance แต่อ่านง่ายขึ้น): แท็บที่เลือกเป็นพิลขาว · ตัวเลขเป็นป้ายกลมแยกจากชื่อ
 * · แท็บ tone=alert ที่มีใบ = ป้ายแดง · แท็บว่างตัวจาง · ลูกศรซ้าย/ขวาสลับแท็บ (Radix) · มือถือเลื่อนแนวนอนและเลื่อนแท็บที่เลือกเข้ากลางจอ
 */
function PillTabs({ tabs, active, onChange, counts, label }: {
  tabs: PettyTab[]; active: string; onChange: (key: string) => void; counts: Record<string, number | undefined>; label: string;
}) {
  const listRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    listRef.current?.querySelector<HTMLElement>('[data-state="active"]')
      ?.scrollIntoView({ block: 'nearest', inline: 'center', behavior: 'smooth' });
  }, [active]);

  return (
    <Tabs value={active} onValueChange={onChange} className="min-w-0 gap-0">
      <TabsList ref={listRef} aria-label={label}
        className="h-auto! w-full max-w-full snap-x justify-start gap-1 overflow-x-auto rounded-2xl bg-brand-900/40 p-1.5 ring-1 ring-white/10 backdrop-blur-sm [scrollbar-width:none] lg:w-fit [&::-webkit-scrollbar]:hidden">
        {tabs.map(t => {
          const n = counts[t.key];
          const hot = t.tone === 'alert' && (n ?? 0) > 0;
          return (
            <TabsTrigger key={t.key} value={t.key}
              className="group h-auto flex-none snap-start gap-2 rounded-xl border-0 px-3.5 py-2 text-sm font-medium text-white/80 transition-colors hover:bg-white/10 hover:text-white focus-visible:ring-2 focus-visible:ring-white/60 data-[state=active]:bg-white data-[state=active]:text-brand-800 data-[state=active]:shadow-md sm:px-4">
              {t.label}
              {n !== undefined && <span className={`inline-flex min-w-6 items-center justify-center rounded-full px-1.5 py-px text-xs font-semibold tabular-nums transition-colors ${hot
                ? 'bg-rose-500 text-white'
                : n === 0
                  ? 'bg-white/10 text-white/50 group-data-[state=active]:bg-[#eef2f8] group-data-[state=active]:text-ink-300'
                  : 'bg-white/20 text-white group-data-[state=active]:bg-brand-50 group-data-[state=active]:text-brand-700'}`}>
                {n}
              </span>}
            </TabsTrigger>
          );
        })}
      </TabsList>
    </Tabs>
  );
}

function Empty({ filtered, onClear }: { filtered: boolean; onClear: () => void }) {
  return (
    <div className="px-6 py-14 text-center text-sm text-ink-500">
      <p>{filtered ? 'ไม่มีใบที่ตรงกับตัวกรอง' : 'ไม่มีรายการในแท็บนี้'}</p>
      {filtered && <button type="button" onClick={onClear} className="mt-2 font-medium text-brand-700 hover:underline">ล้างตัวกรองทั้งหมด</button>}
    </div>
  );
}

/** ปุ่มลัดมาตรฐานในแถว */
export function RowButton({ children, onClick, disabled, tone = 'primary', title }: {
  children: ReactNode; onClick: () => void; disabled?: boolean; tone?: 'primary' | 'ghost' | 'danger'; title?: string;
}) {
  return (
    <button type="button" onClick={onClick} disabled={disabled} title={title}
      className={buttonClass(tone === 'primary' ? 'primary' : tone === 'danger' ? 'danger' : 'secondary', 'sm', 'min-h-8 px-3 sm:min-h-7')}>
      {children}
    </button>
  );
}
