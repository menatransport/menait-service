'use client';

import { useState } from 'react';
import type { PettySpec } from '@/app/finance/types-petty';
import { searchTrucks } from '@/app/finance/petty-api';
import { parseTruckPaste, type PettyItemDraft } from '@/lib/finance/petty-items';
import { blankItem, itemFields } from '@/lib/finance/petty-spec';
import { Button, FIELD, LABEL, Notice } from './ui';

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

  const [resolving, setResolving] = useState(false);
  const [unknown, setUnknown] = useState<string[]>([]);

  async function submit() {
    setResolving(true);
    // เติมทะเบียนจาก master ให้ทุกคัน — ด่านซ้ำเข้มใช้เบอร์รถ+ทะเบียนเป็นคีย์ จะปล่อยว่างไม่ได้
    const found = new Map<string, { truck_plate: string; truck_type: string }>();
    const missing: string[] = [];
    for (const code of new Set(codes)) {
      try {
        const options = await searchTrucks(code);
        const hit = options.find(o => o.truck_code === code);
        if (hit) found.set(code, { truck_plate: hit.truck_plate, truck_type: hit.truck_type });
        else missing.push(code);
      } catch { missing.push(code); }
    }
    setResolving(false);
    if (missing.length) { setUnknown(missing); return; }

    const rows = codes.map(code => ({
      ...(blankItem(spec) as Record<string, unknown>),
      truck_code: code,
      truck_plate: found.get(code)?.truck_plate ?? '',
      event_date: eventDate,
      rate,
      ...(typeField ? { truck_type: truckType || found.get(code)?.truck_type || '' } : {}),
    })) as (PettyItemDraft & Record<string, unknown>)[];
    onAdd(rows);
    onClose();
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-ink-900/30 p-0 sm:items-center sm:p-4" role="dialog" aria-modal="true" aria-labelledby="add-many-title">
      <div className="w-full max-w-lg rounded-t-2xl bg-white p-5 shadow-xl sm:rounded-2xl sm:p-6">
        <h2 id="add-many-title" className="font-display text-base font-semibold text-ink-900">เพิ่มหลายคัน</h2>
        <p className="mt-1 text-xs text-ink-500">วางรหัสรถคั่นด้วยเว้นวรรคหรือจุลภาค — สร้างแถวด้วยวันที่และราคาเดียวกัน</p>
        <label className="mt-4 block">
          <span className={LABEL}>รหัสรถ</span>
          <textarea value={raw} onChange={e => setRaw(e.target.value)} rows={4}
            placeholder="161 144 F014 F016"
            className={`${FIELD} font-mono`} />
        </label>
        <div className="mt-3 grid gap-3 sm:grid-cols-3">
          <label className="block"><span className={LABEL}>วันที่</span>
            <input type="date" value={eventDate} onChange={e => setEventDate(e.target.value)} className={FIELD} />
          </label>
          <label className="block"><span className={LABEL}>ราคา/ครั้ง</span>
            <input value={rate} onChange={e => setRate(e.target.value)} inputMode="decimal" className={`${FIELD} text-right`} />
          </label>
          {typeField && (
            <label className="block"><span className={LABEL}>{typeField.label}</span>
              <select value={truckType} onChange={e => setTruckType(e.target.value)} className={FIELD}>
                <option value="">เลือก</option>
                {(typeField.options ?? []).map(o => <option key={o} value={o}>{o}</option>)}
              </select>
            </label>
          )}
        </div>
        {unknown.length > 0 && (
          <div className="mt-3"><Notice tone="error">ไม่พบรถใน master: {unknown.join(', ')}</Notice></div>
        )}
        <div className="mt-5 flex flex-wrap items-center justify-between gap-3">
          <span className="text-xs text-ink-500">
            {codes.length > 0 ? `จะสร้าง ${codes.length} แถว` : 'ยังไม่ได้วางรหัสรถ'}
          </span>
          <div className="flex gap-2">
            <Button onClick={onClose}>ยกเลิก</Button>
            <Button tone="primary" onClick={() => void submit()}
              disabled={resolving || codes.length === 0 || !eventDate || !rate}>
              {resolving ? 'กำลังหาทะเบียน…' : 'สร้างแถว'}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
