'use client';

import { useCallback, useEffect, useState } from 'react';
import { fetchJson } from '../api';
import type { AdvanceDetail } from '../types';
import { AdvanceSummary } from './AdvanceSummary';
import { PrintCashAdvanceButton } from './PrintCashAdvanceButton';
import { AttachmentPanel } from './AttachmentPanel';
import { ClearForm } from './ClearForm';
import { NoAccess, Panel } from './FinanceShell';
import { LogList } from './LogList';

const CLEARABLE = new Set(['AWAITING_CLEARING', 'SENT_BACK', 'AWAITING_REVIEW']);

export function MyAdvanceDetail({ formId, onChanged }: { formId: string; onChanged?: () => void }) {
  const [detail, setDetail] = useState<AdvanceDetail | null>(null);
  const [error, setError] = useState('');
  const [refreshKey, setRefreshKey] = useState(0);

  const load = useCallback(() => {
    fetchJson<AdvanceDetail>(`/api/finance/advances/${encodeURIComponent(formId)}`)
      .then(d => { setDetail(d); setError(''); })
      .catch(err => setError(err.message));
  }, [formId]);

  useEffect(() => { load(); }, [load]);

  const onSaved = (d: AdvanceDetail) => { setDetail(d); setRefreshKey(k => k + 1); onChanged?.(); };

  if (error) return <NoAccess text={error} />;
  if (!detail) return <Panel title="กำลังโหลด..."><div className="h-24" /></Panel>;

  return (
    <>
      <PrintCashAdvanceButton detail={detail} />
      <AdvanceSummary item={detail} />
      <Panel title="ไฟล์แนบ">
        <div className="grid gap-5 sm:grid-cols-2">
          <AttachmentPanel formId={formId} folder="request" canUpload={detail.status === 'PENDING_APPROVAL'} refreshKey={refreshKey} />
          {detail.fin && <AttachmentPanel formId={formId} folder="pay" refreshKey={refreshKey} />}
          {detail.fin && <AttachmentPanel formId={formId} folder="clear" refreshKey={refreshKey} />}
          {detail.fin?.settle_amount !== null && detail.fin?.settle_amount !== undefined && detail.fin.settle_amount < 0 && (
            <AttachmentPanel formId={formId} folder="check" refreshKey={refreshKey} />
          )}
        </div>
      </Panel>
      {detail.fin && CLEARABLE.has(detail.status) && <ClearForm key={refreshKey} detail={detail} onSaved={onSaved} />}
      <LogList approvalLogs={detail.approval_logs} finLogs={detail.fin_logs} />
    </>
  );
}
