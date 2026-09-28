'use client';

import { useParams } from 'next/navigation';
import { FinanceShell } from '../../components/FinanceShell';
import { MyAdvanceDetail } from '../../components/MyAdvanceDetail';

export default function MyAdvanceDetailPage() {
  const params = useParams<{ form_id: string }>();
  const formId = decodeURIComponent(params.form_id);

  return (
    <FinanceShell title={`เบิกเงิน Advance ${formId}`}>
      <MyAdvanceDetail formId={formId} />
    </FinanceShell>
  );
}
