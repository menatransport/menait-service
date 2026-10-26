'use client';

import { useEffect, useState } from 'react';
import { Check, Copy } from 'lucide-react';
import { showAlert } from '../api';

/** ปุ่มเล็ก "คัดลอก" — กดแล้วขึ้น "คัดลอกแล้ว" สักครู่ (ผู้ใช้ขอ 26/10/2026 คัดลอกข้อความเบิกเงิน Advance สำหรับ) */
export function CopyTextButton({ text, label = 'คัดลอกข้อความ' }: { text: string; label?: string }) {
  const [copied, setCopied] = useState(false);
  useEffect(() => {
    if (!copied) return;
    const t = setTimeout(() => setCopied(false), 1500);
    return () => clearTimeout(t);
  }, [copied]);
  const copy = () => {
    const done = navigator.clipboard?.writeText(text);
    if (!done) { showAlert({ icon: 'error', title: 'คัดลอกไม่สำเร็จ' }); return; }
    done.then(() => setCopied(true)).catch(() => showAlert({ icon: 'error', title: 'คัดลอกไม่สำเร็จ' }));
  };
  return (
    <button type="button" onClick={copy} aria-label={label} title={label}
      className="inline-flex items-center gap-1 rounded-md border border-gray-200 bg-white px-1.5 py-0.5 text-[11px] font-medium text-brand-600 hover:bg-brand-50">
      {copied ? <Check className="h-3 w-3" /> : <Copy className="h-3 w-3" />}
      {copied ? 'คัดลอกแล้ว' : 'คัดลอก'}
    </button>
  );
}
