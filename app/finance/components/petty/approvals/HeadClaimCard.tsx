'use client';

import { Check, FileText, Undo2 } from 'lucide-react';
import type { PettyClaim, PettySpec } from '@/app/finance/types-petty';
import { costCenterLabel } from '@/lib/finance/petty-cost-centers';
import { formatDate } from '@/lib/finance/status';
import { Field } from '../../FinanceShell';
import { ClaimFiles } from './ClaimFiles';
import type { ClaimFile } from './files-api';
import { claimPeriod } from './model';
import { openerName } from './PendingClaimCard';
import { BTN_APPROVE, BTN_REJECT, BTN_VIEW, CARD, CARD_FOOT, CARD_HEAD, ClaimStatusPill, Money, OutcomeBadge, WaitingBadge } from './ui';

/**
 * การ์ดใบเบิกในหน้าหัวหน้า (flow v3 30/10/2026) — หัวหน้าของผู้ขอเบิกอนุมัติก่อน เจ้าของเงินสดถึงโอนได้
 * mode pending: ปุ่ม ตีกลับ / อนุมัติ · mode done: ใบที่อนุมัติไปแล้ว บอกว่าตอนนี้ไปถึงไหน
 * หัวหน้าไม่ต้องดูยอดวงเงินหรือสลิปโอน — ดูแค่ว่าเบิกอะไร เท่าไร เอกสารแนบมีอะไร
 */
export function HeadClaimCard({ claim, typeName, spec, files, mode, highlight = false, processing = false, onView, onReturn, onApprove }: {
  claim: PettyClaim; typeName: string; spec?: PettySpec | null; files?: ClaimFile[];
  mode: 'pending' | 'done'; highlight?: boolean; processing?: boolean;
  onView: () => void; onReturn?: () => void; onApprove?: () => void;
}) {
  const pending = mode === 'pending';
  return (
    <div id={`head-${claim.form_id}`} className={`${CARD} ${highlight ? 'ring-2 ring-mint-500' : ''}`}>
      <div className={CARD_HEAD}>
        <div>
          <p className="text-sm font-semibold text-brand-800">{claim.form_id}</p>
          <p className="text-xs text-gray-500">{openerName(claim)}</p>
        </div>
        {pending ? <WaitingBadge text="รอหัวหน้าอนุมัติ" /> : <OutcomeBadge ok okText="อนุมัติแล้ว" noText="" />}
      </div>

      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
        <Money label="จำนวนเงินที่ขอ" value={claim.amount} strong />
        <Field label="ประเภท" value={typeName} />
        <Field label="จ่ายให้" value={claim.payee_name ?? '-'} />
        <Field label="ช่วงวันที่" value={claimPeriod(claim)} />
        <Field label="ศูนย์และแผนก" value={costCenterLabel(claim.cost_center) || '-'} />
        {pending
          ? <Field label="วันที่ขอเบิก" value={formatDate(claim.created_at ?? claim.expense_date)} />
          : <Field label="วันที่อนุมัติ" value={formatDate(claim.head_approved_at)} />}
        {!pending && <Field label="ตอนนี้อยู่ที่" value={<ClaimStatusPill status={claim.status} />} />}
      </div>

      {pending && (
        <div className="mt-4">
          <ClaimFiles spec={spec} files={files} missing={[]} />
        </div>
      )}

      <div className={CARD_FOOT}>
        <div className="flex flex-wrap justify-end gap-2">
          <button type="button" onClick={onView} className={`${BTN_VIEW} ${pending ? 'mr-auto' : ''}`}>
            <FileText className="h-4 w-4" /> ดูรายละเอียดทั้งหมด
          </button>
          {pending && (
            <>
              <button type="button" disabled={processing} onClick={onReturn} className={BTN_REJECT}>
                <Undo2 className="h-4 w-4" /> ตีกลับ
              </button>
              <button type="button" disabled={processing} onClick={onApprove} className={BTN_APPROVE}>
                <Check className="h-4 w-4" /> {processing ? 'กำลังทำ…' : 'อนุมัติ'}
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
