'use client';

import type { ReactNode } from 'react';
import Link from 'next/link';
import type { PettyRound } from '@/app/finance/types-petty';
import type { PettyRoundStatus } from '@/lib/finance/petty-status';
import { formatBaht } from '@/lib/finance/status';
import { ROUND_STATUS_LABELS } from '@/lib/finance/petty-worklist';
import { LINE, Tag, UnderlineTabs } from './ui';

export type RoundTab = { key: string; label: string; statuses?: PettyRoundStatus[] };

/** ป้ายสถานะรอบ — คำของ Advance ในขั้นที่เหมือนกัน หน้าตาแบบธีม clean */
export function RoundStatusBadge({ status }: { status: PettyRoundStatus }) {
  return <Tag strong={status === 'CLEAR_REJECTED'}>{ROUND_STATUS_LABELS[status] ?? status}</Tag>;
}

const when = (iso: string | null) => (iso ? new Date(iso).toLocaleDateString('th-TH', { day: 'numeric', month: 'short', year: '2-digit' }) : '-');
const TH = 'px-3 py-2.5 text-left text-xs font-medium text-ink-500 whitespace-nowrap';

/** ตารางรอบส่งเคลียร์ — กดเลขรอบเพื่อเปิดดูใบในรอบ · rowAction = ปุ่มลัดตามบทบาท */
export function RoundTable({ rounds, tabs, activeTab, onTabChange, rowAction, emptyText = 'ยังไม่มีรอบ' }: {
  rounds: PettyRound[];
  tabs?: RoundTab[];
  activeTab?: string;
  onTabChange?: (key: string) => void;
  rowAction?: (round: PettyRound) => ReactNode;
  emptyText?: string;
}) {
  const tab = tabs?.find(t => t.key === activeTab);
  const shown = tab?.statuses ? rounds.filter(r => tab.statuses!.includes(r.status)) : rounds;
  const counts = Object.fromEntries((tabs ?? []).map(t => [t.key, t.statuses ? rounds.filter(r => t.statuses!.includes(r.status)).length : rounds.length]));

  return (
    <div>
      {tabs && <div className="mb-1"><UnderlineTabs tabs={tabs} active={activeTab ?? tabs[0]?.key} onChange={k => onTabChange?.(k)} counts={counts} label="สถานะรอบ" /></div>}

      {/* มือถือ: แถวซ้อน */}
      <ul className={`divide-y ${LINE} sm:hidden`}>
        {shown.map(r => (
          <li key={r.id} className="py-3">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <Link href={`/finance/petty/rounds/${r.id}`} className="text-sm font-semibold text-ink-900 underline-offset-2 hover:underline">{r.batch_no}</Link>
                <p className="truncate text-xs text-ink-500">{r.holder_name ?? r.holder_employee_id ?? '-'} · {r.branch_code ?? '-'} · {r.division_code ?? '-'}</p>
              </div>
              <RoundStatusBadge status={r.status} />
            </div>
            <div className="mt-1.5 flex items-center justify-between gap-2 text-xs text-ink-500">
              <span><span className="font-semibold tabular-nums text-ink-900">{formatBaht(r.total_amount)}</span> บาท · {r.claim_count ?? r.claims?.length ?? '-'} ใบ · {when(r.submitted_at)}</span>
            </div>
            {r.status === 'CLEAR_REJECTED' && r.clear_reject_reason && <p className="mt-1 text-xs text-ink-700">เหตุผล: {r.clear_reject_reason}</p>}
            {rowAction && <div className="mt-2 flex flex-wrap justify-end gap-1.5">{rowAction(r)}</div>}
          </li>
        ))}
        {shown.length === 0 && <li className="py-10 text-center text-sm text-ink-500">{emptyText}</li>}
      </ul>

      {/* เดสก์ท็อป: ตาราง */}
      <div className="hidden overflow-x-auto sm:block">
        <table className="w-full text-sm">
          <thead className={`border-b ${LINE}`}>
            <tr>
              <th className={TH}>รอบที่</th>
              <th className={TH}>เจ้าของเงินสด</th>
              <th className={`${TH} text-right`}>ใบ</th>
              <th className={`${TH} text-right`}>ยอดรวม (บาท)</th>
              <th className={TH}>สถานะ</th>
              <th className={TH}>ส่งเมื่อ</th>
              {rowAction && <th className={TH}><span className="sr-only">ทำรายการ</span></th>}
            </tr>
          </thead>
          <tbody>
            {shown.map(r => (
              <tr key={r.id} className="border-b border-[#f3f6fa] transition-colors hover:bg-[#f9fbfd]">
                <td className="px-3 py-2.5">
                  <Link href={`/finance/petty/rounds/${r.id}`} className="font-medium text-ink-900 underline-offset-2 hover:text-brand-700 hover:underline">{r.batch_no}</Link>
                </td>
                <td className="px-3 py-2.5">
                  <p className="text-ink-900">{r.holder_name ?? r.holder_employee_id ?? '-'}</p>
                  <p className="text-xs text-ink-500">{r.branch_code ?? '-'} · {r.division_code ?? '-'}</p>
                </td>
                <td className="px-3 py-2.5 text-right tabular-nums text-ink-700">{r.claim_count ?? r.claims?.length ?? '-'}</td>
                <td className="px-3 py-2.5 text-right tabular-nums text-ink-900">{formatBaht(r.total_amount)}</td>
                <td className="px-3 py-2.5">
                  <RoundStatusBadge status={r.status} />
                  {r.status === 'CLEAR_REJECTED' && r.clear_reject_reason && (
                    <p className="mt-1 max-w-56 truncate text-xs text-ink-500" title={r.clear_reject_reason}>เหตุผล: {r.clear_reject_reason}</p>
                  )}
                </td>
                <td className="whitespace-nowrap px-3 py-2.5 text-ink-700">{when(r.submitted_at)}</td>
                {rowAction && <td className="px-3 py-2.5"><span className="flex justify-end gap-1.5">{rowAction(r)}</span></td>}
              </tr>
            ))}
            {shown.length === 0 && (
              <tr><td colSpan={rowAction ? 7 : 6} className="py-10 text-center text-ink-500">{emptyText}</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
