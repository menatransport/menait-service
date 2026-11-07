'use client';

import { useEffect, useId, useRef, useState } from 'react';
import { Popover, PopoverAnchor, PopoverContent } from '@/components/ui/popover';
import { searchDrivers, type DriverOption } from '@/app/finance/petty-api';
import { stepIndex } from '@/lib/finance/petty-truck-search';
import { FIELD, FIELD_SM } from './ui';

/** ช่องชื่อคนขับ พิมพ์เองได้ แต่มีรายชื่อจาก master แนะนำ (รายงานรถประจำวัน ATMS ช่วง 45 วันก่อนวันทำรายการ)
 *  เลือกแล้วเติม พจส./พจร. ฟลีท (Mixer L / Mixer S / Trailer / Side curtain) และรถที่ขับให้เป็นค่าแนะนำ (ผู้ใช้สั่ง 7/11/2026 ข้อ 7)
 *  ไม่พบใน master ก็พิมพ์ชื่อเองได้ — ชื่อยังเป็นช่องข้อความเหมือนเดิม */
export function DriverPicker({ value, date, lineNo, block = false, onChange, onPick }: {
  value: string;
  /** วันที่ทำรายการของแถว — master ดูรถ/ฟลีทใกล้วันนั้น */
  date?: string | null;
  lineNo: number;
  block?: boolean;
  onChange: (text: string) => void;
  onPick: (driver: DriverOption) => void;
}) {
  const [options, setOptions] = useState<DriverOption[] | null>(null);
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(-1);
  const input = useRef<HTMLInputElement>(null);
  const listId = useId();
  const typed = value.trim();

  useEffect(() => {
    setActive(-1);
    if (!open || typed.length < 2) { setOptions(null); return; }
    setOptions(null);
    const timer = setTimeout(() => {
      searchDrivers(typed, date).then(setOptions).catch(() => setOptions([]));
    }, 250);
    return () => clearTimeout(timer);
  }, [typed, date, open]);

  function pick(driver: DriverOption) {
    onPick(driver);
    setOpen(false);
  }

  function onKey(event: React.KeyboardEvent<HTMLInputElement>) {
    const list = options ?? [];
    if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
      event.preventDefault();
      setOpen(true);
      setActive(i => stepIndex(i, event.key === 'ArrowDown' ? 1 : -1, list.length));
    } else if (event.key === 'Enter') {
      if (!open || list.length === 0 || active < 0) return;
      event.preventDefault();
      pick(list[active]);
    } else if (event.key === 'Escape') {
      setOpen(false);
    }
  }

  const showList = open && typed.length >= 2;
  const list = options ?? [];

  return (
    <Popover open={showList} onOpenChange={next => { if (!next) setOpen(false); }}>
      <PopoverAnchor asChild>
        <input ref={input} value={value} autoComplete="off"
          onChange={e => { onChange(e.target.value); setOpen(true); }}
          onFocus={() => setOpen(true)} onKeyDown={onKey}
          placeholder="ชื่อหรือรหัสคนขับ"
          role="combobox" aria-expanded={showList} aria-controls={listId} aria-autocomplete="list"
          aria-activedescendant={active >= 0 ? `${listId}-${active}` : undefined}
          aria-label={lineNo ? `ชื่อคนขับ แถวที่ ${lineNo}` : 'ชื่อคนขับ'}
          className={block ? FIELD : `${FIELD_SM} h-9 w-full`} />
      </PopoverAnchor>
      <PopoverContent align="start" sideOffset={4} collisionPadding={12}
        onOpenAutoFocus={e => e.preventDefault()} onCloseAutoFocus={e => e.preventDefault()}
        onInteractOutside={e => { if (input.current?.contains(e.target as Node)) e.preventDefault(); }}
        className="w-96 max-w-[calc(100vw-24px)] overflow-hidden rounded-[10px] border border-[#dbe4f3] bg-white p-0 shadow-[0_12px_28px_-12px_rgba(15,39,72,0.25)]">
        {options === null ? (
          <p className="px-3 py-2 text-sm text-ink-500">กำลังค้นใน master คนขับ…</p>
        ) : list.length === 0 ? (
          <div className="px-3 py-2 text-sm">
            <p className="text-ink-700">ไม่พบ “{typed}” ในรายงานรถประจำวัน 45 วันล่าสุด</p>
            <p className="mt-0.5 text-xs text-ink-500">พิมพ์ชื่อต่อได้เลย แล้วเลือก พจส./พจร. เอง</p>
          </div>
        ) : (
          <ul id={listId} role="listbox" aria-label="คนขับที่ตรงกับคำค้น" className="max-h-64 overflow-auto py-1 text-sm">
            {list.map((d, i) => (
              <li key={`${d.driver_code}-${d.driver_name}`} id={`${listId}-${i}`} role="option" aria-selected={i === active}>
                <button type="button" onMouseDown={e => e.preventDefault()} onClick={() => pick(d)}
                  onMouseEnter={() => setActive(i)}
                  className={`flex w-full flex-wrap items-baseline gap-x-2 px-3 py-2 text-left ${i === active ? 'bg-[#f3f7fd]' : 'hover:bg-[#f3f7fd]'}`}>
                  <span className="font-semibold text-ink-900">{d.driver_name ?? d.driver_code}</span>
                  {d.driver_role && <span className="rounded bg-[#eef2f8] px-1.5 text-xs font-medium text-ink-700">{d.driver_role}</span>}
                  <span className="ml-auto text-xs text-ink-500">
                    {[d.fleet, d.truck_code, d.truck_plate].filter(Boolean).join(' · ')}
                  </span>
                </button>
              </li>
            ))}
          </ul>
        )}
      </PopoverContent>
    </Popover>
  );
}
