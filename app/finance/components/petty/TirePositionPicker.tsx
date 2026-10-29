'use client';

import { useEffect, useRef, useState } from 'react';
import { parsePositions, positionCountHint, SPARE_TIRES, TIRE_AXLES, togglePosition } from '@/lib/finance/tire-positions';

/**
 * เลือกตำแหน่งยางจากผังล้อ (ผังเดียวกับ WMS) — หนึ่งแถวของใบยางเลือกได้หลายล้อ
 * ค่าเก็บเป็นรหัสคั่นด้วย , · จำนวนล้อไม่ตรงจำนวนเส้นจะเตือน แต่ไม่บล็อก
 */
export function TirePositionPicker({ value, qty, onChange, readOnly = false, missing = false, label }: {
  value: string;
  qty?: number | string | null;
  onChange: (next: string) => void;
  readOnly?: boolean;
  missing?: boolean;
  label: string;
}) {
  const [open, setOpen] = useState(false);
  // ตารางรายการเลื่อนแนวนอนได้ (overflow) กล่อง absolute จะโดนตัด จึงวางแบบ fixed ตามตำแหน่งปุ่ม
  const [at, setAt] = useState<{ top: number; left: number } | null>(null);
  const box = useRef<HTMLDivElement>(null);
  const trigger = useRef<HTMLButtonElement>(null);
  const picked = parsePositions(value);
  const hint = positionCountHint(value, qty);

  useEffect(() => {
    if (!open) return;
    const close = (e: MouseEvent) => { if (box.current && !box.current.contains(e.target as Node)) setOpen(false); };
    const hide = () => setOpen(false);
    document.addEventListener('mousedown', close);
    window.addEventListener('resize', hide);
    window.addEventListener('scroll', hide, true);
    return () => {
      document.removeEventListener('mousedown', close);
      window.removeEventListener('resize', hide);
      window.removeEventListener('scroll', hide, true);
    };
  }, [open]);

  function toggle() {
    const r = trigger.current?.getBoundingClientRect();
    if (r) setAt({ top: r.bottom + 4, left: Math.max(8, Math.min(r.left, window.innerWidth - 272)) });
    setOpen(v => !v);
  }

  if (readOnly) return <span className="text-sm">{picked.length ? picked.join(', ') : '-'}</span>;

  const wheel = (code: string) => {
    const on = picked.includes(code);
    return (
      <button key={code} type="button" onClick={() => onChange(togglePosition(value, code))} aria-pressed={on}
        className={`h-8 w-11 rounded-md border text-[11px] font-semibold transition-colors ${on ? 'border-brand-600 bg-brand-600 text-white' : 'border-slate-200 bg-white text-ink-700 hover:border-brand-300'}`}>
        {code}
      </button>
    );
  };

  return (
    <div ref={box} className="relative">
      <button ref={trigger} type="button" onClick={toggle} aria-label={label} aria-expanded={open}
        className={`w-36 truncate rounded-lg border px-2 py-1 text-left ${missing ? 'border-rose-300' : 'border-slate-200'} ${picked.length ? '' : 'text-ink-400'}`}>
        {picked.length ? picked.join(', ') : 'เลือกตำแหน่ง'}
      </button>
      {hint && <p className="mt-0.5 text-[11px] text-amber-700">{hint}</p>}
      {open && at && (
        <div style={{ position: 'fixed', top: at.top, left: at.left }}
          className="z-50 w-64 rounded-xl border border-slate-200 bg-white p-3 shadow-lg">
          <p className="mb-2 text-center text-[11px] text-ink-400">หัวรถ</p>
          <div className="space-y-1.5">
            {TIRE_AXLES.map(axle => (
              <div key={axle.label} className="flex items-center justify-between gap-2">
                <span className="flex gap-1">{axle.left.map(wheel)}</span>
                <span className="text-[10px] text-ink-400">{axle.label}</span>
                <span className="flex gap-1">{axle.right.map(wheel)}</span>
              </div>
            ))}
          </div>
          <div className="mt-2 flex items-center justify-center gap-2 border-t border-slate-100 pt-2">
            <span className="text-[10px] text-ink-400">ยางอะไหล่</span>{SPARE_TIRES.map(wheel)}
          </div>
          <div className="mt-2 flex justify-end">
            <button type="button" onClick={() => setOpen(false)} className="rounded-lg bg-brand-600 px-3 py-1 text-xs font-medium text-white">เสร็จ</button>
          </div>
        </div>
      )}
    </div>
  );
}
