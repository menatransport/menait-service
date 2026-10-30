'use client';

import { useParams } from 'next/navigation';
import { MascotLoader } from '@/components/loading';
import { useSessionContext } from '@/app/context/SessionContext';
import { isPettyFormId } from '@/lib/finance/petty-access';
import { ClaimDetail } from '../../components/petty/worklist/ClaimDetail';
import { EmptyState, PettyPage } from '../../components/petty/ui';

/** หน้าเต็มของใบหนึ่งใบ — เนื้อหาเดียวกับแผงข้าง (แบบหน้าเต็มของ Advance แต่กว้างกว่าเพราะตารางรายการรถ) */
export default function PettyClaimDetailPage() {
  const { loading } = useSessionContext();
  const params = useParams<{ form_id: string }>();
  const formId = decodeURIComponent(params?.form_id ?? '');

  if (loading) return <MascotLoader />;
  if (!isPettyFormId(formId)) {
    return (
      <PettyPage title="ใบเบิกเงินสดย่อย">
        <EmptyState title="หมายเลขเอกสารไม่ถูกต้อง" />
      </PettyPage>
    );
  }

  return (
    <PettyPage title={`ใบเบิก ${formId}`} width="max-w-[1120px]">
      <ClaimDetail formId={formId} />
    </PettyPage>
  );
}
