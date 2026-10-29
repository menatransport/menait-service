'use client';

import type { ReactNode } from 'react';
import Link from 'next/link';
import type { PettyRound } from '@/app/finance/types-petty';
import { PETTY_ROUND_LABELS, PETTY_ROUND_STYLES, type PettyRoundStatus } from '@/lib/finance/petty-status';
import { formatBaht } from '@/lib/finance/status';

export type RoundTab = { key: string; label: string; statuses?: PettyRoundStatus[] };

export function RoundStatusBadge({ status }: { status: PettyRoundStatus }) {
  return (
    <span className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-medium whitespace-nowrap ${PETTY_ROUND_STYLES[status]}`}>
      {PETTY_ROUND_LABELS[status]}
    </span>
  );
}

const when = (iso: string | null) => (iso ? new Date(iso).toLocaleDateString('th-TH', { day: 'numeric', month: 'short', year: '2-digit' }) : '-');

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
  const count = (t: RoundTab) => (t.statuses ? rounds.filter(r => t.statuses!.includes(r.status)).length : rounds.length);

  return (
    <div className="rounded-2xl border border-slate-200 bg-white">
      {tabs && (
        <div className="flex flex-wrap gap-1 border-b border-slate-100 px-3 pt-3">
          {tabs.map(t => (
            <button key={t.key} type="button" onClick={() => onTabChange?.(t.key)}
              className={`rounded-t-lg px-3 py-1.5 text-sm ${t.key === activeTab ? 'bg-brand-50 font-semibold text-brand-800' : 'text-ink-500 hover:text-ink-800'}`}>
              {t.label} <span className="tabular-nums text-ink-400">{count(t)}</span>
            </button>
          ))}
        </div>
      )}
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="text-left text-ink-500">
            <tr>
              <th className="px-3 py-2">รอบที่</th>
              <th className="px-3 py-2">เจ้าของเงินสด</th>
              <th className="px-3 py-2 text-right">ใบ</th>
              <th className="px-3 py-2 text-right">ยอดรวม (บาท)</th>
              <th className="px-3 py-2">สถานะ</th>
              <th className="px-3 py-2">ส่งเมื่อ</th>
              {rowAction && <th className="px-3 py-2" />}
            </tr>
          </thead>
          <tbody>
            {shown.map(r => (
              <tr key={r.id} className="border-t border-slate-100">
                <td className="px-3 py-2">
                  <Link href={`/finance/petty/rounds/${r.id}`} className="font-medium text-brand-700 hover:underline">{r.batch_no}</Link>
                </td>
                <td className="px-3 py-2">
                  <p>{r.holder_name ?? r.holder_employee_id ?? '-'}</p>
                  <p className="text-xs text-ink-400">{r.branch_code ?? '-'} · {r.division_code ?? '-'}</p>
                </td>
                <td className="px-3 py-2 text-right tabular-nums">{r.claim_count ?? r.claims?.length ?? '-'}</td>
                <td className="px-3 py-2 text-right tabular-nums">{formatBaht(r.total_amount)}</td>
                <td className="px-3 py-2">
                  <RoundStatusBadge status={r.status} />
                  {r.status === 'CLEAR_REJECTED' && r.clear_reject_reason && (
                    <p className="mt-1 max-w-56 text-xs text-rose-700" title={r.clear_reject_reason}>เหตุผล: {r.clear_reject_reason}</p>
                  )}
                </td>
                <td className="px-3 py-2 whitespace-nowrap">{when(r.submitted_at)}</td>
                {rowAction && <td className="px-3 py-2"><span className="flex justify-end gap-1.5">{rowAction(r)}</span></td>}
              </tr>
            ))}
            {shown.length === 0 && (
              <tr><td colSpan={rowAction ? 7 : 6} className="py-8 text-center text-ink-400">{emptyText}</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
