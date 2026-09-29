'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { Navbar } from '@/components/navbar';
import { WaveBackground } from '@/components/wave-background';
import { useSessionContext } from '@/app/context/SessionContext';
import { formatBaht } from '@/lib/finance/status';
import { fetchJson, showAlert } from './api';
import { AdvanceListView, type AdvanceListTab } from './components/AdvanceListView';
import { AdvanceSheet } from './components/AdvanceSheet';
import { NoAccess } from './components/FinanceShell';
import type { AdvanceItem } from './types';

const TABS: AdvanceListTab[] = [
  { key: 'voucher', label: 'รอตั้งเบิก', match: i => i.status === 'AWAITING_VOUCHER' },
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
  const [openFormId, setOpenFormId] = useState<string | null>(null);
  const [sheetOpen, setSheetOpen] = useState(false);

  const load = useCallback(() => {
    if (!user?.is_finance) return;
    fetchJson<AdvanceItem[]>('/api/finance/advances')
      .then(setItems)
      .catch(err => { setItems([]); showAlert({ icon: 'error', title: 'โหลดข้อมูลไม่สำเร็จ', text: err.message }); });
  }, [user?.is_finance]);

  useEffect(() => { load(); }, [load]);

  const outstanding = useMemo(() => (items ?? [])
    .filter(i => i.fin && i.status !== 'CLOSED')
    .reduce((sum, i) => sum + (i.fin?.amount_paid ?? 0), 0), [items]);

  const handleOpen = (item: AdvanceItem) => { setOpenFormId(item.form_id); setSheetOpen(true); };
  const handleClose = () => setSheetOpen(false);
  const handleChanged = () => load();

  if (!loading && !user?.is_finance) {
    return (
      <Navbar isHome={false} title="งานเบิกเงิน Advance">
        <main className="flex-1 min-h-0 bg-[#026a75] rounded-t-[1.5rem] sm:rounded-t-[2rem] lg:rounded-t-[3rem] shadow-2xl overflow-y-auto relative">
          <WaveBackground />
          <div className="w-full max-w-screen-2xl mx-auto px-3 py-6 sm:px-6 lg:px-10 sm:py-8 relative z-10">
            <NoAccess />
          </div>
        </main>
      </Navbar>
    );
  }

  return (
    <Navbar isHome={false} title="งานเบิกเงิน Advance">
      <main className="flex-1 min-h-0 bg-[#026a75] rounded-t-[1.5rem] sm:rounded-t-[2rem] lg:rounded-t-[3rem] shadow-2xl overflow-y-auto relative">
        <WaveBackground />
        <div className="w-full max-w-screen-2xl mx-auto px-3 py-6 sm:px-6 lg:px-10 sm:py-8 relative z-10">
          <div className="mb-4 inline-flex items-center gap-2 rounded-full bg-white/10 px-4 py-2 text-sm font-medium text-white ring-1 ring-white/20">
            ยอดค้างเคลียร์ {formatBaht(outstanding)} บาท
          </div>
          <AdvanceListView
            mode="finance"
            items={items}
            loading={items === null}
            tabs={TABS}
            activeTab={tab}
            onTabChange={setTab}
            onOpen={handleOpen}
            exportFileBase="advance"
          />
        </div>

        <AdvanceSheet mode="finance" formId={openFormId} isOpen={sheetOpen} onClose={handleClose} onChanged={handleChanged} />
      </main>
    </Navbar>
  );
}
