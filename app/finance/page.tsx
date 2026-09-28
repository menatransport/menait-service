'use client';

import { useEffect, useMemo, useState } from 'react';
import { Download } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useSessionContext } from '@/app/context/SessionContext';
import { exportAdvancesXlsx } from '@/lib/finance/export';
import { formatBaht, todayBkk } from '@/lib/finance/status';
import { fetchJson, showAlert } from './api';
import { AdvanceTable } from './components/AdvanceTable';
import { FinanceShell, NoAccess, Panel } from './components/FinanceShell';
import type { AdvanceItem } from './types';

type Tab = { key: string; label: string; match: (i: AdvanceItem) => boolean };

const TABS: Tab[] = [
  { key: 'pay', label: 'รอจ่าย', match: i => i.status === 'AWAITING_PAYMENT' },
  { key: 'clearing', label: 'จ่ายแล้วรอเคลียร์', match: i => i.status === 'AWAITING_CLEARING' },
  { key: 'overdue', label: 'เกินกำหนด', match: i => i.overdue },
  { key: 'review', label: 'รอการเงินตรวจ', match: i => i.status === 'AWAITING_REVIEW' },
  { key: 'sentback', label: 'ส่งกลับแก้ไข', match: i => i.status === 'SENT_BACK' },
  { key: 'closed', label: 'ปิดแล้ว', match: i => i.status === 'CLOSED' },
  { key: 'all', label: 'ทั้งหมด', match: () => true },
];

export default function FinanceQueuePage() {
  const { user, loading } = useSessionContext();
  const [items, setItems] = useState<AdvanceItem[] | null>(null);
  const [tab, setTab] = useState('pay');
  const [search, setSearch] = useState('');

  useEffect(() => {
    if (!user?.is_finance) return;
    fetchJson<AdvanceItem[]>('/api/finance/advances')
      .then(setItems)
      .catch(err => { setItems([]); showAlert({ icon: 'error', title: 'โหลดข้อมูลไม่สำเร็จ', text: err.message }); });
  }, [user?.is_finance]);

  const current = TABS.find(t => t.key === tab)!;
  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return (items ?? []).filter(current.match).filter(i => !q
      || i.form_id.toLowerCase().includes(q)
      || (i.requester.name ?? '').toLowerCase().includes(q)
      || (i.fin?.voucher_no ?? '').toLowerCase().includes(q));
  }, [items, current, search]);

  const outstanding = useMemo(() => (items ?? [])
    .filter(i => i.fin && i.status !== 'CLOSED')
    .reduce((sum, i) => sum + (i.fin?.amount_paid ?? 0), 0), [items]);

  if (!loading && !user?.is_finance) return <FinanceShell title="งานเบิกเงิน Advance"><NoAccess /></FinanceShell>;

  return (
    <FinanceShell title="งานเบิกเงิน Advance" wide>
      <Panel
        title={`ยอดค้างเคลียร์ ${formatBaht(outstanding)} บาท`}
        actions={
          <Button type="button" variant="outline" size="sm" disabled={!filtered.length}
            onClick={() => exportAdvancesXlsx(filtered, `advance-${current.key}-${todayBkk()}.xlsx`)}>
            <Download className="mr-1 h-4 w-4" /> Excel
          </Button>
        }
      >
        <div className="mb-4 flex flex-wrap gap-2">
          {TABS.map(t => {
            const count = (items ?? []).filter(t.match).length;
            return (
              <button key={t.key} type="button" onClick={() => setTab(t.key)}
                className={`rounded-full px-3 py-1.5 text-xs font-medium ${tab === t.key ? 'bg-[#026a75] text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}>
                {t.label} ({count})
              </button>
            );
          })}
        </div>
        <Input className="mb-3 max-w-sm" placeholder="ค้นหา เลขที่เอกสาร / ผู้เบิก / เลขที่ใบเบิก" value={search} onChange={e => setSearch(e.target.value)} />
        {items === null ? <p className="text-sm text-gray-400">กำลังโหลด...</p> : <AdvanceTable items={filtered} />}
      </Panel>
    </FinanceShell>
  );
}
