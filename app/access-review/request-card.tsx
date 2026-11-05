'use client';

import { useEffect, useId, useMemo, useRef, useState } from 'react';
import { Check, Loader2, Mail, Plus, Search, X } from 'lucide-react';
import { getCatalog, getCatalogRoles } from './api';
import type { CatalogRole, RoleItem, SystemCode } from './types';

/**
 * "ต้องการเพิ่มสิทธิ์?" / "ต้องการเพิ่มอีเมลกลุ่ม?" — the requester asks for what they don't have yet. The picker is
 * an inline multi-select combobox (search + checkboxes, nothing ticked by default) — inline rather than a floating
 * popover so it scrolls inside the review dialog. Picks show in a green "ต้องการเพิ่ม" card above the list.
 */

const norm = (s: string) => s.toLowerCase();

function cached<T>(cache: Map<SystemCode, Promise<T[]>>, system: SystemCode, load: () => Promise<T[]>) {
    let p = cache.get(system);
    if (!p) {
        p = load();
        p.catch(() => cache.delete(system));
        cache.set(system, p);
    }
    return p;
}

const itemCatalog = new Map<SystemCode, Promise<RoleItem[]>>();
const roleCatalog = new Map<SystemCode, Promise<CatalogRole[]>>();

interface PickerCopy {
    title: string;
    trigger: string;
    triggerMore: string;
    hint: string;
    placeholder: string;
    allTaken: string;
    unit: string;
    readOnlyNote: string;
}

function RequestPicker<T extends { id: number }>({
    copy, icon: Icon, load, exclude, picked, readOnly, labelOf, tagOf, onChange,
}: {
    copy: PickerCopy;
    icon: React.ComponentType<{ className?: string; strokeWidth?: number }>;
    load: () => Promise<T[]>;
    /** Options the requester already has — not offered */
    exclude: (opt: T) => boolean;
    picked: T[];
    readOnly: boolean;
    labelOf: (opt: T) => string;
    tagOf?: (opt: T) => string | null;
    onChange?: (next: T[]) => void;
}) {
    const [open, setOpen] = useState(false);
    const [catalog, setCatalog] = useState<T[] | null>(null);
    const [error, setError] = useState<string | null>(null);
    const [search, setSearch] = useState('');
    const searchRef = useRef<HTMLInputElement>(null);
    const listId = useId();

    useEffect(() => {
        if (!open || catalog) return;
        load().then(setCatalog).catch(err => setError(err instanceof Error ? err.message : 'โหลดรายการไม่สำเร็จ'));
    }, [open, catalog, load]);

    useEffect(() => { if (open) searchRef.current?.focus(); }, [open]);

    const options = useMemo(() => (catalog ?? []).filter(o => !exclude(o)), [catalog, exclude]);
    const visible = useMemo(() => {
        const term = norm(search.trim());
        if (!term) return options;
        return options.filter(o => norm(labelOf(o)).includes(term) || norm(tagOf?.(o) ?? '').includes(term));
    }, [options, search, labelOf, tagOf]);

    const pickedIds = useMemo(() => new Set(picked.map(p => p.id)), [picked]);
    const toggle = (opt: T) => onChange?.(pickedIds.has(opt.id) ? picked.filter(p => p.id !== opt.id) : [...picked, opt]);
    const close = () => { setOpen(false); setSearch(''); };

    if (readOnly && picked.length === 0) return null;

    return (
        <div className="space-y-2">
            {picked.length > 0 && (
                <div className="rounded-xl border border-mint-300/70 bg-emerald-50/60 overflow-hidden">
                    <div className="flex items-center gap-2 px-3 py-2 border-b border-mint-300/50">
                        <span className="v2-tile-mint size-6 rounded-lg flex items-center justify-center shrink-0">
                            <Icon className="size-3.5" strokeWidth={2.5} />
                        </span>
                        <span className="text-sm font-semibold text-ink-900 flex-1 truncate">{copy.title}</span>
                        <span className="shrink-0 rounded-full bg-white px-2 py-0.5 text-[11px] font-semibold tabular-nums text-mint-700">
                            {picked.length} {copy.unit}
                        </span>
                    </div>
                    <ul className="divide-y divide-mint-300/30">
                        {picked.map(opt => {
                            const label = labelOf(opt);
                            const tag = tagOf?.(opt);
                            return (
                                <li key={opt.id} className="flex items-center gap-2 px-3 py-1.5 text-[13px]">
                                    <Plus className="size-3.5 shrink-0 text-mint-600" strokeWidth={2.5} />
                                    <span className="flex-1 min-w-0 truncate text-gray-800" title={label}>{label}</span>
                                    {tag && <span className="shrink-0 rounded bg-white px-1.5 py-px text-[10px] font-medium text-gray-500">{tag}</span>}
                                    {!readOnly && (
                                        <button
                                            type="button"
                                            onClick={() => toggle(opt)}
                                            aria-label={`เอา ${label} ออก`}
                                            className="shrink-0 rounded-full p-0.5 text-gray-400 hover:bg-white hover:text-rose-600 cursor-pointer"
                                        >
                                            <X className="size-3.5" />
                                        </button>
                                    )}
                                </li>
                            );
                        })}
                    </ul>
                    {readOnly && <p className="px-3 py-1.5 text-[11px] text-mint-700 border-t border-mint-300/30">{copy.readOnlyNote}</p>}
                </div>
            )}

            {!readOnly && !open && (
                <button
                    type="button"
                    onClick={() => setOpen(true)}
                    className="flex w-full items-center gap-2 rounded-xl border border-dashed border-brand-300 bg-white px-3 py-2 text-left text-sm font-medium text-brand-700 hover:border-brand-500 hover:bg-brand-50/50 transition-colors cursor-pointer"
                >
                    <Plus className="size-4 shrink-0" />
                    <span className="flex-1">{picked.length > 0 ? copy.triggerMore : copy.trigger}</span>
                    <span className="text-[11px] font-normal text-gray-400">{copy.hint}</span>
                </button>
            )}

            {!readOnly && open && (
                <div
                    className="rounded-xl border border-brand-200 bg-white shadow-card overflow-hidden"
                    onKeyDown={e => { if (e.key === 'Escape') { e.stopPropagation(); close(); } }}
                >
                    <div className="flex items-center gap-2 border-b border-gray-100 px-2.5 py-2">
                        <div className="relative flex-1">
                            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 size-3.5 text-gray-400" />
                            <input
                                ref={searchRef}
                                value={search}
                                onChange={e => setSearch(e.target.value)}
                                placeholder={copy.placeholder}
                                role="combobox"
                                aria-expanded
                                aria-controls={listId}
                                className="h-8 w-full rounded-full border border-gray-200 bg-gray-50 pl-8 pr-3 text-xs text-gray-700 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-brand-600/30"
                            />
                        </div>
                        <button
                            type="button"
                            onClick={close}
                            className="shrink-0 rounded-full bg-brand-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-brand-700 cursor-pointer"
                        >
                            เสร็จ
                        </button>
                    </div>
                    {error ? (
                        <p className="px-3 py-4 text-center text-xs text-rose-600">{error}</p>
                    ) : !catalog ? (
                        <p className="flex items-center justify-center gap-2 px-3 py-6 text-xs text-gray-400"><Loader2 className="size-4 animate-spin" /> กำลังโหลดรายการ...</p>
                    ) : visible.length === 0 ? (
                        <p className="px-3 py-4 text-center text-xs text-gray-400">{options.length === 0 ? copy.allTaken : 'ไม่พบรายการที่ค้นหา'}</p>
                    ) : (
                        <ul id={listId} role="listbox" aria-multiselectable className="max-h-64 overflow-y-auto overscroll-contain py-1">
                            {visible.map(opt => {
                                const on = pickedIds.has(opt.id);
                                const label = labelOf(opt);
                                const tag = tagOf?.(opt);
                                return (
                                    <li key={opt.id} role="option" aria-selected={on}>
                                        {/* relative: keeps the sr-only checkbox inside the row, so focusing it doesn't scroll the dialog */}
                                        <label className={`relative flex items-center gap-2 px-3 py-1.5 text-[13px] cursor-pointer transition-colors ${on ? 'bg-brand-50' : 'hover:bg-gray-50'}`}>
                                            <input type="checkbox" checked={on} onChange={() => toggle(opt)} className="sr-only" />
                                            <span className={`size-4 shrink-0 rounded-[5px] border grid place-items-center transition-colors ${on ? 'bg-brand-600 border-brand-600 text-white' : 'border-gray-300 text-transparent'}`}>
                                                <Check className="size-3" strokeWidth={3} />
                                            </span>
                                            <span className="flex-1 min-w-0 truncate text-gray-700" title={label}>{label}</span>
                                            {tag && <span className="shrink-0 rounded bg-gray-100 px-1.5 py-px text-[10px] font-medium text-gray-500">{tag}</span>}
                                        </label>
                                    </li>
                                );
                            })}
                        </ul>
                    )}
                    {catalog && (
                        <div className="flex items-center justify-between border-t border-gray-100 px-3 py-1.5 text-[11px] text-gray-400">
                            <span>เลือกแล้ว {picked.length} {copy.unit}</span>
                            <span className="tabular-nums">{visible.length} / {options.length}</span>
                        </div>
                    )}
                </div>
            )}
        </div>
    );
}

const labelKey = (it: RoleItem) => `${it.category}\u0000${it.item ?? ''}\u0000${it.permission ?? ''}`;
const itemTag = (it: RoleItem) => it.permission;

const ITEM_COPY: PickerCopy = {
    title: 'สิทธิ์ที่ต้องการเพิ่ม',
    trigger: 'ต้องการเพิ่มสิทธิ์?',
    triggerMore: 'เลือกสิทธิ์เพิ่มอีก',
    hint: 'เลือกเมนูที่ยังไม่มี',
    placeholder: 'ค้นหาเมนูหรือสิทธิ์...',
    allTaken: 'มีสิทธิ์ครบทุกเมนูแล้ว',
    unit: 'รายการ',
    readOnlyNote: 'ผู้แจ้งขอเพิ่มสิทธิ์เหล่านี้ในกลุ่มนี้',
};

/** Menus to add to one role (ATMS: shown above เมนูสิทธิ์). */
export function RequestCard({
    system, ownItems, requested, readOnly, excludeCategory, labelOf, onChange,
}: {
    system: SystemCode;
    /** The role's own items — anything with the same label is not offered */
    ownItems: RoleItem[];
    requested: RoleItem[];
    readOnly: boolean;
    /** e.g. ATMS warehouses — only menus are requested here */
    excludeCategory?: string;
    labelOf: (it: RoleItem) => string;
    onChange?: (items: RoleItem[]) => void;
}) {
    const load = useMemo(() => () => cached(itemCatalog, system, () => getCatalog(system).then(r => r.items)), [system]);
    const exclude = useMemo(() => {
        const own = new Set(ownItems.map(labelKey));
        return (it: RoleItem) => it.category === excludeCategory || own.has(labelKey(it));
    }, [ownItems, excludeCategory]);
    return (
        <RequestPicker
            copy={ITEM_COPY} icon={Plus} load={load} exclude={exclude} picked={requested} readOnly={readOnly}
            labelOf={labelOf} tagOf={itemTag} onChange={onChange}
        />
    );
}

const GROUP_COPY: PickerCopy = {
    title: 'อีเมลกลุ่มที่ต้องการเพิ่ม',
    trigger: 'ต้องการเพิ่มอีเมลกลุ่ม?',
    triggerMore: 'เลือกอีเมลกลุ่มเพิ่มอีก',
    hint: 'เลือกกลุ่มที่ยังไม่ได้อยู่',
    placeholder: 'ค้นหาอีเมลกลุ่ม...',
    allTaken: 'อยู่ในอีเมลกลุ่มครบทุกกลุ่มแล้ว',
    unit: 'กลุ่ม',
    readOnlyNote: 'ผู้แจ้งขอเข้าร่วมอีเมลกลุ่มเหล่านี้',
};

const roleName = (r: CatalogRole) => r.name;

/** Whole roles to join (Email groups) — the requester holds no assignment for these yet. */
export function GroupRequestCard({ system, heldRoleIds, requested, readOnly, onChange }: {
    system: SystemCode;
    heldRoleIds: number[];
    requested: CatalogRole[];
    readOnly: boolean;
    onChange?: (roles: CatalogRole[]) => void;
}) {
    const load = useMemo(() => () => cached(roleCatalog, system, () => getCatalogRoles(system).then(r => r.roles)), [system]);
    const exclude = useMemo(() => {
        const held = new Set(heldRoleIds);
        return (r: CatalogRole) => held.has(r.id);
    }, [heldRoleIds]);
    return (
        <RequestPicker
            copy={GROUP_COPY} icon={Mail} load={load} exclude={exclude} picked={requested} readOnly={readOnly}
            labelOf={roleName} onChange={onChange}
        />
    );
}
