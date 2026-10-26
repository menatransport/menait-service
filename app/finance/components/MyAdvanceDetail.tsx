'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { Pencil } from 'lucide-react';
import { latestReturnRemark } from '@/lib/finance/returnInfo';
import { fetchJson } from '../api';
import type { AdvanceDetail } from '../types';
import { AdvanceSummary } from './AdvanceSummary';
import { PrintDocumentButton } from './PrintDocumentButton';
import { AttachmentPanel } from './AttachmentPanel';
import { ClearForm } from './ClearForm';
import { NoAccess, Panel } from './FinanceShell';
import { MascotLoader } from '@/components/loading';
import { ClearApprovalPanel } from './ClearApprovalPanel';
import { useClearApprovals } from '../useClearApprovals';
import { useSessionContext } from '@/app/context/SessionContext';
import { LogList } from './LogList';
import { ShareApprovalLink } from './ShareApprovalLink';
import { RequesterOutstanding } from './RequesterOutstanding';

// once submitted (AWAITING_REVIEW) the clearing is locked until Accounting sends it back
const CLEARABLE = new Set(['AWAITING_CLEARING', 'SENT_BACK']);

export function MyAdvanceDetail({ formId, onChanged, showRequesterOutstanding = false }: {
  formId: string; onChanged?: () => void;
  /** หน้าอนุมัติเท่านั้น: โชว์ยอดค้างเคลียร์ของผู้ขอเบิก */
  showRequesterOutstanding?: boolean;
}) {
  const [detail, setDetail] = useState<AdvanceDetail | null>(null);
  const [error, setError] = useState('');
  const [refreshKey, setRefreshKey] = useState(0);
  const clearQueue = useClearApprovals(refreshKey);
  const { user } = useSessionContext();

  const load = useCallback(() => {
    fetchJson<AdvanceDetail>(`/api/finance/advances/${encodeURIComponent(formId)}`)
      .then(d => { setDetail(d); setError(''); })
      .catch(err => setError(err.message));
  }, [formId]);

  useEffect(() => { load(); }, [load]);

  const onSaved = (d: AdvanceDetail) => { setDetail(d); setRefreshKey(k => k + 1); onChanged?.(); };

  if (error) return <NoAccess text={error} />;
  if (!detail) return <Panel title="รายละเอียดคำขอ"><div className="py-8"><MascotLoader text="กำลังโหลดรายละเอียด" size={80} /></div></Panel>;

  const isOwner = user?.employee_id === detail.requester.employee_id;

  return (
    <>
      <PrintDocumentButton detail={detail} />
      <AdvanceSummary item={detail} detail={detail} />
      {showRequesterOutstanding && <RequesterOutstanding formId={formId} name={detail.requester.name} />}
      {detail.status === 'RETURNED' && (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
          <p className="min-w-0 break-words">บัญชีตีกลับให้แก้ไข: {latestReturnRemark(detail.fin_logs) || '-'}</p>
          <Link href={`/finance/advance/new?edit=${encodeURIComponent(formId)}`} className="v2-btn text-sm">
            <Pencil className="h-4 w-4" /> แก้ไขและส่งใหม่
          </Link>
        </div>
      )}
      {/* หัวหน้าเปิดดูจากหน้าอนุมัติได้ (26/10/2026) — ลิงก์ส่งผู้อนุมัติกับการแนบไฟล์เป็นของผู้เบิกคนเดียว */}
      {detail.status === 'PENDING_APPROVAL' && isOwner && <ShareApprovalLink detail={detail} />}
      <Panel title="ไฟล์แนบ">
        <div className="grid gap-5 sm:grid-cols-2">
          <AttachmentPanel formId={formId} folder="request" canUpload={detail.status === 'PENDING_APPROVAL' && isOwner} refreshKey={refreshKey} />
          {detail.fin && <AttachmentPanel formId={formId} folder="pay" refreshKey={refreshKey} />}
          {detail.fin && <AttachmentPanel formId={formId} folder="clear" refreshKey={refreshKey} />}
          {detail.fin?.settle_amount !== null && detail.fin?.settle_amount !== undefined && detail.fin.settle_amount < 0 && (
            <AttachmentPanel formId={formId} folder="check" refreshKey={refreshKey} />
          )}
        </div>
      </Panel>
      {detail.status === 'CLEARING_APPROVAL' && clearQueue?.includes(detail.form_id) && (
        <ClearApprovalPanel key={`ca-${refreshKey}`} detail={detail} onSaved={onSaved} />
      )}
      {/* ฟอร์มเคลียร์เป็นของผู้เบิกคนเดียว หัวหน้าที่เปิดใบมาอนุมัติ/ตีกลับเคลียร์ต้องไม่เห็นปุ่มแก้ */}
      {detail.fin && CLEARABLE.has(detail.status) && isOwner && <ClearForm key={refreshKey} detail={detail} onSaved={onSaved} />}
      {detail.status === 'AWAITING_REVIEW' && (
        <p className="rounded-2xl border border-violet-200 bg-violet-50 px-4 py-3 text-sm text-violet-800">
          ส่งเคลียร์เงินแล้ว รอบัญชีตรวจ — แก้ไขไม่ได้ หากต้องแก้ไข ให้ติดต่อบัญชีเพื่อส่งกลับแก้ไข
        </p>
      )}
      <LogList approvalLogs={detail.approval_logs} finLogs={detail.fin_logs} clearLogs={detail.clear_logs} />
    </>
  );
}
