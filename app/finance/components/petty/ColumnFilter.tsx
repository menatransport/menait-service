'use client';

import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { ArrowDownWideNarrow, ArrowUpNarrowWide, ChevronDown, ChevronUp, ListFilter, Search, X } from 'lucide-react';
import type { FilterOption, SortDir } from '@/lib/finance/petty-grid';
import { buttonClass } from './ui';

const POP_W = 288;

/**
 * หัวคอลัมน์แบบ Excel: กดชื่อ = เรียง · กดไอคอนกรวย = เมนูเรียง + ค้นค่า + ติ๊กค่า
 * ติ๊กเริ่มต้นว่างทั้งหมด (= ไม่กรอง) · กด "ตกลง" ถึงจะกรอง · ไอคอนเป็นน้ำเงินเมื่อคอลัมน์นี้กรองอยู่
 */
export function ColumnHeader({
  label, align = 'left', sortDir, onSort, options, selected, onApply, sortLabels = ['เรียง ก → ฮ', 'เรียง ฮ → ก'],
}: {
  label: string;
  align?: 'left' | 'right';
  /** ทิศที่เรียงอยู่ ถ้าคอลัมน์นี้คือตัวเรียง */
  sortDir?: SortDir | null;
  onSort?: (dir: SortDir) => void;
  /** ไม่ส่ง = คอลัมน์นี้ไม่มีตัวกรอง */
  options?: FilterOption[];
  selected?: string[];
  onApply?: (values: string[]) => void;
  sortLabels?: [string, string];
}) {
  const [open, setOpen] = useState(false);
  const btn = useRef<HTMLButtonElement>(null);
  const filtered = (selected?.length ?? 0) > 0;
  const SortIcon = sortDir === 'asc' ? ChevronUp : ChevronDown;

  return (
    <div className="flex items-center gap-1.5">
      <button type="button" disabled={!onSort} onClick={() => onSort?.(sortDir === 'asc' ? 'desc' : 'asc')}
        title={onSort ? `เรียงตาม${label}` : undefined}
        className={`group inline-flex min-w-0 flex-1 items-center gap-1 rounded font-semibold ${align === 'right' ? 'justify-end text-right' : 'text-left'} text-ink-700 hover:text-ink-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-600/30 disabled:cursor-default`}>
        <span className="truncate">{label}</span>
        {sortDir
          ? <SortIcon size={13} className="shrink-0 text-brand-600" aria-label={sortDir === 'asc' ? 'เรียงน้อยไปมาก' : 'เรียงมากไปน้อย'} />
          : onSort && <ChevronDown size={13} className="shrink-0 text-transparent group-hover:text-ink-300" aria-hidden />}
      </button>
      {options && onApply && (
        <>
          <button ref={btn} type="button" onClick={() => setOpen(o => !o)} aria-haspopup="dialog" aria-expanded={open}
            aria-label={`ตัวกรอง ${label}${filtered ? ` (เลือก ${selected!.length})` : ''}`}
            className={`inline-flex size-6 shrink-0 items-center justify-center rounded-md border transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-600/30 ${filtered
              ? 'border-brand-600 bg-brand-600 text-white hover:bg-brand-700'
              : open ? 'border-[#dbe4f3] bg-[#f2f5fa] text-ink-900' : 'border-transparent text-ink-300 hover:border-[#dbe4f3] hover:bg-white hover:text-ink-700'}`}>
            <ListFilter size={13} />
          </button>
          {open && (
            <FilterPopover anchor={btn.current} label={label} options={options} selected={selected ?? []} sortDir={sortDir}
              sortLabels={sortLabels} onSort={onSort} onApply={v => { onApply(v); setOpen(false); }} onClose={() => setOpen(false)} />
          )}
        </>
      )}
    </div>
  );
}

function FilterPopover({ anchor, label, options, selected, sortDir, sortLabels, onSort, onApply, onClose }: {
  anchor: HTMLElement | null;
  label: string;
  options: FilterOption[];
  selected: string[];
  sortDir?: SortDir | null;
  sortLabels: [string, string];
  onSort?: (dir: SortDir) => void;
  onApply: (values: string[]) => void;
  onClose: () => void;
}) {
  const box = useRef<HTMLDivElement>(null);
  const allBox = useRef<HTMLInputElement>(null);
  const [pos, setPos] = useState<{ top: number; left: number } | null>(null);
  const [q, setQ] = useState('');
  // ค่าที่ติ๊กไว้แต่หายไปจากรายการ (โดนตัวกรองอื่นตัดออก) ยังเก็บไว้ ไม่ทิ้งเงียบ ๆ
  const [draft, setDraft] = useState<Set<string>>(() => new Set(selected));

  const shown = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return needle ? options.filter(o => o.value.toLowerCase().includes(needle)) : options;
  }, [options, q]);
  const shownOn = shown.filter(o => draft.has(o.value)).length;
  const allOn = shown.length > 0 && shownOn === shown.length;

  useEffect(() => { if (allBox.current) allBox.current.indeterminate = shownOn > 0 && !allOn; }, [shownOn, allOn]);

  useLayoutEffect(() => {
    if (!anchor || !box.current) return;
    const r = anchor.getBoundingClientRect();
    const h = box.current.offsetHeight;
    const left = Math.min(Math.max(8, r.right - POP_W), window.innerWidth - POP_W - 8);
    const below = r.bottom + 6;
    const top = below + h > window.innerHeight - 8 && r.top - h - 6 > 8 ? r.top - h - 6 : below;
    setPos({ top, left });
  }, [anchor]);

  useEffect(() => {
    const outside = (e: MouseEvent) => {
      const t = e.target as Node;
      if (!box.current?.contains(t) && !anchor?.contains(t)) onClose();
    };
    const key = (e: KeyboardEvent) => { if (e.key === 'Escape') { onClose(); anchor?.focus(); } };
    const scroll = (e: Event) => { if (!box.current?.contains(e.target as Node)) onClose(); };
    document.addEventListener('mousedown', outside);
    document.addEventListener('keydown', key);
    window.addEventListener('scroll', scroll, true);
    window.addEventListener('resize', onClose);
    return () => {
      document.removeEventListener('mousedown', outside);
      document.removeEventListener('keydown', key);
      window.removeEventListener('scroll', scroll, true);
      window.removeEventListener('resize', onClose);
    };
  }, [anchor, onClose]);

  const toggle = (v: string) => setDraft(d => { const n = new Set(d); if (n.has(v)) n.delete(v); else n.add(v); return n; });
  const toggleShown = () => setDraft(d => {
    const n = new Set(d);
    for (const o of shown) if (allOn) n.delete(o.value); else n.add(o.value);
    return n;
  });

  const sortBtn = (dir: SortDir, text: string, Icon: typeof ArrowUpNarrowWide) => (
    <button type="button" onClick={() => { onSort?.(dir); onClose(); }}
      className={`flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-sm transition-colors hover:bg-[#f2f5fa] ${sortDir === dir ? 'font-semibold text-brand-700' : 'text-ink-700'}`}>
      <Icon size={15} className={sortDir === dir ? 'text-brand-600' : 'text-ink-500'} /> {text}
    </button>
  );

  return createPortal(
    <div ref={box} role="dialog" aria-label={`ตัวกรอง ${label}`}
      style={{ top: pos?.top ?? -9999, left: pos?.left ?? -9999, width: POP_W }}
      className="fixed z-[60] rounded-xl border border-[#dbe4f3] bg-white text-left font-normal shadow-[0_12px_32px_rgba(15,39,72,0.16)]">
      {onSort && (
        <div className="border-b border-[#edf1f7] p-1.5">
          {sortBtn('asc', sortLabels[0], ArrowUpNarrowWide)}
          {sortBtn('desc', sortLabels[1], ArrowDownWideNarrow)}
        </div>
      )}
      <div className="p-2.5">
        <div className="relative">
          <Search size={14} className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-ink-300" aria-hidden />
          <input autoFocus type="search" value={q} onChange={e => setQ(e.target.value)} placeholder={`ค้นหาใน${label}`}
            onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); onApply([...draft]); } }}
            className="w-full rounded-lg border border-[#dbe4f3] bg-white py-1.5 pl-8 pr-7 text-sm text-ink-900 placeholder:text-ink-300 focus:border-brand-600 focus:outline-none focus:ring-2 focus:ring-brand-600/15" />
          {q && (
            <button type="button" onClick={() => setQ('')} aria-label="ล้างคำค้น" className="absolute right-2 top-1/2 -translate-y-1/2 text-ink-300 hover:text-ink-900">
              <X size={13} />
            </button>
          )}
        </div>

        <div className="mt-2 rounded-lg border border-[#edf1f7]">
          <label className="flex cursor-pointer items-center gap-2 border-b border-[#edf1f7] px-2.5 py-2 text-sm font-medium text-ink-900">
            <input ref={allBox} type="checkbox" checked={allOn} onChange={toggleShown} disabled={shown.length === 0} className="size-4 accent-brand-600" />
            {q ? 'เลือกทั้งหมดที่ค้นเจอ' : 'เลือกทั้งหมด'}
            <span className="ml-auto text-xs font-normal tabular-nums text-ink-500">{shown.length}</span>
          </label>
          <ul className="max-h-60 overflow-y-auto py-1">
            {shown.length === 0 ? (
              <li className="px-2.5 py-4 text-center text-xs text-ink-500">ไม่พบค่าที่ค้น</li>
            ) : shown.map(o => (
              <li key={o.value}>
                <label className="flex cursor-pointer items-center gap-2 px-2.5 py-1.5 text-sm text-ink-700 hover:bg-[#f7f9fc]">
                  <input type="checkbox" checked={draft.has(o.value)} onChange={() => toggle(o.value)} className="size-4 shrink-0 accent-brand-600" />
                  <span className="min-w-0 flex-1 truncate" title={o.value}>{o.value}</span>
                  <span className="shrink-0 text-xs tabular-nums text-ink-300">{o.count}</span>
                </label>
              </li>
            ))}
          </ul>
        </div>
        <p className="mt-1.5 text-[11px] text-ink-500">
          {draft.size === 0 ? 'ไม่ติ๊ก = แสดงทุกค่า' : `เลือกไว้ ${draft.size} ค่า`}
        </p>
      </div>
      <div className="flex items-center gap-2 border-t border-[#edf1f7] px-2.5 py-2">
        <button type="button" onClick={() => onApply([])} disabled={draft.size === 0 && selected.length === 0}
          className="mr-auto rounded px-1 text-sm font-medium text-ink-500 hover:text-rose-700 disabled:text-ink-300">
          ล้างตัวกรอง
        </button>
        <button type="button" onClick={onClose} className={buttonClass('secondary', 'sm', 'min-h-8 px-3')}>ยกเลิก</button>
        <button type="button" onClick={() => onApply([...draft])} className={buttonClass('primary', 'sm', 'min-h-8 px-3.5')}>ตกลง</button>
      </div>
    </div>,
    document.body,
  );
}
