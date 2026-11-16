'use client';

import { useEffect, useId, useRef, useState } from 'react';
import { PencilLine } from 'lucide-react';
import { Popover, PopoverAnchor, PopoverContent } from '@/components/ui/popover';
import { searchTrucks, type TruckOption } from '@/app/finance/petty-api';
import { highlightParts, stepIndex } from '@/lib/finance/petty-truck-search';
import { FIELD, FIELD_SM } from './ui';

/** เลือกรถจาก master เท่านั้น — พิมพ์เองไม่ได้ เพราะด่านซ้ำเข้มใช้เบอร์รถ+ทะเบียนเป็นคีย์
 *  ค้นแบบ autocomplete: พิมพ์ส่วนไหนของเบอร์รถหรือทะเบียนก็ได้ ไม่ต้องใส่จุด/ขีด (BE จับคู่และเรียงให้)
 *  รายการลอยอยู่เหนือหน้า (Popover พอร์ทัล) จึงไม่โดนกล่องตารางที่เลื่อนแนวนอนตัดขอบ */
export function TruckPicker({ code, plate, fleet, lineNo, readOnly = false, block = false, onPick }: {
  code: string;
  plate: string;
  /** ฟลีท ณ วันทำรายการ (ATMS) — แสดงเป็นป้ายในกล่องรถ */
  fleet?: string | null;
  lineNo: number;
  readOnly?: boolean;
  /** เต็มความกว้างแบบช่องกรอก (หัวใบ) — ไม่ระบุ = ขนาดในตาราง */
  block?: boolean;
  onPick: (truck: TruckOption) => void;
}) {
  const [query, setQuery] = useState('');
  const [options, setOptions] = useState<TruckOption[] | null>(null);
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(-1);
  const input = useRef<HTMLInputElement>(null);
  const listId = useId();
  const typed = query.trim();

  useEffect(() => {
    setActive(-1);
    if (typed.length < 2) { setOptions(null); return; }
    setOptions(null);
    const timer = setTimeout(() => {
      searchTrucks(typed).then(setOptions).catch(() => setOptions([]));
    }, 200);
    return () => clearTimeout(timer);
  }, [typed]);

  function pick(truck: TruckOption) {
    onPick(truck);
    setOpen(false);
    setQuery('');
  }

  function onKey(event: React.KeyboardEvent<HTMLInputElement>) {
    const list = options ?? [];
    if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
      event.preventDefault();
      setOpen(true);
      setActive(i => stepIndex(i, event.key === 'ArrowDown' ? 1 : -1, list.length));
    } else if (event.key === 'Enter') {
      if (!open || list.length === 0) return;
      event.preventDefault(); // ไม่ให้ Enter ไปส่งฟอร์ม
      pick(list[active >= 0 ? active : 0]);
    } else if (event.key === 'Escape') {
      setOpen(false);
    }
  }

  if (readOnly || (code && !open)) {
    // กล่องรถที่เลือกแล้ว: บรรทัดเดียวเสมอ (ผู้ใช้สั่ง 16/11/2026) เบอร์รถ · ทะเบียน (ตัดท้ายถ้ายาว) · ป้ายฟลีท · ปุ่มดินสอ
    const tip = [code, plate, fleet].filter(Boolean).join(' · ');
    const badge = !!fleet && (
      <span className="shrink-0 rounded-full bg-[#eef2f8] px-1.5 text-[10.5px] font-medium leading-[18px] text-ink-700">{fleet}</span>
    );
    if (!readOnly) {
      return (
        <div title={tip} className={`${block ? FIELD : `${FIELD_SM} h-9`} flex w-full min-w-0 items-center gap-1.5`}>
          <span className="shrink-0 font-semibold text-ink-900">{code}</span>
          {plate && <span className="min-w-0 truncate whitespace-nowrap text-xs text-ink-500">{plate}</span>}
          {badge}
          <button type="button" onClick={() => { setOpen(true); setQuery(code); requestAnimationFrame(() => input.current?.select()); }}
            aria-label={`เปลี่ยนรถ${lineNo ? ` แถวที่ ${lineNo}` : ''}`} title="เปลี่ยนรถ"
            className="ml-auto inline-flex size-6 shrink-0 items-center justify-center rounded text-ink-500 transition-colors hover:bg-[#eef2f8] hover:text-ink-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-600/30">
            <PencilLine className="h-3.5 w-3.5" />
          </button>
        </div>
      );
    }
    return (
      <span title={tip} className="inline-flex min-w-0 max-w-full items-center gap-1.5 text-sm">
        <span className="shrink-0 font-medium text-ink-900">{code || '—'}</span>
        {plate && <span className="min-w-0 truncate text-ink-500">{plate}</span>}
        {badge}
      </span>
    );
  }

  const showList = open && typed.length >= 1;
  const list = options ?? [];

  return (
    <Popover open={showList} onOpenChange={next => { if (!next) setOpen(false); }}>
      <PopoverAnchor asChild>
        <input ref={input} value={query} autoComplete="off"
          onChange={e => { setQuery(e.target.value); setOpen(true); }}
          onFocus={() => setOpen(true)} onKeyDown={onKey}
          placeholder="พิมพ์เบอร์รถหรือทะเบียน"
          role="combobox" aria-expanded={showList} aria-controls={listId} aria-autocomplete="list"
          aria-activedescendant={active >= 0 ? `${listId}-${active}` : undefined}
          aria-label={lineNo ? `ค้นรถ แถวที่ ${lineNo}` : 'ค้นรถ'}
          className={block ? FIELD : `${FIELD_SM} h-9 w-full`} />
      </PopoverAnchor>
      <PopoverContent align="start" sideOffset={4} collisionPadding={12}
        onOpenAutoFocus={e => e.preventDefault()} onCloseAutoFocus={e => e.preventDefault()}
        onInteractOutside={e => { if (input.current?.contains(e.target as Node)) e.preventDefault(); }}
        className="w-80 max-w-[calc(100vw-24px)] overflow-hidden rounded-[10px] border border-[#dbe4f3] bg-white p-0 shadow-[0_12px_28px_-12px_rgba(15,39,72,0.25)]">
        {typed.length < 2 ? (
          <p className="px-3 py-2 text-sm text-ink-500">พิมพ์อย่างน้อย 2 ตัว เบอร์รถหรือทะเบียนส่วนไหนก็ได้ เช่น 1093 หรือ 1325</p>
        ) : options === null ? (
          <p className="px-3 py-2 text-sm text-ink-500">กำลังค้น…</p>
        ) : list.length === 0 ? (
          <div className="px-3 py-2 text-sm">
            <p className="text-ink-700">ไม่พบรถที่มี “{typed}” ในเบอร์รถหรือทะเบียน</p>
            <p className="mt-0.5 text-xs text-ink-500">รถใหม่ที่ยังไม่อยู่ใน master ของ ATMS ต้องเพิ่มที่นั่นก่อน แล้วค้นอีกครั้ง</p>
          </div>
        ) : (
          <>
            <ul id={listId} role="listbox" aria-label="รถที่ตรงกับคำค้น" className="max-h-64 overflow-auto py-1 text-sm">
              {list.map((t, i) => (
                <li key={`${t.truck_code}-${t.truck_plate}`} id={`${listId}-${i}`} role="option" aria-selected={i === active}>
                  <button type="button" onMouseDown={e => e.preventDefault()} onClick={() => pick(t)}
                    onMouseEnter={() => setActive(i)}
                    className={`flex w-full items-baseline gap-2 px-3 py-2 text-left ${i === active ? 'bg-[#f3f7fd]' : 'hover:bg-[#f3f7fd]'}`}>
                    <Marked className="min-w-14 font-semibold text-ink-900" text={t.truck_code} query={typed} />
                    {t.truck_plate && <Marked className="text-ink-700" text={t.truck_plate} query={typed} />}
                    {t.truck_type && <span className="ml-auto text-xs text-ink-500">{t.truck_type}</span>}
                  </button>
                </li>
              ))}
            </ul>
            <p className="border-t border-[#edf1f7] px-3 py-1.5 text-xs text-ink-500">↑ ↓ เลือก · Enter ใช้คันนี้ · Esc ปิด</p>
          </>
        )}
      </PopoverContent>
    </Popover>
  );
}

/** ข้อความที่ส่วนตรงกับคำค้นเป็นตัวหนาสีแบรนด์ */
function Marked({ text, query, className }: { text: string; query: string; className?: string }) {
  return (
    <span className={className}>
      {highlightParts(text, query).map((part, i) => part.hit
        ? <mark key={i} className="rounded-sm bg-amber-100 px-0.5 font-semibold text-ink-900">{part.text}</mark>
        : <span key={i}>{part.text}</span>)}
    </span>
  );
}
