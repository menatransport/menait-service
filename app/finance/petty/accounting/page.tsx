'use client';

import { useCallback, useEffect, useState } from 'react';
import { Landmark } from 'lucide-react';
import { MascotLoader } from '@/components/loading';
import { useSessionContext } from '@/app/context/SessionContext';
import type { PettyClaim, PettyExpenseType, PettyFund } from '@/app/finance/types-petty';
import { exportPettyXlsx } from '@/lib/finance/petty-export';
import { showAlert, showConfirm } from '../../api';
import { getExpenseTypes, getFunds, listClaims, postAction } from '../../petty-api';
import { FinanceCanvas, FinanceHeading, NoAccess, Panel } from '../../components/FinanceShell';
import { ClaimTable } from '../../components/petty/ClaimTable';
import { CoverSheetButton } from '../../components/petty/CoverSheetButton';

const TITLE = 'ตรวจเอกสารเงินสดย่อย';
const CAPTION = 'ใบที่ผู้อนุมัติส่งมา — ตรวจแล้วกดผ่าน หรือส่งกลับให้แก้';

export default function PettyAccountingPage() {
  const { user, loading } = useSessionContext();
  const [claims, setClaims] = useState<PettyClaim[] | null>(null);
  const [types, setTypes] = useState<PettyExpenseType[]>([]);
  const [funds, setFunds] = useState<PettyFund[]>([]);
  const [busy, setBusy] = useState<string | null>(null);

  const isAllowed = user?.is_finance === true || user?.role === 'a';

  const load = useCallback(async () => {
    try {
      const [page, t, f] = await Promise.all([
        listClaims({ view: 'all', status: 'AWAITING_REVIEW', limit: '200' }),
        getExpenseTypes(),
        getFunds(),
      ]);
      setClaims(page.items); setTypes(t); setFunds(f);
    } catch (err) {
      setClaims([]);
      showAlert({ icon: 'error', title: 'โหลดคิวไม่สำเร็จ', text: (err as Error).message });
    }
  }, []);

  useEffect(() => { if (isAllowed) void load(); }, [isAllowed, load]);

  async function review(claim: PettyClaim, pass: boolean) {
    setBusy(claim.form_id);
    try {
      const body: Record<string, unknown> = { action: pass ? 'PASS' : 'SEND_BACK' };
      if (!pass) {
        const res = await showConfirm({ title: `ส่งกลับใบ ${claim.form_id}`, input: 'textarea',
          inputLabel: 'เหตุผล (ผู้อนุมัติและเจ้าหน้าที่จะเห็นข้อความนี้)',
          inputValidator: (v: string) => (!v || !v.trim()) ? 'ต้องระบุเหตุผล' : null,
          confirmButtonText: 'ส่งกลับ' }) as { isConfirmed?: boolean; value?: string };
        if (!res?.isConfirmed) return;
        body.remark = res.value;
      }
      await postAction(claim.form_id, 'review', body);
      await load();
    } catch (err) {
      showAlert({ icon: 'error', title: 'ทำรายการไม่สำเร็จ', text: (err as Error).message });
      await load();
    } finally { setBusy(null); }
  }

  if (loading) return <MascotLoader />;
  if (!isAllowed) return <NoAccess text="หน้านี้สำหรับฝ่ายบัญชีและการเงินเท่านั้น" />;
  if (claims === null) return <MascotLoader />;

  const pending = claims.filter(c => c.reviewed_at === null);
  const reviewed = claims.filter(c => c.reviewed_at !== null);

  return (
    <FinanceCanvas title={TITLE}>
      <FinanceHeading icon={Landmark} title={TITLE} caption={CAPTION}
        actions={
          <span className="flex gap-2">
            <CoverSheetButton claims={claims} types={types} funds={funds} />
            <button type="button"
              onClick={() => void exportPettyXlsx(claims, types, funds,
                `เงินสดย่อย-รอตรวจ-${new Date().toISOString().slice(0, 10)}.xlsx`)}
              className="rounded-lg border border-slate-200 px-3 py-1.5 text-sm">
              ดาวน์โหลด Excel
            </button>
          </span>
        } />

      <Panel title={`รอตรวจ ${pending.length} ใบ`}>
        <ClaimTable claims={pending} types={types} />
        <div className="mt-3 space-y-2">
          {pending.map(c => (
            <div key={c.id} className="flex flex-wrap items-center justify-between gap-2 rounded-lg bg-slate-50 px-3 py-2 text-sm">
              <span>
                {c.form_id} · {c.amount.toLocaleString('th-TH', { minimumFractionDigits: 2 })} บาท
                {c.dd_no ? <> · DD {c.dd_no}</> : <span className="ml-1 text-amber-700">· ยังไม่มีเลข DD</span>}
              </span>
              <span className="flex gap-2">
                <button type="button" disabled={busy === c.form_id} onClick={() => void review(c, true)}
                  className="rounded-lg bg-brand-600 px-3 py-1.5 text-white disabled:opacity-40">ผ่าน</button>
                <button type="button" disabled={busy === c.form_id} onClick={() => void review(c, false)}
                  className="rounded-lg border border-slate-200 px-3 py-1.5 disabled:opacity-40">ส่งกลับแก้ไข</button>
              </span>
            </div>
          ))}
        </div>
      </Panel>

      {reviewed.length > 0 && (
        <Panel title={`ตรวจผ่านแล้ว รอการเงินปิดรอบ (${reviewed.length})`}>
          <ClaimTable claims={reviewed} types={types} />
        </Panel>
      )}
    </FinanceCanvas>
  );
}
