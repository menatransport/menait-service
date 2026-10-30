'use client';

import { Suspense, useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { ClipboardCheck, Plus } from 'lucide-react';
import { MascotLoader } from '@/components/loading';
import type { PettyClaim, PettyExpenseType, PettyFund } from '@/app/finance/types-petty';
import type { PettyTab } from '@/lib/finance/petty-list';
import { filterByType } from '@/lib/finance/petty-type-filter';
import { formatBaht } from '@/lib/finance/status';
import { showAlert } from '../api';
import { getExpenseTypes, getFunds, listAllClaims } from '../petty-api';
import { PettyListView } from '../components/petty/PettyListView';
import { PettySheet } from '../components/petty/PettySheet';
import { TypeFilter, usePettyTypeFilter } from '../components/petty/TypeFilter';
import { FinanceCanvas, FinanceHeading, SummaryTiles } from '../components/FinanceShell';

const TITLE = 'ใบเบิกเงินสดย่อยของฉัน';
const CAPTION = 'ใบที่คุณเปิด สถานะ และสิ่งที่ต้องแก้';

const TABS: PettyTab[] = [
  { key: 'all', label: 'ทั้งหมด' },
  { key: 'pending', label: 'รออนุมัติ', statuses: ['PENDING_APPROVAL'] },
  { key: 'approved', label: 'อนุมัติจ่ายแล้ว', statuses: ['APPROVED', 'CLEAR_PENDING', 'TRANSFERRED'] },
  { key: 'fix', label: 'ต้องแก้ไข', statuses: ['RETURNED', 'SENT_BACK'], tone: 'alert' },
  { key: 'review', label: 'อยู่ที่บัญชี', statuses: ['AWAITING_REVIEW', 'REVIEWED'] },
  { key: 'closed', label: 'ปิดแล้ว', statuses: ['CLOSED'] },
];

export default function MyPettyClaimsPage() {
  // ?type= อ่านผ่าน useSearchParams ต้องมี Suspense ครอบ
  return (
    <Suspense fallback={<MascotLoader />}>
      <MyPettyClaims />
    </Suspense>
  );
}

function MyPettyClaims() {
  const [tab, setTab] = useState('all');
  const [claims, setClaims] = useState<PettyClaim[] | null>(null);
  const [types, setTypes] = useState<PettyExpenseType[]>([]);
  const [funds, setFunds] = useState<PettyFund[]>([]);
  const [openId, setOpenId] = useState<string | null>(null);
  const [sheetOpen, setSheetOpen] = useState(false);
  const typeFilter = usePettyTypeFilter(types);

  const load = useCallback(async () => {
    try {
      // ทุกหน้า ไม่ใช่แค่ 200 ใบแรก — กรองประเภทแล้วตัวเลขจะได้ครบ
      const [page, t, f] = await Promise.all([listAllClaims({ view: 'mine' }), getExpenseTypes(), getFunds(true)]);
      setClaims(page.items); setTypes(t); setFunds(f);
    } catch (err) {
      setClaims([]);
      showAlert({ icon: 'error', title: 'โหลดรายการไม่สำเร็จ', text: (err as Error).message });
    }
  }, []);
  useEffect(() => { void load(); }, [load]);

  // หน้าโชว์ทันที (แบบหน้า Advance) — ระหว่างโหลดตัวเลขเป็น "-" และตารางหมุนรอ
  // ตัวเลขบนการ์ดสรุปและแท็บนับเฉพาะประเภทที่เลือก จะได้ตรงกับตาราง
  const list = filterByType(claims ?? [], typeFilter.code);
  const count = (...s: PettyClaim['status'][]) => (claims ? list.filter(c => s.includes(c.status)).length : '-');
  const sum = (...s: PettyClaim['status'][]) => list.filter(c => s.includes(c.status)).reduce((a, c) => a + c.amount, 0);
  const stats = [
    { label: 'ใบทั้งหมด', value: claims ? list.length : '-' },
    { label: 'รออนุมัติ', value: count('PENDING_APPROVAL') },
    { label: 'อนุมัติจ่ายแล้ว รอเคลียร์', value: count('APPROVED', 'CLEAR_PENDING', 'TRANSFERRED') },
    { label: 'ต้องแก้ไข', value: count('RETURNED', 'SENT_BACK'), alert: claims !== null },
    { label: 'ยอดที่ยังไม่ปิด (บาท)', value: claims ? formatBaht(sum('PENDING_APPROVAL', 'APPROVED', 'CLEAR_PENDING', 'TRANSFERRED', 'AWAITING_REVIEW', 'SENT_BACK', 'REVIEWED')) : '-' },
  ];

  return (
    <FinanceCanvas title={TITLE} width="max-w-[1600px]">
      <FinanceHeading
        icon={ClipboardCheck}
        title={TITLE}
        caption={CAPTION}
        actions={(
          <Link href="/finance/petty/new" className="v2-btn text-sm">
            <Plus className="h-4 w-4" /> เปิดใบใหม่
          </Link>
        )}
      />
      <SummaryTiles items={stats} />
      <PettyListView variant="canvas" claims={list} loading={claims === null} types={types} funds={funds} tabs={TABS} activeTab={tab} onTabChange={setTab}
        onOpen={c => { setOpenId(c.form_id); setSheetOpen(true); }}
        filters={<TypeFilter types={types} value={typeFilter.code} onChange={typeFilter.setCode} onCanvas />}
        exportFileBase={typeFilter.code ? `เงินสดย่อยของฉัน-${typeFilter.name}` : 'เงินสดย่อยของฉัน'} hideColumns={['creator']} />
      <PettySheet formId={openId} isOpen={sheetOpen} onClose={() => setSheetOpen(false)} onChanged={() => void load()} />
    </FinanceCanvas>
  );
}
