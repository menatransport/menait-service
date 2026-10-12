'use client';

import { useState } from 'react';
import type { PettySpec } from '@/app/finance/types-petty';
import { parseTruckPaste, type PettyItemDraft } from '@/lib/finance/petty-items';
import { blankItem, itemFields } from '@/lib/finance/petty-spec';

/** ของจริงมี 16 แถว ถ้ากรอกทีละช่องคงไม่มีใครใช้ — วางรหัสรถรวดเดียวแล้วเติมเลขบัตรทีหลัง */
export function AddManyTrucksDialog({ spec, onClose, onAdd }: {
  spec: PettySpec;
  onClose: () => void;
  onAdd: (rows: (PettyItemDraft & Record<string, unknown>)[]) => void;
}) {
  const [raw, setRaw] = useState('');
  const [eventDate, setEventDate] = useState('');
  const [rate, setRate] = useState('');
  const [truckType, setTruckType] = useState('');

  const typeField = itemFields(spec).find(f => f.key === 'truck_type');
  const codes = parseTruckPaste(raw);

  function submit() {
    const rows = codes.map(code => ({
      ...(blankItem(spec) as Record<string, unknown>),
      truck_code: code,
      truck_plate: '',
      event_date: eventDate,
      rate,
      ...(typeField ? { truck_type: truckType } : {}),
    })) as (PettyItemDraft & Record<string, unknown>)[];
    onAdd(rows);
    onClose();
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 p-4">
      <div className="w-full max-w-lg rounded-2xl bg-white p-5 shadow-xl">
        <h2 className="text-lg font-medium">เพิ่มหลายคัน</h2>
        <p className="mt-1 text-sm text-ink-500">
          วางรหัสรถคั่นด้วยเว้นวรรคหรือจุลภาค เช่น 161 144 F014 F016 — ระบบสร้างแถวให้ทุกคัน
          ด้วยวันที่กับราคาเดียวกัน แล้วค่อยเติมเลขที่บัตรชั่งทีละแถว
        </p>
        <textarea value={raw} onChange={e => setRaw(e.target.value)} rows={4}
          placeholder="161 144 F014 F016"
          className="mt-3 w-full rounded-lg border border-slate-200 p-2 font-mono text-sm" />
        <div className="mt-3 grid gap-2 sm:grid-cols-3">
          <label className="text-sm">วันที่
            <input type="date" value={eventDate} onChange={e => setEventDate(e.target.value)}
              className="mt-1 w-full rounded-lg border border-slate-200 px-2 py-1.5" />
          </label>
          <label className="text-sm">ราคา/ครั้ง
            <input value={rate} onChange={e => setRate(e.target.value)} inputMode="decimal"
              className="mt-1 w-full rounded-lg border border-slate-200 px-2 py-1.5 text-right" />
          </label>
          {typeField && (
            <label className="text-sm">{typeField.label}
              <select value={truckType} onChange={e => setTruckType(e.target.value)}
                className="mt-1 w-full rounded-lg border border-slate-200 px-2 py-1.5">
                <option value="">เลือก</option>
                {(typeField.options ?? []).map(o => <option key={o} value={o}>{o}</option>)}
              </select>
            </label>
          )}
        </div>
        <div className="mt-4 flex items-center justify-between">
          <span className="text-sm text-ink-500">
            {codes.length > 0 ? `จะสร้าง ${codes.length} แถว` : 'ยังไม่ได้วางรหัสรถ'}
          </span>
          <div className="flex gap-2">
            <button type="button" onClick={onClose}
              className="rounded-lg border border-slate-200 px-3 py-1.5 text-sm">ยกเลิก</button>
            <button type="button" onClick={submit} disabled={codes.length === 0 || !eventDate || !rate}
              className="rounded-lg bg-brand-600 px-3 py-1.5 text-sm text-white disabled:opacity-40">
              สร้างแถว
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
