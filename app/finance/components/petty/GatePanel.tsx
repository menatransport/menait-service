'use client';

import { Check } from 'lucide-react';
import Link from 'next/link';
import { Notice } from './ui';

export type GateItem = { key?: string; label?: string; line_no?: number };
export type GateDup = { line_no?: number; message?: string; form_id?: string | null;
  event_date?: string | null; payee_name?: string | null; amount?: number | null };

const baht = (n: number) => n.toLocaleString('th-TH', { minimumFractionDigits: 2 });
/** "ใบ LB-B02-2610-001 · 17/09/2026 · อัญชัญ น่วมมี · 100.00" — REQUIREMENT §4.1 */
export function dupRef(d: GateDup): string {
  const date = d.event_date ? d.event_date.slice(0, 10).split('-').reverse().join('/') : '';
  return [d.form_id ? `ใบ ${d.form_id}` : '', date, d.payee_name ?? '', d.amount != null ? `${baht(Number(d.amount))} บาท` : '']
    .filter(Boolean).join(' · ');
}

function DupList({ items }: { items: GateDup[] }) {
  return (
    <ul className="mt-1 space-y-0.5">
      {items.map((d, i) => (
        <li key={i}>
          {d.line_no ? `แถวที่ ${d.line_no}: ` : ''}{d.message}
          {d.form_id && <> — <Link href={`/finance/petty/${d.form_id}`} className="underline underline-offset-2">{dupRef(d)}</Link></>}
        </li>
      ))}
    </ul>
  );
}

/** แผงบอกว่าทำไมอนุมัติไม่ได้ — เอกสารขาด/ซ้ำเข้ม = บล็อก (แดง) · ซ้ำอ่อน = เตือน (เทา) ทับได้พร้อมเหตุผล
 *  missing = ที่คนเปิดใบต้องแนบ · holderMissing = สลิปโอนที่เจ้าของเงินสดแนบเองตอนอนุมัติจ่าย (บล็อกเหมือนกัน แต่เป็นงานของคนกด) */
export function GatePanel({ missing = [], holderMissing = [], hard = [], soft = [] }: {
  missing?: GateItem[];
  holderMissing?: GateItem[];
  hard?: GateDup[];
  soft?: GateDup[];
}) {
  if (missing.length === 0 && holderMissing.length === 0 && hard.length === 0 && soft.length === 0) {
    return (
      <p className="inline-flex items-center gap-1.5 text-sm text-ink-700">
        <Check className="h-4 w-4 text-ink-500" /> เอกสารครบ อนุมัติได้
      </p>
    );
  }

  return (
    <div className="space-y-3">
      {missing.length > 0 && (
        <Notice tone="error" title="เอกสารไม่ครบ อนุมัติไม่ได้">
          <p>{missing.map(m => m.label ?? m.key).join(' · ')}</p>
        </Notice>
      )}
      {holderMissing.length > 0 && (
        <Notice tone="error" title="รอสลิปโอนจากคุณ">
          <p>{holderMissing.map(m => m.label ?? m.key).join(' · ')}</p>
          <p className="mt-1 text-xs">โอนเงินแล้วแนบสลิปที่กล่องไฟล์แนบด้านบน แล้วค่อยกดอนุมัติจ่าย</p>
        </Notice>
      )}
      {hard.length > 0 && (
        <Notice tone="error" title="มีรายการที่เบิกไปแล้ว (ทับไม่ได้)">
          <DupList items={hard} />
        </Notice>
      )}
      {soft.length > 0 && (
        <Notice title="มีรายการที่อาจซ้ำ — อนุมัติทับได้ แต่ต้องระบุเหตุผล">
          <div className="text-ink-500"><DupList items={soft} /></div>
        </Notice>
      )}
    </div>
  );
}
