'use client';

import { useEffect, useMemo, useState } from 'react';
import { Check, ChevronDown, ChevronRight, Copy, Pencil, Plus, Search, Trash2, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { MascotLoader } from '@/components/loading';
import { adminCopyRoleItems, adminCreateRoleItem, adminDeleteRoleItem, adminListRoleItems, adminUpdateRoleItem } from '../api';
import { SYSTEM_META, SystemIcon } from '../components';
import { RolePicker } from './role-picker';
import type { AdminRole, AdminRoleItem } from '../types';

const showAlert = (opts: Record<string, unknown>) => import('sweetalert2').then(({ default: Swal }) => Swal.fire({ confirmButtonText: 'ตกลง', ...opts }));

/** ATMS imports put warehouses under this category — pinned first, like the employee checklist. */
const WAREHOUSE_CATEGORY = 'คลังสินค้า';
/** ATMS action order, so every menu reads แสดง → ค้นหา → บันทึก → แก้ไข → ลบ. */
const PERMISSION_ORDER = ['แสดง', 'ค้นหา', 'บันทึก', 'แก้ไข', 'ลบ', 'พิมพ์', 'อนุมัติ'];
const permRank = (p: string | null) => { const i = PERMISSION_ORDER.indexOf(p ?? ''); return i < 0 ? PERMISSION_ORDER.length : i; };

/** Header chips per collapsed menu — big report menus (25+) show the rest as +N. */
const MAX_CHIPS = 8;

interface Group { category: string; items: AdminRoleItem[]; permissionOnly: boolean }

function groupItems(items: AdminRoleItem[]): Group[] {
    const map = new Map<string, AdminRoleItem[]>();
    for (const it of items) map.set(it.category, [...(map.get(it.category) ?? []), it]);
    return [...map.entries()]
        .map(([category, list]) => ({
            category,
            items: [...list].sort((a, b) => (a.item ?? '').localeCompare(b.item ?? '', 'th') || permRank(a.permission) - permRank(b.permission)),
            // ATMS menus: no sub-item, just actions → shown as chips on the header line
            permissionOnly: list.every(i => !i.item),
        }))
        .sort((a, b) => (a.category === WAREHOUSE_CATEGORY ? -1 : b.category === WAREHOUSE_CATEGORY ? 1 : a.category.localeCompare(b.category, 'th', { sensitivity: 'base' })));
}

function ItemRow({ item, onChanged, onDeleted }: { item: AdminRoleItem; onChanged: (i: AdminRoleItem) => void; onDeleted: () => void }) {
    const [draft, setDraft] = useState<{ category: string; item: string; permission: string } | null>(null);

    const save = async () => {
        if (!draft) return;
        if (!draft.category.trim()) return showAlert({ icon: 'warning', title: 'กรุณาระบุหมวด / เมนู' });
        try {
            onChanged(await adminUpdateRoleItem(item.id, { category: draft.category.trim(), item: draft.item.trim() || null, permission: draft.permission.trim() || null }));
            setDraft(null);
        } catch (err) {
            await showAlert({ icon: 'error', title: 'บันทึกไม่สำเร็จ', text: err instanceof Error ? err.message : undefined });
        }
    };

    const remove = async () => {
        try {
            await adminDeleteRoleItem(item.id);
            onDeleted();
        } catch (err) {
            await showAlert({ icon: 'error', title: 'ลบไม่สำเร็จ', text: err instanceof Error ? err.message : undefined });
        }
    };

    if (draft) {
        const keys = (e: React.KeyboardEvent) => { if (e.key === 'Enter') save(); if (e.key === 'Escape') setDraft(null); };
        return (
            <tr className="border-t border-gray-50 bg-brand-50/40">
                <td className="py-1.5 pl-9 pr-2" colSpan={2}>
                    <div className="grid grid-cols-2 gap-1.5">
                        <Input autoFocus value={draft.item} onChange={e => setDraft({ ...draft, item: e.target.value })} onKeyDown={keys} placeholder="รายการ (ไม่บังคับ)" className="h-8 text-xs" />
                        <Input value={draft.category} onChange={e => setDraft({ ...draft, category: e.target.value })} onKeyDown={keys} placeholder="หมวด / เมนู" className="h-8 text-xs" />
                    </div>
                </td>
                <td className="px-2 py-1.5"><Input value={draft.permission} onChange={e => setDraft({ ...draft, permission: e.target.value })} onKeyDown={keys} placeholder="สิทธิ์" className="h-8 text-xs" /></td>
                <td className="px-2 py-1.5">
                    <div className="flex justify-end gap-2">
                        <button type="button" onClick={save} title="บันทึก" className="text-brand-600 hover:text-brand-700 cursor-pointer"><Check className="size-4" /></button>
                        <button type="button" onClick={() => setDraft(null)} title="ยกเลิก" className="text-gray-400 hover:text-gray-600 cursor-pointer"><X className="size-4" /></button>
                    </div>
                </td>
            </tr>
        );
    }

    return (
        <tr className="group/row border-t border-gray-50 hover:bg-gray-50/80">
            {/* ATMS menu rows have no sub-item: the action itself is the row's label */}
            <td className="py-1.5 pl-9 pr-2 text-gray-700" colSpan={2}>{item.item ?? item.permission ?? <span className="text-gray-400">ทั้งเมนู</span>}</td>
            <td className="px-2 py-1.5 text-gray-600">{item.item && item.permission}</td>
            <td className="px-2 py-1.5">
                <div className="flex justify-end gap-2.5 opacity-0 group-hover/row:opacity-100 focus-within:opacity-100">
                    <button type="button" onClick={() => setDraft({ category: item.category, item: item.item ?? '', permission: item.permission ?? '' })} title="แก้ไข" className="text-gray-400 hover:text-brand-600 cursor-pointer"><Pencil className="size-3.5" /></button>
                    <button type="button" onClick={remove} title="ลบ" className="text-gray-400 hover:text-rose-600 cursor-pointer"><Trash2 className="size-3.5" /></button>
                </div>
            </td>
        </tr>
    );
}

function CategoryGroup({ group, open, onToggle, onAddInto, onChanged, onDeleted }: {
    group: Group;
    open: boolean;
    onToggle: () => void;
    onAddInto: () => void;
    onChanged: (i: AdminRoleItem) => void;
    onDeleted: (id: number) => void;
}) {
    return (
        <tbody className="border-b border-gray-100 last:border-b-0">
            <tr className="hover:bg-gray-50">
                <td className="px-2 py-2" colSpan={3}>
                    <button type="button" onClick={onToggle} className="flex w-full items-center gap-2 text-left cursor-pointer">
                        {open ? <ChevronDown className="size-4 shrink-0 text-gray-400" /> : <ChevronRight className="size-4 shrink-0 text-gray-400" />}
                        <span className="font-medium text-gray-800">{group.category}</span>
                        <span className="shrink-0 text-xs text-gray-400 tabular-nums">{group.items.length.toLocaleString()}</span>
                        {group.permissionOnly && !open && (
                            <span className="flex min-w-0 flex-wrap gap-1">
                                {group.items.slice(0, MAX_CHIPS).map(i => (
                                    <span key={i.id} className="rounded border border-gray-200 bg-white px-1.5 py-px text-[11px] text-gray-600">{i.permission ?? 'ทั้งเมนู'}</span>
                                ))}
                                {group.items.length > MAX_CHIPS && <span className="px-1 text-[11px] text-gray-400">+{group.items.length - MAX_CHIPS}</span>}
                            </span>
                        )}
                    </button>
                </td>
                <td className="w-16 px-2 py-2 text-right">
                    <button type="button" onClick={onAddInto} title="เพิ่มรายการในหมวดนี้" className="text-gray-400 hover:text-brand-600 cursor-pointer"><Plus className="size-4" /></button>
                </td>
            </tr>
            {open && group.items.map(it => (
                <ItemRow key={it.id} item={it} onChanged={onChanged} onDeleted={() => onDeleted(it.id)} />
            ))}
        </tbody>
    );
}

type Panel = 'none' | 'add' | 'copy';

export function RoleItemsDialog({ role, open, onOpenChange, onRoleChanged }: {
    role: AdminRole | null;
    open: boolean;
    onOpenChange: (v: boolean) => void;
    onRoleChanged?: (r: AdminRole) => void;
}) {
    // Keyed on role.id instead of nulling state synchronously when the dialog opens/closes.
    const [result, setResult] = useState<{ roleId: number; items: AdminRoleItem[] } | null>(null);
    const [reloadKey, setReloadKey] = useState(0);
    const [q, setQ] = useState('');
    const [expanded, setExpanded] = useState<Set<string>>(new Set());
    const [panel, setPanel] = useState<Panel>('none');
    const [draft, setDraft] = useState({ category: '', item: '', permission: '' });
    const [source, setSource] = useState<AdminRole | null>(null);
    const [busy, setBusy] = useState(false);

    useEffect(() => {
        if (!open || !role) return;
        let alive = true;
        adminListRoleItems(role.id)
            .then(list => { if (alive) setResult({ roleId: role.id, items: list }); })
            .catch(() => { if (alive) setResult({ roleId: role.id, items: [] }); });
        return () => { alive = false; };
    }, [open, role?.id, reloadKey]); // eslint-disable-line react-hooks/exhaustive-deps -- refetch per role, not per role-object refresh

    useEffect(() => {
        if (!open) return;
        setQ(''); setExpanded(new Set()); setPanel('none'); setSource(null); setDraft({ category: '', item: '', permission: '' });
    }, [open, role?.id]);

    const items = result && role && result.roleId === role.id ? result.items : null;
    const groups = useMemo(() => groupItems(items ?? []), [items]);
    const categories = useMemo(() => groups.map(g => g.category), [groups]);
    const permissions = useMemo(() => [...new Set((items ?? []).map(i => i.permission).filter((p): p is string => !!p))].sort((a, b) => permRank(a) - permRank(b)), [items]);

    // search: a matching category keeps all its rows; otherwise only the matching rows stay (and open)
    const needle = q.trim().toLowerCase();
    const shown = useMemo(() => {
        if (!needle) return groups;
        return groups
            .map(g => g.category.toLowerCase().includes(needle) ? g : {
                ...g,
                items: g.items.filter(i => (i.item ?? '').toLowerCase().includes(needle) || (i.permission ?? '').toLowerCase().includes(needle)),
            })
            .filter(g => g.items.length > 0);
    }, [groups, needle]);

    const setItems = (next: AdminRoleItem[]) => {
        if (!role) return;
        setResult({ roleId: role.id, items: next });
        onRoleChanged?.({ ...role, item_count: next.length });
    };

    const toggle = (category: string) => setExpanded(prev => {
        const next = new Set(prev);
        if (next.has(category)) next.delete(category); else next.add(category);
        return next;
    });
    const allOpen = shown.length > 0 && shown.every(g => expanded.has(g.category));

    const add = async () => {
        if (!role || !draft.category.trim()) return showAlert({ icon: 'warning', title: 'กรุณาระบุหมวด / เมนู' });
        setBusy(true);
        try {
            const created = await adminCreateRoleItem(role.id, { category: draft.category.trim(), item: draft.item.trim() || undefined, permission: draft.permission.trim() || undefined });
            setItems([...(items ?? []), created]);
            setExpanded(prev => new Set(prev).add(created.category));
            setDraft(d => ({ ...d, item: '', permission: '' })); // keep the category for the next row
        } catch (err) {
            await showAlert({ icon: 'error', title: 'เพิ่มรายการไม่สำเร็จ', text: err instanceof Error ? err.message : undefined });
        } finally {
            setBusy(false);
        }
    };

    const copy = async () => {
        if (!role || !source) return;
        setBusy(true);
        try {
            const res = await adminCopyRoleItems(role.id, source.id);
            onRoleChanged?.(res.role);
            setReloadKey(k => k + 1);
            setPanel('none'); setSource(null);
            await showAlert({
                icon: 'success', title: `คัดลอกแล้ว ${res.added.toLocaleString()} รายการ`,
                text: res.added < source.item_count ? `ข้าม ${(source.item_count - res.added).toLocaleString()} รายการที่มีอยู่แล้ว` : undefined,
            });
        } catch (err) {
            await showAlert({ icon: 'error', title: 'คัดลอกไม่สำเร็จ', text: err instanceof Error ? err.message : undefined });
        } finally {
            setBusy(false);
        }
    };

    const openAddInto = (category: string) => {
        setDraft({ category, item: '', permission: '' });
        setPanel('add');
    };

    const panelBtn = (p: Panel) => `gap-1.5 ${panel === p ? 'border-brand-600 text-brand-700 bg-brand-50' : ''}`;

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-3xl max-h-[88vh] flex flex-col gap-3">
                <DialogHeader>
                    <DialogTitle>รายละเอียดสิทธิ์</DialogTitle>
                    {role && (
                        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-gray-600">
                            <span className="inline-flex items-center gap-1.5 rounded border border-gray-200 px-2 py-0.5 text-xs text-gray-600">
                                <SystemIcon code={role.system_code} className="size-3.5" />{SYSTEM_META[role.system_code]?.label ?? role.system_code}
                            </span>
                            <span className="font-medium text-gray-800">{role.name}</span>
                            {items && (
                                <span className="text-xs text-gray-500">
                                    {items.length.toLocaleString()} รายการ · {groups.length.toLocaleString()} หมวด · ผู้ใช้ {role.user_count.toLocaleString()} คน
                                </span>
                            )}
                        </div>
                    )}
                </DialogHeader>

                {items === null ? (
                    <div className="flex justify-center py-8"><MascotLoader text="กำลังโหลด" size={64} /></div>
                ) : (
                    <>
                        <div className="flex flex-wrap items-center gap-2">
                            <div className="relative">
                                <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 size-3.5 text-gray-400" />
                                <input value={q} onChange={e => setQ(e.target.value)} placeholder="ค้นหาหมวด / รายการ / สิทธิ์..." className="h-9 w-64 rounded-lg border border-gray-200 bg-white pl-8 pr-3 text-sm text-gray-700 placeholder:text-gray-400" />
                            </div>
                            {!needle && groups.length > 0 && (
                                <button type="button" onClick={() => setExpanded(allOpen ? new Set() : new Set(shown.map(g => g.category)))} className="text-xs text-gray-500 hover:text-brand-600 cursor-pointer">
                                    {allOpen ? 'ย่อทั้งหมด' : 'ขยายทั้งหมด'}
                                </button>
                            )}
                            <div className="ml-auto flex gap-2">
                                <Button type="button" size="sm" variant="outline" className={panelBtn('copy')} onClick={() => setPanel(p => p === 'copy' ? 'none' : 'copy')}>
                                    <Copy className="size-3.5" /> คัดลอกจากกลุ่มอื่น
                                </Button>
                                <Button type="button" size="sm" variant="outline" className={panelBtn('add')} onClick={() => setPanel(p => p === 'add' ? 'none' : 'add')}>
                                    <Plus className="size-3.5" /> เพิ่มรายการ
                                </Button>
                            </div>
                        </div>

                        {panel === 'copy' && role && (
                            <div className="space-y-2 rounded-lg border border-gray-200 bg-gray-50 p-3">
                                <p className="text-xs text-gray-600">เลือกกลุ่มสิทธิ์ {SYSTEM_META[role.system_code]?.label} ที่ต้องการคัดลอก — เพิ่มเฉพาะรายการที่กลุ่มนี้ยังไม่มี</p>
                                <div className="bg-white rounded-lg"><RolePicker systemId={role.system_id} excludeId={role.id} value={source} onChange={setSource} /></div>
                                <div className="flex items-center justify-end gap-2">
                                    <Button type="button" size="sm" variant="ghost" onClick={() => setPanel('none')}>ยกเลิก</Button>
                                    <Button type="button" size="sm" disabled={!source || busy} onClick={copy}>
                                        {busy ? 'กำลังคัดลอก...' : source ? `คัดลอก ${source.item_count.toLocaleString()} รายการ` : 'คัดลอก'}
                                    </Button>
                                </div>
                            </div>
                        )}

                        {panel === 'add' && (
                            <div className="rounded-lg border border-gray-200 bg-gray-50 p-3">
                                <div className="grid gap-2 sm:grid-cols-[1fr_1fr_10rem_auto] items-end">
                                    <label className="text-xs text-gray-600">หมวด / เมนู
                                        <Input list="ar-categories" value={draft.category} onChange={e => setDraft({ ...draft, category: e.target.value })} placeholder="เลือกหรือพิมพ์ใหม่" className="mt-1 h-8 bg-white text-xs" />
                                    </label>
                                    <label className="text-xs text-gray-600">รายการ
                                        <Input value={draft.item} onChange={e => setDraft({ ...draft, item: e.target.value })} onKeyDown={e => e.key === 'Enter' && add()} placeholder="ไม่บังคับ" className="mt-1 h-8 bg-white text-xs" />
                                    </label>
                                    <label className="text-xs text-gray-600">สิทธิ์
                                        <Input list="ar-permissions" value={draft.permission} onChange={e => setDraft({ ...draft, permission: e.target.value })} onKeyDown={e => e.key === 'Enter' && add()} placeholder="เช่น แสดง" className="mt-1 h-8 bg-white text-xs" />
                                    </label>
                                    <Button type="button" size="sm" disabled={busy} onClick={add} className="gap-1.5"><Plus className="size-3.5" /> เพิ่ม</Button>
                                </div>
                                <datalist id="ar-categories">{categories.map(c => <option key={c} value={c} />)}</datalist>
                                <datalist id="ar-permissions">{permissions.map(p => <option key={p} value={p} />)}</datalist>
                            </div>
                        )}

                        <div className="min-h-0 flex-1 overflow-y-auto rounded-lg border border-gray-100">
                            {shown.length === 0 ? (
                                <p className="py-10 text-center text-sm text-gray-400">{needle ? 'ไม่พบรายการที่ค้นหา' : 'ยังไม่มีรายการสิทธิ์ — เพิ่มเองหรือคัดลอกจากกลุ่มอื่น'}</p>
                            ) : (
                                <table className="w-full text-sm">
                                    <thead className="sticky top-0 z-10 bg-gray-50">
                                        <tr className="border-b border-gray-100">
                                            <th className="px-2 py-1.5 text-left text-xs font-semibold text-gray-500" colSpan={2}>หมวด / เมนู · รายการ</th>
                                            <th className="w-40 px-2 py-1.5 text-left text-xs font-semibold text-gray-500">สิทธิ์</th>
                                            <th className="w-16 px-2 py-1.5" />
                                        </tr>
                                    </thead>
                                    {shown.map(g => (
                                        <CategoryGroup
                                            key={g.category}
                                            group={g}
                                            open={!!needle || expanded.has(g.category)}
                                            onToggle={() => toggle(g.category)}
                                            onAddInto={() => openAddInto(g.category)}
                                            onChanged={updated => setItems((items ?? []).map(x => x.id === updated.id ? updated : x))}
                                            onDeleted={id => setItems((items ?? []).filter(x => x.id !== id))}
                                        />
                                    ))}
                                </table>
                            )}
                        </div>
                    </>
                )}
            </DialogContent>
        </Dialog>
    );
}
