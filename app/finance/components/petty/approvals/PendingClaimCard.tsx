'use client';

import { Check, FileText, Undo2 } from 'lucide-react';
import type { PettyClaim, PettySpec } from '@/app/finance/types-petty';
import { needsDebtDoc } from '@/lib/finance/petty-debt';
import { formatDate } from '@/lib/finance/status';
import { Field } from '../../FinanceShell';
import { ClaimFiles } from './ClaimFiles';
import { countByFolder, type ClaimFile } from './files-api';
import { claimPeriod, docsState } from './model';
import { BTN_APPROVE, BTN_REJECT, BTN_VIEW, CARD, CARD_FOOT, CARD_HEAD, HintLine, Money, WaitingBadge } from './ui';

export const openerName = (c: PettyClaim) =>
  c.created_by_name?.trim() ? `${c.created_by_name.trim()} · ${c.created_by}` : c.created_by;

/** การ์ดรออนุมัติจ่าย — วางแบบ PendingCard ของ Advance: ตีกลับ/อนุมัติจ่าย อยู่ตำแหน่ง ไม่อนุมัติ/อนุมัติ */
export function PendingClaimCard({ claim, typeName, spec, files, highlight, processing, onView, onReturn, onApprove }: {
  claim: PettyClaim; typeName: string; spec?: PettySpec | null; files: ClaimFile[] | undefined;
  highlight: boolean; processing: boolean; onView: () => void; onReturn: () => void; onApprove: () => void;
}) {
  const docs = files === undefined ? null : docsState(spec, countByFolder(files), claim);
  const debt = needsDebtDoc(claim);
  return (
    <div id={`apv-${claim.form_id}`} className={`${CARD} ${highlight ? 'ring-2 ring-mint-500' : ''}`}>
      <div className={CARD_HEAD}>
        <div>
          <p className="text-sm font-semibold text-brand-800">{claim.form_id}</p>
          <p className="text-xs text-gray-500">{openerName(claim)}</p>
        </div>
        <WaitingBadge text="รออนุมัติจ่าย" />
      </div>

      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
        <Money label="จำนวนเงินที่ขอ" value={claim.amount} strong />
        <Field label="ช่วงวันที่" value={claimPeriod(claim)} />
        <Field label="วันที่ขอเบิก" value={formatDate(claim.expense_date)} />
        <Field label="ประเภท" value={typeName} />
        <Field label="จ่ายให้" value={claim.payee_name ?? '-'} />
        <Field label="เอกสาร" value={docs === null ? 'กำลังตรวจ…'
          : docs.ready ? <span className="text-mint-700">ครบ</span>
          : <span className="text-rose-600">ไม่ครบ ขาด {docs.missing.length} อย่าง</span>} />
        {debt && (
          <div className="col-span-2 sm:col-span-3">
            <Field label="ใบรับสภาพหนี้ (มี พจร.)" value={claim.debt_doc_no ?? 'ยังไม่มีเลข กรอกตอนกดอนุมัติจ่าย'} />
          </div>
        )}
      </div>

      <div className="mt-4">
        <ClaimFiles spec={spec} files={files} missing={docs?.missing ?? []} />
      </div>

      <div className={CARD_FOOT}>
        {docs && !docs.ready && (
          <HintLine tone="warn">เอกสารยังไม่ครบ ให้คนเปิดใบแนบเพิ่มก่อน หรือกดตีกลับพร้อมบอกว่าขาดอะไร</HintLine>
        )}
        <div className="flex flex-wrap justify-end gap-2">
          <button type="button" onClick={onView} className={`${BTN_VIEW} mr-auto`}>
            <FileText className="h-4 w-4" /> ดูรายละเอียดทั้งหมด
          </button>
          <button type="button" disabled={processing} onClick={onReturn} className={BTN_REJECT}>
            <Undo2 className="h-4 w-4" /> ตีกลับ
          </button>
          <button type="button" disabled={processing || docs === null || !docs.ready} onClick={onApprove} className={BTN_APPROVE}
            title={docs && !docs.ready ? 'เอกสารยังไม่ครบ' : undefined}>
            <Check className="h-4 w-4" /> {processing ? 'กำลังทำ…' : 'อนุมัติจ่าย'}
          </button>
        </div>
      </div>
    </div>
  );
}
