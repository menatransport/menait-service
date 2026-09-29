'use client';

import { useCallback, useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { fetchJson, putAction, showAlert, showConfirm } from '../api';
import type { AdvanceDetail } from '../types';
import { AdvanceSummary } from './AdvanceSummary';
import { PrintDocumentButton } from './PrintDocumentButton';
import { AttachmentPanel } from './AttachmentPanel';
import { NoAccess, Panel } from './FinanceShell';
import { LogList } from './LogList';
import { PayForm } from './PayForm';
import { ReviewPanel } from './ReviewPanel';
import { VoucherForm } from './VoucherForm';

export function FinanceAdvanceDetail({ formId, onChanged }: { formId: string; onChanged?: () => void }) {
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

  const rejectVoucher = async () => {
    const res = await showConfirm({
      title: 'ตีกลับไปตั้งเบิกใหม่?', text: detail?.form_id,
      input: 'textarea', inputPlaceholder: 'เหตุผลที่ตีกลับ',
      inputValidator: (v: string) => (v?.trim() ? undefined : 'กรุณาระบุเหตุผลที่ตีกลับ'),
    });
    if (!res.isConfirmed) return;
    try {
      const saved = await putAction(formId, 'reject-voucher', { remark: String(res.value).trim() });
      await showAlert({ icon: 'success', title: 'ตีกลับไปตั้งเบิกใหม่แล้ว' });
      onSaved(saved);
    } catch (err) {
      showAlert({ icon: 'error', title: 'ตีกลับไม่สำเร็จ', text: (err as Error).message });
    }
  };

  if (error) return <NoAccess text={error} />;
  if (!detail) return <Panel title="กำลังโหลด..."><div className="h-24" /></Panel>;

  const canVoucher = detail.status === 'AWAITING_VOUCHER';
  const canPay = ['AWAITING_PAYMENT', 'AWAITING_CLEARING'].includes(detail.status);

  return (
    <>
      <PrintDocumentButton detail={detail} />
      <AdvanceSummary item={detail} />
      <Panel title="ไฟล์แนบทุกขั้นตอน">
        <div className="grid gap-5 sm:grid-cols-2">
          <AttachmentPanel formId={formId} folder="request" refreshKey={refreshKey} />
          <AttachmentPanel formId={formId} folder="pay" canUpload={Boolean(canPay)} refreshKey={refreshKey} />
          <AttachmentPanel formId={formId} folder="clear" refreshKey={refreshKey} />
          <AttachmentPanel formId={formId} folder="check" canUpload={detail.status === 'AWAITING_REVIEW'} refreshKey={refreshKey} />
        </div>
      </Panel>
      {canVoucher && <VoucherForm key={`v-${refreshKey}`} detail={detail} onSaved={onSaved} />}
      {detail.status === 'AWAITING_PAYMENT' && (
        <div className="mb-4">
          <Button type="button" variant="outline" onClick={rejectVoucher}
            className="border-rose-400 text-rose-600 hover:bg-rose-50 hover:text-rose-700">
            ตีกลับไปตั้งเบิกใหม่
          </Button>
        </div>
      )}
      {canPay && <PayForm key={`pay-${refreshKey}`} detail={detail} onSaved={onSaved} />}
      {detail.status === 'AWAITING_REVIEW' && <ReviewPanel key={`rev-${refreshKey}`} detail={detail} onSaved={onSaved} />}
      <LogList approvalLogs={detail.approval_logs} finLogs={detail.fin_logs} />
    </>
  );
}
