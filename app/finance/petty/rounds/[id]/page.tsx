'use client';

import { useCallback, useState } from 'react';
import { useParams } from 'next/navigation';
import { MascotLoader } from '@/components/loading';
import { useSessionContext } from '@/app/context/SessionContext';
import type { PettyClaim, PettyRound } from '@/app/finance/types-petty';
import { FinanceShell, NoAccess } from '../../../components/FinanceShell';
import { PettySheet } from '../../../components/petty/PettySheet';
import { RoundDetail } from '../../../components/petty/worklist/RoundDetail';

/**
 * หน้าเต็มของรอบส่งเคลียร์ — เนื้อหาเดียวกับแผงด้านข้างในหน้างานเงินสดย่อย (แบบหน้าเต็มของ Advance)
 * หัวหน้าเปิดจากลิงก์ในอีเมลมาอนุมัติเคลียร์ที่นี่ · เจ้าของเงินสด บัญชี การเงิน เห็นรอบเดียวกัน ปุ่มตามบทบาท
 */
export default function PettyRoundPage() {
  const { loading } = useSessionContext();
  const params = useParams<{ id: string }>();
  const raw = params?.id ?? '';
  const id = /^\d{1,9}$/.test(raw) ? Number(raw) : NaN;
  const [batchNo, setBatchNo] = useState<string | null>(null);
  const [openId, setOpenId] = useState<string | null>(null);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);

  const onLoaded = useCallback((r: PettyRound) => setBatchNo(r.batch_no), []);
  const openClaim = (c: PettyClaim) => { setOpenId(c.form_id); setSheetOpen(true); };

  if (loading) return <MascotLoader />;
  if (!Number.isInteger(id) || id <= 0) return <FinanceShell title="รอบส่งเคลียร์"><NoAccess text="เลขรอบไม่ถูกต้อง" /></FinanceShell>;

  return (
    <FinanceShell title={batchNo ? `รอบส่งเคลียร์ ${batchNo}` : 'รอบส่งเคลียร์'}>
      <RoundDetail key={refreshKey} roundId={id} onOpenClaim={openClaim} onLoaded={onLoaded} />
      <PettySheet formId={openId} isOpen={sheetOpen} onClose={() => setSheetOpen(false)}
        onChanged={() => setRefreshKey(k => k + 1)} />
    </FinanceShell>
  );
}
