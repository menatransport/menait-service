'use client';

import { useCallback, useEffect, useState } from 'react';
import { fetchJson } from '../api';
import type { AdvanceDetail, FinAccount } from '../types';
import { AdvanceSummary } from './AdvanceSummary';
import { AttachmentPanel } from './AttachmentPanel';
import { NoAccess, Panel } from './FinanceShell';
import { LogList } from './LogList';
import { PayForm } from './PayForm';
import { ReviewPanel } from './ReviewPanel';

export function FinanceAdvanceDetail({ formId, onChanged }: { formId: string; onChanged?: () => void }) {
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

  useEffect(() => { load(); }, [load]);

  const onSaved = (d: AdvanceDetail) => { setDetail(d); setRefreshKey(k => k + 1); onChanged?.(); };

  if (error) return <NoAccess text={error} />;
  if (!detail) return <Panel title="กำลังโหลด..."><div className="h-24" /></Panel>;

  const canPay = detail.status === 'AWAITING_PAYMENT' || detail.status === 'AWAITING_CLEARING';

  return (
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
  );
}
