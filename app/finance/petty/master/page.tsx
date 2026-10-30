'use client';

import { useCallback, useEffect, useState } from 'react';
import { MascotLoader } from '@/components/loading';
import { useSessionContext } from '@/app/context/SessionContext';
import type { PettyExpenseType, PettyFund } from '@/app/finance/types-petty';
import { canReview } from '@/lib/finance/petty-access';
import { fundLabel } from '@/lib/finance/petty-fund-label';
import { fetchJson, showAlert, showSuccess } from '../../api';
import { pettyConfirm, pettyReview } from '../../components/petty/petty-confirm';
import { Button, EmptyState, FIELD, FIELD_SM, LABEL, LINE, PettyPage, Section, Tag, UnderlineTabs } from '../../components/petty/ui';

const TITLE = 'ตั้งค่าเงินสดย่อย';
const CAPTION = 'วงเงินของแต่ละสาขา/แผนก และกติกาเอกสารของแต่ละประเภท';

const BLANK_FUND = { branch_code: '', division_code: '', holder_employee_id: '', fund_limit: '' };
const TABS = [{ key: 'funds', label: 'วงเงินสดย่อย' }, { key: 'types', label: 'ประเภทการเบิก' }];
const TH = 'px-3 py-2.5 text-left text-xs font-medium text-ink-500 whitespace-nowrap';
const money = (n: number | null | undefined) => (n == null ? '-' : n.toLocaleString('th-TH', { minimumFractionDigits: 2 }));
const limitText = (raw: string) => (raw.trim() === '' ? 'ไม่ระบุ' : `${money(Number(raw))} บาท`);

export default function PettyMasterPage() {
  const { user, loading } = useSessionContext();
  const [tab, setTab] = useState<'funds' | 'types'>('funds');
  const [funds, setFunds] = useState<PettyFund[] | null>(null);
  const [types, setTypes] = useState<PettyExpenseType[] | null>(null);
  const [draft, setDraft] = useState({ ...BLANK_FUND });
  /** แถวที่กำลังแก้ผู้ถือเงิน/ยอด — แก้ได้ทีละวงเงิน */
  const [editing, setEditing] = useState<{ id: number; holder: string; limit: string } | null>(null);
  const [saving, setSaving] = useState(false);

  const isAdmin = user?.role === 'a';
  const isFinance = canReview(user);

  const loadFunds = useCallback(async () => {
    try { setFunds(await fetchJson<PettyFund[]>('/api/finance/petty/funds?active=false')); }
    catch (err) { setFunds([]); showAlert({ icon: 'error', title: 'โหลดวงเงินไม่สำเร็จ', text: (err as Error).message }); }
  }, []);

  const loadTypes = useCallback(async () => {
    try { setTypes(await fetchJson<PettyExpenseType[]>('/api/finance/petty/expense-types?active=false')); }
    catch (err) { setTypes([]); showAlert({ icon: 'error', title: 'โหลดประเภทไม่สำเร็จ', text: (err as Error).message }); }
  }, []);

  useEffect(() => { if (isAdmin || isFinance) { void loadFunds(); void loadTypes(); } }, [isAdmin, isFinance, loadFunds, loadTypes]);

  async function saveFund() {
    const ok = await pettyReview({ title: 'เพิ่มวงเงินสดย่อย',
      rows: [
        ['สาขา', draft.branch_code.trim()],
        ['แผนก', draft.division_code.trim().toUpperCase()],
        ['เจ้าของเงินสด (รหัส)', draft.holder_employee_id.trim()],
        ['วงเงิน', limitText(draft.fund_limit)],
      ], confirmButtonText: 'เพิ่มวงเงิน', cancelButtonText: 'กลับไปแก้ไข' });
    if (!ok) return;
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
      showSuccess('เพิ่มวงเงินแล้ว');
      await loadFunds();
    } catch (err) {
      showAlert({ icon: 'error', title: 'บันทึกไม่สำเร็จ', text: (err as Error).message });
    } finally { setSaving(false); }
  }

  async function saveEdit() {
    if (!editing) return;
    const fund = funds?.find(f => f.id === editing.id);
    const ok = await pettyReview({ title: 'แก้ไขวงเงินสดย่อย',
      rows: [
        ['วงเงิน', fund ? fundLabel(fund) : `#${editing.id}`],
        ['เจ้าของเงินสด (รหัส)', fund && fund.holder_employee_id !== editing.holder.trim()
          ? `${fund.holder_employee_id} → ${editing.holder.trim()}` : editing.holder.trim()],
        ['ยอดวงเงิน', fund && String(fund.fund_limit ?? '') !== editing.limit.trim()
          ? `${money(fund.fund_limit)} → ${limitText(editing.limit)}` : limitText(editing.limit)],
      ], confirmButtonText: 'บันทึก', cancelButtonText: 'กลับไปแก้ไข' });
    if (!ok) return;
    setSaving(true);
    try {
      await fetchJson(`/api/finance/petty/funds/${editing.id}`, {
        method: 'PUT',
        body: JSON.stringify({
          holder_employee_id: editing.holder.trim(),
          fund_limit: editing.limit.trim() === '' ? null : Number(editing.limit),
        }),
      });
      setEditing(null);
      showSuccess('บันทึกแล้ว');
      await loadFunds();
    } catch (err) {
      showAlert({ icon: 'error', title: 'แก้ไขไม่สำเร็จ', text: (err as Error).message });
    } finally { setSaving(false); }
  }

  async function toggleFund(fund: PettyFund) {
    const closing = fund.is_active;
    const ask = await pettyConfirm({
      title: closing ? 'ปิดวงเงินนี้?' : 'เปิดใช้วงเงินนี้?',
      text: `${fundLabel(fund)} · ${fund.holder_name ?? fund.holder_employee_id}`,
      confirmButtonText: closing ? 'ปิดวงเงิน' : 'เปิดใช้',
    }, { danger: closing }) as { isConfirmed?: boolean };
    if (!ask?.isConfirmed) return;
    try {
      await fetchJson(`/api/finance/petty/funds/${fund.id}`, {
        method: 'PUT', body: JSON.stringify({ is_active: !fund.is_active }),
      });
      showSuccess(closing ? 'ปิดวงเงินแล้ว' : 'เปิดใช้แล้ว');
      await loadFunds();
    } catch (err) { showAlert({ icon: 'error', title: 'แก้ไขไม่สำเร็จ', text: (err as Error).message }); }
  }

  async function saveSpec(type: PettyExpenseType, raw: string) {
    let spec: unknown;
    try { spec = JSON.parse(raw); }
    catch { showAlert({ icon: 'error', title: 'JSON ไม่ถูกต้อง', text: 'ตรวจวงเล็บและเครื่องหมายจุลภาคอีกครั้ง' }); return; }
    const ask = await pettyConfirm({ title: `บันทึกกติกาของ ${type.name_th}?`,
      text: 'มีผลกับช่องที่ต้องกรอก เอกสารที่บังคับ และด่านกันซ้ำของใบใหม่ทันที', confirmButtonText: 'บันทึก' }) as { isConfirmed?: boolean };
    if (!ask?.isConfirmed) return;
    try {
      await fetchJson(`/api/finance/petty/expense-types/${type.code}`, {
        method: 'PUT',
        body: JSON.stringify({
          name_th: type.name_th, atms_sku: type.atms_sku, sort_order: type.sort_order,
          is_active: type.is_active, spec,
        }),
      });
      await loadTypes();
      showSuccess('บันทึกแล้ว');
    } catch (err) { showAlert({ icon: 'error', title: 'บันทึกไม่สำเร็จ', text: (err as Error).message }); }
  }

  if (loading) return <MascotLoader />;
  if (!isAdmin && !isFinance) {
    return <PettyPage title={TITLE}><EmptyState title="ไม่มีสิทธิ์เข้าถึง" text="หน้านี้สำหรับผู้ดูแลระบบและฝ่ายบัญชีเท่านั้น" /></PettyPage>;
  }

  const adminBtn = 'rounded px-1 text-xs font-medium text-ink-500 underline-offset-2 hover:text-ink-900 hover:underline';

  return (
    <PettyPage title={TITLE} caption={CAPTION}>
      <UnderlineTabs tabs={TABS} active={tab} onChange={k => setTab(k as 'funds' | 'types')} label="หมวดตั้งค่า" />

      {tab === 'funds' && (
        <div className="mt-5">
          {funds === null ? <MascotLoader /> : (
            <>
              {/* มือถือ */}
              <ul className={`divide-y ${LINE} sm:hidden`}>
                {funds.map(f => (
                  <li key={f.id} className="py-3">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <p className="text-sm font-semibold text-ink-900">{fundLabel(f)}</p>
                        <p className="text-xs text-ink-500">{f.branch_code} · {f.division_code} · {f.holder_name ?? '-'} {f.holder_employee_id}</p>
                      </div>
                      <Tag strong={!f.is_active}>{f.is_active ? 'เปิดใช้' : 'ปิด'}</Tag>
                    </div>
                    <p className="mt-1 text-xs tabular-nums text-ink-700">วงเงิน {money(f.fund_limit)}</p>
                    {editing?.id === f.id ? (
                      <div className="mt-2 grid grid-cols-2 gap-2">
                        <input value={editing.holder} onChange={e => setEditing({ ...editing, holder: e.target.value })}
                          placeholder="รหัสพนักงาน" aria-label="รหัสเจ้าของเงินสด" className={FIELD_SM} />
                        <input value={editing.limit} onChange={e => setEditing({ ...editing, limit: e.target.value })}
                          inputMode="decimal" aria-label="ยอดวงเงิน" className={`${FIELD_SM} text-right`} />
                        <Button onClick={() => setEditing(null)}>ยกเลิก</Button>
                        <Button tone="primary" disabled={saving || !editing.holder.trim()} onClick={() => void saveEdit()}>บันทึก</Button>
                      </div>
                    ) : isAdmin && (
                      <div className="mt-1.5 flex gap-3">
                        <button type="button" className={adminBtn}
                          onClick={() => setEditing({ id: f.id, holder: f.holder_employee_id, limit: f.fund_limit == null ? '' : String(f.fund_limit) })}>แก้ไข</button>
                        <button type="button" className={adminBtn} onClick={() => void toggleFund(f)}>{f.is_active ? 'ปิดวงเงิน' : 'เปิดใช้'}</button>
                      </div>
                    )}
                  </li>
                ))}
                {funds.length === 0 && <li className="py-10 text-center text-sm text-ink-500">ยังไม่มีวงเงินสดย่อย</li>}
              </ul>

              {/* เดสก์ท็อป */}
              <div className="hidden overflow-x-auto sm:block">
                <table className="w-full text-sm">
                  <thead className={`border-b ${LINE}`}>
                    <tr>
                      <th className={TH}>ชื่อวงเงินสดย่อย</th>
                      <th className={TH}>สาขา · แผนก</th>
                      <th className={TH}>เจ้าของเงินสด (ผู้อนุมัติจ่าย)</th>
                      <th className={`${TH} text-right`}>ยอดวงเงิน</th>
                      <th className={TH}>สถานะ</th>
                      <th className={TH}><span className="sr-only">จัดการ</span></th>
                    </tr>
                  </thead>
                  <tbody>
                    {funds.map(f => (
                      <tr key={f.id} className="border-b border-[#f3f6fa] text-ink-900 hover:bg-[#f9fbfd]">
                        <td className="px-3 py-2.5 font-medium">{fundLabel(f)}</td>
                        <td className="px-3 py-2.5 text-ink-700">{f.branch_code} · {f.division_code}</td>
                        {editing?.id === f.id ? (
                          <>
                            <td className="px-3 py-2">
                              <input value={editing.holder} onChange={e => setEditing({ ...editing, holder: e.target.value })}
                                placeholder="รหัสพนักงาน" aria-label="รหัสเจ้าของเงินสด" className={`${FIELD_SM} w-32`} />
                            </td>
                            <td className="px-3 py-2 text-right">
                              <input value={editing.limit} onChange={e => setEditing({ ...editing, limit: e.target.value })}
                                inputMode="decimal" aria-label="ยอดวงเงิน" className={`${FIELD_SM} w-32 text-right`} />
                            </td>
                            <td className="px-3 py-2.5"><Tag strong={!f.is_active}>{f.is_active ? 'เปิดใช้' : 'ปิด'}</Tag></td>
                            <td className="whitespace-nowrap px-3 py-2 text-right">
                              <span className="inline-flex gap-1.5">
                                <Button size="sm" onClick={() => setEditing(null)}>ยกเลิก</Button>
                                <Button size="sm" tone="primary" disabled={saving || !editing.holder.trim()} onClick={() => void saveEdit()}>บันทึก</Button>
                              </span>
                            </td>
                          </>
                        ) : (
                          <>
                            <td className="px-3 py-2.5">{f.holder_name ?? '-'} <span className="text-xs text-ink-500">{f.holder_employee_id}</span></td>
                            <td className="px-3 py-2.5 text-right tabular-nums">{money(f.fund_limit)}</td>
                            <td className="px-3 py-2.5"><Tag strong={!f.is_active}>{f.is_active ? 'เปิดใช้' : 'ปิด'}</Tag></td>
                            <td className="whitespace-nowrap px-3 py-2.5 text-right">
                              {isAdmin && (
                                <span className="inline-flex gap-3">
                                  <button type="button" className={adminBtn}
                                    onClick={() => setEditing({ id: f.id, holder: f.holder_employee_id, limit: f.fund_limit == null ? '' : String(f.fund_limit) })}>แก้ไข</button>
                                  <button type="button" className={adminBtn} onClick={() => void toggleFund(f)}>
                                    {f.is_active ? 'ปิดวงเงิน' : 'เปิดใช้'}
                                  </button>
                                </span>
                              )}
                            </td>
                          </>
                        )}
                      </tr>
                    ))}
                    {funds.length === 0 && (
                      <tr><td colSpan={6} className="py-10 text-center text-ink-500">ยังไม่มีวงเงินสดย่อย</td></tr>
                    )}
                  </tbody>
                </table>
              </div>
            </>
          )}

          {isAdmin && (
            <Section label="เพิ่มวงเงิน" className="mt-6 !border-t !pt-6">
              <div className="grid items-end gap-3 sm:grid-cols-2 lg:grid-cols-5">
                <label className="block"><span className={LABEL}>สาขา</span>
                  <input value={draft.branch_code} onChange={e => setDraft({ ...draft, branch_code: e.target.value })}
                    placeholder="03" className={FIELD} />
                </label>
                <label className="block"><span className={LABEL}>แผนก</span>
                  <input value={draft.division_code} onChange={e => setDraft({ ...draft, division_code: e.target.value })}
                    placeholder="B02" className={FIELD} />
                </label>
                <label className="block"><span className={LABEL}>เจ้าของเงินสด (รหัส)</span>
                  <input value={draft.holder_employee_id} onChange={e => setDraft({ ...draft, holder_employee_id: e.target.value })}
                    placeholder="รหัสพนักงาน" className={FIELD} />
                </label>
                <label className="block"><span className={LABEL}>วงเงิน</span>
                  <input value={draft.fund_limit} onChange={e => setDraft({ ...draft, fund_limit: e.target.value })}
                    placeholder="ไม่ระบุก็ได้" inputMode="decimal" className={`${FIELD} text-right`} />
                </label>
                <Button tone="primary" size="lg" disabled={saving || !draft.branch_code || !draft.division_code || !draft.holder_employee_id}
                  onClick={() => void saveFund()} className="w-full">
                  เพิ่มวงเงิน
                </Button>
              </div>
            </Section>
          )}
        </div>
      )}

      {tab === 'types' && (
        <div className="mt-5">
          {types === null ? <MascotLoader /> : types.map(t => (
            <Section key={t.code}
              label={<span className="inline-flex items-center gap-2">{t.name_th}<Tag>{t.code}</Tag>{!t.is_active && <Tag strong>ปิด</Tag>}</span>}>
              <SpecEditor value={JSON.stringify(t.spec, null, 2)} onSave={raw => void saveSpec(t, raw)} />
            </Section>
          ))}
          {types?.length === 0 && <EmptyState title="ยังไม่มีประเภทการเบิก" />}
        </div>
      )}
    </PettyPage>
  );
}

function SpecEditor({ value, onSave }: { value: string; onSave: (raw: string) => void }) {
  const [draft, setDraft] = useState(value);
  useEffect(() => { setDraft(value); }, [value]);
  const dirty = draft !== value;
  return (
    <div>
      <textarea value={draft} onChange={e => setDraft(e.target.value)} rows={14} spellCheck={false} aria-label="กติกา (JSON)"
        className={`${FIELD} font-mono text-xs leading-relaxed`} />
      <div className="mt-2 flex flex-wrap items-center gap-2">
        <Button tone="primary" onClick={() => onSave(draft)} disabled={!dirty}>บันทึก</Button>
        <Button onClick={() => setDraft(value)} disabled={!dirty}>ยกเลิกที่แก้</Button>
        {dirty && <span className="text-xs text-ink-500">มีการแก้ที่ยังไม่บันทึก</span>}
      </div>
    </div>
  );
}
