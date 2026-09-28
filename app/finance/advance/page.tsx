'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Plus } from 'lucide-react';
import { formatBaht, formatDate } from '@/lib/finance/status';
import { fetchJson, showAlert } from '../api';
import { FinanceShell, Panel } from '../components/FinanceShell';
import { StatusBadge } from '../components/StatusBadge';
import type { AdvanceItem } from '../types';

export default function MyAdvancesPage() {
  const [items, setItems] = useState<AdvanceItem[] | null>(null);

  useEffect(() => {
    fetchJson<AdvanceItem[]>('/api/finance/advances?mine=1')
      .then(setItems)
      .catch(err => { setItems([]); showAlert({ icon: 'error', title: 'โหลดข้อมูลไม่สำเร็จ', text: err.message }); });
  }, []);

  return (
    <FinanceShell title="เบิกเงิน Advance ของฉัน">
      <Panel
        title="รายการเบิกเงินของฉัน"
        actions={
          <Link href="/finance/advance/new" className="inline-flex items-center gap-1 rounded-xl bg-[#026a75] px-3 py-2 text-sm font-medium text-white hover:bg-[#055058]">
            <Plus className="h-4 w-4" /> ขอเบิกเงิน
          </Link>
        }
      >
        {items === null ? (
          <p className="text-sm text-gray-400">กำลังโหลด...</p>
        ) : items.length === 0 ? (
          <p className="text-sm text-gray-500">ยังไม่มีรายการ</p>
        ) : (
          <ul className="divide-y divide-gray-100">
            {items.map(it => (
              <li key={it.form_id}>
                <Link href={`/finance/advance/${encodeURIComponent(it.form_id)}`} className="flex flex-col gap-1 py-3 hover:bg-gray-50 sm:flex-row sm:items-center sm:justify-between">
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-[#055058]">{it.form_id}</p>
                    <p className="truncate text-xs text-gray-500">{it.request.purpose ?? '-'}</p>
                  </div>
                  <div className="flex flex-wrap items-center gap-3 text-sm">
                    <span>{formatBaht(it.fin?.amount_paid ?? it.request.amount)}</span>
                    {it.fin && <span className="text-xs text-gray-500">กำหนดเคลียร์ {formatDate(it.fin.clear_due_date)}</span>}
                    <StatusBadge status={it.status} overdue={it.overdue} />
                  </div>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </Panel>
    </FinanceShell>
  );
}
