'use client';

import { useEffect, useRef, useState } from 'react';
import { searchTrucks, type TruckOption } from '@/app/finance/petty-api';

/** เลือกรถจาก master เท่านั้น — พิมพ์เองไม่ได้ เพราะด่านซ้ำเข้มใช้เบอร์รถ+ทะเบียนเป็นคีย์
 *  ถ้าหาไม่เจอ ให้ไปเพิ่มใน master ก่อน (ใบจริงมี F014/F016 ที่อาจยังไม่มีในระบบ) */
export function TruckPicker({ code, plate, lineNo, readOnly = false, onPick }: {
  code: string;
  plate: string;
  lineNo: number;
  readOnly?: boolean;
  onPick: (truck: TruckOption) => void;
}) {
  const [query, setQuery] = useState('');
  const [options, setOptions] = useState<TruckOption[] | null>(null);
  const [open, setOpen] = useState(false);
  const box = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (query.trim().length < 2) { setOptions(null); return; }
    const timer = setTimeout(() => {
      searchTrucks(query.trim()).then(setOptions).catch(() => setOptions([]));
    }, 300);
    return () => clearTimeout(timer);
  }, [query]);

  useEffect(() => {
    function away(event: MouseEvent) {
      if (box.current && !box.current.contains(event.target as Node)) setOpen(false);
    }
    document.addEventListener('mousedown', away);
    return () => document.removeEventListener('mousedown', away);
  }, []);

  if (readOnly || (code && !open)) {
    return (
      <span className="inline-flex items-center gap-1 text-sm">
        <span className="font-medium">{code || '—'}</span>
        {plate && <span className="text-ink-400">({plate})</span>}
        {!readOnly && (
          <button type="button" onClick={() => { setOpen(true); setQuery(code); }}
            className="ml-1 text-xs text-brand-700 hover:underline">เปลี่ยน</button>
        )}
      </span>
    );
  }

  return (
    <div ref={box} className="relative">
      <input value={query} onChange={e => { setQuery(e.target.value); setOpen(true); }}
        onFocus={() => setOpen(true)} placeholder="ค้นเบอร์รถหรือทะเบียน"
        aria-label={`ค้นรถ แถวที่ ${lineNo}`}
        className="w-44 rounded-lg border border-slate-200 px-2 py-1" />
      {open && query.trim().length >= 2 && (
        <div className="absolute z-20 mt-1 max-h-56 w-64 overflow-auto rounded-lg border border-slate-200 bg-white shadow-lg">
          {options === null ? (
            <p className="px-3 py-2 text-sm text-ink-400">กำลังค้น…</p>
          ) : options.length === 0 ? (
            <p className="px-3 py-2 text-sm text-ink-500">
              ไม่พบรถคันนี้ใน master — ให้เพิ่มใน master ก่อน แล้วค้นอีกครั้ง
            </p>
          ) : (
            <ul className="text-sm">
              {options.map(t => (
                <li key={`${t.truck_code}-${t.truck_plate}`}>
                  <button type="button" onClick={() => { onPick(t); setOpen(false); setQuery(''); }}
                    className="block w-full px-3 py-1.5 text-left hover:bg-slate-50">
                    <span className="font-medium">{t.truck_code}</span>
                    {t.truck_plate && <span className="ml-1 text-ink-500">{t.truck_plate}</span>}
                    {t.truck_type && <span className="ml-1 text-xs text-ink-400">{t.truck_type}</span>}
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}
