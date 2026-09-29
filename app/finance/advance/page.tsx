'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { Plus } from 'lucide-react';
import { Navbar } from '@/components/navbar';
import { WaveBackground } from '@/components/wave-background';
import { fetchJson, showAlert } from '../api';
import { AdvanceListView, type AdvanceListTab } from '../components/AdvanceListView';
import { AdvanceSheet } from '../components/AdvanceSheet';
import type { AdvanceItem } from '../types';

const TABS: AdvanceListTab[] = [
  { key: 'all', label: 'ทั้งหมด', match: () => true },
  { key: 'pending', label: 'รออนุมัติ', match: i => i.status === 'PENDING_APPROVAL' },
  { key: 'pay', label: 'รอจ่าย', match: i => i.status === 'AWAITING_VOUCHER' || i.status === 'AWAITING_PAYMENT' },
  { key: 'clear', label: 'ต้องเคลียร์', match: i => i.status === 'AWAITING_CLEARING' || i.status === 'SENT_BACK' },
  { key: 'review', label: 'รอบัญชีตรวจ', match: i => i.status === 'AWAITING_REVIEW' },
  { key: 'closed', label: 'ปิดแล้ว', match: i => i.status === 'CLOSED' || i.status === 'REJECTED' },
];

export default function MyAdvancesPage() {
  const [items, setItems] = useState<AdvanceItem[] | null>(null);
  const [tab, setTab] = useState('all');
  const [openFormId, setOpenFormId] = useState<string | null>(null);
  const [sheetOpen, setSheetOpen] = useState(false);

  const load = useCallback(() => {
    fetchJson<AdvanceItem[]>('/api/finance/advances?mine=1')
      .then(setItems)
      .catch(err => { setItems([]); showAlert({ icon: 'error', title: 'โหลดข้อมูลไม่สำเร็จ', text: err.message }); });
  }, []);

  useEffect(() => { load(); }, [load]);

  const handleOpen = (item: AdvanceItem) => { setOpenFormId(item.form_id); setSheetOpen(true); };
  const handleClose = () => setSheetOpen(false);
  const handleChanged = () => load();

  return (
    <Navbar isHome={false} title="ติดตามคำขอ Advance">
      <main className="flex-1 min-h-0 bg-[#026a75] rounded-t-[1.5rem] sm:rounded-t-[2rem] lg:rounded-t-[3rem] shadow-2xl overflow-y-auto relative">
        <WaveBackground />
        <div className="w-full max-w-screen-2xl mx-auto px-3 py-6 sm:px-6 lg:px-10 sm:py-8 relative z-10">
          <AdvanceListView
            mode="mine"
            items={items}
            loading={items === null}
            tabs={TABS}
            activeTab={tab}
            onTabChange={setTab}
            onOpen={handleOpen}
            headerAction={
              <Link
                href="/finance/advance/new"
                className="inline-flex items-center gap-1.5 rounded-full bg-white px-3 py-1.5 text-sm font-medium text-[#026a75] hover:bg-white/90 transition-all"
              >
                <Plus className="h-4 w-4" /> ขอเบิกเงิน
              </Link>
            }
          />
        </div>

        <AdvanceSheet mode="mine" formId={openFormId} isOpen={sheetOpen} onClose={handleClose} onChanged={handleChanged} />
      </main>
    </Navbar>
  );
}
