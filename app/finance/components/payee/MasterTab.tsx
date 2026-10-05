'use client';

import { useEffect, useMemo, useState } from 'react';
import { FileText, History, Pencil, Plus, Power, Search } from 'lucide-react';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { MascotLoader } from '@/components/loading';
import { bankLabel, formatAccountNo, normalizeAccountNo } from '@/lib/finance/bank';
import { formatDate } from '@/lib/finance/status';
import { kbankAccountError, type PayeeAccount } from '@/lib/finance/payee';
import { formatPayeeChanges, PAYEE_LOG_ACTION_LABELS } from '@/lib/finance/payee-log';
import { fetchJson, showAlert, showConfirm } from '../../api';

type PersonInfo = { employee_id: string; name: string | null; department: string | null; position: string | null };
type PayeeLog = { action: string; changes: unknown; remark: string | null; action_by: string | null; action_by_name: string | null; created_at: string | null };

const BTN_PRIMARY = 'inline-flex items-center gap-1.5 rounded-xl bg-linear-to-r from-brand-600 to-brand-500 px-4 py-2 text-sm font-semibold text-white shadow-md transition-all hover:from-brand-700 hover:to-brand-600 disabled:cursor-not-allowed disabled:opacity-50';
const BTN_GHOST = 'rounded-xl px-4 py-2 text-sm text-gray-600 hover:bg-gray-100 disabled:opacity-50';
const ICON_BTN = 'inline-flex size-8 items-center justify-center rounded-lg text-gray-500 transition-colors hover:bg-gray-100 hover:text-brand-700';
const FTH = 'px-3 py-3 text-left text-xs font-semibold text-gray-700 whitespace-nowrap';

const LABEL = 'mb-1 block text-xs font-semibold text-gray-600';

function StatusPill({ status }: { status: PayeeAccount['status'] }) {
  const on = status === 'ACTIVE';
  return (
    <span className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-medium whitespace-nowrap ${on ? 'border-emerald-200 bg-emerald-50 text-emerald-700' : 'border-gray-200 bg-gray-100 text-gray-600'}`}>
      {on ? 'ใช้งาน' : 'ปิดใช้งาน'}
    </span>
  );
}

function RowActions({ a, onEdit, onToggle, onLogs }: { a: PayeeAccount; onEdit: () => void; onToggle: () => void; onLogs: () => void }) {
  return (
    <div className="flex items-center gap-1">
      <button type="button" className={ICON_BTN} title="แก้ไข" aria-label="แก้ไข" onClick={onEdit}><Pencil className="size-4" /></button>
      <button type="button" className={ICON_BTN} title={a.status === 'ACTIVE' ? 'ปิดใช้งาน' : 'เปิดใช้งาน'} aria-label={a.status === 'ACTIVE' ? 'ปิดใช้งาน' : 'เปิดใช้งาน'} onClick={onToggle}><Power className="size-4" /></button>
      <button type="button" className={ICON_BTN} title="ประวัติ" aria-label="ประวัติ" onClick={onLogs}><History className="size-4" /></button>
    </div>
  );
}

export function MasterTab({ accounts, loading, query, onQueryChange, onChanged }: {
  accounts: PayeeAccount[] | null; loading: boolean; query: string; onQueryChange: (q: string) => void; onChanged: () => void | Promise<void>;
}) {
  const [addOpen, setAddOpen] = useState(false);
  const [editing, setEditing] = useState<PayeeAccount | null>(null);
  const [logsFor, setLogsFor] = useState<PayeeAccount | null>(null);

  const shown = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return accounts ?? [];
    return (accounts ?? []).filter(a => [a.employee_id, a.employee_name, a.department, a.account_no, a.account_name]
      .some(v => (v ?? '').toLowerCase().includes(q)));
  }, [accounts, query]);

  const toggle = async (a: PayeeAccount) => {
    const next = a.status === 'ACTIVE' ? 'INACTIVE' : 'ACTIVE';
    const res = await showConfirm({
      icon: 'question',
      title: next === 'INACTIVE' ? 'ปิดใช้งานบัญชีนี้?' : 'เปิดใช้งานบัญชีนี้?',
      text: `${a.employee_name ?? a.employee_id} · ${formatAccountNo(a.account_no)}`,
    });
    if (!res.isConfirmed) return;
    try {
      await fetchJson(`/api/finance/payee-accounts/${a.id}`, { method: 'PUT', body: JSON.stringify({ status: next }) });
      await onChanged();
    } catch (err) {
      await showAlert({ icon: 'error', title: 'ดำเนินการไม่สำเร็จ', text: (err as Error).message });
    }
  };

  return (
    <>
      <div className="flex flex-col gap-3 border-b border-gray-100 p-4 sm:flex-row sm:items-center sm:justify-between lg:p-5">
        <div className="relative w-full sm:max-w-sm">
          <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-gray-400" />
          <Input value={query} onChange={e => onQueryChange(e.target.value)} placeholder="ค้นหาชื่อ / รหัสพนักงาน / เลขที่บัญชี" className="pl-9" aria-label="ค้นหา" />
        </div>
        <button type="button" className={BTN_PRIMARY} onClick={() => setAddOpen(true)}><Plus className="size-4" />เพิ่มบัญชี</button>
      </div>

      {loading ? (
        <div className="py-12"><MascotLoader text="กำลังโหลดบัญชี" size={80} /></div>
      ) : shown.length === 0 ? (
        <div className="px-6 py-16 text-center text-gray-500">
          <FileText size={56} className="mx-auto mb-4 text-gray-300" />
          <p className="text-lg">ไม่มีบัญชี</p>
        </div>
      ) : (
        <>
          <div className="block divide-y divide-gray-100 xl:hidden">
            {shown.map(a => (
              <div key={a.id} className="space-y-1.5 px-4 py-3">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="font-medium text-gray-800">{a.employee_name ?? a.employee_id}</p>
                    <p className="text-xs text-gray-500">{a.employee_id}{a.department ? ` · ${a.department}` : ''}</p>
                  </div>
                  <StatusPill status={a.status} />
                </div>
                <p className="text-sm tabular-nums text-brand-800">{bankLabel(a.bank)} · {formatAccountNo(a.account_no)}</p>
                <p className="text-xs text-gray-600">{a.account_name}</p>
                <div className="flex items-center justify-between">
                  <p className="text-xs text-gray-500">แก้ไขล่าสุด {formatDate(a.updated_at)}{a.updated_by_name ? ` · ${a.updated_by_name}` : ''}</p>
                  <RowActions a={a} onEdit={() => setEditing(a)} onToggle={() => toggle(a)} onLogs={() => setLogsFor(a)} />
                </div>
              </div>
            ))}
          </div>
          <div className="hidden overflow-x-auto xl:block">
            <table className="w-full">
              <thead className="bg-gray-100">
                <tr>
                  <th className={FTH}>พนักงาน</th><th className={FTH}>ธนาคาร</th><th className={FTH}>เลขที่บัญชี</th>
                  <th className={FTH}>ชื่อบัญชี</th><th className={FTH}>สถานะ</th><th className={FTH}>แก้ไขล่าสุด</th><th className={FTH} />
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {shown.map(a => (
                  <tr key={a.id} className="transition-colors hover:bg-gray-50">
                    <td className="px-3 py-2.5 text-sm align-top">
                      <p className="font-medium text-gray-800">{a.employee_name ?? a.employee_id}</p>
                      <p className="text-xs text-gray-500">{a.employee_id}{a.department ? ` · ${a.department}` : ''}</p>
                    </td>
                    <td className="px-3 py-2.5 text-sm align-top">{bankLabel(a.bank)}</td>
                    <td className="px-3 py-2.5 text-sm align-top tabular-nums font-medium text-brand-800">{formatAccountNo(a.account_no)}</td>
                    <td className="px-3 py-2.5 text-sm align-top">{a.account_name}</td>
                    <td className="px-3 py-2.5 align-top"><StatusPill status={a.status} /></td>
                    <td className="px-3 py-2.5 text-xs align-top text-gray-600">{formatDate(a.updated_at)}{a.updated_by_name ? <><br />{a.updated_by_name}</> : null}</td>
                    <td className="px-3 py-2.5 align-top"><RowActions a={a} onEdit={() => setEditing(a)} onToggle={() => toggle(a)} onLogs={() => setLogsFor(a)} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}

      <AddAccountDialog open={addOpen} onOpenChange={setAddOpen} onDone={onChanged} />
      <EditAccountDialog account={editing} onClose={() => setEditing(null)} onDone={onChanged} />
      <LogsDialog account={logsFor} onClose={() => setLogsFor(null)} />
    </>
  );
}

function AddAccountDialog({ open, onOpenChange, onDone }: { open: boolean; onOpenChange: (o: boolean) => void; onDone: () => void | Promise<void> }) {
  const [empId, setEmpId] = useState('');
  const [person, setPerson] = useState<PersonInfo | null>(null);
  const [lookup, setLookup] = useState<'idle' | 'loading' | 'notfound'>('idle');
  const [accountNo, setAccountNo] = useState('');
  const [accountName, setAccountName] = useState('');
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (open) { setEmpId(''); setPerson(null); setLookup('idle'); setAccountNo(''); setAccountName(''); setErrors({}); }
  }, [open]);

  const doLookup = async () => {
    const id = empId.trim();
    setPerson(null);
    if (!id) { setLookup('idle'); return; }
    setLookup('loading');
    try {
      const p = await fetchJson<PersonInfo>(`/api/finance/people/${encodeURIComponent(id)}`);
      setPerson(p); setLookup('idle');
      setAccountName(prev => prev.trim() ? prev : (p.name ?? ''));
    } catch {
      setLookup('notfound');
    }
  };

  const submit = async () => {
    const next: Record<string, string> = {};
    if (!person) next.employee_id = 'กรุณาระบุรหัสพนักงานที่มีอยู่ในระบบ';
    const accErr = kbankAccountError(accountNo);
    if (accErr) next.account_no = accErr;
    if (!accountName.trim()) next.account_name = 'กรุณาระบุชื่อบัญชี';
    setErrors(next);
    if (Object.keys(next).length) return;
    setBusy(true);
    try {
      await fetchJson('/api/finance/payee-accounts', {
        method: 'POST',
        body: JSON.stringify({ employee_id: person!.employee_id, account_no: normalizeAccountNo(accountNo), account_name: accountName.trim() }),
      });
      onOpenChange(false);
      try { await onDone(); } catch { /* list shows its own error */ }
      await showAlert({ icon: 'success', title: 'เพิ่มบัญชีแล้ว' });
    } catch (err) {
      await showAlert({ icon: 'error', title: 'เพิ่มบัญชีไม่สำเร็จ', text: (err as Error).message });
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[92vh] overflow-y-auto rounded-2xl sm:max-w-md">
        <DialogHeader className="text-left">
          <DialogTitle className="text-lg font-semibold text-brand-800">เพิ่มบัญชีรับเงิน</DialogTitle>
          <DialogDescription className="text-xs text-gray-500">เพิ่มเข้า Master โดยตรง (ไม่ต้องผ่านคำขอ) · ธนาคารกสิกรไทย</DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <div>
            <label htmlFor="pa-emp" className={LABEL}>รหัสพนักงาน</label>
            <Input id="pa-emp" value={empId} onChange={e => { setEmpId(e.target.value); setPerson(null); setLookup('idle'); }} onBlur={doLookup} />
            {lookup === 'loading' && <p className="mt-1 text-xs text-gray-500">กำลังค้นหา...</p>}
            {lookup === 'notfound' && <p className="mt-1 text-xs text-rose-600">ไม่พบรหัสพนักงาน</p>}
            {person && (
              <p className="mt-1 rounded-lg bg-emerald-50 px-2.5 py-1.5 text-xs text-emerald-800">
                {person.name ?? person.employee_id}{person.department ? ` · ${person.department}` : ''}{person.position ? ` · ${person.position}` : ''}
              </p>
            )}
            {errors.employee_id && <p className="mt-1 text-xs text-rose-600">{errors.employee_id}</p>}
          </div>
          <div>
            <label htmlFor="pa-no" className={LABEL}>เลขที่บัญชี K-Bank</label>
            <Input id="pa-no" inputMode="numeric" value={accountNo} onChange={e => setAccountNo(e.target.value)} placeholder="10 หลัก" />
            {errors.account_no && <p className="mt-1 text-xs text-rose-600">{errors.account_no}</p>}
          </div>
          <div>
            <label htmlFor="pa-name" className={LABEL}>ชื่อบัญชี</label>
            <Input id="pa-name" value={accountName} onChange={e => setAccountName(e.target.value)} />
            {errors.account_name && <p className="mt-1 text-xs text-rose-600">{errors.account_name}</p>}
          </div>
          <div className="flex justify-end gap-2 pt-1">
            <button type="button" className={BTN_GHOST} onClick={() => onOpenChange(false)} disabled={busy}>ยกเลิก</button>
            <button type="button" className={BTN_PRIMARY} onClick={submit} disabled={busy}>{busy ? 'กำลังบันทึก...' : 'บันทึก'}</button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function EditAccountDialog({ account, onClose, onDone }: { account: PayeeAccount | null; onClose: () => void; onDone: () => void | Promise<void> }) {
  const [accountNo, setAccountNo] = useState('');
  const [accountName, setAccountName] = useState('');
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (account) { setAccountNo(account.account_no); setAccountName(account.account_name); setErrors({}); }
  }, [account]);

  const submit = async () => {
    if (!account) return;
    const next: Record<string, string> = {};
    const accErr = kbankAccountError(accountNo);
    if (accErr) next.account_no = accErr;
    if (!accountName.trim()) next.account_name = 'กรุณาระบุชื่อบัญชี';
    setErrors(next);
    if (Object.keys(next).length) return;
    setBusy(true);
    try {
      await fetchJson(`/api/finance/payee-accounts/${account.id}`, {
        method: 'PUT',
        body: JSON.stringify({ account_no: normalizeAccountNo(accountNo), account_name: accountName.trim() }),
      });
      onClose();
      try { await onDone(); } catch { /* list shows its own error */ }
      await showAlert({ icon: 'success', title: 'บันทึกแล้ว' });
    } catch (err) {
      await showAlert({ icon: 'error', title: 'บันทึกไม่สำเร็จ', text: (err as Error).message });
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog open={account !== null} onOpenChange={o => { if (!o) onClose(); }}>
      <DialogContent className="rounded-2xl sm:max-w-md">
        <DialogHeader className="text-left">
          <DialogTitle className="text-lg font-semibold text-brand-800">แก้ไขบัญชี</DialogTitle>
          <DialogDescription className="text-xs text-gray-500">{account?.employee_name ?? account?.employee_id}</DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <div>
            <label htmlFor="pe-no" className={LABEL}>เลขที่บัญชี K-Bank</label>
            <Input id="pe-no" inputMode="numeric" value={accountNo} onChange={e => setAccountNo(e.target.value)} />
            {errors.account_no && <p className="mt-1 text-xs text-rose-600">{errors.account_no}</p>}
          </div>
          <div>
            <label htmlFor="pe-name" className={LABEL}>ชื่อบัญชี</label>
            <Input id="pe-name" value={accountName} onChange={e => setAccountName(e.target.value)} />
            {errors.account_name && <p className="mt-1 text-xs text-rose-600">{errors.account_name}</p>}
          </div>
          <div className="flex justify-end gap-2 pt-1">
            <button type="button" className={BTN_GHOST} onClick={onClose} disabled={busy}>ยกเลิก</button>
            <button type="button" className={BTN_PRIMARY} onClick={submit} disabled={busy}>{busy ? 'กำลังบันทึก...' : 'บันทึก'}</button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function LogsDialog({ account, onClose }: { account: PayeeAccount | null; onClose: () => void }) {
  const [logs, setLogs] = useState<PayeeLog[] | null>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    setLogs(null); setError('');
    if (!account) return;
    let live = true;
    fetchJson<PayeeLog[]>(`/api/finance/payee-accounts/${account.id}/logs`)
      .then(l => { if (live) setLogs(Array.isArray(l) ? l : []); })
      .catch(e => { if (live) setError(e.message); });
    return () => { live = false; };
  }, [account]);

  return (
    <Dialog open={account !== null} onOpenChange={o => { if (!o) onClose(); }}>
      <DialogContent className="max-h-[92vh] overflow-y-auto rounded-2xl sm:max-w-lg">
        <DialogHeader className="text-left">
          <DialogTitle className="text-lg font-semibold text-brand-800">ประวัติบัญชี</DialogTitle>
          <DialogDescription className="text-xs text-gray-500">{account?.employee_name ?? account?.employee_id} · {formatAccountNo(account?.account_no)}</DialogDescription>
        </DialogHeader>
        {error && <p className="rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}
        {!logs && !error && <p className="py-6 text-center text-sm text-gray-500">กำลังโหลด...</p>}
        {logs && logs.length === 0 && <p className="py-6 text-center text-sm text-gray-500">ยังไม่มีประวัติ</p>}
        {logs && logs.length > 0 && (
          <ol className="space-y-3 text-sm">
            {logs.map((log, i) => {
              const lines = formatPayeeChanges(log.changes);
              return (
                <li key={i} className="border-l-2 border-brand-600 pl-3">
                  <p className="font-medium">{PAYEE_LOG_ACTION_LABELS[log.action] ?? log.action} · {log.action_by_name ?? log.action_by ?? '-'}</p>
                  <p className="text-xs text-gray-500">{formatDate(log.created_at)}{log.remark ? ` · ${log.remark}` : ''}</p>
                  {lines.length > 0 && (
                    <ul className="mt-1 text-xs text-gray-600">{lines.map(l => <li key={l}>{l}</li>)}</ul>
                  )}
                </li>
              );
            })}
          </ol>
        )}
      </DialogContent>
    </Dialog>
  );
}
