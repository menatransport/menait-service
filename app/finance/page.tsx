'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { Landmark } from 'lucide-react';
import { useSessionContext } from '@/app/context/SessionContext';
import { formatBaht } from '@/lib/finance/status';
import { fetchJson, showAlert } from './api';
import { AdvanceListView, type AdvanceListTab } from './components/AdvanceListView';
import { AdvanceSheet } from './components/AdvanceSheet';
import { FinanceCanvas, FinanceHeading, NoAccess, SummaryTiles } from './components/FinanceShell';
import type { AdvanceItem } from './types';

const TABS: AdvanceListTab[] = [
  { key: 'voucher', label: 'รอตั้งเบิก', match: i => i.status === 'AWAITING_VOUCHER' },
  { key: 'pay', label: 'รอจ่าย', match: i => i.status === 'AWAITING_PAYMENT' },
  { key: 'clearing', label: 'จ่ายแล้วรอเคลียร์', match: i => i.status === 'AWAITING_CLEARING' },
  { key: 'overdue', label: 'เกินกำหนด', match: i => i.overdue },
  { key: 'review', label: 'รอบัญชีตรวจ', match: i => i.status === 'AWAITING_REVIEW' },
  { key: 'sentback', label: 'ส่งกลับแก้ไข', match: i => i.status === 'SENT_BACK' },
  { key: 'closed', label: 'ปิดแล้ว', match: i => i.status === 'CLOSED' },
  { key: 'all', label: 'ทั้งหมด', match: () => true },
];

export default function FinanceQueuePage() {
  const { user, loading } = useSessionContext();
  const [items, setItems] = useState<AdvanceItem[] | null>(null);
  const [tab, setTab] = useState('voucher');
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

  const stats = useMemo(() => {
    const all = items ?? [];
    const count = (match: (i: AdvanceItem) => boolean) => all.filter(match).length;
    return [
      { label: 'ยอดค้างเคลียร์ (บาท)', value: formatBaht(outstanding) },
      { label: 'รอตั้งเบิก', value: count(i => i.status === 'AWAITING_VOUCHER') },
      { label: 'รอจ่าย', value: count(i => i.status === 'AWAITING_PAYMENT') },
      { label: 'รอบัญชีตรวจ', value: count(i => i.status === 'AWAITING_REVIEW') },
      { label: 'เกินกำหนดเคลียร์', value: count(i => i.overdue), alert: true },
    ];
  }, [items, outstanding]);

  const handleOpen = (item: AdvanceItem) => { setOpenFormId(item.form_id); setSheetOpen(true); };
  const handleClose = () => setSheetOpen(false);
  const handleChanged = () => load();

  if (!loading && !user?.is_finance) {
    return (
      <FinanceCanvas title="งานเบิกเงิน Advance" width="max-w-lg">
        <NoAccess />
      </FinanceCanvas>
    );
  }

  return (
    <FinanceCanvas title="งานเบิกเงิน Advance">
      <FinanceHeading icon={Landmark} title="งานเบิกเงิน Advance" caption="ตั้งเบิก จ่ายเงิน และตรวจเคลียร์เงินทดรองจ่าย" />
      <SummaryTiles items={stats} />
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

      <AdvanceSheet mode="finance" formId={openFormId} isOpen={sheetOpen} onClose={handleClose} onChanged={handleChanged} />
    </FinanceCanvas>
  );
}
