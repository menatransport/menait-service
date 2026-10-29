'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { MascotLoader } from '@/components/loading';
import { useSessionContext } from '@/app/context/SessionContext';
import type { PettyClaim, PettyExpenseType, PettyFund } from '@/app/finance/types-petty';
import { accountCodeLine } from '@/lib/finance/petty-account-code';
import { canApprove, canReview } from '@/lib/finance/petty-access';
import { needsDebtDoc } from '@/lib/finance/petty-debt';
import { fundLabelWithHolder } from '@/lib/finance/petty-fund-label';
import { payeeBankText } from '@/lib/finance/petty-payee';
import { isItemBased } from '@/lib/finance/petty-spec';
import { transferCalc } from '@/lib/finance/petty-transfer';
import { canUploadPettyFile } from '@/lib/finance/petty-upload';
import { claimHistory } from '@/lib/finance/petty-worklist';
import { formatBaht, formatDate } from '@/lib/finance/status';
import { showAlert, showConfirm } from '../../../api';
import { checkDuplicate, getClaim, getExpenseTypes, getFunds, resubmitClaim, type PettyAction } from '../../../petty-api';
import { Field, NoAccess, Panel } from '../../FinanceShell';
import { DdSheet } from '../DdSheet';
import { DocumentPreset } from '../DocumentPreset';
import { FlowSteps } from '../FlowSteps';
import { GatePanel, type GateDup, type GateItem } from '../GatePanel';
import { ItemGrid } from '../ItemGrid';
import { PettyAttachments } from '../PettyAttachments';
import { PettyPrintButton } from '../PettyPrintButton';
import { runPettyAction } from '../petty-actions';
import { docsState } from '../approvals/model';
import { ClaimReviewPanel } from './ClaimReviewPanel';
import { HistoryPanel } from './HistoryPanel';
import { PRIMARY_BTN } from './RoundVoucherForm';
import { ClaimBadge } from './StatusBadges';

type FileRow = { key: string; fileName?: string; url: string; folder?: string };
type Gate = { missing: GateItem[]; holderMissing: GateItem[]; hard: GateDup[]; soft: GateDup[] };

const OUTLINE_BTN = 'h-11 rounded-xl';

/**
 * ใบเงินสดย่อยหนึ่งใบ ใช้ทั้งในแผงด้านข้าง (PettySheet) และหน้าเต็ม — เรียงแบบ FinanceAdvanceDetail:
 * ข้อมูลใบ · รายการ · DD · ไฟล์แนบทุกขั้นตอน · กล่องทำงานตามบทบาท · ประวัติ
 * กล่องทำงาน: เจ้าของเงินสด (อนุมัติจ่าย/ตีกลับ/เลข DD) · ผู้เปิดใบ (ส่งอีกครั้ง) · บัญชี (ตรวจผ่าน/ส่งกลับแก้ไข) · สิทธิ์จริงตัดสินที่ BE
 */
export function ClaimDetail({ formId, onChanged, onOpenRound }: {
  formId: string;
  onChanged?: () => void;
  /** มี = เปิดรอบในหน้าเดิม (แผงด้านข้าง) · ไม่มี = ลิงก์ไปหน้ารอบ */
  onOpenRound?: (batchId: number) => void;
}) {
  const { user } = useSessionContext();
  const [claim, setClaim] = useState<PettyClaim | null>(null);
  const [type, setType] = useState<PettyExpenseType | null>(null);
  const [fund, setFund] = useState<PettyFund | null>(null);
  const [files, setFiles] = useState<FileRow[]>([]);
  const [gate, setGate] = useState<Gate | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);

  const loadFiles = useCallback(async () => {
    try {
      const res = await fetch(`/api/uploads3?form_id=${encodeURIComponent(formId)}`, { cache: 'no-store' });
      if (res.ok) setFiles(((await res.json()) as { files?: FileRow[] }).files ?? []);
    } catch { /* รายการไฟล์โหลดไม่ได้ ไม่ทำให้หน้าล้ม */ }
  }, [formId]);

  const load = useCallback(async () => {
    try {
      const [c, types, funds] = await Promise.all([getClaim(formId), getExpenseTypes(), getFunds(true)]);
      setClaim(c);
      setType(types.find(t => t.code === c.expense_type) ?? null);
      setFund(funds.find(f => f.id === c.fund_id) ?? null);
      await loadFiles();
    } catch (err) {
      setError((err as Error).message);
    }
  }, [formId, loadFiles]);

  useEffect(() => { setClaim(null); setError(null); setGate(null); void load(); }, [load]);

  const spec = type?.spec ?? {};
  const isHolder = canApprove(user, fund);

  // ด่านล่วงหน้าเฉพาะใบที่รออนุมัติ: เอกสารที่ขาดตาม spec (แยกของคนเปิดใบ/สลิปโอนของเจ้าของเงินสด แบบการ์ดหน้าอนุมัติ)
  // + ซ้ำรายแถวจาก BE (ด่านจริงคือตอนกด)
  useEffect(() => {
    if (!claim || !type || claim.status !== 'PENDING_APPROVAL' || !isHolder) { setGate(null); return; }
    let alive = true;
    (async () => {
      const counts: Record<string, number> = {};
      for (const f of files) counts[f.folder ?? 'request'] = (counts[f.folder ?? 'request'] ?? 0) + 1;
      const docs = docsState(type.spec, counts, claim);
      const missing: GateItem[] = docs.fromClerk.map(label => ({ label }));
      const holderMissing: GateItem[] = docs.fromHolder.map(label => ({ label }));
      const hard: GateDup[] = []; const soft: GateDup[] = [];
      for (const [i, row] of claim.items.entries()) {
        if (!row.event_date) continue;
        try {
          const res = await checkDuplicate({ expense_type: claim.expense_type, event_date: row.event_date,
            truck_code: row.truck_code, truck_plate: row.truck_plate, ref_no: row.ref_no, exclude_claim_id: claim.id });
          res.hard.forEach(d => hard.push({ ...d, line_no: i + 1 }));
          res.soft.forEach(d => soft.push({ ...d, line_no: i + 1 }));
        } catch { /* บอกล่วงหน้าไม่ได้ก็ไม่เป็นไร */ }
      }
      if (alive) setGate({ missing, holderMissing, hard, soft });
    })();
    return () => { alive = false; };
  }, [claim, type, files, isHolder]);

  const changed = async () => { await load(); onChanged?.(); };

  // ใบที่ถูกตีกลับ: ผู้เปิดใบแนบเอกสารที่ขาดแล้วส่งกลับเข้าคิวเดิม (ตีกลับผู้เบิก → เจ้าของเงินสด · บัญชีส่งกลับ → บัญชีโดยตรง)
  async function resubmit() {
    if (!claim) return;
    const toAccounting = claim.status === 'SENT_BACK';
    const res = await showConfirm({ title: toAccounting ? 'ส่งกลับให้บัญชีตรวจอีกครั้ง?' : 'ส่งให้เจ้าของเงินสดอนุมัติอีกครั้ง?',
      text: `ใบ ${claim.form_id} · แนบเอกสารที่ขาดครบแล้วใช่ไหม`, confirmButtonText: 'ส่ง' }) as { isConfirmed?: boolean };
    if (!res?.isConfirmed) return;
    setBusy('resubmit');
    try {
      await resubmitClaim(claim);
      await changed();
    } catch (err) {
      showAlert({ icon: 'error', title: 'ส่งไม่สำเร็จ', text: (err as Error).message });
    } finally { setBusy(null); }
  }

  async function act(action: PettyAction) {
    if (!claim) return;
    setBusy(action);
    try {
      if (await runPettyAction(claim, action, { spec })) await changed();
    } finally { setBusy(null); }
  }

  if (error) return <NoAccess text={error} />;
  if (!claim) return <Panel title="รายละเอียดใบเบิก"><div className="py-8"><MascotLoader text="กำลังโหลดรายละเอียด" size={80} /></div></Panel>;

  const typeName = type?.name_th ?? claim.expense_type;
  const canUpload = canUploadPettyFile({ user: user ?? { employee_id: null }, claim, fund });
  const counts = files.reduce<Record<string, number>>((acc, f) => { const k = f.folder ?? 'request'; acc[k] = (acc[k] ?? 0) + 1; return acc; }, {});
  const blocked = (gate?.missing.length ?? 0) > 0 || (gate?.holderMissing.length ?? 0) > 0 || (gate?.hard.length ?? 0) > 0;
  const usesDd = (spec.prints ?? []).includes('DD');
  const isClerk = !!user?.employee_id && user.employee_id === claim.created_by;
  const calc = transferCalc(claim.amount, typeof claim.detail?.payee_type === 'string' ? claim.detail.payee_type : null);
  const payeeBank = payeeBankText(claim.detail);
  const roundLink = claim.batch_id === null ? null : onOpenRound ? (
    <button type="button" onClick={() => onOpenRound(claim.batch_id!)} className="text-brand-600 hover:underline">ดูรอบส่งเคลียร์</button>
  ) : (
    <Link href={`/finance/petty/rounds/${claim.batch_id}`} className="text-brand-600 hover:underline">ดูรอบส่งเคลียร์</Link>
  );

  return (
    <>
      <div className="flex justify-end"><PettyPrintButton claim={claim} fund={fund} spec={spec} typeName={typeName} /></div>

      <Panel title={`ใบเบิก ${claim.form_id}`} actions={<ClaimBadge status={claim.status} />}>
        <div className="mb-4 rounded-xl border border-gray-100 bg-gray-50 px-3 py-2"><FlowSteps status={claim.status} /></div>
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
          <Field label="ประเภท" value={typeName} />
          <Field label="จ่ายให้" value={payeeBank ? `${claim.payee_name ?? '-'} · ${payeeBank}` : (claim.payee_name ?? '-')} />
          <Field label="ยอดเงิน" value={`${formatBaht(claim.amount)} บาท`} />
          <Field label="ยอดที่ต้องโอนจริง" value={(
            <span title={calc.note}>{formatBaht(calc.transfer)} บาท{calc.kind !== 'none' && (
              <span className="ml-1 text-xs font-normal text-ink-500">({calc.kind === 'withhold' ? `หัก 3% ${formatBaht(calc.tax)}` : `บริษัทออกภาษีให้ ${formatBaht(calc.tax)}`})</span>
            )}</span>
          )} />
          <Field label="ช่วงวันที่ค่าใช้จ่าย" value={claim.period_from && claim.period_to ? `${formatDate(claim.period_from)} – ${formatDate(claim.period_to)}` : formatDate(claim.expense_date)} />
          <Field label="เลขที่ใบรับสินค้า (DD)" value={claim.dd_no ?? (usesDd ? 'ยังไม่กรอก' : '-')} />
          <Field label="เจ้าหน้าที่ผู้เปิดใบ" value={claim.created_by_name ?? claim.created_by} />
          <Field label="วงเงินสดย่อย" value={fund ? fundLabelWithHolder(fund) : '-'} />
          <Field label="รหัสค่าใช้จ่าย (บัญชี)" value={accountCodeLine(fund) || '-'} />
          <Field label="เจ้าของเงินสด (ผู้อนุมัติจ่าย)" value={claim.approved_by_name ?? claim.approved_by ?? '-'} />
          <Field label="วันที่จ่าย" value={claim.transfer_date ? formatDate(claim.transfer_date) : '-'} />
          {(claim.debt_doc_no || needsDebtDoc(claim)) && (
            <Field label="เลขที่ใบรับสภาพหนี้ (มี พจร.)" value={claim.debt_doc_no ?? 'กรอกตอนอนุมัติจ่าย'} />
          )}
          {roundLink && <Field label="รอบส่งเคลียร์" value={roundLink} />}
        </div>
      </Panel>

      {isItemBased(spec) && (
        <Panel title={`${spec.item_label ?? 'รายการ'} (${claim.items.length})`}>
          <ItemGrid spec={spec} rows={claim.items as never[]} onChange={() => {}} readOnly />
        </Panel>
      )}

      {usesDd && (
        <Panel title="ใบรับสินค้า (DD) จาก ATMS">
          <DdSheet ddNo={claim.dd_no} expenseType={claim.expense_type} claimAmount={claim.amount} />
        </Panel>
      )}

      <Panel title="ไฟล์แนบทุกขั้นตอน">
        <div className="mb-3"><DocumentPreset spec={spec} typeName={typeName} counts={counts} /></div>
        <PettyAttachments formId={claim.form_id} spec={spec}
          files={files.map(f => ({ key: f.key, fileName: f.fileName, url: f.url, folder: f.folder ?? 'other' }))}
          canUpload={canUpload} onChanged={() => void loadFiles()} />
        {!canUpload && (
          <p className="mt-2 text-xs text-ink-400">แนบไฟล์เพิ่มได้เฉพาะเจ้าหน้าที่ผู้เปิดใบและเจ้าของเงินสด จนกว่าบัญชีจะตรวจผ่าน</p>
        )}
      </Panel>

      {claim.status === 'RETURNED' && claim.return_reason && (
        <p className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">ตีกลับผู้เบิก รอแก้แล้วส่งใหม่: {claim.return_reason}</p>
      )}
      {claim.status === 'SENT_BACK' && (
        <p className="rounded-2xl border border-orange-200 bg-orange-50 px-4 py-3 text-sm text-orange-800">
          ส่งกลับแก้ไข — รอผู้เปิดใบแก้แล้วส่งกลับมาที่บัญชี: {claim.review_remark || '-'}
        </p>
      )}
      {claim.dup_override_reason && (
        <p className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-ink-700">เจ้าของเงินสดยืนยันทับเรื่องรายการซ้ำ: {claim.dup_override_reason}</p>
      )}

      {/* เจ้าของเงินสด: อนุมัติจ่าย */}
      {isHolder && claim.status === 'PENDING_APPROVAL' && (
        <>
          {gate && <GatePanel {...gate} />}
          <Panel title="อนุมัติจ่าย">
            <div className="space-y-3">
              <Button type="button" onClick={() => void act('approve')} disabled={busy !== null || blocked} className={PRIMARY_BTN}>
                {busy === 'approve' ? 'กำลังบันทึก...' : 'อนุมัติจ่าย'}
              </Button>
              {blocked && <p className="text-xs text-rose-700">อนุมัติไม่ได้จนกว่าเอกสารจะครบ และไม่มีรายการซ้ำ ดูกล่องด้านบน</p>}
              <Button type="button" variant="outline" onClick={() => void act('return')} disabled={busy !== null}
                className={`${OUTLINE_BTN} w-full border-rose-300 text-rose-600 hover:bg-rose-50`}>
                ตีกลับผู้เบิก
              </Button>
            </div>
          </Panel>
        </>
      )}

      {/* เจ้าของเงินสด: ใบที่อนุมัติจ่ายแล้ว รอรวมรอบ */}
      {isHolder && claim.status === 'APPROVED' && (
        <Panel title="ส่งเคลียร์">
          <div className="flex flex-col gap-2 sm:flex-row">
            {usesDd && (
              <Button type="button" variant={claim.dd_no ? 'outline' : 'default'} onClick={() => void act('dd')} disabled={busy !== null}
                className={`${OUTLINE_BTN} flex-1 ${claim.dd_no ? '' : 'bg-brand-600 text-white hover:bg-brand-700'}`}>
                {claim.dd_no ? 'แก้เลข DD' : 'ใส่เลข DD'}
              </Button>
            )}
            <Link href="/finance/petty/approvals?tab=clear"
              className={`${OUTLINE_BTN} inline-flex flex-1 items-center justify-center border border-gray-200 px-4 text-sm font-medium text-ink-700 hover:bg-gray-50`}>
              ไปส่งเคลียร์เป็นรอบ
            </Link>
          </div>
        </Panel>
      )}

      {/* ผู้เปิดใบ: แก้แล้วส่งอีกครั้ง */}
      {isClerk && (claim.status === 'RETURNED' || claim.status === 'SENT_BACK') && (
        <Panel title="ส่งอีกครั้ง">
          <Button type="button" onClick={() => void resubmit()} disabled={busy !== null} className={PRIMARY_BTN}>
            {busy === 'resubmit' ? 'กำลังส่ง...' : claim.status === 'SENT_BACK' ? 'ส่งกลับให้บัญชี' : 'ส่งให้เจ้าของเงินสดอีกครั้ง'}
          </Button>
        </Panel>
      )}

      {/* บัญชี: ตรวจทีละใบ */}
      {canReview(user) && claim.status === 'AWAITING_REVIEW' && (
        <ClaimReviewPanel key={claim.status} claim={claim} needsDd={usesDd} onSaved={() => void changed()} />
      )}

      <HistoryPanel entries={claimHistory(claim)} />
    </>
  );
}
