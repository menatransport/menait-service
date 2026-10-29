'use client';

import { useParams } from 'next/navigation';
import { MascotLoader } from '@/components/loading';
import { useSessionContext } from '@/app/context/SessionContext';
import { isPettyFormId } from '@/lib/finance/petty-access';
import { FinanceCanvas, NoAccess } from '../../components/FinanceShell';
import { ClaimDetail } from '../../components/petty/worklist/ClaimDetail';

/** หน้าเต็มของใบหนึ่งใบ — เนื้อหาเดียวกับแผงข้าง (แบบหน้าเต็มของ Advance แต่กว้างกว่าเพราะตารางรายการรถ) */
export default function PettyClaimDetailPage() {
  const { loading } = useSessionContext();
  const params = useParams<{ form_id: string }>();
  const formId = decodeURIComponent(params?.form_id ?? '');

  if (loading) return <MascotLoader />;
  if (!isPettyFormId(formId)) return <FinanceCanvas title="ใบเบิกเงินสดย่อย" width="max-w-4xl"><NoAccess text="หมายเลขเอกสารไม่ถูกต้อง" /></FinanceCanvas>;

  return (
    <FinanceCanvas title={`ใบเบิก ${formId}`} width="max-w-5xl">
      <ClaimDetail formId={formId} />
    </FinanceCanvas>
  );
}
