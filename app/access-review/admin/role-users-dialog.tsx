'use client';

import { useEffect, useMemo, useState } from 'react';
import { Search, Trash2, UserPlus, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { TableSkeleton } from '@/components/ui/loading';
import { adminCreateUserRole, adminDeleteUserRole, adminListUserRoles, adminUpdateUserRole, AccessReviewError } from '../api';
import { ActivePill, SYSTEM_META, SystemIcon } from '../components';
import type { AdminRole, AdminUserRole } from '../types';

const showAlert = (opts: Record<string, unknown>) => import('sweetalert2').then(({ default: Swal }) => Swal.fire({ confirmButtonText: 'ตกลง', ...opts }));
const showConfirm = (opts: Record<string, unknown>) => import('sweetalert2').then(({ default: Swal }) => Swal.fire({
    showCancelButton: true, confirmButtonColor: '#1c6ef2', cancelButtonColor: '#d33', confirmButtonText: 'ยืนยัน', cancelButtonText: 'ยกเลิก', ...opts,
})).then(r => r.isConfirmed);

/** Minimal shape read from /api/organization/user — the same org list app/master/page.tsx already fetches client-side. */
interface EmployeeOption {
    employee_id: string;
    firstname: string;
    lastname: string;
    department?: string | null;
    division?: { division_th: string | null; division_eng: string | null } | null;
    position?: string | null;
    employee_status?: string | null;
}

const orgLine = (e: EmployeeOption) =>
    [e.division?.division_th || e.division?.division_eng, e.department, e.position].filter(Boolean).join(' · ');

function EmployeePicker({ all, value, onChange }: { all: EmployeeOption[]; value: EmployeeOption | null; onChange: (e: EmployeeOption | null) => void }) {
    const [q, setQ] = useState('');
    const [open, setOpen] = useState(false);

    const term = q.trim().toLowerCase();
    const matches = term.length === 0 ? [] : all
        .filter(e => e.employee_status !== 'Inactive')
        .filter(e => e.employee_id.toLowerCase().includes(term) || `${e.firstname} ${e.lastname}`.toLowerCase().includes(term))
        .slice(0, 20);

    if (value) {
        return (
            <div className="flex items-center justify-between gap-2 rounded-md border border-gray-200 bg-gray-50 px-3 py-2 text-sm">
                <div className="min-w-0">
                    <p className="font-medium text-gray-800">{value.firstname} {value.lastname}</p>
                    <p className="text-xs text-gray-400"><span className="font-mono">{value.employee_id}</span>{orgLine(value) ? ` · ${orgLine(value)}` : ''}</p>
                </div>
                <button type="button" onClick={() => { onChange(null); setQ(''); }} className="text-gray-400 hover:text-rose-600 cursor-pointer shrink-0">
                    <X className="size-4" />
                </button>
            </div>
        );
    }

    return (
        <div className="relative">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 size-3.5 text-gray-400" />
            <Input
                value={q}
                onChange={e => { setQ(e.target.value); setOpen(true); }}
                onFocus={() => setOpen(true)}
                onBlur={() => setTimeout(() => setOpen(false), 150)}
                placeholder="ค้นหาชื่อหรือรหัสพนักงาน..."
                className="pl-8"
            />
            {open && term.length > 0 && (
                <div className="absolute z-10 mt-1 w-full max-h-56 overflow-y-auto rounded-md border border-gray-200 bg-white shadow-lg">
                    {matches.length === 0 ? (
                        <p className="px-3 py-2 text-xs text-gray-400">ไม่พบพนักงาน</p>
                    ) : matches.map(e => (
                        <button
                            key={e.employee_id}
                            type="button"
                            onClick={() => { onChange(e); setQ(''); setOpen(false); }}
                            className="flex w-full flex-col items-start px-3 py-2 text-left text-sm hover:bg-gray-50 cursor-pointer"
                        >
                            <span className="font-medium text-gray-800">{e.firstname} {e.lastname}</span>
                            <span className="text-xs text-gray-400"><span className="font-mono">{e.employee_id}</span>{orgLine(e) ? ` · ${orgLine(e)}` : ''}</span>
                        </button>
                    ))}
                </div>
            )}
        </div>
    );
}

function AccountNameCell({ row, onChanged }: { row: AdminUserRole; onChanged: (r: AdminUserRole) => void }) {
    const [value, setValue] = useState(row.account_name ?? '');

    const commit = async () => {
        if (value === (row.account_name ?? '')) return;
        try {
            onChanged(await adminUpdateUserRole(row.id, { account_name: value }));
        } catch (err) {
            await showAlert({ icon: 'error', title: 'บันทึกไม่สำเร็จ', text: err instanceof Error ? err.message : undefined });
            setValue(row.account_name ?? '');
        }
    };

    return <Input value={value} onChange={e => setValue(e.target.value)} onBlur={commit} className="h-8 w-36 font-mono text-xs" />;
}

/** Inline form at the top of the dialog — pick an employee (+ account name for ATMS/Winspeed) and bind them to this role. */
function AddUserRow({ role, employees, onAdded }: { role: AdminRole; employees: EmployeeOption[]; onAdded: (r: AdminUserRole) => void }) {
    const [employee, setEmployee] = useState<EmployeeOption | null>(null);
    const [accountName, setAccountName] = useState('');
    const [saving, setSaving] = useState(false);
    const needsAccountName = role.system_code !== 'EMAIL';

    const save = async () => {
        if (!employee) return showAlert({ icon: 'warning', title: 'กรุณาเลือกพนักงาน' });
        if (needsAccountName && !accountName.trim()) return showAlert({ icon: 'warning', title: 'กรุณาระบุชื่อบัญชีในระบบ' });
        setSaving(true);
        try {
            onAdded(await adminCreateUserRole({ employee_id: employee.employee_id, role_id: role.id, account_name: needsAccountName ? accountName.trim() : undefined }));
            setEmployee(null);
            setAccountName('');
        } catch (err) {
            const msg = err instanceof AccessReviewError && err.status === 409 ? 'พนักงานคนนี้มีกลุ่มสิทธิ์นี้อยู่แล้ว' : (err instanceof Error ? err.message : undefined);
            await showAlert({ icon: 'error', title: 'เพิ่มผู้ใช้ไม่สำเร็จ', text: msg });
        } finally {
            setSaving(false);
        }
    };

    return (
        <div className="rounded-xl border border-gray-200 bg-gray-50/60 p-3">
            <p className="mb-2 flex items-center gap-1.5 text-sm font-medium text-gray-700"><UserPlus className="size-4 text-brand-600" /> เพิ่มผู้ใช้เข้ากลุ่มสิทธิ์นี้</p>
            <div className="flex flex-col gap-2 sm:flex-row sm:items-start">
                <div className="flex-1"><EmployeePicker all={employees} value={employee} onChange={setEmployee} /></div>
                {needsAccountName && (
                    <Input value={accountName} onChange={e => setAccountName(e.target.value)} placeholder="ชื่อบัญชีในระบบ (username)" className="sm:w-52 font-mono text-sm" />
                )}
                <Button type="button" disabled={saving} onClick={save} className="shrink-0">{saving ? 'กำลังบันทึก...' : 'เพิ่ม'}</Button>
            </div>
        </div>
    );
}

type CountChanged = (roleId: number, delta: number) => void;

/** Keyed by role id from the dialog, so search / filter state starts fresh for every role. */
function RoleUsersPanel({ role, employees, onCountChanged }: { role: AdminRole; employees: EmployeeOption[]; onCountChanged: CountChanged }) {
    const [q, setQ] = useState('');
    const [includeInactive, setIncludeInactive] = useState(false);
    // Keyed on the filter instead of nulling state synchronously when it changes.
    const [listState, setListState] = useState<{ key: boolean; items: AdminUserRole[] } | null>(null);
    const rows = listState?.key === includeInactive ? listState.items : null;
    const setRows = (fn: (items: AdminUserRole[]) => AdminUserRole[]) =>
        setListState(prev => prev && prev.key === includeInactive ? { key: prev.key, items: fn(prev.items) } : prev);

    useEffect(() => {
        let alive = true;
        adminListUserRoles({ role_id: role.id, include_inactive: includeInactive, page_size: 500 })
            .then(res => { if (alive) setListState({ key: includeInactive, items: res.items }); })
            .catch(() => { if (alive) setListState({ key: includeInactive, items: [] }); });
        return () => { alive = false; };
    }, [role.id, includeInactive]);

    // Position comes from the API once the backend sends it; until then fall back to the org list.
    const byId = useMemo(() => new Map(employees.map(e => [e.employee_id, e])), [employees]);
    const positionOf = (r: AdminUserRole) => r.position ?? byId.get(r.employee_id)?.position ?? null;

    const shown = useMemo(() => {
        const needle = q.trim().toLowerCase();
        return (rows ?? []).filter(r => !needle || [r.employee_id, r.employee_name, r.account_name, r.division, r.department]
            .some(v => v?.toLowerCase().includes(needle)));
    }, [rows, q]);

    const replace = (updated: AdminUserRole) => {
        const before = rows?.find(r => r.id === updated.id);
        if (before && before.is_active !== updated.is_active) onCountChanged(updated.role_id, updated.is_active ? 1 : -1);
        setRows(items => items.map(r => r.id === updated.id ? updated : r));
    };

    const added = (row: AdminUserRole) => {
        onCountChanged(row.role_id, 1);
        setRows(items => [row, ...items.filter(r => r.id !== row.id)]);
    };

    const toggleActive = async (row: AdminUserRole) => {
        try { replace(await adminUpdateUserRole(row.id, { is_active: !row.is_active })); }
        catch (err) { await showAlert({ icon: 'error', title: 'บันทึกไม่สำเร็จ', text: err instanceof Error ? err.message : undefined }); }
    };

    const remove = async (row: AdminUserRole) => {
        const ok = await showConfirm({ icon: 'warning', title: `นำ ${row.employee_name} ออกจากกลุ่มสิทธิ์นี้?`, text: 'ระบบจะลบแบบ soft delete' });
        if (!ok) return;
        try {
            await adminDeleteUserRole(row.id);
            if (row.is_active) onCountChanged(row.role_id, -1);
            setRows(items => items.filter(r => r.id !== row.id));
        } catch (err) {
            await showAlert({ icon: 'error', title: 'ลบไม่สำเร็จ', text: err instanceof Error ? err.message : undefined });
        }
    };

    const isEmail = role.system_code === 'EMAIL';
    const headers: [string, string][] = [
        ['ผู้ใช้', ''], ['ฝ่าย / แผนก', ''], ['ตำแหน่ง', ''],
        ...(isEmail ? [] : [['บัญชี', 'w-40'] as [string, string]]),
        ['สถานะ', 'w-28'], ['', 'w-10'],
    ];

    return (
        <div className="min-h-0 flex-1 space-y-3 overflow-y-auto">
            <AddUserRow role={role} employees={employees} onAdded={added} />

            <div className="flex flex-wrap items-center gap-2">
                <div className="relative">
                    <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 size-3.5 text-gray-400" />
                    <input value={q} onChange={e => setQ(e.target.value)} placeholder="ค้นหาชื่อ, รหัส, ฝ่าย, บัญชี..." className="h-9 w-64 rounded-lg border border-gray-200 bg-white pl-8 pr-3 text-sm text-gray-700 placeholder:text-gray-400" />
                </div>
                <label className="flex items-center gap-1.5 text-xs text-gray-500">
                    <input type="checkbox" checked={includeInactive} onChange={e => setIncludeInactive(e.target.checked)} className="size-3.5 accent-brand-600" />
                    แสดงที่ปิดใช้งาน
                </label>
                {rows && <span className="ml-auto text-xs text-gray-500 tabular-nums">{shown.length.toLocaleString()} คน</span>}
            </div>

            {rows === null ? <TableSkeleton rows={5} /> : shown.length === 0 ? (
                <p className="py-8 text-center text-sm text-gray-400">ยังไม่มีผู้ใช้ในกลุ่มนี้</p>
            ) : (
                <div className="overflow-x-auto rounded-xl border border-gray-100">
                    <table className="w-full text-sm">
                        <thead>
                            <tr className="bg-gray-50 border-b border-gray-100">
                                {headers.map(([h, w], i) => (
                                    <th key={i} className={`px-3 py-2 text-left text-xs font-semibold text-gray-500 whitespace-nowrap ${w}`}>{h}</th>
                                ))}
                            </tr>
                        </thead>
                        <tbody>
                            {shown.map(row => (
                                <tr key={row.id} className={`border-b border-gray-50 last:border-b-0 hover:bg-gray-50/80 ${!row.is_active ? 'opacity-50' : ''}`}>
                                    <td className="px-3 py-2">
                                        <p className="text-gray-800">{row.employee_name}</p>
                                        <p className="whitespace-nowrap text-[11px] text-gray-400 font-mono">{row.employee_id}{row.email ? ` · ${row.email}` : ''}</p>
                                    </td>
                                    <td className="px-3 py-2 text-xs text-gray-600 min-w-44">
                                        <p>{row.division || '-'}</p>
                                        {row.department && <p className="text-gray-400">{row.department}</p>}
                                    </td>
                                    <td className="px-3 py-2 text-xs text-gray-600 min-w-40">{positionOf(row) || '-'}</td>
                                    {!isEmail && <td className="px-3 py-2"><AccountNameCell row={row} onChanged={replace} /></td>}
                                    <td className="px-3 py-2"><ActivePill active={row.is_active} onClick={() => toggleActive(row)} /></td>
                                    <td className="px-3 py-2 text-right">
                                        <button type="button" onClick={() => remove(row)} title="นำออกจากกลุ่ม" className="text-gray-400 hover:text-rose-600 cursor-pointer"><Trash2 className="size-3.5" /></button>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            )}
        </div>
    );
}

/**
 * Everyone bound to one role (ar_user_roles), with ฝ่าย / ตำแหน่ง — opened from the ผู้ใช้ count in กลุ่มสิทธิ์.
 * IT adds, edits the account name, toggles or soft-deletes assignments right here.
 */
export function RoleUsersDialog({ role, onOpenChange, onCountChanged }: {
    role: AdminRole | null;
    onOpenChange: (v: boolean) => void;
    /** Active-assignment delta, so the role row's ผู้ใช้ count stays in step without a reload */
    onCountChanged: CountChanged;
}) {
    const [employees, setEmployees] = useState<EmployeeOption[]>([]);

    useEffect(() => {
        fetch('/api/organization/user').then(r => r.ok ? r.json() : []).then(data => setEmployees(Array.isArray(data) ? data : [])).catch(() => setEmployees([]));
    }, []);

    return (
        <Dialog open={role != null} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-5xl max-h-[90vh] flex flex-col">
                <DialogHeader>
                    <DialogTitle className="flex items-center gap-2">
                        {role && <SystemIcon code={role.system_code} className="size-4 text-brand-600" />}
                        {role?.system_code === 'EMAIL' ? 'สมาชิกอีเมลกลุ่ม' : 'ผู้ใช้ในกลุ่มสิทธิ์'}
                    </DialogTitle>
                    {role && <p className="text-sm text-gray-500">{SYSTEM_META[role.system_code]?.label ?? role.system_code} · <b className="text-gray-700">{role.name}</b></p>}
                </DialogHeader>
                {role && <RoleUsersPanel key={role.id} role={role} employees={employees} onCountChanged={onCountChanged} />}
            </DialogContent>
        </Dialog>
    );
}
