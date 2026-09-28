'use client';

import { useRouter } from 'next/navigation';
import { formatBaht, formatDate } from '@/lib/finance/status';
import type { AdvanceItem } from '../types';
import { StatusBadge } from './StatusBadge';

const TH = 'whitespace-nowrap px-3 py-2 text-left text-xs font-semibold text-gray-600';
const TD = 'whitespace-nowrap px-3 py-2 text-sm';

export function AdvanceTable({ items }: { items: AdvanceItem[] }) {
  const router = useRouter();
  if (items.length === 0) return <p className="py-6 text-center text-sm text-gray-500">ไม่มีรายการ</p>;
  return (
    <div className="overflow-x-auto">
      <table className="min-w-full divide-y divide-gray-100">
        <thead className="bg-gray-50">
          <tr>
            {['ลำดับ', 'เลขที่เอกสาร', 'ผู้เบิก', 'แผนก', 'ศูนย์', 'วัตถุประสงค์', 'ยอดเงิน', 'วันที่ใช้เงิน', 'เลขที่ใบเบิก',
              'วันที่โอนเงิน', 'กำหนดการเคลียร์', 'ยอดใช้จริง', 'รับคืน (เบิกเพิ่ม)', 'สถานะ'].map(h => <th key={h} className={TH}>{h}</th>)}
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-50">
          {items.map((it, idx) => (
            <tr key={it.form_id} onClick={() => router.push(`/finance/${encodeURIComponent(it.form_id)}`)}
              className={`cursor-pointer hover:bg-[#8ce4cb]/10 ${it.overdue ? 'bg-rose-50/60' : ''}`}>
              <td className={TD}>{idx + 1}</td>
              <td className={`${TD} font-medium text-[#055058]`}>{it.form_id}</td>
              <td className={TD}>{it.requester.name ?? it.requester.employee_id}</td>
              <td className={TD}>{it.requester.department ?? '-'}</td>
              <td className={TD}>{it.requester.site_code ?? it.requester.site ?? '-'}</td>
              <td className={`${TD} max-w-xs truncate`}>{it.fin?.purpose ?? it.request.purpose ?? '-'}</td>
              <td className={`${TD} text-right`}>{formatBaht(it.fin?.amount_paid ?? it.request.amount)}</td>
              <td className={TD}>{formatDate(it.request.use_date)}</td>
              <td className={TD}>{it.fin?.voucher_no ?? '-'}</td>
              <td className={TD}>{formatDate(it.fin?.transfer_date)}</td>
              <td className={TD}>{formatDate(it.fin?.clear_due_date)}</td>
              <td className={`${TD} text-right`}>{formatBaht(it.fin?.amount_actual)}</td>
              <td className={`${TD} text-right`}>{formatBaht(it.fin?.settle_amount)}</td>
              <td className={TD}><StatusBadge status={it.status} overdue={it.overdue} /></td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
