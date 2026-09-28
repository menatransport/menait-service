'use client';

import { useCallback, useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { useSessionContext } from '@/app/context/SessionContext';
import { fetchJson } from '../api';
import { AdvanceSummary } from '../components/AdvanceSummary';
import { AttachmentPanel } from '../components/AttachmentPanel';
import { FinanceShell, NoAccess, Panel } from '../components/FinanceShell';
import { LogList } from '../components/LogList';
import { PayForm } from '../components/PayForm';
import { ReviewPanel } from '../components/ReviewPanel';
import type { AdvanceDetail, FinAccount } from '../types';

export default function FinanceAdvanceDetailPage() {
  const { user, loading } = useSessionContext();
  const params = useParams<{ form_id: string }>();
  const formId = decodeURIComponent(params.form_id);
  const [detail, setDetail] = useState<AdvanceDetail | null>(null);
  const [accounts, setAccounts] = useState<FinAccount[]>([]);
  const [error, setError] = useState('');
  const [refreshKey, setRefreshKey] = useState(0);

  const load = useCallback(() => {
    fetchJson<AdvanceDetail>(`/api/finance/advances/${encodeURIComponent(formId)}`)
      .then(d => { setDetail(d); setError(''); })
      .catch(err => setError(err.message));
    fetchJson<FinAccount[]>('/api/finance/accounts').then(setAccounts).catch(() => setAccounts([]));
  }, [formId]);

  useEffect(() => { if (user?.is_finance) load(); }, [user?.is_finance, load]);

  const onSaved = (d: AdvanceDetail) => { setDetail(d); setRefreshKey(k => k + 1); };

  if (!loading && !user?.is_finance) return <FinanceShell title="งานเบิกเงิน Advance"><NoAccess /></FinanceShell>;

  const canPay = detail && (detail.status === 'AWAITING_PAYMENT' || detail.status === 'AWAITING_CLEARING');

  return (
    <FinanceShell title={`งานเบิกเงิน ${formId}`}>
      {error ? <NoAccess text={error} /> : !detail ? <Panel title="กำลังโหลด..."><div className="h-24" /></Panel> : (
        <>
          <AdvanceSummary item={detail} />
          <Panel title="ไฟล์แนบทุกขั้นตอน">
            <div className="grid gap-5 sm:grid-cols-2">
              <AttachmentPanel formId={formId} folder="request" refreshKey={refreshKey} />
              <AttachmentPanel formId={formId} folder="pay" canUpload={Boolean(canPay)} refreshKey={refreshKey} />
              <AttachmentPanel formId={formId} folder="clear" refreshKey={refreshKey} />
              <AttachmentPanel formId={formId} folder="check" canUpload={detail.status === 'AWAITING_REVIEW'} refreshKey={refreshKey} />
            </div>
          </Panel>
          {canPay && <PayForm key={`pay-${refreshKey}`} detail={detail} accounts={accounts} onSaved={onSaved} />}
          {detail.status === 'AWAITING_REVIEW' && <ReviewPanel key={`rev-${refreshKey}`} detail={detail} onSaved={onSaved} />}
          <LogList approvalLogs={detail.approval_logs} finLogs={detail.fin_logs} />
        </>
      )}
    </FinanceShell>
  );
}
