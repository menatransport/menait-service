'use client';

import { FileText } from 'lucide-react';
import type { PettyClaim } from '@/app/finance/types-petty';
import { formatDate } from '@/lib/finance/status';
import { Field } from '../../FinanceShell';
import { claimOutcome } from './model';
import { openerName } from './PendingClaimCard';
import { BTN_VIEW, CARD, CARD_FOOT, CARD_HEAD, ClaimStatusPill, Money, OutcomeBadge } from './ui';

/** ใบที่ผ่านมือเจ้าของเงินสดแล้ว — เทียบการ์ดแถบ อนุมัติ/ไม่อนุมัติแล้ว ของ Advance + สถานะตอนนี้ */
export function HandledClaimCard({ claim, typeName, highlight = false, onView }: {
  claim: PettyClaim; typeName: string; highlight?: boolean; onView: () => void;
}) {
  const returned = claimOutcome(claim) === 'returned';
  const note = returned ? claim.return_reason : claim.review_remark;
  return (
    <div id={`apv-${claim.form_id}`} className={`${CARD} ${highlight ? 'ring-2 ring-mint-500' : ''}`}>
      <div className={CARD_HEAD}>
        <div>
          <p className="text-sm font-semibold text-brand-800">{claim.form_id}</p>
          <p className="text-xs text-gray-500">{openerName(claim)}</p>
        </div>
        <OutcomeBadge ok={!returned} okText="อนุมัติจ่ายแล้ว" noText="ตีกลับ" />
      </div>
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
        <Money label="จำนวนเงิน" value={claim.amount} strong />
        <Field label="ประเภท" value={typeName} />
        <Field label="จ่ายให้" value={claim.payee_name ?? '-'} />
        <Field label="วันที่จ่าย" value={formatDate(claim.transfer_date)} />
        <Field label="วันที่ดำเนินการ" value={formatDate(claim.approved_at)} />
        <Field label="ตอนนี้อยู่ที่" value={<ClaimStatusPill status={claim.status} />} />
        {note && <div className="col-span-2 sm:col-span-3"><Field label="หมายเหตุ" value={note} /></div>}
      </div>
      <div className={CARD_FOOT}>
        <button type="button" onClick={onView} className={BTN_VIEW}>
          <FileText className="h-4 w-4" /> ดูรายละเอียดทั้งหมด
        </button>
      </div>
    </div>
  );
}
