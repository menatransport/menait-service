'use client';

import Link from 'next/link';
import { Check, FileText, Printer, X } from 'lucide-react';
import { fundLabel } from '@/lib/finance/petty-fund-label';
import { formatDate } from '@/lib/finance/status';
import { Field } from '../../FinanceShell';
import { roundOutcome, type ClearRound } from './model';
import { BTN_APPROVE, BTN_REJECT, BTN_VIEW, CARD, CARD_FOOT, CARD_HEAD, HintLine, Money, OutcomeBadge, RoundStatusPill, WaitingBadge } from './ui';

/**
 * การ์ดรอบส่งเคลียร์ — หนึ่งการ์ด = หนึ่งรอบ
 * head-pending = คิวหัวหน้า (ไม่อนุมัติ/อนุมัติ) · head-history = หัวหน้ากดไปแล้ว · holder = รอบที่เจ้าของเงินสดส่งไปแล้ว
 */
export function RoundCard({ round, mode, highlight = false, processing = false, onApprove, onReject, onPrint }: {
  round: ClearRound; mode: 'head-pending' | 'head-history' | 'holder';
  highlight?: boolean; processing?: boolean;
  onApprove?: () => void; onReject?: () => void; onPrint?: () => void;
}) {
  const count = round.claim_count ?? round.claims?.length ?? 0;
  const rejected = roundOutcome(round) === 'rejected';
  const decided = round.status !== 'CLEAR_PENDING';
  return (
    <div id={`rnd-${round.id}`} className={`${CARD} ${highlight ? 'ring-2 ring-mint-500' : ''}`}>
      <div className={CARD_HEAD}>
        <div>
          <p className="text-sm font-semibold text-brand-800">รอบ {round.batch_no}</p>
          <p className="text-xs text-gray-500">เจ้าของเงินสด {round.holder_name ?? round.holder_employee_id ?? '-'}</p>
        </div>
        {mode === 'head-pending' ? <WaitingBadge text="รออนุมัติเคลียร์" />
          : mode === 'head-history' ? <OutcomeBadge ok={!rejected} okText="อนุมัติแล้ว" noText="ไม่อนุมัติ" />
          : <RoundStatusPill status={round.status} />}
      </div>

      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
        <Money label="ยอดรวม" value={round.total_amount} strong />
        <Field label="จำนวนใบ" value={`${count} ใบ`} />
        <Field label="ส่งเคลียร์เมื่อ" value={formatDate(round.submitted_at)} />
        <div className="col-span-2"><Field label="วงเงิน" value={round.branch_code && round.division_code ? fundLabel({ branch_code: round.branch_code, division_code: round.division_code }) : '-'} /></div>
        {mode === 'head-history' && <Field label="วันที่ดำเนินการ" value={formatDate(round.clear_approved_at)} />}
        {mode === 'holder' && decided && (
          <Field label={rejected ? 'หัวหน้าที่ไม่อนุมัติ' : 'หัวหน้าที่อนุมัติ'} value={round.clear_approved_by_name ?? round.clear_approved_by ?? '-'} />
        )}
        {rejected && round.clear_reject_reason && (
          <div className="col-span-2 sm:col-span-3"><Field label="เหตุผลที่ไม่อนุมัติ" value={round.clear_reject_reason} /></div>
        )}
      </div>

      <div className={CARD_FOOT}>
        {mode === 'head-pending' && round.is_primary === false && (
          <HintLine>อนุมัติแทนได้ — มีหัวหน้าที่ใกล้กว่าในสายงานของเจ้าของเงินสด</HintLine>
        )}
        <div className="flex flex-wrap justify-end gap-2">
          <Link href={`/finance/petty/rounds/${round.id}`} className={`${BTN_VIEW} mr-auto`}>
            <FileText className="h-4 w-4" /> ดูรายละเอียดทั้งหมด
          </Link>
          {mode === 'holder' && onPrint && (
            <button type="button" onClick={onPrint} disabled={processing} className={BTN_VIEW}>
              <Printer className="h-4 w-4" /> พิมพ์ใบปะหน้า
            </button>
          )}
          {mode === 'head-pending' && (
            <>
              <button type="button" disabled={processing} onClick={onReject} className={BTN_REJECT}>
                <X className="h-4 w-4" /> ไม่อนุมัติ
              </button>
              <button type="button" disabled={processing} onClick={onApprove} className={BTN_APPROVE}>
                <Check className="h-4 w-4" /> อนุมัติ
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
