'use client';

import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { ArrowDown, ArrowUp, FileSpreadsheet, FileText, Search, X } from 'lucide-react';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { PaginationControls } from '@/components/pagination-controls';
import type { PettyClaim, PettyExpenseType, PettyFund } from '@/app/finance/types-petty';
import { exportPettyXlsx } from '@/lib/finance/petty-export';
import { matchesSearch, matchesTab, pageCount, paginate, sortClaims, tabCounts, type PettyTab } from '@/lib/finance/petty-list';
import { formatBaht, formatDate, todayBkk } from '@/lib/finance/status';
import { PettyStatusBadge } from './PettyStatusBadge';

const PAGE_SIZE = 20;
const TH = 'px-3 py-3 text-left text-xs font-semibold text-gray-700 whitespace-nowrap';
const TD = 'px-3 py-2.5 text-sm whitespace-nowrap align-top';

/**
 * ตารางรายการเงินสดย่อย — โครงเดียวกับ AdvanceListView: แท็บสถานะมีตัวเลข · หัวการ์ดน้ำเงินเข้ม (ค้นหา เรียง Excel)
 * · คลิกแถวเปิดแผงข้าง · ปุ่มลัดต่อแถว (ผู้เรียกกำหนด) · ติ๊กเลือกได้ (ปิดรอบ)
 * รายการทั้งหมดโหลดมาก่อนแล้ว (≤200 ใบต่อมุมมอง) กรอง/ค้น/แบ่งหน้าในเครื่อง
 */
export function PettyListView({
  claims, types, funds = [], tabs, activeTab, onTabChange, onOpen, loading = false,
  headerAction, filters, exportFileBase, rowAction, rowNote, selectable = false, selected = [], onSelect, footer,
}: {
  claims: PettyClaim[];
  types: PettyExpenseType[];
  funds?: PettyFund[];
  tabs: PettyTab[];
  activeTab: string;
  onTabChange: (key: string) => void;
  onOpen: (claim: PettyClaim) => void;
  loading?: boolean;
  /** ปุ่มเพิ่มในหัวการ์ด (เช่น ใบปะหน้า) */
  headerAction?: ReactNode;
  /** ตัวเลือกเพิ่มในแถบแท็บ (เช่น เลือกกองทุน) */
  filters?: ReactNode;
  exportFileBase?: string;
  /** ปุ่มลัดในแถว — คืน null ถ้าใบนี้ไม่มีอะไรให้กด */
  rowAction?: (claim: PettyClaim) => ReactNode;
  /** ป้ายเล็กข้างสถานะ (เช่น "เอกสารครบ" / "ขาด 2") */
  rowNote?: (claim: PettyClaim) => string | null | undefined;
  selectable?: boolean;
  selected?: number[];
  onSelect?: (ids: number[]) => void;
  /** แถบล่างของการ์ด (เช่น สรุปยอดที่เลือก + ปุ่มปิดรอบ) */
  footer?: ReactNode;
}) {
  const [search, setSearch] = useState('');
  const [order, setOrder] = useState<'asc' | 'desc'>('desc');
  const [page, setPage] = useState(1);
  const [exporting, setExporting] = useState(false);

  const tab = tabs.find(t => t.key === activeTab) ?? tabs[0];
  const typeName = (code: string) => types.find(t => t.code === code)?.name_th ?? code;
  const counts = useMemo(() => tabCounts(claims, tabs), [claims, tabs]);
  const rows = useMemo(
    () => sortClaims(claims.filter(c => matchesTab(c, tab) && matchesSearch(c, search, typeName(c.expense_type))), order),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [claims, tab, search, order, types],
  );
  const pages = pageCount(rows.length, PAGE_SIZE);
  useEffect(() => { setPage(1); }, [activeTab, search, order]);
  useEffect(() => { if (page > pages) setPage(pages); }, [page, pages]);
  const shown = paginate(rows, page, PAGE_SIZE);

  const allShownSelected = selectable && shown.length > 0 && shown.every(c => selected.includes(c.id));
  const toggleAll = () => {
    if (!onSelect) return;
    onSelect(allShownSelected ? selected.filter(id => !shown.some(c => c.id === id)) : [...new Set([...selected, ...shown.map(c => c.id)])]);
  };
  const toggle = (id: number) => onSelect?.(selected.includes(id) ? selected.filter(x => x !== id) : [...selected, id]);

  const period = (c: PettyClaim) => c.period_from && c.period_to
    ? (c.period_from === c.period_to ? formatDate(c.period_from) : `${formatDate(c.period_from)} – ${formatDate(c.period_to)}`)
    : formatDate(c.expense_date);

  async function handleExport() {
    if (!exportFileBase || exporting) return;
    setExporting(true);
    try { await exportPettyXlsx(rows, types, funds, `${exportFileBase}-${activeTab}-${todayBkk()}.xlsx`); }
    finally { setExporting(false); }
  }

  const colSpan = 9 + (selectable ? 1 : 0) + (rowAction ? 1 : 0);

  return (
    <Tabs value={activeTab} onValueChange={onTabChange}>
      <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <TabsList className="max-w-full justify-start overflow-x-auto rounded-full bg-gray-800/50 p-1 backdrop-blur-sm">
          {tabs.map(t => (
            <TabsTrigger key={t.key} value={t.key}
              className="shrink-0 rounded-full px-5 py-2 font-medium text-white/70 transition-all hover:text-white data-[state=active]:bg-white data-[state=active]:text-brand-700 data-[state=active]:shadow-md">
              {t.label}{counts[t.key] !== undefined ? ` (${counts[t.key]})` : ''}
            </TabsTrigger>
          ))}
        </TabsList>
        {filters}
      </div>

      <section className="relative overflow-hidden rounded-2xl border border-white/30 bg-white shadow-xl">
        <div className="bg-brand-800 p-4 lg:p-5">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <h2 className="text-lg font-semibold text-white lg:text-xl">{tab?.label ?? ''}</h2>
              <p className="mt-0.5 text-xs text-white/70 lg:text-sm">{rows.length} ใบ · รวม {formatBaht(rows.reduce((s, c) => s + c.amount, 0))} บาท</p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <div className="relative">
                <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-white/60" />
                <input type="text" value={search} onChange={e => setSearch(e.target.value)}
                  placeholder="ค้นหา เลขที่ใบ / ผู้เปิดใบ / จ่ายให้ / DD"
                  className="w-56 rounded-lg border border-white/20 bg-white/10 py-1.5 pl-8 pr-8 text-sm text-white placeholder:text-white/50 transition-all focus:border-white/40 focus:bg-white/20 focus:outline-none sm:w-72" />
                {search && (
                  <button type="button" onClick={() => setSearch('')} className="absolute right-2 top-1/2 -translate-y-1/2 text-white/60 hover:text-white">
                    <X size={12} />
                  </button>
                )}
              </div>
              <button type="button" onClick={() => setOrder(o => (o === 'desc' ? 'asc' : 'desc'))} title="เรียงตามลำดับที่เปิดใบ"
                className="flex items-center gap-1.5 rounded-lg border border-white/20 bg-white/10 px-3 py-1.5 text-sm font-medium text-white transition-all hover:bg-white/20">
                {order === 'desc' ? <ArrowDown size={14} /> : <ArrowUp size={14} />} <span>ล่าสุด</span>
              </button>
              {headerAction}
              {exportFileBase && (
                <button type="button" onClick={() => void handleExport()} disabled={rows.length === 0 || exporting}
                  className="flex items-center gap-1.5 rounded-lg bg-emerald-600 px-3 py-1.5 text-sm font-medium text-white transition-all hover:bg-emerald-500 disabled:cursor-not-allowed disabled:opacity-60">
                  <FileSpreadsheet size={14} /> <span>{exporting ? 'กำลังส่งออก…' : 'Excel'}</span>
                </button>
              )}
            </div>
          </div>
        </div>

        {loading && (
          <div className="absolute inset-0 z-10 flex items-center justify-center bg-white/75 backdrop-blur-sm">
            <div className="h-12 w-12 animate-spin rounded-full border-4 border-brand-200 border-t-brand-600" />
          </div>
        )}

        {/* มือถือ: การ์ด */}
        <div className={`block lg:hidden ${loading ? 'min-h-52' : ''}`}>
          {!loading && shown.length === 0 ? <Empty /> : (
            <div className="divide-y divide-gray-100">
              {shown.map(c => (
                <div key={c.id} className="p-4 transition-colors active:bg-gray-100">
                  <div className="flex items-start justify-between gap-2" onClick={() => onOpen(c)}>
                    <div className="min-w-0 flex-1">
                      <p className="text-xs font-medium text-brand-600">{c.form_id}</p>
                      <p className="truncate text-sm font-semibold text-gray-800">{typeName(c.expense_type)} · {c.payee_name ?? '-'}</p>
                      <p className="mt-0.5 text-xs text-gray-500">{c.created_by_name ?? c.created_by} · {period(c)}</p>
                    </div>
                    <PettyStatusBadge status={c.status} note={rowNote?.(c)} />
                  </div>
                  <div className="mt-2 flex items-center justify-between text-xs text-gray-500">
                    <span className="font-medium text-gray-800">{formatBaht(c.amount)} บาท</span>
                    <span className="flex items-center gap-2">
                      {selectable && <input type="checkbox" checked={selected.includes(c.id)} onChange={() => toggle(c.id)} aria-label={`เลือกใบ ${c.form_id}`} />}
                      {rowAction?.(c)}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* เดสก์ท็อป: ตาราง */}
        <div className={`hidden overflow-x-auto lg:block ${loading ? 'min-h-52' : ''}`}>
          <table className="w-full">
            <thead className="bg-gray-100">
              <tr>
                {selectable && (
                  <th className="w-8 px-3 py-3">
                    <input type="checkbox" checked={allShownSelected} onChange={toggleAll} aria-label="เลือกทั้งหน้า" />
                  </th>
                )}
                <th className={TH}>เลขที่ใบ</th>
                <th className={TH}>ประเภท</th>
                <th className={TH}>ผู้เปิดใบ</th>
                <th className={TH}>จ่ายให้</th>
                <th className={TH}>ช่วงวันที่</th>
                <th className={`${TH} text-right`}>จำนวนเงิน</th>
                <th className={TH}>DD</th>
                <th className={TH}>สถานะ</th>
                <th className={TH}>หมายเหตุ</th>
                {rowAction && <th className={`${TH} text-right`}>ทำรายการ</th>}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {!loading && shown.length === 0 ? (
                <tr><td colSpan={colSpan}><Empty /></td></tr>
              ) : shown.map(c => (
                <tr key={c.id} className="cursor-pointer transition-colors hover:bg-gray-50" onClick={() => onOpen(c)}>
                  {selectable && (
                    <td className="px-3 py-2.5 align-top" onClick={e => e.stopPropagation()}>
                      <input type="checkbox" checked={selected.includes(c.id)} onChange={() => toggle(c.id)} aria-label={`เลือกใบ ${c.form_id}`} />
                    </td>
                  )}
                  <td className={`${TD} font-medium text-brand-800`}>{c.form_id}</td>
                  <td className={TD}>{typeName(c.expense_type)}</td>
                  <td className="px-3 py-2.5 align-top text-sm">
                    <div className="min-w-32 max-w-48">
                      <p className="font-medium leading-snug text-gray-800">{c.created_by_name ?? c.created_by}</p>
                      {c.created_by_name && <p className="text-xs leading-snug text-gray-500">{c.created_by}</p>}
                    </div>
                  </td>
                  <td className="px-3 py-2.5 align-top text-sm"><div className="max-w-56 truncate" title={c.payee_name ?? undefined}>{c.payee_name ?? '-'}</div></td>
                  <td className={`${TD} tabular-nums`}>{period(c)}</td>
                  <td className={`${TD} text-right tabular-nums`}>{formatBaht(c.amount)}</td>
                  <td className={TD}>{c.dd_no ?? <span className="text-gray-400">-</span>}</td>
                  <td className="w-40 px-3 py-2.5 align-top"><PettyStatusBadge status={c.status} note={rowNote?.(c)} /></td>
                  <td className="px-3 py-2.5 align-top text-xs">
                    {c.status === 'RETURNED' && c.return_reason && <p className="max-w-56 text-amber-700" title={c.return_reason}>ตีกลับ: {c.return_reason}</p>}
                    {c.status === 'SENT_BACK' && c.review_remark && <p className="max-w-56 text-orange-700" title={c.review_remark}>บัญชี: {c.review_remark}</p>}
                    {c.transfer_date && c.status !== 'RETURNED' && <p className="text-gray-500">โอน {formatDate(c.transfer_date)}</p>}
                    {c.reviewed_at && c.status === 'AWAITING_REVIEW' && <p className="text-emerald-700">บัญชีผ่านแล้ว รอปิดรอบ</p>}
                  </td>
                  {rowAction && (
                    <td className="px-3 py-2.5 text-right align-top" onClick={e => e.stopPropagation()}>
                      <span className="inline-flex justify-end gap-1.5">{rowAction(c)}</span>
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-gray-100 p-4">
          <div>{footer}</div>
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

/** ปุ่มลัดมาตรฐานในแถว */
export function RowButton({ children, onClick, disabled, tone = 'primary', title }: {
  children: ReactNode; onClick: () => void; disabled?: boolean; tone?: 'primary' | 'ghost' | 'danger'; title?: string;
}) {
  const cls = tone === 'primary' ? 'bg-brand-600 text-white hover:bg-brand-700'
    : tone === 'danger' ? 'border border-rose-200 text-rose-700 hover:bg-rose-50'
    : 'border border-slate-200 text-ink-700 hover:bg-slate-50';
  return (
    <button type="button" onClick={onClick} disabled={disabled} title={title}
      className={`rounded-lg px-2.5 py-1 text-xs font-medium transition-colors disabled:opacity-40 ${cls}`}>
      {children}
    </button>
  );
}
