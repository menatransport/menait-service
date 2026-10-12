'use client';

import { useCallback, useEffect, useState } from 'react';
import { Settings2 } from 'lucide-react';
import { MascotLoader } from '@/components/loading';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useSessionContext } from '@/app/context/SessionContext';
import type { PettyExpenseType, PettyFund } from '@/app/finance/types-petty';
import { fetchJson, showAlert } from '../../api';
import { FinanceCanvas, FinanceHeading, NoAccess, Panel } from '../../components/FinanceShell';

const TITLE = 'ตั้งค่าเงินสดย่อย';
const CAPTION = 'กองทุนของแต่ละสาขา/แผนก และกติกาเอกสารของแต่ละประเภทการเบิก';

const BLANK_FUND = { branch_code: '', division_code: '', holder_employee_id: '', fund_limit: '' };

export default function PettyMasterPage() {
  const { user, loading } = useSessionContext();
  const [tab, setTab] = useState<'funds' | 'types'>('funds');
  const [funds, setFunds] = useState<PettyFund[] | null>(null);
  const [types, setTypes] = useState<PettyExpenseType[] | null>(null);
  const [draft, setDraft] = useState({ ...BLANK_FUND });
  const [saving, setSaving] = useState(false);

  const isAdmin = user?.role === 'a';
  const isFinance = !!user?.is_finance;

  const loadFunds = useCallback(async () => {
    try { setFunds(await fetchJson<PettyFund[]>('/api/finance/petty/funds?active=false')); }
    catch (err) { setFunds([]); showAlert({ icon: 'error', title: 'โหลดกองทุนไม่สำเร็จ', text: (err as Error).message }); }
  }, []);

  const loadTypes = useCallback(async () => {
    try { setTypes(await fetchJson<PettyExpenseType[]>('/api/finance/petty/expense-types?active=false')); }
    catch (err) { setTypes([]); showAlert({ icon: 'error', title: 'โหลดประเภทไม่สำเร็จ', text: (err as Error).message }); }
  }, []);

  useEffect(() => { if (isAdmin || isFinance) { void loadFunds(); void loadTypes(); } }, [isAdmin, isFinance, loadFunds, loadTypes]);

  async function saveFund() {
    setSaving(true);
    try {
      await fetchJson('/api/finance/petty/funds', {
        method: 'POST',
        body: JSON.stringify({
          branch_code: draft.branch_code.trim(),
          division_code: draft.division_code.trim().toUpperCase(),
          holder_employee_id: draft.holder_employee_id.trim(),
          fund_limit: draft.fund_limit.trim() === '' ? null : Number(draft.fund_limit),
        }),
      });
      setDraft({ ...BLANK_FUND });
      await loadFunds();
    } catch (err) {
      showAlert({ icon: 'error', title: 'บันทึกไม่สำเร็จ', text: (err as Error).message });
    } finally { setSaving(false); }
  }

  async function toggleFund(fund: PettyFund) {
    try {
      await fetchJson(`/api/finance/petty/funds/${fund.id}`, {
        method: 'PUT', body: JSON.stringify({ is_active: !fund.is_active }),
      });
      await loadFunds();
    } catch (err) { showAlert({ icon: 'error', title: 'แก้ไขไม่สำเร็จ', text: (err as Error).message }); }
  }

  async function saveSpec(type: PettyExpenseType, raw: string) {
    let spec: unknown;
    try { spec = JSON.parse(raw); }
    catch { showAlert({ icon: 'error', title: 'JSON ไม่ถูกต้อง', text: 'ตรวจวงเล็บและเครื่องหมายจุลภาคอีกครั้ง' }); return; }
    try {
      await fetchJson(`/api/finance/petty/expense-types/${type.code}`, {
        method: 'PUT',
        body: JSON.stringify({
          name_th: type.name_th, atms_sku: type.atms_sku, sort_order: type.sort_order,
          is_active: type.is_active, spec,
        }),
      });
      await loadTypes();
      showAlert({ icon: 'success', title: 'บันทึกแล้ว', timer: 1400, showConfirmButton: false });
    } catch (err) { showAlert({ icon: 'error', title: 'บันทึกไม่สำเร็จ', text: (err as Error).message }); }
  }

  if (loading) return <MascotLoader />;
  if (!isAdmin && !isFinance) return <NoAccess text="หน้านี้สำหรับผู้ดูแลระบบและฝ่ายบัญชีเท่านั้น" />;

  return (
    <FinanceCanvas title={TITLE}>
      <FinanceHeading icon={Settings2} title={TITLE} caption={CAPTION} />
      <Tabs value={tab} onValueChange={v => setTab(v as 'funds' | 'types')} className="mb-4">
        <TabsList>
          <TabsTrigger value="funds">กองทุน</TabsTrigger>
          <TabsTrigger value="types">ประเภทการเบิก</TabsTrigger>
        </TabsList>
      </Tabs>

      {tab === 'funds' && (
        <Panel title="กองทุนเงินสดย่อย">
          {funds === null ? <MascotLoader /> : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="text-ink-500 text-left">
                  <tr>
                    <th className="py-2">สาขา</th><th className="py-2">แผนก</th>
                    <th className="py-2">ผู้อนุมัติ (รหัสพนักงาน)</th>
                    <th className="py-2 text-right">วงเงิน</th>
                    <th className="py-2">สถานะ</th><th className="py-2" />
                  </tr>
                </thead>
                <tbody>
                  {funds.map(f => (
                    <tr key={f.id} className="border-t border-slate-100">
                      <td className="py-2">{f.branch_code}</td>
                      <td className="py-2">{f.division_code}</td>
                      <td className="py-2">{f.holder_employee_id}</td>
                      <td className="py-2 text-right">{f.fund_limit?.toLocaleString('th-TH', { minimumFractionDigits: 2 }) ?? '-'}</td>
                      <td className="py-2">{f.is_active ? 'เปิดใช้' : 'ปิด'}</td>
                      <td className="py-2 text-right">
                        {isAdmin && (
                          <button type="button" onClick={() => void toggleFund(f)}
                            className="text-xs text-brand-700 hover:underline">
                            {f.is_active ? 'ปิดกองทุน' : 'เปิดใช้'}
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
                  {funds.length === 0 && (
                    <tr><td colSpan={6} className="py-6 text-center text-ink-400">ยังไม่มีกองทุน</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          )}

          {isAdmin && (
            <div className="mt-4 grid gap-2 sm:grid-cols-5 items-end">
              <label className="text-sm">สาขา
                <input value={draft.branch_code} onChange={e => setDraft({ ...draft, branch_code: e.target.value })}
                  placeholder="03" className="mt-1 w-full rounded-lg border border-slate-200 px-2 py-1.5" />
              </label>
              <label className="text-sm">แผนก
                <input value={draft.division_code} onChange={e => setDraft({ ...draft, division_code: e.target.value })}
                  placeholder="B02" className="mt-1 w-full rounded-lg border border-slate-200 px-2 py-1.5" />
              </label>
              <label className="text-sm">ผู้อนุมัติ
                <input value={draft.holder_employee_id} onChange={e => setDraft({ ...draft, holder_employee_id: e.target.value })}
                  placeholder="รหัสพนักงาน" className="mt-1 w-full rounded-lg border border-slate-200 px-2 py-1.5" />
              </label>
              <label className="text-sm">วงเงิน
                <input value={draft.fund_limit} onChange={e => setDraft({ ...draft, fund_limit: e.target.value })}
                  placeholder="ไม่ระบุก็ได้" className="mt-1 w-full rounded-lg border border-slate-200 px-2 py-1.5" />
              </label>
              <button type="button" disabled={saving || !draft.branch_code || !draft.division_code || !draft.holder_employee_id}
                onClick={() => void saveFund()}
                className="rounded-lg bg-brand-600 px-3 py-2 text-white disabled:opacity-40">
                เพิ่มกองทุน
              </button>
            </div>
          )}
        </Panel>
      )}

      {tab === 'types' && (
        <div className="grid gap-4">
          {types === null ? <MascotLoader /> : types.map(t => (
            <Panel key={t.code} title={`${t.name_th} (${t.code})`}>
              <p className="mb-2 text-xs text-ink-500">
                กติกานี้คุมทั้งช่องที่ต้องกรอก เอกสารที่บังคับ และด่านกันซ้ำ — แก้ที่นี่ได้เลย ไม่ต้องแก้โค้ด
              </p>
              <SpecEditor value={JSON.stringify(t.spec, null, 2)} onSave={raw => void saveSpec(t, raw)} />
            </Panel>
          ))}
        </div>
      )}
    </FinanceCanvas>
  );
}

function SpecEditor({ value, onSave }: { value: string; onSave: (raw: string) => void }) {
  const [draft, setDraft] = useState(value);
  useEffect(() => { setDraft(value); }, [value]);
  return (
    <div>
      <textarea value={draft} onChange={e => setDraft(e.target.value)} rows={14} spellCheck={false}
        className="w-full rounded-lg border border-slate-200 p-3 font-mono text-xs" />
      <div className="mt-2 flex gap-2">
        <button type="button" onClick={() => onSave(draft)}
          className="rounded-lg bg-brand-600 px-3 py-1.5 text-sm text-white">บันทึก</button>
        <button type="button" onClick={() => setDraft(value)}
          className="rounded-lg border border-slate-200 px-3 py-1.5 text-sm">ยกเลิกที่แก้</button>
      </div>
    </div>
  );
}
