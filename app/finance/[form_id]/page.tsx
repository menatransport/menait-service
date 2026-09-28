'use client';

import { useParams } from 'next/navigation';
import { useSessionContext } from '@/app/context/SessionContext';
import { FinanceAdvanceDetail } from '../components/FinanceAdvanceDetail';
import { FinanceShell, NoAccess } from '../components/FinanceShell';

export default function FinanceAdvanceDetailPage() {
  const { user, loading } = useSessionContext();
  const params = useParams<{ form_id: string }>();
  const formId = decodeURIComponent(params.form_id);

  if (!loading && !user?.is_finance) return <FinanceShell title="งานเบิกเงิน Advance"><NoAccess /></FinanceShell>;

  return (
    <FinanceShell title={`งานเบิกเงิน ${formId}`}>
      <FinanceAdvanceDetail formId={formId} />
    </FinanceShell>
  );
}
