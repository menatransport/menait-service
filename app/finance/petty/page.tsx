'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { Receipt } from 'lucide-react';
import { MascotLoader } from '@/components/loading';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useSessionContext } from '@/app/context/SessionContext';
import type { PettyClaim, PettyExpenseType } from '@/app/finance/types-petty';
import type { PettyStatus } from '@/lib/finance/petty-status';
import { showAlert } from '../api';
import { getExpenseTypes, listClaims } from '../petty-api';
import { FinanceCanvas, FinanceHeading, Panel } from '../components/FinanceShell';
import { ClaimTable } from '../components/petty/ClaimTable';

const TITLE = 'ใบเบิกเงินสดย่อยของฉัน';
const CAPTION = 'ใบที่คุณเปิด พร้อมสถานะและสิ่งที่ต้องแก้';

const TABS: { key: string; label: string; statuses: PettyStatus[] | null }[] = [
  { key: 'open', label: 'กำลังดำเนินการ', statuses: ['PENDING_APPROVAL', 'APPROVED', 'TRANSFERRED', 'AWAITING_REVIEW'] },
  { key: 'fix', label: 'ต้องแก้ไข', statuses: ['RETURNED', 'SENT_BACK'] },
  { key: 'closed', label: 'คืนยอดแล้ว', statuses: ['CLOSED'] },
  { key: 'all', label: 'ทั้งหมด', statuses: null },
];

export default function MyPettyClaimsPage() {
  const { loading } = useSessionContext();
  const [tab, setTab] = useState('open');
  const [claims, setClaims] = useState<PettyClaim[] | null>(null);
  const [types, setTypes] = useState<PettyExpenseType[]>([]);

  const load = useCallback(async () => {
    try {
      const [page, t] = await Promise.all([listClaims({ view: 'mine', limit: '200' }), getExpenseTypes()]);
      setClaims(page.items); setTypes(t);
    } catch (err) {
      setClaims([]);
      showAlert({ icon: 'error', title: 'โหลดรายการไม่สำเร็จ', text: (err as Error).message });
    }
  }, []);

  useEffect(() => { void load(); }, [load]);

  const active = TABS.find(t => t.key === tab)!;
  const shown = (claims ?? []).filter(c => !active.statuses || active.statuses.includes(c.status));
  const needFix = (claims ?? []).filter(c => c.status === 'RETURNED' || c.status === 'SENT_BACK').length;

  if (loading || claims === null) return <MascotLoader />;

  return (
    <FinanceCanvas title={TITLE}>
      <FinanceHeading icon={Receipt} title={TITLE} caption={CAPTION}
        actions={
          <Link href="/finance/petty/new"
            className="rounded-lg bg-brand-600 px-3 py-2 text-sm text-white">เปิดใบใหม่</Link>
        } />

      {needFix > 0 && (
        <div className="mb-3 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
          มี {needFix} ใบที่ถูกตีกลับหรือส่งกลับให้แก้ — ดูที่แท็บ &ldquo;ต้องแก้ไข&rdquo;
        </div>
      )}

      <Tabs value={tab} onValueChange={setTab} className="mb-4">
        <TabsList>
          {TABS.map(t => <TabsTrigger key={t.key} value={t.key}>{t.label}</TabsTrigger>)}
        </TabsList>
      </Tabs>

      <Panel title={`${shown.length} ใบ`}>
        <ClaimTable claims={shown} types={types} showReturnReason={tab === 'fix' || tab === 'all'} />
      </Panel>
    </FinanceCanvas>
  );
}
