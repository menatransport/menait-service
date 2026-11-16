'use client';

import { useMemo, useState } from 'react';
import type { PettyExpenseType, PettyFund } from '@/app/finance/types-petty';
import { FUND_MAP_VIA_LABEL, fundMapCounts, fundMapRows, type FundMapVia } from '@/lib/finance/petty-fund-map';
import { fundLabelWithHolder } from '@/lib/finance/petty-fund-label';
import { FIELD, LINE } from './ui';

const VIA_TONE: Record<FundMapVia, string> = {
  department: 'bg-[#e7f5ec] text-brand-800',
  accounting: 'bg-amber-50 text-amber-800',
  none: 'bg-rose-50 text-rose-700',
};

/** วงเงินตามแผนก — แต่ละศูนย์และแผนกเปิดใบแล้วระบบล็อกวงเงินไหน (ผู้ใช้สั่ง 16/11/2026) · อ่านอย่างเดียว */
export function FundMapTable({ funds, types }: { funds: readonly PettyFund[]; types: readonly PettyExpenseType[] }) {
  const [type, setType] = useState('');
  const [center, setCenter] = useState('');
  const [via, setVia] = useState<'' | FundMapVia>('');
  const all = useMemo(() => fundMapRows(funds.filter(f => f.is_active), type || null), [funds, type]);
  const rows = all.filter(r => (!center || r.center === center) && (!via || r.via === via));
  const counts = fundMapCounts(all);
  const centers = [...new Set(all.map(r => r.center))];
  const TH = 'px-3 py-2.5 text-left text-xs font-medium text-ink-500 whitespace-nowrap';

  return (
    <section className={`mt-10 border-t ${LINE} pt-6`} aria-label="วงเงินตามแผนก">
      <h2 className="font-display text-base font-semibold text-ink-900">วงเงินตามแผนก</h2>
      <p className="mt-0.5 text-xs text-ink-500">
        แต่ละศูนย์และแผนกเปิดใบแล้วระบบล็อกวงเงินไหน · แผนกที่ไม่มีวงเงินของตัวเองใช้วงเงินบัญชีสาขาเดียวกัน · ใช้กติกาเดียวกับหน้าเปิดใบ
      </p>

      <div className="mt-4 grid gap-3 sm:grid-cols-3">
        <label className="block text-xs text-ink-500">ประเภทการเบิก
          <select value={type} onChange={e => setType(e.target.value)} className={`${FIELD} mt-1`}>
            <option value="">ทุกประเภท (ไม่จำกัดแผนก)</option>
            {types.map(t => <option key={t.code} value={t.code}>{t.name_th}</option>)}
          </select>
        </label>
        <label className="block text-xs text-ink-500">ศูนย์
          <select value={center} onChange={e => setCenter(e.target.value)} className={`${FIELD} mt-1`}>
            <option value="">ทุกศูนย์</option>
            {centers.map(c => <option key={c} value={c}>{c}</option>)}
          </select>
        </label>
        <label className="block text-xs text-ink-500">ที่มา
          <select value={via} onChange={e => setVia(e.target.value as '' | FundMapVia)} className={`${FIELD} mt-1`}>
            <option value="">ทั้งหมด</option>
            {(Object.keys(FUND_MAP_VIA_LABEL) as FundMapVia[]).map(v => <option key={v} value={v}>{FUND_MAP_VIA_LABEL[v]} ({counts[v]})</option>)}
          </select>
        </label>
      </div>

      <p className="mt-3 text-xs text-ink-500">
        {all.length} แผนก · วงเงินของแผนก {counts.department} · ใช้วงเงินบัญชี {counts.accounting} ·{' '}
        <span className={counts.none ? 'font-medium text-rose-700' : ''}>ไม่มีวงเงิน {counts.none}</span>
      </p>

      <div className="mt-3 overflow-x-auto">
        <table className="w-full text-sm">
          <thead className={`border-b ${LINE}`}>
            <tr>
              <th className={TH}>ศูนย์และแผนก</th>
              <th className={TH}>วงเงินที่ใช้</th>
              <th className={TH}>ที่มา</th>
            </tr>
          </thead>
          <tbody>
            {rows.map(r => (
              <tr key={r.code} className="border-b border-[#f3f6fa] text-ink-900">
                <td className="px-3 py-2.5 whitespace-nowrap"><span className="font-medium tabular-nums">{r.code}</span> <span className="text-ink-700">{r.name}</span></td>
                <td className="px-3 py-2.5">
                  {r.fund
                    ? <>{fundLabelWithHolder(r.fund)} <span className="ml-1 text-xs text-ink-500">({r.fund.branch_code}/{r.fund.division_code})</span></>
                    : <span className="text-rose-700">ไม่มีวงเงินที่เบิกได้ — ติดต่อฝ่ายบัญชี</span>}
                </td>
                <td className="px-3 py-2.5"><span className={`rounded-full px-2 py-0.5 text-xs font-medium ${VIA_TONE[r.via]}`}>{FUND_MAP_VIA_LABEL[r.via]}</span></td>
              </tr>
            ))}
            {rows.length === 0 && <tr><td colSpan={3} className="py-8 text-center text-ink-500">ไม่มีแผนกตามที่กรอง</td></tr>}
          </tbody>
        </table>
      </div>
    </section>
  );
}
