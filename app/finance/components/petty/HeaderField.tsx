'use client';

import type { PettySpecField } from '@/app/finance/types-petty';
import { BANKS } from '@/lib/finance/bank';
import { payeeAccountHint, payeeAccountType, type PayeeAccountType } from '@/lib/finance/petty-payee';
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

  // จ่ายให้: ชื่อ-สกุล + ปลายทางเงิน (ผู้ใช้สั่ง 2026-10-13) — เลือกได้ว่าบัญชีธนาคารหรือพร้อมเพย์
  // เลขบัญชีตรวจจำนวนหลักตามธนาคาร (กสิกร/กรุงเทพ/… 10 หลัก, ออมสิน/ธ.ก.ส. 12) · พร้อมเพย์ เบอร์ 10 หลัก หรือบัตรประชาชน 13 หลัก
  if (field.key === 'payee_name') {
    const type = payeeAccountType(form);
    const hint = payeeAccountHint(form);
    const digits = type === 'bank' ? (BANKS[String(form.payee_bank ?? '')]?.digits ?? []) : [];
    const noPlaceholder = type === 'promptpay' ? 'เบอร์มือถือ หรือเลขบัตรประชาชน'
      : digits.length === 1 ? `เลขบัญชี ${digits[0]} หลัก` : 'เลขบัญชีธนาคาร';
    const tab = (value: PayeeAccountType, text: string) => (
      <button type="button" key={value} aria-pressed={type === value}
        className={`rounded-md px-2.5 py-1 text-xs font-medium ${type === value ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
        onClick={() => onChange({ payee_account_type: value, payee_account_no: '' })}>
        {text}
      </button>
    );
    return (
      <div className="text-sm sm:col-span-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <span>{label}</span>
          <div className="inline-flex rounded-lg bg-slate-100 p-0.5" role="group" aria-label="ปลายทางเงิน">
            {tab('bank', 'บัญชีธนาคาร')}{tab('promptpay', 'พร้อมเพย์')}
          </div>
        </div>
        <div className="mt-1 grid gap-2 sm:grid-cols-3">
          <input value={String(value ?? '')} className="w-full rounded-lg border border-slate-200 px-2 py-1.5"
            placeholder="ชื่อ นามสกุล" autoComplete="off"
            onChange={e => onChange({ payee_name: e.target.value })} />
          {type === 'bank' && (
            <select value={String(form.payee_bank ?? '')} className="w-full rounded-lg border border-slate-200 px-2 py-1.5"
              aria-label="ชื่อธนาคาร"
              onChange={e => onChange({ payee_bank: e.target.value })}>
              <option value="">ชื่อธนาคาร</option>
              {Object.entries(BANKS).map(([code, bank]) => <option key={code} value={code}>{bank.label}</option>)}
            </select>
          )}
          <div className={type === 'promptpay' ? 'sm:col-span-2' : undefined}>
            <input value={String(form.payee_account_no ?? '')}
              className={`w-full rounded-lg border px-2 py-1.5 ${hint ? 'border-rose-400 bg-rose-50/40' : 'border-slate-200'}`}
              placeholder={noPlaceholder} inputMode="numeric" autoComplete="off"
              aria-label={type === 'promptpay' ? 'เบอร์พร้อมเพย์' : 'เลขบัญชีธนาคาร'}
              aria-invalid={Boolean(hint)}
              onChange={e => onChange({ payee_account_no: e.target.value })} />
            {hint && <p className="mt-0.5 text-xs text-rose-600">{hint}</p>}
          </div>
        </div>
      </div>
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
