'use client';

import { useEffect, useState } from 'react';
import type { Outstanding } from '@/lib/finance/outstanding';
import { formatBaht } from '@/lib/finance/status';
import { fetchJson } from '../api';

/** ยอดค้างเคลียร์ของผู้ขอเบิก — แสดงเฉพาะตอนเปิดจากหน้าอนุมัติ (ผู้ใช้แจ้ง 26/10/2026) */
export function RequesterOutstanding({ formId, name }: { formId: string; name?: string | null }) {
  const [data, setData] = useState<Outstanding | null>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    let alive = true;
    fetchJson<Outstanding>(`/api/finance/advances/${encodeURIComponent(formId)}/outstanding`)
      .then(d => { if (alive) { setData(d); setError(''); } })
      .catch(err => { if (alive) setError((err as Error).message); });
    return () => { alive = false; };
  }, [formId]);

  const tiles = data ? [
    { label: 'ยอด Outstanding', b: data.total, tone: 'text-brand-800' },
    { label: 'อยู่ในกำหนด', b: data.on_time, tone: 'text-emerald-700' },
    { label: 'เกินกำหนด', b: data.overdue, tone: data.overdue.count ? 'text-rose-600' : 'text-gray-500' },
  ] : [];

  return (
    <section className="rounded-2xl border border-gray-200 bg-white px-4 py-3">
      <p className="mb-2 text-sm font-semibold text-brand-800">
        ยอดค้างเคลียร์ของ{name ? ` ${name}` : 'ผู้ขอเบิก'}
        <span className="ml-2 text-xs font-normal text-gray-500">ใบที่รับเงินไปแล้ว ยังไม่ปิดรายการ</span>
      </p>
      {error && <p className="text-sm text-rose-600">{error}</p>}
      {!data && !error && <p className="text-sm text-gray-400">กำลังโหลด...</p>}
      {data && (
        <div className="grid grid-cols-3 gap-2">
          {tiles.map(t => (
            <div key={t.label} className="rounded-xl bg-gray-50 px-3 py-2">
              <p className="text-[11px] text-gray-500">{t.label}</p>
              <p className={`text-base font-semibold tabular-nums ${t.tone}`}>{formatBaht(t.b.amount)}</p>
              <p className="text-[11px] text-gray-500">{t.b.count} ใบ</p>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}
