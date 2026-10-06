'use client';

import { useState } from 'react';
import Link from 'next/link';
import { ClipboardCheck, Plus } from 'lucide-react';
import { tabCount, type AdvanceSummary } from '@/lib/finance/advanceQuery';
import { AdvanceListView, type AdvanceListTab } from '../components/AdvanceListView';
import { AdvanceSheet } from '../components/AdvanceSheet';
import { FinanceCanvas, FinanceHeading, SummaryTiles } from '../components/FinanceShell';
import type { AdvanceItem } from '../types';

const TABS: AdvanceListTab[] = [
  { key: 'all', label: 'ทั้งหมด' },
  { key: 'pending', label: 'รออนุมัติ', status: ['PENDING_APPROVAL'] },
  { key: 'pay', label: 'รอจ่าย', status: ['AWAITING_VOUCHER', 'AWAITING_PAYMENT'] },
  { key: 'clear', label: 'ต้องเคลียร์', status: ['AWAITING_CLEARING', 'SENT_BACK'] },
  { key: 'returned', label: 'ต้องแก้ไข', status: ['RETURNED'] },
  { key: 'review', label: 'รอบัญชีตรวจ', status: ['AWAITING_REVIEW'] },
  { key: 'closed', label: 'ปิดแล้ว', status: ['CLOSED', 'REJECTED'] },
];

export default function MyAdvancesPage() {
  const [summary, setSummary] = useState<AdvanceSummary | null>(null);
  const [refreshKey, setRefreshKey] = useState(0);
  const [tab, setTab] = useState('all');
  const [openFormId, setOpenFormId] = useState<string | null>(null);
  const [sheetOpen, setSheetOpen] = useState(false);

  const handleOpen = (item: AdvanceItem) => { setOpenFormId(item.form_id); setSheetOpen(true); };
  const handleClose = () => setSheetOpen(false);
  const handleChanged = () => setRefreshKey(k => k + 1);

  const count = (...statuses: string[]) => statuses.reduce((n, s) => n + (summary?.counts?.[s] ?? 0), 0);
  const stats = [
    { label: 'คำขอทั้งหมด', value: tabCount({}, summary) ?? 0 },
    { label: 'รออนุมัติ', value: count('PENDING_APPROVAL') },
    { label: 'รอรับเงิน', value: count('AWAITING_VOUCHER', 'AWAITING_PAYMENT') },
    { label: 'ต้องเคลียร์', value: count('AWAITING_CLEARING', 'SENT_BACK') },
    { label: 'เกินกำหนดเคลียร์', value: summary?.overdue ?? 0, alert: true },
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
        tabs={TABS}
        activeTab={tab}
        onTabChange={setTab}
        onOpen={handleOpen}
        refreshKey={refreshKey}
        onSummary={setSummary}
      />

      <AdvanceSheet mode="mine" formId={openFormId} isOpen={sheetOpen} onClose={handleClose} onChanged={handleChanged} />
    </FinanceCanvas>
  );
}
