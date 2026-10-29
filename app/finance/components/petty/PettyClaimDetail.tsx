'use client';

import { useCallback, useEffect, useState, type ReactNode } from 'react';
import { payeeBankText } from '@/lib/finance/petty-payee';
import { fundLabelWithHolder } from '@/lib/finance/petty-fund-label';
import { accountCodeLine } from '@/lib/finance/petty-account-code';
import Link from 'next/link';
import { MascotLoader } from '@/components/loading';
import { useSessionContext } from '@/app/context/SessionContext';
import type { PettyClaim, PettyExpenseType, PettyFund } from '@/app/finance/types-petty';
import { canApprove, canReview } from '@/lib/finance/petty-access';
import { isItemBased } from '@/lib/finance/petty-spec';
import { canUploadPettyFile } from '@/lib/finance/petty-upload';
import { formatBaht, formatDate } from '@/lib/finance/status';
import { showAlert, showConfirm } from '../../api';
import { checkDuplicate, getClaim, getExpenseTypes, getFunds, resubmitClaim, type PettyAction } from '../../petty-api';
import { Field, NoAccess, Panel } from '../FinanceShell';
import { DdSheet } from './DdSheet';
import { DocumentPreset } from './DocumentPreset';
import { FlowSteps } from './FlowSteps';
import { GatePanel, type GateDup, type GateItem } from './GatePanel';
import { ItemGrid } from './ItemGrid';
import { PettyAttachments } from './PettyAttachments';
import { PettyPrintButton } from './PettyPrintButton';
import { PettyStatusBadge } from './PettyStatusBadge';
import { runPettyAction } from './petty-actions';

type FileRow = { key: string; fileName?: string; url: string; folder?: string };
type Gate = { missing: GateItem[]; hard: GateDup[]; soft: GateDup[] };

/**
 * เนื้อหาใบเงินสดย่อยหนึ่งใบ ใช้ทั้งในแผงข้าง (Sheet) และหน้าเต็ม — หัวใบ แถบขั้นตอน รายการ DD ไฟล์แนบ
 * และ **แถบปุ่มเปลี่ยนสถานะ** ตามบทบาท (ผู้ถือเงิน / บัญชี / การเงิน) · สิทธิ์จริงตัดสินที่ BE
 */
export function PettyClaimDetail({ formId, onChanged, compact = false, headerRight }: {
  formId: string;
  onChanged?: () => void;
  /** ในแผงข้าง: ซ่อนหัวเรื่องใหญ่ ใช้พื้นที่แน่นขึ้น */
  compact?: boolean;
  headerRight?: ReactNode;
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

  // ด่านล่วงหน้าเฉพาะใบที่รออนุมัติ: เอกสารที่ขาดตาม spec + ซ้ำรายแถวจาก BE (ด่านจริงคือตอนกด)
  const spec = type?.spec ?? {};
  const isHolder = canApprove(user, fund);
  useEffect(() => {
    if (!claim || !type || claim.status !== 'PENDING_APPROVAL' || !isHolder) { setGate(null); return; }
    let alive = true;
    (async () => {
      const counts: Record<string, number> = {};
      for (const f of files) counts[f.folder ?? 'request'] = (counts[f.folder ?? 'request'] ?? 0) + 1;
      const missing: GateItem[] = (type.spec.attachments ?? []).filter(a => a.required && !counts[a.key]).map(a => ({ key: a.key, label: a.label }));
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
      if (alive) setGate({ missing, hard, soft });
    })();
    return () => { alive = false; };
  }, [claim, type, files, isHolder]);

  // ใบที่ถูกตีกลับ: ผู้เปิดใบแนบเอกสารที่ขาดแล้วส่งกลับเข้าคิวเดิม (ตีกลับผู้เบิก → เจ้าของเงินสด · บัญชีตีกลับ → บัญชีโดยตรง)
  async function resubmit() {
    if (!claim) return;
    const toAccounting = claim.status === 'SENT_BACK';
    const res = await showConfirm({ title: toAccounting ? 'ส่งกลับให้บัญชีตรวจอีกครั้ง' : 'ส่งให้เจ้าของเงินสดอนุมัติอีกครั้ง',
      text: `ใบ ${claim.form_id} · แนบเอกสารที่ขาดครบแล้วใช่ไหม`, confirmButtonText: 'ส่ง' }) as { isConfirmed?: boolean };
    if (!res?.isConfirmed) return;
    setBusy('resubmit');
    try {
      await resubmitClaim(claim);
      await load(); onChanged?.();
    } catch (err) {
      showAlert({ icon: 'error', title: 'ส่งไม่สำเร็จ', text: (err as Error).message });
    } finally { setBusy(null); }
  }

  async function act(action: PettyAction, pass?: boolean) {
    if (!claim) return;
    setBusy(action);
    try {
      const changed = await runPettyAction(claim, action, { spec, pass });
      if (changed) { await load(); onChanged?.(); }
    } finally { setBusy(null); }
  }

  if (error) return <NoAccess text={error} />;
  if (!claim) return <MascotLoader />;

  const typeName = type?.name_th ?? claim.expense_type;
  const canUpload = canUploadPettyFile({ user: user ?? { employee_id: null }, claim, fund });
  const counts = files.reduce<Record<string, number>>((acc, f) => { const k = f.folder ?? 'request'; acc[k] = (acc[k] ?? 0) + 1; return acc; }, {});
  const blocked = (gate?.missing.length ?? 0) > 0 || (gate?.hard.length ?? 0) > 0;

  // ปุ่มตามบทบาทและสถานะ — เหมือนแถบปุ่มในแผง Advance ของการเงิน
  const buttons: ReactNode[] = [];
  const btn = (label: string, onClick: () => void, opts: { tone?: 'primary' | 'ghost'; disabled?: boolean; key: string }) => (
    <button key={opts.key} type="button" onClick={onClick} disabled={busy !== null || opts.disabled}
      className={`rounded-lg px-4 py-2 text-sm font-medium transition-colors disabled:opacity-40 ${opts.tone === 'ghost' ? 'border border-slate-200 text-ink-700 hover:bg-slate-50' : 'bg-brand-600 text-white hover:bg-brand-700'}`}>
      {busy ? 'กำลังทำ…' : label}
    </button>
  );
  const usesDd = (spec.prints ?? []).includes('DD');
  const isClerk = !!user?.employee_id && user.employee_id === claim.created_by;
  if (isHolder) {
    if (claim.status === 'PENDING_APPROVAL') {
      buttons.push(btn('อนุมัติจ่าย', () => void act('approve'), { key: 'approve', disabled: blocked }));
      buttons.push(btn('ตีกลับผู้เบิก', () => void act('return'), { key: 'return', tone: 'ghost' }));
    }
    if (claim.status === 'APPROVED') {
      if (usesDd) buttons.push(btn(claim.dd_no ? 'แก้เลข DD' : 'ใส่เลข DD', () => void act('dd'), { key: 'dd', tone: claim.dd_no ? 'ghost' : 'primary' }));
      buttons.push(
        <Link key="round" href="/finance/petty/approvals?tab=clear" className="rounded-lg border border-slate-200 px-4 py-2 text-sm font-medium text-ink-700 hover:bg-slate-50">
          ไปส่งเคลียร์เป็นรอบ
        </Link>,
      );
    }
  }
  if (isClerk && (claim.status === 'RETURNED' || claim.status === 'SENT_BACK')) {
    buttons.push(btn(claim.status === 'SENT_BACK' ? 'ส่งกลับให้บัญชี' : 'ส่งให้เจ้าของเงินสดอีกครั้ง', () => void resubmit(), { key: 'resubmit' }));
  }
  if (canReview(user) && claim.status === 'AWAITING_REVIEW') {
    buttons.push(btn('ตรวจผ่าน', () => void act('review', true), { key: 'pass' }));
    buttons.push(btn('ตีกลับแก้ไข', () => void act('review', false), { key: 'sendback', tone: 'ghost' }));
  }
  if (claim.batch_id) {
    buttons.push(
      <Link key="open-round" href={`/finance/petty/rounds/${claim.batch_id}`} className="rounded-lg border border-slate-200 px-4 py-2 text-sm font-medium text-ink-700 hover:bg-slate-50">
        ดูรอบส่งเคลียร์
      </Link>,
    );
  }

  return (
    <div className="space-y-4">
      {!compact && (
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <h1 className="font-display text-2xl font-semibold text-brand-800">ใบเบิก {claim.form_id}</h1>
            <p className="text-sm text-ink-500">{typeName}</p>
          </div>
          <span className="flex items-center gap-2">
            <PettyStatusBadge status={claim.status} />
            <PettyPrintButton claim={claim} fund={fund} spec={spec} typeName={typeName} />
            {headerRight}
          </span>
        </div>
      )}

      <div className="rounded-2xl border border-slate-200 bg-white px-4 py-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <FlowSteps status={claim.status} />
          {compact && <span className="flex items-center gap-2"><PettyPrintButton claim={claim} fund={fund} spec={spec} typeName={typeName} />{headerRight}</span>}
        </div>
        {buttons.length > 0 && (
          <div className="mt-3 flex flex-wrap items-center gap-2 border-t border-slate-100 pt-3">
            {buttons}
            {isHolder && claim.status === 'PENDING_APPROVAL' && blocked && (
              <span className="text-xs text-rose-700">อนุมัติไม่ได้จนกว่าจะครบ — ดูแผงด้านล่าง</span>
            )}
          </div>
        )}
      </div>

      {claim.status === 'RETURNED' && claim.return_reason && (
        <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">ผู้อนุมัติตีกลับ: {claim.return_reason}</div>
      )}
      {claim.status === 'SENT_BACK' && claim.review_remark && (
        <div className="rounded-xl border border-orange-200 bg-orange-50 px-4 py-3 text-sm text-orange-800">บัญชีตีกลับ: {claim.review_remark} — แก้หรือแนบเอกสารแล้วกด &quot;ส่งกลับให้บัญชี&quot;</div>
      )}
      {claim.dup_override_reason && (
        <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-ink-700">ผู้อนุมัติยืนยันทับเรื่องรายการซ้ำ: {claim.dup_override_reason}</div>
      )}

      {isHolder && claim.status === 'PENDING_APPROVAL' && gate && <GatePanel {...gate} />}

      <Panel title="หัวใบ">
        <div className={`grid gap-3 ${compact ? 'sm:grid-cols-2' : 'sm:grid-cols-3'}`}>
          <Field label="จ่ายให้" value={payeeBankText(claim.detail) ? `${claim.payee_name ?? '-'} · ${payeeBankText(claim.detail)}` : (claim.payee_name ?? '-')} />
          <Field label="ยอดรวม" value={`${formatBaht(claim.amount)} บาท`} />
          <Field label="ช่วงวันที่ค่าใช้จ่าย" value={claim.period_from && claim.period_to ? `${formatDate(claim.period_from)} – ${formatDate(claim.period_to)}` : formatDate(claim.expense_date)} />
          <Field label="เลขที่ใบรับสินค้า (DD)" value={claim.dd_no ?? 'ยังไม่กรอก'} />
          <Field label="เจ้าหน้าที่ผู้เปิดใบ" value={claim.created_by_name ?? claim.created_by} />
          <Field label="วงเงินสดย่อย" value={fund ? fundLabelWithHolder(fund) : '-'} />
          <Field label="รหัสค่าใช้จ่าย (บัญชี)" value={accountCodeLine(fund) || '-'} />
          <Field label="เจ้าของเงินสด (ผู้อนุมัติจ่าย)" value={claim.approved_by_name ?? claim.approved_by ?? '-'} />
          <Field label="วันที่จ่าย" value={formatDate(claim.transfer_date) || '-'} />
          <Field label="บัญชีตรวจเมื่อ" value={claim.reviewed_at ? new Date(claim.reviewed_at).toLocaleString('th-TH') : '-'} />
        </div>
      </Panel>

      {isItemBased(spec) && (
        <Panel title={`${spec.item_label ?? 'รายการ'} (${claim.items.length})`}>
          <ItemGrid spec={spec} rows={claim.items as never[]} onChange={() => {}} readOnly />
        </Panel>
      )}

      {(spec.prints ?? []).includes('DD') && (
        <Panel title="ใบรับสินค้า (DD) จาก ATMS">
          <DdSheet ddNo={claim.dd_no} expenseType={claim.expense_type} claimAmount={claim.amount} />
        </Panel>
      )}

      <Panel title="ไฟล์แนบ">
        <div className="mb-3"><DocumentPreset spec={spec} typeName={typeName} counts={counts} /></div>
        <PettyAttachments formId={claim.form_id} spec={spec}
          files={files.map(f => ({ key: f.key, fileName: f.fileName, url: f.url, folder: f.folder ?? 'other' }))}
          canUpload={canUpload} onChanged={() => void loadFiles()} />
        {!canUpload && (
          <p className="mt-2 text-xs text-ink-400">แนบไฟล์เพิ่มได้เฉพาะเจ้าหน้าที่ผู้เปิดใบและเจ้าของเงินสด จนกว่าบัญชีจะตรวจผ่าน</p>
        )}
      </Panel>
    </div>
  );
}

/** แจ้งเตือนรวมเมื่อโหลดไม่ได้ — ใช้โดยหน้าเต็ม */
export function warnLoad(err: unknown) {
  showAlert({ icon: 'error', title: 'โหลดใบไม่สำเร็จ', text: (err as Error).message });
}
