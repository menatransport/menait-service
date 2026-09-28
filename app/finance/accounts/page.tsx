'use client';

import { useCallback, useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useSessionContext } from '@/app/context/SessionContext';
import { fetchJson, showAlert } from '../api';
import { FinanceShell, NoAccess, Panel } from '../components/FinanceShell';
import type { FinAccount } from '../types';

export default function FinanceAccountsPage() {
  const { user, loading } = useSessionContext();
  const [accounts, setAccounts] = useState<FinAccount[]>([]);
  const [draft, setDraft] = useState({ acc_code: '', acc_name: '', acc_name_en: '' });
  const [editing, setEditing] = useState<FinAccount | null>(null);
  const [saving, setSaving] = useState(false);

  const load = useCallback(() => {
    fetchJson<FinAccount[]>('/api/finance/accounts').then(setAccounts)
      .catch(err => showAlert({ icon: 'error', title: 'โหลดข้อมูลไม่สำเร็จ', text: err.message }));
  }, []);

  useEffect(() => { if (user?.is_finance) load(); }, [user?.is_finance, load]);

  const save = async (method: 'POST' | 'PUT', body: Record<string, unknown>, done: string) => {
    setSaving(true);
    try {
      await fetchJson('/api/finance/accounts', { method, body: JSON.stringify(body) });
      await showAlert({ icon: 'success', title: done });
      setDraft({ acc_code: '', acc_name: '', acc_name_en: '' });
      setEditing(null);
      load();
    } catch (err) {
      showAlert({ icon: 'error', title: 'บันทึกไม่สำเร็จ', text: (err as Error).message });
    } finally {
      setSaving(false);
    }
  };

  if (!loading && !user?.is_finance) return <FinanceShell title="รหัสบัญชี"><NoAccess /></FinanceShell>;

  return (
    <FinanceShell title="รหัสบัญชี (เงินสดย่อย)" wide>
      <Panel title="เพิ่มรหัสบัญชี">
        <form className="grid gap-3 sm:grid-cols-4" onSubmit={e => {
          e.preventDefault();
          if (!draft.acc_code.trim() || !draft.acc_name.trim()) return showAlert({ icon: 'warning', title: 'กรุณาระบุรหัสและชื่อบัญชี' });
          save('POST', draft, 'เพิ่มรหัสบัญชีแล้ว');
        }}>
          <Input placeholder="AccCode" value={draft.acc_code} onChange={e => setDraft({ ...draft, acc_code: e.target.value })} />
          <Input placeholder="AccName (ไทย)" value={draft.acc_name} onChange={e => setDraft({ ...draft, acc_name: e.target.value })} />
          <Input placeholder="AccNameEng" value={draft.acc_name_en} onChange={e => setDraft({ ...draft, acc_name_en: e.target.value })} />
          <Button type="submit" disabled={saving} className="bg-[#026a75] hover:bg-[#055058]">เพิ่ม</Button>
        </form>
      </Panel>
      <Panel title={`ทั้งหมด ${accounts.length} บัญชี`}>
        <div className="overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead className="bg-gray-50 text-xs text-gray-600">
              <tr><th className="px-3 py-2 text-left">AccCode</th><th className="px-3 py-2 text-left">AccName</th>
                <th className="px-3 py-2 text-left">AccNameEng</th><th className="px-3 py-2 text-left">สถานะ</th><th className="px-3 py-2" /></tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {accounts.map(a => editing?.acc_code === a.acc_code ? (
                <tr key={a.acc_code}>
                  <td className="px-3 py-2 font-medium">{a.acc_code}</td>
                  <td className="px-3 py-2"><Input value={editing.acc_name} onChange={e => setEditing({ ...editing, acc_name: e.target.value })} /></td>
                  <td className="px-3 py-2"><Input value={editing.acc_name_en ?? ''} onChange={e => setEditing({ ...editing, acc_name_en: e.target.value })} /></td>
                  <td className="px-3 py-2">
                    <label className="inline-flex items-center gap-2 text-xs">
                      <input type="checkbox" checked={editing.is_active} onChange={e => setEditing({ ...editing, is_active: e.target.checked })} /> ใช้งาน
                    </label>
                  </td>
                  <td className="space-x-2 whitespace-nowrap px-3 py-2 text-right">
                    <Button size="sm" disabled={saving} className="bg-[#026a75] hover:bg-[#055058]"
                      onClick={() => save('PUT', { acc_code: editing.acc_code, acc_name: editing.acc_name, acc_name_en: editing.acc_name_en, is_active: editing.is_active }, 'บันทึกแล้ว')}>บันทึก</Button>
                    <Button size="sm" variant="outline" onClick={() => setEditing(null)}>ยกเลิก</Button>
                  </td>
                </tr>
              ) : (
                <tr key={a.acc_code} className={a.is_active ? '' : 'text-gray-400'}>
                  <td className="px-3 py-2 font-medium">{a.acc_code}</td>
                  <td className="px-3 py-2">{a.acc_name}</td>
                  <td className="px-3 py-2">{a.acc_name_en ?? '-'}</td>
                  <td className="px-3 py-2">{a.is_active ? 'ใช้งาน' : 'ปิดใช้งาน'}</td>
                  <td className="px-3 py-2 text-right"><Button size="sm" variant="outline" onClick={() => setEditing(a)}>แก้ไข</Button></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Panel>
    </FinanceShell>
  );
}
