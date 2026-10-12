'use client';

import type { PettySpecField } from '@/app/finance/types-petty';
import { TruckPicker } from './TruckPicker';

/** ช่องหัวใบหนึ่งช่อง เรนเดอร์ตามชนิดที่ spec บอก — เพิ่มชนิดใหม่ต้องเพิ่มที่นี่ที่เดียว */
export function HeaderField({ field, value, form, onChange }: {
  field: PettySpecField;
  value: unknown;
  form: Record<string, unknown>;
  onChange: (patch: Record<string, unknown>) => void;
}) {
  const label = (
    <>
      {field.label}
      {field.required && <span className="text-rose-500"> *</span>}
    </>
  );
  const box = 'mt-1 w-full rounded-lg border border-slate-200 px-2 py-1.5';

  if (field.type === 'truck') {
    return (
      <label className="text-sm">{label}
        <div className="mt-1">
          <TruckPicker lineNo={0}
            code={String(form.truck_code ?? '')} plate={String(form.truck_plate ?? '')}
            onPick={truck => onChange({
              truck_code: truck.truck_code,
              truck_plate: truck.truck_plate,
              truck_type: truck.truck_type || form.truck_type,
            })} />
        </div>
      </label>
    );
  }

  if (field.type === 'select') {
    return (
      <label className="text-sm">{label}
        <select value={String(value ?? '')} className={box}
          onChange={e => onChange({ [field.key]: e.target.value })}>
          <option value="">เลือก</option>
          {(field.options ?? []).map(option => <option key={option} value={option}>{option}</option>)}
        </select>
      </label>
    );
  }

  return (
    <label className="text-sm">{label}
      <input value={String(value ?? '')} className={box}
        type={field.type === 'date' ? 'date' : 'text'}
        inputMode={field.type === 'money' || field.type === 'number' ? 'decimal' : undefined}
        placeholder={field.type === 'employee' ? 'ชื่อ-สกุล' : undefined}
        onChange={e => onChange({ [field.key]: e.target.value })} />
    </label>
  );
}
