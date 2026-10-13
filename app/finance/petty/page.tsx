'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { Plus, Receipt } from 'lucide-react';
import { MascotLoader } from '@/components/loading';
import { useSessionContext } from '@/app/context/SessionContext';
import type { PettyClaim, PettyExpenseType, PettyFund } from '@/app/finance/types-petty';
import type { PettyTab } from '@/lib/finance/petty-list';
import { formatBaht } from '@/lib/finance/status';
import { showAlert } from '../api';
import { getExpenseTypes, getFunds, listClaims } from '../petty-api';
import { FinanceCanvas, FinanceHeading, SummaryTiles } from '../components/FinanceShell';
import { PettyListView } from '../components/petty/PettyListView';
import { PettySheet } from '../components/petty/PettySheet';

const TITLE = 'ใบเบิกเงินสดย่อยของฉัน';
const CAPTION = 'ใบที่คุณเปิด ติดตามสถานะ และสิ่งที่ต้องแก้';

const TABS: PettyTab[] = [
  { key: 'all', label: 'ทั้งหมด' },
  { key: 'pending', label: 'รออนุมัติ', statuses: ['PENDING_APPROVAL'] },
  { key: 'paying', label: 'อนุมัติแล้ว/รอโอน', statuses: ['APPROVED', 'TRANSFERRED'] },
  { key: 'fix', label: 'ต้องแก้ไข', statuses: ['RETURNED', 'SENT_BACK'] },
  { key: 'review', label: 'รอบัญชีตรวจ', statuses: ['AWAITING_REVIEW'] },
  { key: 'closed', label: 'คืนยอดแล้ว', statuses: ['CLOSED'] },
];

export default function MyPettyClaimsPage() {
  const { loading } = useSessionContext();
  const [tab, setTab] = useState('all');
  const [claims, setClaims] = useState<PettyClaim[] | null>(null);
  const [types, setTypes] = useState<PettyExpenseType[]>([]);
  const [funds, setFunds] = useState<PettyFund[]>([]);
  const [openId, setOpenId] = useState<string | null>(null);
  const [sheetOpen, setSheetOpen] = useState(false);

  const load = useCallback(async () => {
    try {
      const [page, t, f] = await Promise.all([listClaims({ view: 'mine', limit: '200' }), getExpenseTypes(), getFunds(true)]);
      setClaims(page.items); setTypes(t); setFunds(f);
    } catch (err) {
      setClaims([]);
      showAlert({ icon: 'error', title: 'โหลดรายการไม่สำเร็จ', text: (err as Error).message });
    }
  }, []);
  useEffect(() => { void load(); }, [load]);

  if (loading || claims === null) return <MascotLoader />;

  const count = (...s: PettyClaim['status'][]) => claims.filter(c => s.includes(c.status)).length;
  const sum = (...s: PettyClaim['status'][]) => claims.filter(c => s.includes(c.status)).reduce((a, c) => a + c.amount, 0);
  const stats = [
    { label: 'ใบทั้งหมด', value: claims.length },
    { label: 'รออนุมัติ', value: count('PENDING_APPROVAL') },
    { label: 'รอโอน/รอส่งบัญชี', value: count('APPROVED', 'TRANSFERRED') },
    { label: 'ต้องแก้ไข', value: count('RETURNED', 'SENT_BACK'), alert: true },
    { label: 'ยอดที่ยังไม่ปิดรอบ', value: formatBaht(sum('PENDING_APPROVAL', 'APPROVED', 'TRANSFERRED', 'AWAITING_REVIEW', 'SENT_BACK')), hint: 'บาท' },
  ];

  return (
    <FinanceCanvas title={TITLE}>
      <FinanceHeading icon={Receipt} title={TITLE} caption={CAPTION}
        actions={<Link href="/finance/petty/new" className="v2-btn text-sm"><Plus className="h-4 w-4" /> เปิดใบใหม่</Link>} />
      <SummaryTiles items={stats} />
      <PettyListView claims={claims} types={types} funds={funds} tabs={TABS} activeTab={tab} onTabChange={setTab}
        onOpen={c => { setOpenId(c.form_id); setSheetOpen(true); }} exportFileBase="เงินสดย่อยของฉัน" />
      <PettySheet formId={openId} isOpen={sheetOpen} onClose={() => setSheetOpen(false)} onChanged={() => void load()} />
    </FinanceCanvas>
  );
}
