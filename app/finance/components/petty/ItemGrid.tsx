'use client';

import { Plus, Trash2, Truck } from 'lucide-react';
import type { PettySpec } from '@/app/finance/types-petty';
import { claimTotal, lineAmount, type PettyItemDraft } from '@/lib/finance/petty-items';
import { blankItem, itemFields } from '@/lib/finance/petty-spec';
import { TirePositionPicker } from './TirePositionPicker';
import { TruckPicker } from './TruckPicker';
import { Button, FIELD_SM, Req } from './ui';

type Row = PettyItemDraft & Record<string, unknown>;
type Field = ReturnType<typeof itemFields>[number];

export type DupHint = { line_no: number; level: 'hard' | 'soft'; message: string; form_id?: string | null };

const money = (n: number) => n.toLocaleString('th-TH', { minimumFractionDigits: 2 });
const TH = 'px-3 py-2.5 text-left text-xs font-medium text-ink-500 whitespace-nowrap';
/** มือถือ: แถวกลายเป็นการ์ดซ้อน (grid 2 คอลัมน์) · จอใหญ่: ตารางปกติ — DOM ชุดเดียว */
const CELL = 'sm:table-cell sm:px-3 sm:py-2 sm:align-middle';
const MOBILE_LABEL = 'mb-1 block text-[11px] font-medium text-ink-500 sm:hidden';
const CELL_LABEL = 'mb-1 block text-[11px] font-medium text-ink-500';

/**
 * รายการของใบเบิก
 * - กรอก (หน้าเปิดใบ): หนึ่งรายการ = หนึ่งบล็อก มีแถบหัว "รายการที่ n · รวม · ลบ" แล้วช่องเรียงเป็นกริดตัดบรรทัดเอง
 *   ไม่ต้องเลื่อนซ้ายขวาแม้ประเภทมีช่องเยอะ (ค่ายาง 11 ช่อง) — Bew 30/10/2026
 * - อ่านอย่างเดียว (หน้ารายละเอียด): ตารางปกติ อ่านเทียบกันหลายแถวได้
 */
export function ItemGrid({ spec, rows, onChange, onAddMany, dups = [], readOnly = false }: {
  spec: PettySpec;
  rows: Row[];
  onChange: (rows: Row[]) => void;
  onAddMany?: () => void;
  dups?: DupHint[];
  readOnly?: boolean;
}) {
  // 'truck' มีช่องของตัวเอง ส่วนช่องอื่น (รวม qty ถ้าประเภทนั้นประกาศไว้) เรนเดอร์ตามลำดับใน spec
  const fields = itemFields(spec).filter(f => f.key !== 'truck');
  const truckField = itemFields(spec).find(f => f.key === 'truck');
  const hasTruck = !!truckField;
  const total = claimTotal(rows);

  function setCell(index: number, key: string, value: unknown) {
    onChange(rows.map((r, i) => (i === index ? { ...r, [key]: value } : r)));
  }

  function hintFor(lineNo: number) {
    return dups.find(d => d.line_no === lineNo);
  }

  if (readOnly) {
    return (
      <div className="sm:overflow-x-auto sm:rounded-xl sm:border sm:border-[#edf1f7]">
        <table className="block w-full text-sm sm:table">
          <thead className="hidden border-b border-[#edf1f7] bg-[#f7f9fc] sm:table-header-group">
            <tr>
              <th className={`${TH} w-10`}>#</th>
              {hasTruck && <th className={TH}>รถ</th>}
              {fields.map(f => <th key={f.key} className={TH}>{f.label}</th>)}
              <th className={`${TH} text-right`}>รวม</th>
            </tr>
          </thead>
          <tbody className="block space-y-2 sm:table-row-group sm:space-y-0">
            {rows.map((row, index) => (
              <tr key={index}
                className="grid grid-cols-2 gap-x-3 gap-y-2.5 rounded-xl border border-[#edf1f7] p-3 sm:table-row sm:rounded-none sm:border-0 sm:border-b sm:border-[#f3f6fa] sm:p-0 sm:last:border-b-0">
                <td className={`col-span-2 text-xs text-ink-500 sm:text-sm sm:text-ink-300 ${CELL}`}>
                  <span className="sm:hidden">รายการที่ </span>{index + 1}
                </td>
                {hasTruck && (
                  <td className={`col-span-2 ${CELL}`}>
                    <span className={MOBILE_LABEL}>รถ</span>
                    <TruckPicker lineNo={index + 1} readOnly code={String(row.truck_code ?? '')}
                      plate={String(row.truck_plate ?? '')} onPick={() => {}} />
                  </td>
                )}
                {fields.map(f => {
                  const value = String(row[f.key] ?? '');
                  const numeric = f.type === 'money' || f.type === 'number';
                  return (
                    <td key={f.key} className={`${numeric ? 'col-span-1' : 'col-span-2'} ${CELL}`}>
                      <span className={MOBILE_LABEL}>{f.label}</span>
                      {f.type === 'tire_positions'
                        ? <TirePositionPicker value={value} qty={row.qty as number | string | null | undefined}
                            readOnly label={f.label} onChange={() => {}} />
                        : <span className={`text-ink-900 ${numeric ? 'tabular-nums' : ''}`}>{value || '-'}</span>}
                    </td>
                  );
                })}
                <td className={`col-span-2 flex items-center justify-between border-t border-[#f3f6fa] pt-2 tabular-nums text-ink-900 sm:border-0 sm:pt-2 sm:text-right ${CELL}`}>
                  <span className="text-xs text-ink-500 sm:hidden">รวม</span>
                  <span className="font-semibold sm:font-normal">{money(lineAmount(row.qty ?? 1, row.rate))}</span>
                </td>
              </tr>
            ))}
            {rows.length === 0 && (
              <tr className="block sm:table-row"><td colSpan={fields.length + 3} className="block py-8 text-center text-ink-500 sm:table-cell">
                ยังไม่มีรายการ
              </td></tr>
            )}
          </tbody>
          {rows.length > 0 && (
            <tfoot className="block border-t border-[#edf1f7] sm:table-footer-group">
              <tr className="flex items-center justify-between px-1 pt-3 font-semibold text-ink-900 sm:table-row sm:p-0">
                <td colSpan={fields.length + (hasTruck ? 2 : 1)} className="text-ink-700 sm:table-cell sm:px-3 sm:py-2.5 sm:text-right">
                  รวม {rows.length} รายการ
                </td>
                <td className="tabular-nums sm:table-cell sm:px-3 sm:py-2.5 sm:text-right">{money(total)}</td>
              </tr>
            </tfoot>
          )}
        </table>
      </div>
    );
  }

  function editor(f: Field, row: Row, index: number) {
    const value = String(row[f.key] ?? '');
    const numeric = f.type === 'money' || f.type === 'number';
    const label = `${f.label} แถวที่ ${index + 1}`;
    if (f.type === 'tire_positions') {
      return <TirePositionPicker value={value} qty={row.qty as number | string | null | undefined}
        label={label} onChange={next => setCell(index, f.key, next)} />;
    }
    if (f.type === 'select') {
      return (
        <select value={value} onChange={e => setCell(index, f.key, e.target.value)} aria-label={label}
          className={`${FIELD_SM} h-9 w-full`}>
          <option value="">เลือก</option>
          {(f.options ?? []).map(o => <option key={o} value={o}>{o}</option>)}
        </select>
      );
    }
    return (
      <input value={value} type={f.type === 'date' ? 'date' : 'text'}
        inputMode={numeric ? 'decimal' : undefined}
        onChange={e => setCell(index, f.key, e.target.value)} aria-label={label}
        className={`${FIELD_SM} h-9 w-full ${numeric ? 'text-right tabular-nums' : ''}`} />
    );
  }

  return (
    <div>
      {rows.length === 0 ? (
        <div className="rounded-lg border border-dashed border-[#dbe4f3] px-4 py-8 text-center text-sm text-ink-500">
          ยังไม่มีรายการ — กด &ldquo;เพิ่มแถว&rdquo;{onAddMany && <> หรือ &ldquo;เพิ่มหลายคัน&rdquo;</>} ด้านล่าง
        </div>
      ) : (
        <ol className="space-y-3">
          {rows.map((row, index) => {
            const hint = hintFor(index + 1);
            return (
              <li key={index}
                className={`rounded-lg border ${hint?.level === 'hard' ? 'border-rose-300' : 'border-[#dbe4f3]'}`}>
                <div className="flex items-center justify-between gap-3 rounded-t-lg border-b border-[#edf1f7] bg-[#f7f9fc] py-1.5 pl-3.5 pr-1.5">
                  <span className="text-xs font-semibold text-ink-700">รายการที่ {index + 1}</span>
                  <div className="flex items-center gap-3">
                    <span className="text-xs text-ink-500">รวม
                      <span className="ml-2 text-sm font-semibold tabular-nums text-ink-900">{money(lineAmount(row.qty ?? 1, row.rate))}</span>
                    </span>
                    <button type="button" aria-label={`ลบแถวที่ ${index + 1}`}
                      onClick={() => onChange(rows.filter((_, i) => i !== index))}
                      className="inline-flex size-8 items-center justify-center rounded-md text-ink-300 transition-colors hover:bg-rose-50 hover:text-rose-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-600/30 sm:size-7">
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-x-3 gap-y-3 p-3.5 md:grid-cols-4 xl:grid-cols-6">
                  {truckField && (
                    <div className="col-span-2">
                      <span className={CELL_LABEL}>รถ{truckField.required && <Req />}</span>
                      <TruckPicker lineNo={index + 1}
                        code={String(row.truck_code ?? '')} plate={String(row.truck_plate ?? '')}
                        onPick={truck => onChange(rows.map((r, i) => i === index
                          ? { ...r, truck_code: truck.truck_code, truck_plate: truck.truck_plate,
                              truck_type: truck.truck_type || r.truck_type }
                          : r))} />
                    </div>
                  )}
                  {fields.map(f => (
                    <label key={f.key} className="block min-w-0">
                      <span className={CELL_LABEL}>{f.label}{f.required && <Req />}</span>
                      {editor(f, row, index)}
                    </label>
                  ))}
                </div>
                {hint && (
                  <p className={`border-t px-3.5 py-2 text-xs ${hint.level === 'hard' ? 'border-rose-100 text-rose-700' : 'border-[#edf1f7] text-ink-500'}`}>
                    {hint.message}{hint.form_id && <> (ใบ {hint.form_id})</>}
                  </p>
                )}
              </li>
            );
          })}
        </ol>
      )}

      <div className="mt-3 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="grid grid-cols-1 gap-2 sm:flex sm:flex-wrap">
          <Button onClick={() => onChange([...rows, blankItem(spec) as Row])} className="min-h-11 sm:min-h-10">
            <Plus className="h-4 w-4 text-ink-500" /> เพิ่มแถว
          </Button>
          {onAddMany && (
            <Button onClick={onAddMany} className="min-h-11 sm:min-h-10">
              <Truck className="h-4 w-4 text-ink-500" /> เพิ่มหลายคัน
            </Button>
          )}
        </div>
        {rows.length > 0 && (
          <div className="flex items-baseline justify-between gap-4 rounded-lg border border-[#dbe4f3] bg-[#f7f9fc] px-4 py-2 sm:justify-end">
            <span className="text-xs text-ink-500">รวม {rows.length} รายการ</span>
            <span className="text-base font-semibold tabular-nums text-ink-900">{money(total)}</span>
          </div>
        )}
      </div>
    </div>
  );
}
