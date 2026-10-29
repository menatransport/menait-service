'use client';

import { useRef, useState } from 'react';
import { Check, FileText, Paperclip, Undo2 } from 'lucide-react';
import type { PettyClaim, PettySpec } from '@/app/finance/types-petty';
import { needsDebtDoc } from '@/lib/finance/petty-debt';
import { pettyFileProblem } from '@/lib/finance/petty-upload';
import { formatDate } from '@/lib/finance/status';
import { showAlert } from '../../../api';
import { uploadPettyFiles } from '../../../petty-api';
import { Field } from '../../FinanceShell';
import { ClaimFiles } from './ClaimFiles';
import { countByFolder, type ClaimFile } from './files-api';
import { claimPeriod, docsLabel, docsState, pendingHint } from './model';
import { BTN_APPROVE, BTN_REJECT, BTN_VIEW, CARD, CARD_FOOT, CARD_HEAD, HintLine, Money, WaitingBadge } from './ui';

export const openerName = (c: PettyClaim) =>
  c.created_by_name?.trim() ? `${c.created_by_name.trim()} · ${c.created_by}` : c.created_by;

const DOCS_TONE = { muted: 'text-gray-500', ok: 'text-mint-700', warn: 'text-amber-700', bad: 'text-rose-600' } as const;

/** การ์ดรออนุมัติจ่าย — วางแบบ PendingCard ของ Advance: ตีกลับ/อนุมัติจ่าย อยู่ตำแหน่ง ไม่อนุมัติ/อนุมัติ
 *  ขาดแค่สลิปโอนของเจ้าของเงินสด: มีปุ่ม แนบสลิปโอน อัปโหลดเข้าหมวดสลิปของใบนี้ตรง ๆ แล้วโหลดไฟล์การ์ดใหม่ */
export function PendingClaimCard({ claim, typeName, spec, files, highlight, processing, onView, onReturn, onApprove, onFilesChanged }: {
  claim: PettyClaim; typeName: string; spec?: PettySpec | null; files: ClaimFile[] | undefined;
  highlight: boolean; processing: boolean; onView: () => void; onReturn: () => void; onApprove: () => void;
  onFilesChanged: () => void | Promise<void>;
}) {
  const docs = files === undefined ? null : docsState(spec, countByFolder(files), claim);
  const hint = pendingHint(docs);
  const docsText = docsLabel(docs);
  const debt = needsDebtDoc(claim);
  const pickRef = useRef<HTMLInputElement>(null);
  const [attaching, setAttaching] = useState(false);

  async function attachSlip(list: FileList | null) {
    const folder = hint?.attachFolder;
    const picked = Array.from(list ?? []);
    if (!folder || !picked.length || attaching) return;
    // บอกก่อนส่งว่าไฟล์ไหนรับไม่ได้ (เซิร์ฟเวอร์เช็กซ้ำอีกชั้น)
    const bad = picked.map(f => ({ f, why: pettyFileProblem(f.name, f.size) })).filter(x => x.why);
    if (bad.length) {
      showAlert({ icon: 'warning', title: 'แนบไฟล์นี้ไม่ได้', text: bad.map(x => `${x.f.name}: ${x.why}`).join('\n') });
      return;
    }
    setAttaching(true);
    try {
      const failed = await uploadPettyFiles(claim.form_id, folder, picked);
      if (failed.length) showAlert({ icon: 'error', title: 'แนบสลิปไม่สำเร็จ', text: `ไฟล์ที่ไม่ขึ้น: ${failed.join(', ')} ลองแนบใหม่อีกครั้ง` });
      await onFilesChanged();
    } finally {
      setAttaching(false);
    }
  }
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
        <Field label="เอกสาร" value={docsText.tone === 'muted' ? docsText.text
          : <span className={DOCS_TONE[docsText.tone]}>{docsText.text}</span>} />
        {debt && (
          <div className="col-span-2 sm:col-span-3">
            <Field label="ใบรับสภาพหนี้ (มี พจร.)" value={claim.debt_doc_no ?? 'ยังไม่มีเลข ใส่หลังโอนเงินได้ ต้องมีก่อนส่งเคลียร์'} />
          </div>
        )}
      </div>

      <div className="mt-4">
        <ClaimFiles spec={spec} files={files} missing={docs?.missing ?? []} />
      </div>

      <div className={CARD_FOOT}>
        {hint && <HintLine tone="warn">{hint.text}</HintLine>}
        <div className="flex flex-wrap justify-end gap-2">
          <button type="button" onClick={onView} className={`${BTN_VIEW} mr-auto`}>
            <FileText className="h-4 w-4" /> ดูรายละเอียดทั้งหมด
          </button>
          <button type="button" disabled={processing} onClick={onReturn} className={BTN_REJECT}>
            <Undo2 className="h-4 w-4" /> ตีกลับ
          </button>
          {hint?.attachFolder && (
            <>
              <button type="button" disabled={processing || attaching} onClick={() => pickRef.current?.click()} className={BTN_VIEW}>
                <Paperclip className="h-4 w-4" /> {attaching ? 'กำลังแนบ…' : 'แนบสลิปโอน'}
              </button>
              <input ref={pickRef} type="file" multiple accept="image/*,application/pdf" className="hidden"
                aria-label={`แนบสลิปโอนของใบ ${claim.form_id}`}
                onChange={e => { void attachSlip(e.target.files); e.target.value = ''; }} />
            </>
          )}
          <button type="button" disabled={processing || docs === null || !docs.ready} onClick={onApprove} className={BTN_APPROVE}
            title={docs && !docs.ready ? (docs.fromClerk.length ? 'เอกสารยังไม่ครบ' : 'แนบสลิปโอนก่อน') : undefined}>
            <Check className="h-4 w-4" /> {processing ? 'กำลังทำ…' : 'อนุมัติจ่าย'}
          </button>
        </div>
      </div>
    </div>
  );
}
