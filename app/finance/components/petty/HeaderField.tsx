'use client';

import type { PettySpecField } from '@/app/finance/types-petty';
import { BANKS } from '@/lib/finance/bank';
import { payeeAccountHint, payeeAccountType, type PayeeAccountType } from '@/lib/finance/petty-payee';
import { TruckPicker } from './TruckPicker';
import { FIELD, LABEL, Req } from './ui';

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
      {field.required && <Req />}
    </>
  );

  if (field.type === 'truck') {
    return (
      <div>
        <span className={LABEL}>{label}</span>
        <TruckPicker lineNo={0} block
          code={String(form.truck_code ?? '')} plate={String(form.truck_plate ?? '')}
          onPick={truck => onChange({
            truck_code: truck.truck_code,
            truck_plate: truck.truck_plate,
            truck_type: truck.truck_type || form.truck_type,
          })} />
      </div>
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
        className={`px-3 py-1.5 text-xs transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-brand-600/30 ${type === value
          ? 'font-semibold text-ink-900 shadow-[inset_0_-2px_0_0_var(--color-brand-600)]'
          : 'font-medium text-ink-500 hover:text-ink-900'}`}
        onClick={() => onChange({ payee_account_type: value, payee_account_no: '' })}>
        {text}
      </button>
    );
    return (
      <div className="sm:col-span-3">
        <div className="mb-1.5 flex flex-wrap items-center justify-between gap-2">
          <span className="text-xs font-medium text-ink-500">{label}</span>
          <div className="inline-flex overflow-hidden rounded-lg border border-[#dbe4f3] bg-white" role="group" aria-label="ปลายทางเงิน">
            {tab('bank', 'บัญชีธนาคาร')}{tab('promptpay', 'พร้อมเพย์')}
          </div>
        </div>
        <div className="grid gap-2.5 sm:grid-cols-3">
          <input value={String(value ?? '')} className={FIELD} aria-label="ชื่อผู้รับเงิน"
            placeholder="ชื่อ นามสกุล" autoComplete="off"
            onChange={e => onChange({ payee_name: e.target.value })} />
          {type === 'bank' && (
            <select value={String(form.payee_bank ?? '')} className={FIELD}
              aria-label="ชื่อธนาคาร"
              onChange={e => onChange({ payee_bank: e.target.value })}>
              <option value="">ชื่อธนาคาร</option>
              {Object.entries(BANKS).map(([code, bank]) => <option key={code} value={code}>{bank.label}</option>)}
            </select>
          )}
          <div className={type === 'promptpay' ? 'sm:col-span-2' : undefined}>
            <input value={String(form.payee_account_no ?? '')}
              className={`${FIELD} ${hint ? '!border-rose-400' : ''}`}
              placeholder={noPlaceholder} inputMode="numeric" autoComplete="off"
              aria-label={type === 'promptpay' ? 'เบอร์พร้อมเพย์' : 'เลขบัญชีธนาคาร'}
              aria-invalid={Boolean(hint)}
              onChange={e => onChange({ payee_account_no: e.target.value })} />
            {hint && <p className="mt-1 text-xs text-rose-700">{hint}</p>}
          </div>
        </div>
      </div>
    );
  }

  if (field.type === 'select') {
    return (
      <label className="block">
        <span className={LABEL}>{label}</span>
        <select value={String(value ?? '')} className={FIELD}
          onChange={e => onChange({ [field.key]: e.target.value })}>
          <option value="">เลือก</option>
          {(field.options ?? []).map(option => <option key={option} value={option}>{option}</option>)}
        </select>
      </label>
    );
  }

  const numeric = field.type === 'money' || field.type === 'number';
  return (
    <label className="block">
      <span className={LABEL}>{label}</span>
      <input value={String(value ?? '')} className={`${FIELD} ${numeric ? 'text-right tabular-nums' : ''}`}
        type={field.type === 'date' ? 'date' : 'text'}
        inputMode={numeric ? 'decimal' : undefined}
        placeholder={field.type === 'employee' ? 'ชื่อ-สกุล' : numeric ? '0.00' : undefined}
        onChange={e => onChange({ [field.key]: e.target.value })} />
    </label>
  );
}
