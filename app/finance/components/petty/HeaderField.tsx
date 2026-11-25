'use client';

import { useRef } from 'react';
import type { PettySpecField } from '@/app/finance/types-petty';
import { BANKS } from '@/lib/finance/bank';
import { payeeAccountHint, payeeAccountType, type PayeeAccountType } from '@/lib/finance/petty-payee';
import { fleetAt } from '@/app/finance/petty-api';
import { applyDriver, applyFleet } from '@/lib/finance/petty-driver-fill';
import { DriverPicker } from './DriverPicker';
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
  // วันที่ล่าสุดที่ถามฟลีทไป — คำตอบของวันเก่าที่มาช้าไม่ทับของวันใหม่
  const askedDate = useRef<string | null>(null);

  /** เปลี่ยนวันที่ทำรายการในหัวใบ + มีรถแล้ว → ถาม พจส./พจร. และคนขับของวันใหม่ (ค่าแนะนำ แก้เองได้) — แบบเดียวกับแถวค่าชั่ง (25/11/2026) */
  function onDateChange(next: string) {
    onChange({ [field.key]: next });
    const code = String(form.truck_code ?? '');
    if (field.key !== 'event_date' || !code || !/^\d{4}-\d{2}-\d{2}$/.test(next)) return;
    askedDate.current = next;
    fleetAt({ truck_code: code, truck_plate: String(form.truck_plate ?? ''), date: next })
      .then(info => {
        if (askedDate.current !== next) return;
        const row = { truck_code: code, truck_type: form.truck_type, driver_name: form.driver, driver_code: form.driver_code, driver_role: form.driver_role };
        const filled = applyFleet(row, info, { dateChanged: true });
        onChange({ fleet: filled.fleet, truck_type: filled.truck_type, driver: filled.driver_name ?? form.driver,
          driver_code: filled.driver_code ?? null, driver_role: filled.driver_role });
      })
      .catch(() => { /* ไม่รู้สถานะก็เปิดใบได้ เลือกเอง */ });
  }

  if (field.type === 'truck') {
    return (
      <div>
        <span className={LABEL}>{label}</span>
        <TruckPicker lineNo={0} block
          code={String(form.truck_code ?? '')} plate={String(form.truck_plate ?? '')} fleet={form.fleet ? String(form.fleet) : null}
          onPick={truck => {
            onChange({ truck_code: truck.truck_code, truck_plate: truck.truck_plate,
              truck_type: truck.truck_type || form.truck_type, fleet: null });
            // ฟลีท ณ วันทำรายการจาก ATMS (ข้อ 10) — ช้า/ไม่พบ ก็เปิดใบได้
            fleetAt({ truck_code: truck.truck_code, truck_plate: truck.truck_plate, date: String(form.event_date ?? '') || null })
              .then(info => {
                const next = applyFleet({ ...form, truck_code: truck.truck_code, truck_plate: truck.truck_plate }, info);
                onChange({ fleet: next.fleet, truck_type: next.truck_type, driver: form.driver || info?.driver_name || form.driver,
                  driver_code: next.driver_code, driver_role: next.driver_role });
              })
              .catch(() => {});
          }} />
      </div>
    );
  }

  // คนขับในหัวใบ (ค่าทางด่วน): ค้นจาก master คนขับ เลือกแล้วเติม พจส./พจร. ฟลีท และรถที่ยังว่าง (ข้อ 7)
  if (field.type === 'employee' && field.key === 'driver') {
    return (
      <div>
        <span className={LABEL}>{label}</span>
        <DriverPicker value={String(value ?? '')} date={String(form.event_date ?? '') || null} lineNo={0} block
          onChange={text => onChange({ driver: text, driver_code: null })}
          onPick={driver => {
            const next = applyDriver({ ...form, driver_name: form.driver }, driver);
            onChange({ driver: next.driver_name, driver_code: next.driver_code, driver_role: next.driver_role, fleet: next.fleet,
              truck_code: next.truck_code, truck_plate: next.truck_plate, truck_type: next.truck_type });
          }} />
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
            {tab('bank', 'บัญชีธนาคาร')}{tab('promptpay', 'พร้อมเพย์')}{tab('bill', 'ใบชำระหนี้')}
          </div>
        </div>
        {/* ป้ายเหนือทุกช่องและกล่องสูงเท่ากัน เหมือนช่องอื่นของหัวใบ (ผู้ใช้สั่ง 5/11/2026) */}
        <div className="grid gap-4 sm:grid-cols-3">
          <label className="block">
            <span className={LABEL}>ชื่อผู้รับเงิน</span>
            <input value={String(value ?? '')} className={FIELD} aria-label="ชื่อผู้รับเงิน"
              placeholder="ชื่อ นามสกุล" autoComplete="off"
              onChange={e => onChange({ payee_name: e.target.value })} />
          </label>
          {type === 'bank' && (
            <label className="block">
              <span className={LABEL}>ธนาคาร</span>
              <select value={String(form.payee_bank ?? '')} className={FIELD}
                aria-label="ชื่อธนาคาร"
                onChange={e => onChange({ payee_bank: e.target.value })}>
                <option value="">ชื่อธนาคาร</option>
                {Object.entries(BANKS).map(([code, bank]) => <option key={code} value={code}>{bank.label}</option>)}
              </select>
            </label>
          )}
          {type === 'bill' && (
            <p className="self-end pb-3 text-sm text-ink-500 sm:col-span-2">
              ไม่ต้องกรอกเลขบัญชี แนบใบชำระหนี้หรือ QR Code ในช่องด้านล่างแทน
            </p>
          )}
          {type !== 'bill' && <label className={`block ${type === 'promptpay' ? 'sm:col-span-2' : ''}`}>
            <span className={LABEL}>{type === 'promptpay' ? 'เบอร์พร้อมเพย์' : 'เลขบัญชี'}</span>
            <input value={String(form.payee_account_no ?? '')}
              className={`${FIELD} ${hint ? '!border-rose-400' : ''}`}
              placeholder={noPlaceholder} inputMode="numeric" autoComplete="off"
              aria-label={type === 'promptpay' ? 'เบอร์พร้อมเพย์' : 'เลขบัญชีธนาคาร'}
              aria-invalid={Boolean(hint)}
              onChange={e => onChange({ payee_account_no: e.target.value })} />
            {hint && <span className="mt-1 block text-xs text-rose-700">{hint}</span>}
          </label>}
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
        onChange={e => (field.type === 'date' ? onDateChange(e.target.value) : onChange({ [field.key]: e.target.value }))} />
    </label>
  );
}
