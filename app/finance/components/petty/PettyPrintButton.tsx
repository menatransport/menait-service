'use client';

import { useState } from 'react';
import { Printer } from 'lucide-react';
import type { PettyClaim, PettyFund, PettySpec } from '@/app/finance/types-petty';
import { itemSummaryHtml, pettyVoucherHtml, receiptSubstituteHtml, travelRequestFormHtml } from '@/lib/finance/petty-voucher';
import { attachmentPagesHtml, openPrintWindow, type PrintFile } from '@/lib/finance/printShared';
import { printUnit } from '@/lib/finance/petty-spec';
import { showAlert } from '@/app/finance/api';
import { itemSummaryLabel, printsFor } from './approvals/model';

type Kind = 'PETTY_VOUCHER' | 'RECEIPT_SUBSTITUTE' | 'ITEM_SUMMARY' | 'REQUEST_FORM';

/** เอกสารที่พิมพ์ได้มาจาก spec.prints ของประเภทนั้น (ตัดใบที่ print_when ไม่เข้าเงื่อนไข) — ประเภทที่ไม่มีใบรับรองก็ไม่ขึ้นปุ่ม · ใบสรุปรายการมีทุกประเภท */
export function PettyPrintButton({ claim, fund, spec, typeName, payeePosition }: {
  claim: PettyClaim;
  fund: PettyFund | null;
  spec: PettySpec;
  typeName: string;
  payeePosition?: string | null;
}) {
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const prints = printsFor(spec, claim);

  // หน้าแนบไฟล์ต่อท้ายใบสรุปรายการเท่านั้น ใบอื่นไม่แนบ — โหลดไม่ได้ก็พิมพ์ตัวเอกสารไปก่อน
  async function attachments(): Promise<string> {
    try {
      const res = await fetch(`/api/uploads3?form_id=${encodeURIComponent(claim.form_id)}`, { cache: 'no-store' });
      if (!res.ok) return '';
      const data = await res.json().catch(() => ({ files: [] })) as { files?: PrintFile[] };
      const folders = (spec.attachments ?? []).map(a => a.key);
      const labels = Object.fromEntries((spec.attachments ?? []).map(a => [a.key, a.label]));
      return attachmentPagesHtml(data.files ?? [], folders, labels);
    } catch {
      return '';
    }
  }

  async function print(kind: Kind) {
    if (!fund) {
      showAlert({ icon: 'error', title: 'ยังโหลดข้อมูลกองทุนไม่ได้', text: 'ลองโหลดหน้าใหม่อีกครั้ง' });
      return;
    }
    setBusy(true);
    try {
      const opts = {
        claim, fund, typeName, payeePosition, unit: printUnit(spec),
        logoUrl: `${window.location.origin}/mena.png`,
      };
      const html = kind === 'PETTY_VOUCHER' ? pettyVoucherHtml(opts)
        : kind === 'RECEIPT_SUBSTITUTE' ? receiptSubstituteHtml(opts)
        : kind === 'REQUEST_FORM' ? travelRequestFormHtml(opts)
        : itemSummaryHtml({ ...opts, spec, attachmentsHtml: await attachments() });
      if (!openPrintWindow(html)) {
        showAlert({ icon: 'warning', title: 'เบราว์เซอร์บล็อกหน้าต่างพิมพ์',
          text: 'อนุญาต pop-up ของเว็บนี้แล้วลองอีกครั้ง' });
      }
    } finally {
      setBusy(false);
      setOpen(false);
    }
  }

  const item = (kind: Kind, label: string) => (
    <button type="button" onClick={() => print(kind)} disabled={busy}
      className="block w-full px-3 py-1.5 text-left text-sm hover:bg-slate-50 disabled:opacity-50">
      {label}
    </button>
  );

  return (
    <div className="relative">
      <button type="button" onClick={() => setOpen(v => !v)}
        className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 px-3 py-1.5 text-sm">
        <Printer className="h-4 w-4" /> {busy ? 'กำลังเตรียม…' : 'พิมพ์เอกสาร'}
      </button>
      {open && (
        <div className="absolute right-0 z-20 mt-1 w-60 rounded-lg border border-slate-200 bg-white py-1 shadow-lg">
          {prints.includes('PETTY_VOUCHER') && item('PETTY_VOUCHER', 'ใบสำคัญจ่ายเงินสดย่อย')}
          {prints.includes('RECEIPT_SUBSTITUTE') && item('RECEIPT_SUBSTITUTE', 'ใบรับรองแทนใบเสร็จรับเงิน')}
          {item('ITEM_SUMMARY', itemSummaryLabel(spec))}
          {prints.includes('REQUEST_FORM') && item('REQUEST_FORM', 'แบบฟอร์มขอใช้บริการแกร็บแท็กซี่')}
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
