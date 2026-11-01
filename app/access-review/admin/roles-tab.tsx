'use client';

import { useEffect, useMemo, useState } from 'react';
import { ChevronDown, ChevronRight, Copy, ListTree, Pencil, Plus, Search, Trash2, Users } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { TableSkeleton } from '@/components/ui/loading';
import { adminCopyRoleItems, adminCreateRole, adminDeleteRole, adminListRoles, adminListSystems, adminUpdateRole } from '../api';
import { ActivePill, SYSTEM_META, SystemIcon } from '../components';
import { RoleItemsDialog } from './role-items-dialog';
import { RolePicker } from './role-picker';
import { RoleUsersDialog } from './role-users-dialog';
import type { AdminRole, AdminSystem, SystemCode } from '../types';

const showAlert = (opts: Record<string, unknown>) => import('sweetalert2').then(({ default: Swal }) => Swal.fire({ confirmButtonText: 'ตกลง', ...opts }));
const showConfirm = (opts: Record<string, unknown>) => import('sweetalert2').then(({ default: Swal }) => Swal.fire({
    showCancelButton: true, confirmButtonColor: '#1c6ef2', cancelButtonColor: '#d33', confirmButtonText: 'ยืนยัน', cancelButtonText: 'ยกเลิก', ...opts,
})).then(r => r.isConfirmed);

/** Email groups are a single grant each — no item list, nothing to copy. */
const hasItems = (code: SystemCode) => code !== 'EMAIL';

type AddSeed = { systemId: number | null; source: AdminRole | null };

function AddRoleDialog({ systems, seed, onClose, onCreated }: {
    systems: AdminSystem[];
    seed: AddSeed | null;
    onClose: () => void;
    onCreated: (r: AdminRole) => void;
}) {
    const open = seed != null;
    const [systemId, setSystemId] = useState<number | null>(null);
    const [mode, setMode] = useState<'blank' | 'copy'>('blank');
    const [source, setSource] = useState<AdminRole | null>(null);
    const [name, setName] = useState('');
    const [saving, setSaving] = useState(false);

    useEffect(() => {
        if (!seed) return;
        setSystemId(seed.systemId ?? systems[0]?.id ?? null);
        setMode(seed.source ? 'copy' : 'blank');
        setSource(seed.source);
        setName(seed.source ? `${seed.source.name} (สำเนา)` : '');
    }, [seed, systems]);

    const system = systems.find(s => s.id === systemId) ?? null;
    const canCopy = system ? hasItems(system.code) : false;
    const copying = canCopy && mode === 'copy';

    const pickSystem = (id: number) => {
        setSystemId(id);
        setSource(null);
        if (!hasItems(systems.find(s => s.id === id)?.code ?? 'ATMS')) setMode('blank');
    };

    const pickSource = (r: AdminRole | null) => {
        // follow the source in the name only while the name is still the auto one
        if (!name.trim() || (source && name === `${source.name} (สำเนา)`)) setName(r ? `${r.name} (สำเนา)` : '');
        setSource(r);
    };

    const save = async () => {
        if (!systemId || !name.trim()) return showAlert({ icon: 'warning', title: 'กรุณาเลือกระบบและระบุชื่อกลุ่มสิทธิ์' });
        if (copying && !source) return showAlert({ icon: 'warning', title: 'กรุณาเลือกกลุ่มสิทธิ์ต้นทาง' });
        setSaving(true);
        try {
            let role = await adminCreateRole({ system_id: systemId, name: name.trim() });
            if (copying && source) {
                try {
                    role = (await adminCopyRoleItems(role.id, source.id)).role;
                } catch (err) {
                    await showAlert({
                        icon: 'warning', title: 'สร้างกลุ่มแล้ว แต่คัดลอกรายการไม่สำเร็จ',
                        text: `${err instanceof Error ? err.message : ''} — ลองใหม่ได้ที่ปุ่ม "คัดลอกจากกลุ่มอื่น" ในรายละเอียดสิทธิ์`,
                    });
                }
            }
            onCreated(role);
            onClose();
        } catch (err) {
            await showAlert({ icon: 'error', title: 'สร้างไม่สำเร็จ', text: err instanceof Error ? err.message : undefined });
        } finally {
            setSaving(false);
        }
    };

    return (
        <Dialog open={open} onOpenChange={v => !v && onClose()}>
            <DialogContent className="sm:max-w-3xl">
                <DialogHeader><DialogTitle>เพิ่มกลุ่มสิทธิ์</DialogTitle></DialogHeader>
                <div className="space-y-4">
                    <div>
                        <p className="mb-1.5 text-sm text-gray-700">ระบบ</p>
                        <div className="inline-flex rounded-lg border border-gray-200 p-0.5">
                            {systems.map(s => (
                                <button
                                    key={s.id}
                                    type="button"
                                    onClick={() => pickSystem(s.id)}
                                    className={`inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm cursor-pointer ${s.id === systemId ? 'bg-brand-600 text-white' : 'text-gray-600 hover:bg-gray-50'}`}
                                >
                                    <SystemIcon code={s.code} className="size-3.5" />{SYSTEM_META[s.code]?.label ?? s.name}
                                </button>
                            ))}
                        </div>
                    </div>

                    {canCopy && (
                        <div>
                            <p className="mb-1.5 text-sm text-gray-700">รายการสิทธิ์ตั้งต้น</p>
                            <div className="grid grid-cols-2 gap-2">
                                {([['blank', 'กลุ่มว่าง', 'เพิ่มรายการเองภายหลัง'], ['copy', 'คัดลอกจากกลุ่มอื่น', 'สำเนารายการสิทธิ์ทั้งหมด']] as const).map(([value, title, sub]) => (
                                    <button
                                        key={value}
                                        type="button"
                                        onClick={() => setMode(value)}
                                        className={`rounded-lg border px-3 py-2 text-left cursor-pointer ${mode === value ? 'border-brand-600 bg-brand-50' : 'border-gray-200 hover:bg-gray-50'}`}
                                    >
                                        <span className={`block text-sm font-medium ${mode === value ? 'text-brand-700' : 'text-gray-700'}`}>{title}</span>
                                        <span className="block text-xs text-gray-400">{sub}</span>
                                    </button>
                                ))}
                            </div>
                        </div>
                    )}

                    {copying && <RolePicker systemId={systemId} value={source} onChange={pickSource} />}

                    <label className="block text-sm text-gray-700">{system?.code === 'EMAIL' ? 'อีเมลกลุ่ม' : 'ชื่อกลุ่มสิทธิ์'}
                        <Input
                            value={name}
                            onChange={e => setName(e.target.value)}
                            placeholder={system?.code === 'EMAIL' ? 'เช่น account-center@menatransport.co.th' : 'เช่น ACC-Officer'}
                            className="mt-1"
                        />
                    </label>

                    {copying && source && (
                        <p className="rounded-lg border border-gray-200 bg-gray-50 px-3 py-2 text-xs text-gray-600">
                            จะคัดลอก <b className="tabular-nums">{source.item_count.toLocaleString()}</b> รายการจาก <b>{source.name}</b> — ไม่รวมพนักงานที่ถือสิทธิ์
                        </p>
                    )}
                </div>
                <DialogFooter>
                    <Button type="button" variant="outline" onClick={onClose}>ยกเลิก</Button>
                    <Button type="button" disabled={saving} onClick={save}>{saving ? 'กำลังบันทึก...' : copying ? 'สร้างและคัดลอก' : 'บันทึก'}</Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}

/** Name shown as text; the pencil swaps in an input that saves on Enter / blur. */
function RoleNameCell({ role, onRename }: { role: AdminRole; onRename: (name: string) => Promise<void> }) {
    const [draft, setDraft] = useState<string | null>(null);

    const commit = async () => {
        const name = (draft ?? '').trim();
        setDraft(null);
        if (name && name !== role.name) await onRename(name);
    };

    if (draft !== null) {
        return (
            <Input
                autoFocus
                value={draft}
                onChange={e => setDraft(e.target.value)}
                onBlur={commit}
                onKeyDown={e => { if (e.key === 'Enter') e.currentTarget.blur(); if (e.key === 'Escape') setDraft(null); }}
                className="h-8 max-w-80"
            />
        );
    }
    return (
        <span className="group/name inline-flex items-center gap-1.5">
            <span className="font-medium text-gray-800">{role.name}</span>
            <button type="button" onClick={() => setDraft(role.name)} title="แก้ไขชื่อ" className="text-gray-300 opacity-0 group-hover/name:opacity-100 hover:text-brand-600 cursor-pointer">
                <Pencil className="size-3.5" />
            </button>
        </span>
    );
}

function SystemSection({ system, roles, onOpenItems, onOpenUsers, onCopy, onToggleActive, onRename, onRemove }: {
    system: AdminSystem;
    roles: AdminRole[];
    onOpenItems: (r: AdminRole) => void;
    onOpenUsers: (r: AdminRole) => void;
    onCopy: (r: AdminRole) => void;
    onToggleActive: (r: AdminRole) => void;
    onRename: (r: AdminRole, name: string) => Promise<void>;
    onRemove: (r: AdminRole) => void;
}) {
    const [open, setOpen] = useState(true);
    const items = hasItems(system.code);
    const users = roles.reduce((n, r) => n + r.user_count, 0);
    const headers: [string, string][] = items
        ? [['ชื่อกลุ่มสิทธิ์', ''], ['รายการสิทธิ์', 'w-36'], ['ผู้ใช้', 'w-24 text-right'], ['สถานะ', 'w-28'], ['', 'w-20']]
        : [['อีเมลกลุ่ม', ''], ['สมาชิก', 'w-24 text-right'], ['สถานะ', 'w-28'], ['', 'w-20']];

    return (
        <section className="overflow-hidden rounded-xl border border-gray-200">
            <button type="button" onClick={() => setOpen(o => !o)} className="flex w-full items-center gap-2 bg-gray-50 px-3 py-2.5 text-left cursor-pointer hover:bg-gray-100/70">
                {open ? <ChevronDown className="size-4 text-gray-400" /> : <ChevronRight className="size-4 text-gray-400" />}
                <SystemIcon code={system.code} className="size-4 text-brand-600" />
                <span className="font-semibold text-gray-800">{SYSTEM_META[system.code]?.label ?? system.name}</span>
                <span className="text-xs text-gray-500">{roles.length.toLocaleString()} กลุ่ม · ผู้ใช้ {users.toLocaleString()} คน</span>
            </button>

            {open && (roles.length === 0 ? (
                <p className="border-t border-gray-100 py-6 text-center text-sm text-gray-400">ไม่พบกลุ่มสิทธิ์</p>
            ) : (
                <div className="overflow-x-auto border-t border-gray-100">
                    <table className="w-full text-sm">
                        <thead>
                            <tr className="border-b border-gray-100">
                                {headers.map(([h, w], i) => (
                                    <th key={i} className={`px-3 py-2 text-left text-xs font-semibold text-gray-500 whitespace-nowrap ${w}`}>{h}</th>
                                ))}
                            </tr>
                        </thead>
                        <tbody>
                            {roles.map(role => (
                                <tr key={role.id} className={`border-b border-gray-50 last:border-b-0 hover:bg-gray-50/80 ${!role.is_active ? 'opacity-50' : ''}`}>
                                    <td className="px-3 py-2"><RoleNameCell role={role} onRename={name => onRename(role, name)} /></td>
                                    {items && (
                                        <td className="px-3 py-2">
                                            <button type="button" onClick={() => onOpenItems(role)} className="inline-flex items-center gap-1 whitespace-nowrap text-xs font-medium text-brand-600 hover:underline cursor-pointer">
                                                <ListTree className="size-3.5" />{role.item_count.toLocaleString()} รายการ
                                            </button>
                                        </td>
                                    )}
                                    <td className="px-3 py-2 text-right">
                                        <button type="button" onClick={() => onOpenUsers(role)} title="ดูและเพิ่มผู้ใช้" className="inline-flex items-center gap-1 whitespace-nowrap text-xs font-medium text-brand-600 tabular-nums hover:underline cursor-pointer">
                                            <Users className="size-3.5" />{role.user_count.toLocaleString()}
                                        </button>
                                    </td>
                                    <td className="px-3 py-2"><ActivePill active={role.is_active} onClick={() => onToggleActive(role)} /></td>
                                    <td className="px-3 py-2">
                                        <div className="flex items-center justify-end gap-3">
                                            {items && (
                                                <button type="button" onClick={() => onCopy(role)} title="คัดลอกเป็นกลุ่มใหม่" className="text-gray-400 hover:text-brand-600 cursor-pointer"><Copy className="size-3.5" /></button>
                                            )}
                                            <button type="button" onClick={() => onRemove(role)} title="ลบ" className="text-gray-400 hover:text-rose-600 cursor-pointer"><Trash2 className="size-3.5" /></button>
                                        </div>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            ))}
        </section>
    );
}

export function RolesTab() {
    const [systems, setSystems] = useState<AdminSystem[]>([]);
    const [systemId, setSystemId] = useState<number | null>(null);
    const [q, setQ] = useState('');
    const [includeInactive, setIncludeInactive] = useState(false);
    const [roles, setRoles] = useState<AdminRole[] | null>(null);
    const [addSeed, setAddSeed] = useState<AddSeed | null>(null);
    const [itemsFor, setItemsFor] = useState<AdminRole | null>(null);
    const [usersFor, setUsersFor] = useState<AdminRole | null>(null);

    useEffect(() => { adminListSystems().then(setSystems).catch(() => setSystems([])); }, []);

    // ~120 roles in total — load them all once and filter here so every system's count stays visible
    useEffect(() => {
        let alive = true;
        adminListRoles({ include_inactive: includeInactive })
            .then(list => { if (alive) setRoles(list); })
            .catch(() => { if (alive) setRoles([]); });
        return () => { alive = false; };
    }, [includeInactive]);

    const matched = useMemo(() => {
        const needle = q.trim().toLowerCase();
        return (roles ?? []).filter(r => !needle || r.name.toLowerCase().includes(needle));
    }, [roles, q]);

    const bySystem = useMemo(() => {
        const map = new Map<number, AdminRole[]>();
        for (const r of matched) map.set(r.system_id, [...(map.get(r.system_id) ?? []), r]);
        return map;
    }, [matched]);

    const replace = (updated: AdminRole) => {
        setRoles(prev => (prev ?? []).map(r => r.id === updated.id ? updated : r));
        setItemsFor(cur => cur && cur.id === updated.id ? updated : cur);
    };

    const bumpUsers = (roleId: number, delta: number) =>
        setRoles(prev => (prev ?? []).map(r => r.id === roleId ? { ...r, user_count: Math.max(0, r.user_count + delta) } : r));

    const toggleActive = async (role: AdminRole) => {
        try {
            replace(await adminUpdateRole(role.id, { is_active: !role.is_active }));
        } catch (err) {
            await showAlert({ icon: 'error', title: 'บันทึกไม่สำเร็จ', text: err instanceof Error ? err.message : undefined });
        }
    };

    const rename = async (role: AdminRole, name: string) => {
        try {
            replace(await adminUpdateRole(role.id, { name }));
        } catch (err) {
            await showAlert({ icon: 'error', title: 'บันทึกไม่สำเร็จ', text: err instanceof Error ? err.message : undefined });
        }
    };

    const remove = async (role: AdminRole) => {
        const ok = await showConfirm({ icon: 'warning', title: `ลบกลุ่มสิทธิ์ "${role.name}"?`, text: 'ระบบจะลบแบบ soft delete (ซ่อนจากรายการ)' });
        if (!ok) return;
        try {
            await adminDeleteRole(role.id);
            setRoles(prev => (prev ?? []).filter(r => r.id !== role.id));
        } catch (err) {
            await showAlert({ icon: 'error', title: 'ลบไม่สำเร็จ', text: err instanceof Error ? err.message : undefined });
        }
    };

    const created = (role: AdminRole) => {
        setRoles(prev => [role, ...(prev ?? []).filter(r => r.id !== role.id)]);
    };

    const shownSystems = systems.filter(s => systemId == null || s.id === systemId);
    const chip = (active: boolean) => `inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm cursor-pointer ${active ? 'bg-white text-brand-700 shadow-sm font-medium' : 'text-gray-600 hover:text-gray-800'}`;

    return (
        <div className="space-y-3">
            <div className="flex flex-wrap items-center gap-2">
                <div className="inline-flex flex-wrap rounded-lg bg-gray-100 p-0.5">
                    <button type="button" onClick={() => setSystemId(null)} className={chip(systemId == null)}>
                        ทุกระบบ <span className="text-xs text-gray-400 tabular-nums">{matched.length}</span>
                    </button>
                    {systems.map(s => (
                        <button key={s.id} type="button" onClick={() => setSystemId(s.id)} className={chip(systemId === s.id)}>
                            <SystemIcon code={s.code} className="size-3.5" />{SYSTEM_META[s.code]?.label ?? s.name}
                            <span className="text-xs text-gray-400 tabular-nums">{bySystem.get(s.id)?.length ?? 0}</span>
                        </button>
                    ))}
                </div>
                <div className="relative">
                    <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 size-3.5 text-gray-400" />
                    <input value={q} onChange={e => setQ(e.target.value)} placeholder="ค้นหาชื่อกลุ่มสิทธิ์..." className="h-9 w-56 rounded-lg border border-gray-200 bg-white pl-8 pr-3 text-sm text-gray-700 placeholder:text-gray-400" />
                </div>
                <label className="flex items-center gap-1.5 text-xs text-gray-500">
                    <input type="checkbox" checked={includeInactive} onChange={e => setIncludeInactive(e.target.checked)} className="size-3.5 accent-brand-600" />
                    แสดงที่ปิดใช้งาน
                </label>
                <Button type="button" size="sm" onClick={() => setAddSeed({ systemId, source: null })} className="ml-auto gap-1.5">
                    <Plus className="size-3.5" /> เพิ่มกลุ่มสิทธิ์
                </Button>
            </div>

            {roles === null ? <TableSkeleton rows={6} /> : (
                <div className="space-y-3">
                    {shownSystems.map(s => (
                        <SystemSection
                            key={s.id}
                            system={s}
                            roles={bySystem.get(s.id) ?? []}
                            onOpenItems={setItemsFor}
                            onOpenUsers={setUsersFor}
                            onCopy={r => setAddSeed({ systemId: r.system_id, source: r })}
                            onToggleActive={toggleActive}
                            onRename={rename}
                            onRemove={remove}
                        />
                    ))}
                </div>
            )}

            <AddRoleDialog systems={systems} seed={addSeed} onClose={() => setAddSeed(null)} onCreated={created} />
            <RoleUsersDialog role={usersFor} onOpenChange={v => !v && setUsersFor(null)} onCountChanged={bumpUsers} />
            <RoleItemsDialog role={itemsFor} open={itemsFor != null} onOpenChange={v => !v && setItemsFor(null)} onRoleChanged={replace} />
        </div>
    );
}
