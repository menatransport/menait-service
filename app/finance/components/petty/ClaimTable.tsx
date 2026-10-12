'use client';

import Link from 'next/link';
import type { PettyClaim, PettyExpenseType } from '@/app/finance/types-petty';
import { PETTY_STATUS_LABELS, PETTY_STATUS_STYLES } from '@/lib/finance/petty-status';

export function PettyStatusBadge({ status }: { status: PettyClaim['status'] }) {
  return (
    <span className={`inline-block rounded-full border px-2 py-0.5 text-xs ${PETTY_STATUS_STYLES[status]}`}>
      {PETTY_STATUS_LABELS[status]}
    </span>
  );
}

export function ClaimTable({ claims, types, showReturnReason = false, selectable, selected, onSelect }: {
  claims: PettyClaim[];
  types: PettyExpenseType[];
  showReturnReason?: boolean;
  selectable?: boolean;
  selected?: number[];
  onSelect?: (ids: number[]) => void;
}) {
  const typeName = (code: string) => types.find(t => t.code === code)?.name_th ?? code;

  function toggle(id: number) {
    if (!onSelect || !selected) return;
    onSelect(selected.includes(id) ? selected.filter(x => x !== id) : [...selected, id]);
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead className="text-left text-ink-500">
          <tr>
            {selectable && <th className="w-8 py-2" />}
            <th className="py-2">เลขที่ใบ</th>
            <th className="py-2">ประเภท</th>
            <th className="py-2">จ่ายให้</th>
            <th className="py-2">ช่วงวันที่</th>
            <th className="py-2 text-right">จำนวนเงิน</th>
            <th className="py-2">สถานะ</th>
            <th className="py-2">DD</th>
          </tr>
        </thead>
        <tbody>
          {claims.map(c => (
            <tr key={c.id} className="border-t border-slate-100 align-top">
              {selectable && (
                <td className="py-2">
                  <input type="checkbox" checked={selected?.includes(c.id) ?? false}
                    onChange={() => toggle(c.id)} aria-label={`เลือกใบ ${c.form_id}`} />
                </td>
              )}
              <td className="py-2">
                <Link href={`/finance/petty/${c.form_id}`} className="text-brand-700 hover:underline">
                  {c.form_id}
                </Link>
                {showReturnReason && c.return_reason && (
                  <p className="mt-0.5 text-xs text-amber-700">เหตุผลที่ตีกลับ: {c.return_reason}</p>
                )}
                {c.status === 'SENT_BACK' && c.review_remark && (
                  <p className="mt-0.5 text-xs text-orange-700">บัญชีส่งกลับ: {c.review_remark}</p>
                )}
              </td>
              <td className="py-2">{typeName(c.expense_type)}</td>
              <td className="py-2">{c.payee_name ?? '-'}</td>
              <td className="py-2 whitespace-nowrap">
                {c.period_from && c.period_to
                  ? (c.period_from === c.period_to ? c.period_from : `${c.period_from} – ${c.period_to}`)
                  : c.expense_date}
              </td>
              <td className="py-2 text-right tabular-nums">
                {c.amount.toLocaleString('th-TH', { minimumFractionDigits: 2 })}
              </td>
              <td className="py-2"><PettyStatusBadge status={c.status} /></td>
              <td className="py-2">{c.dd_no ?? '-'}</td>
            </tr>
          ))}
          {claims.length === 0 && (
            <tr><td colSpan={selectable ? 8 : 7} className="py-8 text-center text-ink-400">
              ไม่มีรายการ
            </td></tr>
          )}
        </tbody>
      </table>
    </div>
  );
}
