'use client';

import { useParams } from 'next/navigation';
import { MascotLoader } from '@/components/loading';
import { useSessionContext } from '@/app/context/SessionContext';
import { isPettyFormId } from '@/lib/finance/petty-access';
import { FinanceCanvas, NoAccess } from '../../components/FinanceShell';
import { PettyClaimDetail } from '../../components/petty/PettyClaimDetail';

/** หน้าเต็มของใบหนึ่งใบ — เนื้อหาเดียวกับแผงข้างในตาราง */
export default function PettyClaimDetailPage() {
  const { loading } = useSessionContext();
  const params = useParams<{ form_id: string }>();
  const formId = params?.form_id ?? '';

  if (loading) return <MascotLoader />;
  if (!isPettyFormId(formId)) return <NoAccess text="หมายเลขเอกสารไม่ถูกต้อง" />;

  return (
    <FinanceCanvas title={`ใบเบิก ${formId}`}>
      <PettyClaimDetail formId={formId} />
    </FinanceCanvas>
  );
}
