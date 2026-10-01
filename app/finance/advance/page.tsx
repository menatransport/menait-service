'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { ClipboardCheck, Plus } from 'lucide-react';
import { fetchJson, showAlert } from '../api';
import { AdvanceListView, type AdvanceListTab } from '../components/AdvanceListView';
import { AdvanceSheet } from '../components/AdvanceSheet';
import { FinanceCanvas, FinanceHeading, SummaryTiles } from '../components/FinanceShell';
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

  const all = items ?? [];
  const count = (match: (i: AdvanceItem) => boolean) => all.filter(match).length;
  const stats = [
    { label: 'คำขอทั้งหมด', value: all.length },
    { label: 'รออนุมัติ', value: count(i => i.status === 'PENDING_APPROVAL') },
    { label: 'รอรับเงิน', value: count(i => i.status === 'AWAITING_VOUCHER' || i.status === 'AWAITING_PAYMENT') },
    { label: 'ต้องเคลียร์', value: count(i => i.status === 'AWAITING_CLEARING' || i.status === 'SENT_BACK') },
    { label: 'เกินกำหนดเคลียร์', value: count(i => i.overdue), alert: true },
  ];

  return (
    <FinanceCanvas title="ติดตามคำขอ Advance">
      <FinanceHeading
        icon={ClipboardCheck}
        title="คำขอเบิกเงิน Advance ของฉัน"
        caption="ติดตามสถานะ รับเงิน และส่งเคลียร์เงินทดรองจ่าย"
        actions={
          <Link href="/finance/advance/new" className="v2-btn text-sm">
            <Plus className="h-4 w-4" /> ขอเบิกเงิน
          </Link>
        }
      />
      <SummaryTiles items={stats} />
      <AdvanceListView
        mode="mine"
        items={items}
        loading={items === null}
        tabs={TABS}
        activeTab={tab}
        onTabChange={setTab}
        onOpen={handleOpen}
      />

      <AdvanceSheet mode="mine" formId={openFormId} isOpen={sheetOpen} onClose={handleClose} onChanged={handleChanged} />
    </FinanceCanvas>
  );
}
