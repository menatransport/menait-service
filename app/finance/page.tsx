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
import { fetchAllAdvances, type AdvancePage, type AdvanceSummary, type ScopeFilter } from '@/lib/finance/advanceQuery';

const TABS: AdvanceListTab[] = [
  { key: 'voucher', label: 'รอตั้งเบิก', status: ['AWAITING_VOUCHER'] },
  { key: 'pay', label: 'รอจ่าย', status: ['AWAITING_PAYMENT'] },
  { key: 'clearing', label: 'จ่ายแล้วรอเคลียร์', status: ['AWAITING_CLEARING'] },
  { key: 'overdue', label: 'เกินกำหนด', overdue: true },
  { key: 'returned', label: 'ตีกลับผู้เบิก', status: ['RETURNED'] },
  { key: 'review', label: 'รอบัญชีตรวจ', status: ['AWAITING_REVIEW'] },
  { key: 'sentback', label: 'ส่งกลับแก้ไข', status: ['SENT_BACK'] },
  { key: 'closed', label: 'ปิดแล้ว', status: ['CLOSED'] },
  { key: 'all', label: 'ทั้งหมด' },
];

export default function FinanceQueuePage() {
  const { user, loading } = useSessionContext();
  const [summary, setSummary] = useState<AdvanceSummary | null>(null);
  const [scope, setScope] = useState<ScopeFilter>({});
  const [refreshKey, setRefreshKey] = useState(0);
  const [tab, setTab] = useState('voucher');
  const [openFormId, setOpenFormId] = useState<string | null>(null);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [pendingPayees, setPendingPayees] = useState(0);

  const load = useCallback(() => setRefreshKey(k => k + 1), []);

  useEffect(() => {
    if (!user?.is_finance) return;
    fetchJson<unknown[]>('/api/finance/payee-requests?status=PENDING')
      .then(r => setPendingPayees(Array.isArray(r) ? r.length : 0))
      .catch(() => setPendingPayees(0));
  }, [user?.is_finance]);

  const stats = useMemo(() => {
    const n = (status: string) => summary?.counts?.[status] ?? 0;
    return [
      { label: 'ยอดค้างเคลียร์ (บาท)', value: formatBaht(summary?.outstanding_amount ?? 0) },
      { label: 'รอตั้งเบิก', value: n('AWAITING_VOUCHER') },
      { label: 'รอจ่าย', value: n('AWAITING_PAYMENT') },
      { label: 'รอบัญชีตรวจ', value: n('AWAITING_REVIEW') },
      { label: 'เกินกำหนดเคลียร์', value: summary?.overdue ?? 0, alert: true },
    ];
  }, [summary]);

  const [reminding, setReminding] = useState(false);
  const remindInFlight = useRef(false);
  const overdueCount = summary?.overdue ?? 0;

  const remindAll = async () => {
    if (remindInFlight.current || overdueCount === 0) return;
    const res = await showConfirm({
      title: `ส่งอีเมลแจ้งเตือนเกินกำหนด ${overdueCount} รายการ?`,
      text: 'ส่งทุกรายการที่เกินกำหนดตามตัวกรองปัจจุบัน (ค้นหา/ช่วงเดือน/ศูนย์ค่าใช้จ่าย) และส่งทันทีแม้เพิ่งแจ้งเตือนไป',
    });
    if (!res.isConfirmed) return;
    remindInFlight.current = true;
    setReminding(true);
    // small batches: the BE sends each email inside the request, so a big batch could outlive the proxy timeout
    const BATCH = 20;
    let sent = 0;
    try {
      // every overdue id for the current scope (all pages), then send in small batches
      const overdueIds = (await fetchAllAdvances(q => fetchJson<AdvancePage>(`/api/finance/advances?${q}`), scope, { overdue: true }))
        .map(i => i.form_id);
      const skipped: { form_id: string; reason: string }[] = [];
      let disabled = false;
      for (let i = 0; i < overdueIds.length && !disabled; i += BATCH) {
        const r = await sendOverdueReminders(overdueIds.slice(i, i + BATCH));
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
      showAlert({
        icon: 'error', title: 'ส่งแจ้งเตือนไม่สำเร็จ',
        text: sent > 0 ? `ส่งไปแล้ว ${sent} รายการก่อนเกิดข้อผิดพลาด — ${(err as Error).message}` : (err as Error).message,
      });
      load();
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
        tabs={TABS}
        activeTab={tab}
        onTabChange={setTab}
        onOpen={handleOpen}
        exportFileBase="advance"
        refreshKey={refreshKey}
        onSummary={setSummary}
        onScopeChange={setScope}
        headerAction={tab === 'overdue' && overdueCount > 0 ? (
          <button type="button" onClick={remindAll} disabled={reminding}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium bg-white/10 text-white hover:bg-white/20 border border-white/20 transition-all cursor-pointer disabled:opacity-50">
            <BellRing size={14} /> <span>ส่งแจ้งเตือนทั้งหมด ({overdueCount})</span>
          </button>
        ) : undefined}
      />

      <AdvanceSheet mode="finance" formId={openFormId} isOpen={sheetOpen} onClose={handleClose} onChanged={handleChanged} />
    </FinanceCanvas>
  );
}
