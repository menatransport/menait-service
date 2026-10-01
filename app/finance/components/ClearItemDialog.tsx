'use client';

import { useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { rowTotals, validateSingleItem, vat7, type ClearItemRow } from '@/lib/finance/clearItems';
import { formatBaht, parseAmount } from '@/lib/finance/status';
import { DateField } from './DateField';

export interface DraftRow {
  id: number;
  expense_date: string;
  vehicle: string;
  has_receipt: boolean;
  description: string;
  a: string;
  b: string;
  d: string;
  /** B edited by hand: stop auto-filling 7% (UI state only, never sent) */
  bTouched: boolean;
}

export function toRow(r: DraftRow): ClearItemRow {
  return {
    expense_date: r.expense_date, vehicle: r.vehicle, has_receipt: r.has_receipt, description: r.description,
    amount_before_vat: parseAmount(r.a), vat_amount: parseAmount(r.b), wht_amount: parseAmount(r.d),
  };
}

function Field({ label, children, required }: { label: string; children: React.ReactNode; required?: boolean }) {
  return (
    <div className="grid gap-1 sm:grid-cols-[9.5rem_1fr] sm:items-center sm:gap-3">
      <span className="text-sm text-gray-700">{label}{required && ' *'}</span>
      <div>{children}</div>
    </div>
  );
}

/** Popup editor for ONE clearing item. Mount it only while editing (state seeds from `initial`). */
export function ClearItemDialog({ initial, index, isNew, canAddNext, onSave, onCancel }: {
  initial: DraftRow;
  /** 0-based position the item has (or will have) in the list */
  index: number;
  isNew: boolean;
  /** false when saving would fill the list to the max */
  canAddNext: boolean;
  onSave: (row: DraftRow, addNext: boolean) => void;
  onCancel: () => void;
}) {
  const [r, setR] = useState<DraftRow>(initial);
  const [errors, setErrors] = useState<string[]>([]);
  const descRef = useRef<HTMLInputElement>(null);
  const patch = (p: Partial<DraftRow>) => setR(x => ({ ...x, ...p }));

  const setA = (a: string) => setR(x => {
    if (x.bTouched) return { ...x, a };
    const n = parseAmount(a);
    return { ...x, a, b: n === null ? '' : String(vat7(n)) };
  });
  const resetVat = () => setR(x => {
    const n = parseAmount(x.a);
    return { ...x, b: n === null ? '' : String(vat7(n)), bTouched: false };
  });

  const t = rowTotals(toRow(r));

  const save = (addNext: boolean) => {
    const errs = validateSingleItem(r, toRow(r), parseAmount);
    if (errs.length) { setErrors(errs); return; }
    onSave({ ...r, vehicle: r.vehicle.trim(), description: r.description.trim() }, addNext);
  };

  const title = isNew ? `รายการที่ ${index + 1}` : `แก้ไขรายการที่ ${index + 1}`;

  return (
    <Dialog open onOpenChange={o => { if (!o) onCancel(); }}>
      <DialogContent
        showCloseButton={false}
        className="max-h-[92vh] gap-0 overflow-y-auto rounded-2xl p-0 sm:max-w-xl md:w-full"
        onOpenAutoFocus={e => { if (initial.expense_date) { e.preventDefault(); descRef.current?.focus(); } }}
      >
        <form
          onSubmit={e => { e.preventDefault(); e.stopPropagation(); save(false); }}
          className="grid gap-4 p-5"
        >
          <DialogHeader className="text-left">
            <DialogTitle className="text-lg font-semibold text-brand-800">{title}</DialogTitle>
            <DialogDescription className="text-xs text-gray-500">กรอกทีละใบเสร็จ แล้วกดบันทึก</DialogDescription>
          </DialogHeader>

          {errors.length > 0 && (
            <ul role="alert" className="list-disc space-y-0.5 rounded-xl border border-red-200 bg-red-50 py-2 pl-7 pr-3 text-sm text-red-700">
              {errors.map((m, i) => <li key={`${i}-${m}`}>{m}</li>)}
            </ul>
          )}

          <Field label="วันที่" required><DateField value={r.expense_date} onChange={v => patch({ expense_date: v })} /></Field>
          <Field label="ทะเบียนรถ/ประเภท">
            <Input maxLength={50} value={r.vehicle} onChange={e => patch({ vehicle: e.target.value })} />
          </Field>
          <Field label="ใบกำกับภาษี/ใบเสร็จ">
            <div className="inline-flex rounded-xl border p-0.5" role="group">
              {([true, false] as const).map(v => (
                <button key={String(v)} type="button" aria-pressed={r.has_receipt === v} onClick={() => patch({ has_receipt: v })}
                  className={`h-9 rounded-[10px] px-4 text-sm font-medium transition-colors ${r.has_receipt === v ? 'bg-brand-600 text-white' : 'text-gray-600 hover:bg-gray-50'}`}>
                  {v ? 'มี (Y)' : 'ไม่มี (N)'}
                </button>
              ))}
            </div>
          </Field>
          <Field label="รายละเอียด" required>
            <Input ref={descRef} maxLength={255} value={r.description} onChange={e => patch({ description: e.target.value })} />
          </Field>
          <Field label="ยอดก่อน VAT (A)" required>
            <Input className="text-right" inputMode="decimal" placeholder="0.00" value={r.a} onChange={e => setA(e.target.value)} />
          </Field>
          <Field label="VAT 7% (B)">
            <Input className="text-right" inputMode="decimal" placeholder="0.00" value={r.b} onChange={e => patch({ b: e.target.value, bTouched: true })} />
            {r.bTouched && (
              <button type="button" onClick={resetVat} className="mt-1 text-xs text-brand-600 underline">↺ คำนวณ 7%</button>
            )}
          </Field>
          <Field label="หัก ณ ที่จ่าย (D)">
            <Input className="text-right" inputMode="decimal" placeholder="0.00" value={r.d} onChange={e => patch({ d: e.target.value })} />
          </Field>

          <div className="flex items-center justify-between rounded-xl bg-brand-50 px-4 py-2.5 text-sm">
            <span className="text-gray-600">ยอดรวม (C) <b className="ml-1 tabular-nums text-gray-800">{formatBaht(t.total)}</b></span>
            <span className="text-gray-600">สุทธิ (E) <b className="ml-1 tabular-nums text-brand-800">{formatBaht(t.net)}</b></span>
          </div>

          <DialogFooter className="gap-2 sm:justify-end">
            <Button type="button" variant="outline" className="h-11 rounded-xl" onClick={onCancel}>ยกเลิก</Button>
            <Button type="submit" className="h-11 rounded-xl bg-linear-to-r from-brand-600 to-brand-500 hover:from-brand-700 hover:to-brand-600 text-white font-semibold">บันทึก</Button>
            {isNew && canAddNext && (
              <Button type="button" variant="outline" onClick={() => save(true)}
                className="h-11 rounded-xl border-brand-600 font-semibold text-brand-700 hover:bg-brand-50">บันทึกและเพิ่มต่อ</Button>
            )}
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
