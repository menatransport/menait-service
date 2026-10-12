'use client';

import { useState } from 'react';
import { Printer } from 'lucide-react';
import type { PettyClaim, PettyFund, PettySpec } from '@/app/finance/types-petty';
import { pettyVoucherHtml, receiptSubstituteHtml } from '@/lib/finance/petty-voucher';
import { openPrintWindow } from '@/lib/finance/printShared';
import { showAlert } from '@/app/finance/api';
import { printUnit } from '@/lib/finance/petty-spec';

/** เอกสารที่พิมพ์ได้มาจาก spec.prints ของประเภทนั้น — ประเภทที่ไม่มีใบรับรองก็ไม่ขึ้นปุ่ม */
export function PettyPrintButton({ claim, fund, spec, typeName, payeePosition }: {
  claim: PettyClaim;
  fund: PettyFund | null;
  spec: PettySpec;
  typeName: string;
  payeePosition?: string | null;
}) {
  const [open, setOpen] = useState(false);
  const prints = spec.prints ?? ['PETTY_VOUCHER'];

  function print(kind: 'PETTY_VOUCHER' | 'RECEIPT_SUBSTITUTE') {
    if (!fund) {
      showAlert({ icon: 'error', title: 'ยังโหลดข้อมูลกองทุนไม่ได้', text: 'ลองโหลดหน้าใหม่อีกครั้ง' });
      return;
    }
    const opts = { claim, fund, typeName, payeePosition, unit: printUnit(spec) };
    const html = kind === 'PETTY_VOUCHER' ? pettyVoucherHtml(opts) : receiptSubstituteHtml(opts);
    if (!openPrintWindow(html)) {
      showAlert({ icon: 'warning', title: 'เบราว์เซอร์บล็อกหน้าต่างพิมพ์',
        text: 'อนุญาต pop-up ของเว็บนี้แล้วลองอีกครั้ง' });
    }
    setOpen(false);
  }

  return (
    <div className="relative">
      <button type="button" onClick={() => setOpen(v => !v)}
        className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 px-3 py-1.5 text-sm">
        <Printer className="h-4 w-4" /> พิมพ์เอกสาร
      </button>
      {open && (
        <div className="absolute right-0 z-20 mt-1 w-56 rounded-lg border border-slate-200 bg-white py-1 shadow-lg">
          {prints.includes('PETTY_VOUCHER') && (
            <button type="button" onClick={() => print('PETTY_VOUCHER')}
              className="block w-full px-3 py-1.5 text-left text-sm hover:bg-slate-50">
              ใบสำคัญจ่ายเงินสดย่อย
            </button>
          )}
          {prints.includes('RECEIPT_SUBSTITUTE') && (
            <button type="button" onClick={() => print('RECEIPT_SUBSTITUTE')}
              className="block w-full px-3 py-1.5 text-left text-sm hover:bg-slate-50">
              ใบรับรองแทนใบเสร็จรับเงิน
            </button>
          )}
          {prints.includes('DD') && (
            <span className="block px-3 py-1.5 text-left text-xs text-ink-400">
              ใบรับสินค้า (DD) — อยู่ในงานถัดไป
            </span>
          )}
        </div>
      )}
    </div>
  );
}
