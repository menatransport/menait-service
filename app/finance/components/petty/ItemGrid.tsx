'use client';

import { Plus, Trash2, Truck } from 'lucide-react';
import type { PettySpec } from '@/app/finance/types-petty';
import { claimTotal, lineAmount, type PettyItemDraft } from '@/lib/finance/petty-items';
import { blankItem, itemFields } from '@/lib/finance/petty-spec';
import { TirePositionPicker } from './TirePositionPicker';
import { TruckPicker } from './TruckPicker';

type Row = PettyItemDraft & Record<string, unknown>;

export type DupHint = { line_no: number; level: 'hard' | 'soft'; message: string; form_id?: string | null };

export function ItemGrid({ spec, rows, onChange, onAddMany, dups = [], readOnly = false }: {
  spec: PettySpec;
  rows: Row[];
  onChange: (rows: Row[]) => void;
  onAddMany?: () => void;
  dups?: DupHint[];
  readOnly?: boolean;
}) {
  // 'truck' มีคอลัมน์ของตัวเอง ส่วนช่องอื่น (รวม qty ถ้าประเภทนั้นประกาศไว้) เรนเดอร์ตามลำดับใน spec
  const fields = itemFields(spec).filter(f => f.key !== 'truck');
  const hasTruck = itemFields(spec).some(f => f.key === 'truck');
  const total = claimTotal(rows);

  function setCell(index: number, key: string, value: unknown) {
    onChange(rows.map((r, i) => (i === index ? { ...r, [key]: value } : r)));
  }

  function hintFor(lineNo: number) {
    return dups.find(d => d.line_no === lineNo);
  }

  return (
    <div>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="text-left text-ink-500">
            <tr>
              <th className="w-10 py-2">#</th>
              {hasTruck && <th className="py-2">รถ</th>}
              {fields.map(f => (
                <th key={f.key} className="py-2">
                  {f.label}{f.required && <span className="text-rose-500"> *</span>}
                </th>
              ))}
              <th className="py-2 text-right">รวม</th>
              {!readOnly && <th className="w-10 py-2" />}
            </tr>
          </thead>
          <tbody>
            {rows.map((row, index) => {
              const hint = hintFor(index + 1);
              return (
                <tr key={index}
                  className={`border-t border-slate-100 ${
                    hint?.level === 'hard' ? 'bg-rose-50' : hint?.level === 'soft' ? 'bg-amber-50' : ''}`}>
                  <td className="py-1.5 text-ink-400">{index + 1}</td>
                  {hasTruck && (
                    <td className="py-1.5">
                      <TruckPicker lineNo={index + 1} readOnly={readOnly}
                        code={String(row.truck_code ?? '')} plate={String(row.truck_plate ?? '')}
                        onPick={truck => onChange(rows.map((r, i) => i === index
                          ? { ...r, truck_code: truck.truck_code, truck_plate: truck.truck_plate,
                              truck_type: truck.truck_type || r.truck_type }
                          : r))} />
                    </td>
                  )}
                  {fields.map(f => {
                    const value = String(row[f.key] ?? '');
                    const missing = !readOnly && f.required && value.trim() === '';
                    return (
                      <td key={f.key} className="py-1.5">
                        {f.type === 'tire_positions' ? (
                          <TirePositionPicker value={value} qty={row.qty as number | string | null | undefined}
                            readOnly={readOnly} missing={missing} label={`${f.label} แถวที่ ${index + 1}`}
                            onChange={next => setCell(index, f.key, next)} />
                        ) : f.type === 'select' ? (
                          <select value={value} disabled={readOnly}
                            onChange={e => setCell(index, f.key, e.target.value)}
                            aria-label={`${f.label} แถวที่ ${index + 1}`}
                            className={`rounded-lg border px-2 py-1 ${missing ? 'border-rose-300' : 'border-slate-200'}`}>
                            <option value="">เลือก</option>
                            {(f.options ?? []).map(o => <option key={o} value={o}>{o}</option>)}
                          </select>
                        ) : (
                          <input value={value} disabled={readOnly}
                            type={f.type === 'date' ? 'date' : 'text'}
                            inputMode={f.type === 'money' || f.type === 'number' ? 'decimal' : undefined}
                            onChange={e => setCell(index, f.key, e.target.value)}
                            aria-label={`${f.label} แถวที่ ${index + 1}`}
                            className={`rounded-lg border px-2 py-1 ${
                              f.type === 'money' ? 'w-24 text-right'
                              : f.type === 'number' ? 'w-20 text-right'
                              : 'w-36'} ${missing ? 'border-rose-300' : 'border-slate-200'}`} />
                        )}
                      </td>
                    );
                  })}
                  <td className="py-1.5 text-right tabular-nums">
                    {lineAmount(row.qty ?? 1, row.rate).toLocaleString('th-TH', { minimumFractionDigits: 2 })}
                  </td>
                  {!readOnly && (
                    <td className="py-1.5 text-right">
                      <button type="button" aria-label={`ลบแถวที่ ${index + 1}`}
                        onClick={() => onChange(rows.filter((_, i) => i !== index))}
                        className="text-ink-400 hover:text-rose-600">
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </td>
                  )}
                </tr>
              );
            })}
            {rows.length === 0 && (
              <tr><td colSpan={fields.length + 4} className="py-6 text-center text-ink-400">
                ยังไม่มีรายการ
              </td></tr>
            )}
          </tbody>
          <tfoot>
            <tr className="border-t-2 border-slate-200 font-medium">
              <td colSpan={fields.length + (hasTruck ? 2 : 1)} className="py-2 text-right">
                รวม {rows.length} รายการ
              </td>
              <td className="py-2 text-right tabular-nums">
                {total.toLocaleString('th-TH', { minimumFractionDigits: 2 })}
              </td>
              {!readOnly && <td />}
            </tr>
          </tfoot>
        </table>
      </div>

      {!readOnly && (
        <div className="mt-2 flex flex-wrap gap-2">
          <button type="button" onClick={() => onChange([...rows, blankItem(spec) as Row])}
            className="inline-flex items-center gap-1 rounded-lg border border-slate-200 px-3 py-1.5 text-sm">
            <Plus className="h-4 w-4" /> เพิ่มแถว
          </button>
          {onAddMany && (
            <button type="button" onClick={onAddMany}
              className="inline-flex items-center gap-1 rounded-lg border border-slate-200 px-3 py-1.5 text-sm">
              <Truck className="h-4 w-4" /> เพิ่มหลายคัน
            </button>
          )}
        </div>
      )}

      {dups.length > 0 && (
        <ul className="mt-3 space-y-1 text-sm">
          {dups.map((d, i) => (
            <li key={i} className={d.level === 'hard' ? 'text-rose-700' : 'text-amber-700'}>
              แถวที่ {d.line_no}: {d.message}
              {d.form_id && <> (ใบ {d.form_id})</>}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
