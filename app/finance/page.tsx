'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { BellRing, Landmark, UserRoundCheck } from 'lucide-react';
import { useSessionContext } from '@/app/context/SessionContext';
import { formatBaht } from '@/lib/finance/status';
import { fetchJson, sendOverdueReminders, showAlert, showConfirm } from './api';
import { AdvanceListView, type AdvanceListTab } from './components/AdvanceListView';
import { AdvanceSheet } from './components/AdvanceSheet';
import { FinanceCanvas, FinanceHeading, NoAccess, SummaryTiles } from './components/FinanceShell';
import type { AdvanceItem } from './types';

const TABS: AdvanceListTab[] = [
  { key: 'voucher', label: 'รอตั้งเบิก', match: i => i.status === 'AWAITING_VOUCHER' },
  { key: 'pay', label: 'รอจ่าย', match: i => i.status === 'AWAITING_PAYMENT' },
  { key: 'clearing', label: 'จ่ายแล้วรอเคลียร์', match: i => i.status === 'AWAITING_CLEARING' },
  { key: 'overdue', label: 'เกินกำหนด', match: i => i.overdue },
  { key: 'returned', label: 'ตีกลับผู้เบิก', match: i => i.status === 'RETURNED' },
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
  const [pendingPayees, setPendingPayees] = useState(0);

  const load = useCallback(() => {
    if (!user?.is_finance) return;
    fetchJson<AdvanceItem[]>('/api/finance/advances')
      .then(setItems)
      .catch(err => { setItems([]); showAlert({ icon: 'error', title: 'โหลดข้อมูลไม่สำเร็จ', text: err.message }); });
  }, [user?.is_finance]);

  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    if (!user?.is_finance) return;
    fetchJson<unknown[]>('/api/finance/payee-requests?status=PENDING')
      .then(r => setPendingPayees(Array.isArray(r) ? r.length : 0))
      .catch(() => setPendingPayees(0));
  }, [user?.is_finance]);

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

  const [reminding, setReminding] = useState(false);
  const remindInFlight = useRef(false);
  const overdueIds = useMemo(() => (items ?? []).filter(i => i.overdue).map(i => i.form_id), [items]);

  const remindAll = async () => {
    if (remindInFlight.current || overdueIds.length === 0) return;
    const res = await showConfirm({ title: `ส่งอีเมลแจ้งเตือนเกินกำหนด ${overdueIds.length} รายการ?` });
    if (!res.isConfirmed) return;
    remindInFlight.current = true;
    setReminding(true);
    try {
      let sent = 0;
      const skipped: { form_id: string; reason: string }[] = [];
      let disabled = false;
      for (let i = 0; i < overdueIds.length && !disabled; i += 200) {
        const r = await sendOverdueReminders(overdueIds.slice(i, i + 200));
        disabled = r.disabled;
        sent += r.sent;
        skipped.push(...r.skipped);
      }
      if (disabled) await showAlert({ icon: 'warning', title: 'อีเมลยังปิดอยู่ — ยังไม่ได้ส่ง' });
      else {
        const reasons = [...new Set(skipped.map(s => s.reason))].join(', ');
        await showAlert({
          icon: sent > 0 ? 'success' : 'info',
          title: `ส่งแล้ว ${sent} รายการ`,
          text: skipped.length > 0 ? `ข้าม ${skipped.length} รายการ: ${reasons}` : undefined,
        });
      }
      load();
    } catch (err) {
      showAlert({ icon: 'error', title: 'ส่งแจ้งเตือนไม่สำเร็จ', text: (err as Error).message });
    } finally {
      remindInFlight.current = false;
      setReminding(false);
    }
  };

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
      <FinanceHeading icon={Landmark} title="งานเบิกเงิน Advance" caption="ตั้งเบิก จ่ายเงิน และตรวจเคลียร์เงินทดรองจ่าย"
        actions={(
          <Link href="/finance/payee-accounts" className="v2-glass inline-flex items-center gap-2 rounded-xl px-4 py-2 text-sm font-medium text-ink-900 transition-shadow hover:shadow-md">
            <UserRoundCheck className="size-4" />
            บัญชีรับเงินพนักงาน
            {pendingPayees > 0 && (
              <span className="inline-flex min-w-5 items-center justify-center rounded-full bg-rose-600 px-1.5 text-xs font-semibold tabular-nums text-white" aria-label={`รอตรวจ ${pendingPayees} คำขอ`}>{pendingPayees}</span>
            )}
          </Link>
        )}
      />
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
        headerAction={tab === 'overdue' && overdueIds.length > 0 ? (
          <button type="button" onClick={remindAll} disabled={reminding}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium bg-white/10 text-white hover:bg-white/20 border border-white/20 transition-all cursor-pointer disabled:opacity-50">
            <BellRing size={14} /> <span>ส่งแจ้งเตือนทั้งหมด ({overdueIds.length})</span>
          </button>
        ) : undefined}
      />

      <AdvanceSheet mode="finance" formId={openFormId} isOpen={sheetOpen} onClose={handleClose} onChanged={handleChanged} />
    </FinanceCanvas>
  );
}
