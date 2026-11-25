'use client';

import { useState } from 'react';
import type { PettySpec } from '@/app/finance/types-petty';
import type { PettyItemDraft } from '@/lib/finance/petty-items';
import { blankItem } from '@/lib/finance/petty-spec';
import { Button, FIELD, LABEL } from './ui';

const MAX_ROWS = 20;

/** เพิ่มหลายรายการของประเภทที่ไม่ผูกกับรถ (ค่าใช้จ่ายทั่วไป · 25/11/2026): ใส่จำนวนแถวกับวันที่ แล้วกรอกรายละเอียดต่อในตาราง */
export function AddManyRowsDialog({ spec, onClose, onAdd }: {
  spec: PettySpec;
  onClose: () => void;
  onAdd: (rows: (PettyItemDraft & Record<string, unknown>)[]) => void;
}) {
  const [count, setCount] = useState('3');
  const [eventDate, setEventDate] = useState('');
  const n = Math.floor(Number(count));
  const valid = Number.isFinite(n) && n >= 1 && n <= MAX_ROWS;

  function submit() {
    const rows = Array.from({ length: n }, () => ({
      ...(blankItem(spec) as Record<string, unknown>),
      ...(eventDate ? { event_date: eventDate } : {}),
    })) as (PettyItemDraft & Record<string, unknown>)[];
    onAdd(rows);
    onClose();
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-ink-900/30 p-0 sm:items-center sm:p-4" role="dialog" aria-modal="true" aria-labelledby="add-rows-title">
      <div className="w-full max-w-md rounded-t-2xl bg-white p-5 shadow-xl sm:rounded-2xl sm:p-6">
        <h2 id="add-rows-title" className="font-display text-base font-semibold text-ink-900">เพิ่มหลายรายการ</h2>
        <p className="mt-1 text-xs text-ink-500">สร้างแถวว่างตามจำนวนที่ใส่ แล้วกรอกรายละเอียดแต่ละแถวต่อในตาราง</p>
        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          <label className="block"><span className={LABEL}>จำนวนรายการ</span>
            <input value={count} onChange={e => setCount(e.target.value)} inputMode="numeric" className={`${FIELD} text-right`} />
          </label>
          <label className="block"><span className={LABEL}>วันที่ (ใช้ทุกแถว ไม่บังคับ)</span>
            <input type="date" value={eventDate} onChange={e => setEventDate(e.target.value)} className={FIELD} />
          </label>
        </div>
        <div className="mt-5 flex flex-wrap items-center justify-between gap-3">
          <span className={`text-xs ${valid ? 'text-ink-500' : 'text-rose-600'}`}>
            {valid ? `จะสร้าง ${n} แถว` : `ใส่จำนวน 1–${MAX_ROWS} แถว`}
          </span>
          <div className="flex gap-2">
            <Button onClick={onClose}>ยกเลิก</Button>
            <Button tone="primary" onClick={submit} disabled={!valid}>สร้างแถว</Button>
          </div>
        </div>
      </div>
    </div>
  );
}
