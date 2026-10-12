'use client';

import { useCallback, useEffect, useState } from 'react';
import { BadgeCheck } from 'lucide-react';
import { MascotLoader } from '@/components/loading';
import { useSessionContext } from '@/app/context/SessionContext';
import type { PettyBalance, PettyClaim, PettyExpenseType, PettyFund } from '@/app/finance/types-petty';
import { ApiError } from '@/lib/finance/api-error';
import type { GateDup, GateItem } from '../../components/petty/GatePanel';
import { showAlert, showConfirm } from '../../api';
import { checkDuplicate, countAttachments, getBalance, getExpenseTypes, getFunds, listClaims, postAction } from '../../petty-api';
import { FinanceCanvas, FinanceHeading, Panel } from '../../components/FinanceShell';
import { BalanceCard } from '../../components/petty/BalanceCard';
import { GatePanel } from '../../components/petty/GatePanel';
import { ClaimTable } from '../../components/petty/ClaimTable';

const TITLE = 'อนุมัติเบิกเงินสดย่อย';
const CAPTION = 'ใบของกองทุนที่คุณถือ — ตรวจเอกสารแล้วอนุมัติ โอนเงิน และรวบส่งบัญชี';

export default function PettyApprovalsPage() {
  const { user, loading } = useSessionContext();
  const [funds, setFunds] = useState<PettyFund[] | null>(null);
  const [fundId, setFundId] = useState<number | null>(null);
  const [balance, setBalance] = useState<PettyBalance | null>(null);
  const [claims, setClaims] = useState<PettyClaim[] | null>(null);
  const [types, setTypes] = useState<PettyExpenseType[]>([]);
  const [busy, setBusy] = useState<string | null>(null);
  const [gates, setGates] = useState<Record<string, { missing: GateItem[]; hard: GateDup[]; soft: GateDup[] }>>({});

  const load = useCallback(async () => {
    try {
      const [f, page, t] = await Promise.all([getFunds(), listClaims({ view: 'approvals', limit: '200' }), getExpenseTypes()]);
      const mine = f.filter(x => x.holder_employee_id === user?.employee_id);
      setFunds(mine); setClaims(page.items); setTypes(t);
      if (mine.length && fundId === null) setFundId(mine[0].id);
    } catch (err) {
      setFunds([]); setClaims([]);
      showAlert({ icon: 'error', title: 'โหลดคิวไม่สำเร็จ', text: (err as Error).message });
    }
  }, [user?.employee_id, fundId]);

  useEffect(() => { if (user?.employee_id) void load(); }, [user?.employee_id, load]);
  useEffect(() => { if (fundId) getBalance(fundId).then(setBalance).catch(() => setBalance(null)); }, [fundId, claims]);

  // ผลด่านของใบที่รออนุมัติ: ตรวจไฟล์แนบที่ขาดจาก spec และตรวจซ้ำรายแถวจาก BE
  useEffect(() => {
    const pending = (claims ?? []).filter(c => c.fund_id === fundId && c.status === 'PENDING_APPROVAL');
    if (pending.length === 0) { setGates({}); return; }
    let alive = true;
    (async () => {
      const next: Record<string, { missing: GateItem[]; hard: GateDup[]; soft: GateDup[] }> = {};
      for (const claim of pending) {
        const spec = types.find(t => t.code === claim.expense_type)?.spec ?? {};
        const counts = await countAttachments(claim.form_id);
        const missing: GateItem[] = (spec.attachments ?? [])
          .filter(a => a.required && !counts[a.key])
          .map(a => ({ key: a.key, label: a.label }));
        (spec.item_fields ?? []).forEach(f => {
          if (f.key === 'truck' || !f.required) return;
          claim.items.forEach((row, i) => {
            const value = (row as Record<string, unknown>)[f.key];
            if (value === null || value === undefined || String(value).trim() === '') {
              missing.push({ key: f.key, line_no: i + 1, label: `${f.label} (แถวที่ ${i + 1})` });
            }
          });
        });
        const hard: GateDup[] = []; const soft: GateDup[] = [];
        for (const [i, row] of claim.items.entries()) {
          if (!row.event_date) continue;
          try {
            const res = await checkDuplicate({
              expense_type: claim.expense_type, event_date: row.event_date,
              truck_code: row.truck_code, truck_plate: row.truck_plate, ref_no: row.ref_no,
              exclude_claim_id: claim.id,
            });
            res.hard.forEach(d => hard.push({ ...d, line_no: i + 1 }));
            res.soft.forEach(d => soft.push({ ...d, line_no: i + 1 }));
          } catch { /* ด่านจริงอยู่ที่ BE ตอนกดอนุมัติ ตรงนี้แค่บอกล่วงหน้า */ }
        }
        next[claim.form_id] = { missing, hard, soft };
      }
      if (alive) setGates(next);
    })();
    return () => { alive = false; };
  }, [claims, fundId, types]);

  async function act(claim: PettyClaim, action: 'approve' | 'return' | 'transfer' | 'submit-accounting') {
    setBusy(claim.form_id);
    try {
      const body: Record<string, unknown> = {};
      if (action === 'approve') body.attachments = await countAttachments(claim.form_id);
      if (action === 'submit-accounting') body.attachments = await countAttachments(claim.form_id);
      if (action === 'return') {
        const res = await showConfirm({ title: `ตีกลับใบ ${claim.form_id}`, input: 'textarea',
          inputLabel: 'เหตุผล (เจ้าหน้าที่จะเห็นข้อความนี้)', inputValidator: (v: string) =>
            (!v || !v.trim()) ? 'ต้องระบุเหตุผล' : null, confirmButtonText: 'ตีกลับ' }) as { isConfirmed?: boolean; value?: string };
        if (!res?.isConfirmed) return;
        body.reason = res.value;
      }
      if (action === 'transfer') {
        const res = await showConfirm({ title: `บันทึกการโอนของใบ ${claim.form_id}`, input: 'text',
          inputLabel: 'วันที่โอน (YYYY-MM-DD)', inputValue: new Date().toISOString().slice(0, 10),
          confirmButtonText: 'บันทึก' }) as { isConfirmed?: boolean; value?: string };
        if (!res?.isConfirmed) return;
        body.transfer_date = res.value;
      }
      await postAction(claim.form_id, action, body);
      await load();
    } catch (err) {
      // 403 = เอกสารไม่ครบ · 409 = ซ้ำเข้ม หรือสถานะเปลี่ยนไปแล้ว (แท็บเก่า) · 422 = ซ้ำอ่อน ต้องกรอกเหตุผล
      const api = err instanceof ApiError ? err : null;
      const lines = [
        ...(api?.missing ?? []).map(m => `• ${m.label ?? m.key}`),
        ...(api?.duplicates ?? []).map(d => `• ${d.message}${d.form_id ? ` (ใบ ${d.form_id})` : ''}`),
      ];
      if (api?.status === 422 && api.duplicates?.length) {
        const res = await showConfirm({ icon: 'warning', title: 'มีรายการที่อาจซ้ำ',
          text: lines.join('\n'), input: 'textarea', inputLabel: 'เหตุผลที่ยืนยันทับ',
          inputValidator: (v: string) => (!v || !v.trim()) ? 'ต้องระบุเหตุผล' : null,
          confirmButtonText: 'ยืนยันอนุมัติ' }) as { isConfirmed?: boolean; value?: string };
        if (res?.isConfirmed && action === 'approve') {
          await postAction(claim.form_id, 'approve', {
            attachments: await countAttachments(claim.form_id), dup_override_reason: res.value,
          });
          await load();
          return;
        }
      } else {
        showAlert({ icon: 'error', title: api?.message ?? 'ทำรายการไม่สำเร็จ',
          text: lines.length ? lines.join('\n') : (err as Error).message });
      }
      await load();
    } finally { setBusy(null); }
  }

  if (loading || funds === null || claims === null) return <MascotLoader />;

  if (funds.length === 0) {
    return (
      <FinanceCanvas title={TITLE}>
        <FinanceHeading icon={BadgeCheck} title={TITLE} caption={CAPTION} />
        <Panel title="ไม่มีกองทุนที่คุณถือ">
          <p className="text-sm text-ink-600">หน้านี้สำหรับผู้ถือกองทุนเงินสดย่อย ถ้าควรเห็น ให้ผู้ดูแลระบบตั้งกองทุนให้ชื่อคุณ</p>
        </Panel>
      </FinanceCanvas>
    );
  }

  const ofFund = claims.filter(c => c.fund_id === fundId);
  const queues: { label: string; statuses: PettyClaim['status'][]; action: 'approve' | 'transfer' | 'submit-accounting' | null; cta: string }[] = [
    { label: 'รออนุมัติ', statuses: ['PENDING_APPROVAL'], action: 'approve', cta: 'อนุมัติ' },
    { label: 'อนุมัติแล้ว รอโอน', statuses: ['APPROVED'], action: 'transfer', cta: 'บันทึกการโอน' },
    { label: 'โอนแล้ว รอส่งบัญชี', statuses: ['TRANSFERRED', 'SENT_BACK'], action: 'submit-accounting', cta: 'ส่งบัญชี' },
    { label: 'อยู่ที่บัญชี/การเงิน', statuses: ['AWAITING_REVIEW', 'CLOSED'], action: null, cta: '' },
    { label: 'ตีกลับให้เจ้าหน้าที่แก้', statuses: ['RETURNED'], action: null, cta: '' },
  ];

  return (
    <FinanceCanvas title={TITLE}>
      <FinanceHeading icon={BadgeCheck} title={TITLE} caption={CAPTION} />

      {funds.length > 1 && (
        <div className="mb-3">
          <label className="text-sm">กองทุน
            <select value={fundId ?? ''} onChange={e => setFundId(Number(e.target.value))}
              className="ml-2 rounded-lg border border-slate-200 px-2 py-1.5">
              {funds.map(f => <option key={f.id} value={f.id}>สาขา {f.branch_code} · {f.division_code}</option>)}
            </select>
          </label>
        </div>
      )}

      {balance && <div className="mb-4"><BalanceCard balance={balance} /></div>}

      {queues.map(q => {
        const rows = ofFund.filter(c => q.statuses.includes(c.status));
        if (rows.length === 0) return null;
        return (
          <Panel key={q.label} title={`${q.label} (${rows.length})`}>
            <ClaimTable claims={rows} types={types} showReturnReason />
            {q.action && (
              <div className="mt-3 space-y-2">
                {rows.map(c => (
                  <div key={c.id} className="rounded-lg bg-slate-50 px-3 py-2 text-sm">
                    {q.action === 'approve' && gates[c.form_id] && (
                      <div className="mb-2"><GatePanel {...gates[c.form_id]} /></div>
                    )}
                    <div className="flex flex-wrap items-center justify-between gap-2">
                    <span>{c.form_id} · {c.amount.toLocaleString('th-TH', { minimumFractionDigits: 2 })} บาท</span>
                    <span className="flex gap-2">
                      <button type="button"
                        disabled={busy === c.form_id || (q.action === 'approve'
                          && ((gates[c.form_id]?.missing.length ?? 0) > 0
                            || (gates[c.form_id]?.hard.length ?? 0) > 0))}
                        onClick={() => void act(c, q.action!)}
                        className="rounded-lg bg-brand-600 px-3 py-1.5 text-white disabled:opacity-40">
                        {busy === c.form_id ? 'กำลังทำ…' : q.cta}
                      </button>
                      {q.action === 'approve' && (
                        <button type="button" disabled={busy === c.form_id}
                          onClick={() => void act(c, 'return')}
                          className="rounded-lg border border-slate-200 px-3 py-1.5 disabled:opacity-40">
                          ตีกลับ
                        </button>
                      )}
                    </span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </Panel>
        );
      })}
    </FinanceCanvas>
  );
}
