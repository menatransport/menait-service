'use client';

import { AlertTriangle, CheckCircle2, XCircle } from 'lucide-react';
import Link from 'next/link';

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

/** แผงบอกว่าทำไมอนุมัติไม่ได้ — เอกสารขาด/ซ้ำเข้ม = บล็อก · ซ้ำอ่อน = เตือน ทับได้พร้อมเหตุผล
 *  missing = ที่คนเปิดใบต้องแนบ · holderMissing = สลิปโอนที่เจ้าของเงินสดแนบเองตอนอนุมัติจ่าย (บล็อกเหมือนกัน แต่เป็นงานของคนกด) */
export function GatePanel({ missing = [], holderMissing = [], hard = [], soft = [] }: {
  missing?: GateItem[];
  holderMissing?: GateItem[];
  hard?: GateDup[];
  soft?: GateDup[];
}) {
  if (missing.length === 0 && holderMissing.length === 0 && hard.length === 0 && soft.length === 0) {
    return (
      <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">
        <span className="inline-flex items-center gap-1.5">
          <CheckCircle2 className="h-4 w-4" /> เอกสารครบ อนุมัติได้
        </span>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {missing.length > 0 && (
        <Block tone="rose" icon={<XCircle className="h-4 w-4" />} title="เอกสารไม่ครบ อนุมัติไม่ได้">
          <ul className="mt-1 list-disc space-y-0.5 pl-5">
            {missing.map((m, i) => <li key={i}>{m.label ?? m.key}</li>)}
          </ul>
        </Block>
      )}

      {holderMissing.length > 0 && (
        <Block tone="amber" icon={<AlertTriangle className="h-4 w-4" />} title="รอสลิปโอนจากคุณ">
          <ul className="mt-1 list-disc space-y-0.5 pl-5">
            {holderMissing.map((m, i) => <li key={i}>{m.label ?? m.key}</li>)}
          </ul>
          <p className="mt-1 text-xs">โอนเงินแล้วแนบสลิปที่กล่องไฟล์แนบด้านบน แล้วค่อยกดอนุมัติจ่าย</p>
        </Block>
      )}

      {hard.length > 0 && (
        <Block tone="rose" icon={<XCircle className="h-4 w-4" />} title="มีรายการที่เบิกไปแล้ว">
          <ul className="mt-1 list-disc space-y-0.5 pl-5">
            {hard.map((d, i) => (
              <li key={i}>
                {d.line_no ? `แถวที่ ${d.line_no}: ` : ''}{d.message}
                {d.form_id && (
                  <> — <Link href={`/finance/petty/${d.form_id}`} className="underline">{dupRef(d)}</Link></>
                )}
              </li>
            ))}
          </ul>
          <p className="mt-1 text-xs">บัตรชั่งใบหนึ่งของรถคันหนึ่งเบิกได้ครั้งเดียว — ทับไม่ได้</p>
        </Block>
      )}

      {soft.length > 0 && (
        <Block tone="amber" icon={<AlertTriangle className="h-4 w-4" />} title="มีรายการที่อาจซ้ำ">
          <ul className="mt-1 list-disc space-y-0.5 pl-5">
            {soft.map((d, i) => (
              <li key={i}>
                {d.line_no ? `แถวที่ ${d.line_no}: ` : ''}{d.message}
                {d.form_id && (
                  <> — <Link href={`/finance/petty/${d.form_id}`} className="underline">{dupRef(d)}</Link></>
                )}
              </li>
            ))}
          </ul>
          <p className="mt-1 text-xs">อนุมัติทับได้ แต่ต้องระบุเหตุผล (เช่น ชั่ง 2 เที่ยวจริง)</p>
        </Block>
      )}
    </div>
  );
}

function Block({ tone, icon, title, children }: {
  tone: 'rose' | 'amber';
  icon: React.ReactNode;
  title: string;
  children: React.ReactNode;
}) {
  const styles = tone === 'rose'
    ? 'border-rose-200 bg-rose-50 text-rose-800'
    : 'border-amber-200 bg-amber-50 text-amber-800';
  return (
    <div className={`rounded-xl border px-4 py-3 text-sm ${styles}`}>
      <p className="inline-flex items-center gap-1.5 font-medium">{icon} {title}</p>
      {children}
    </div>
  );
}
