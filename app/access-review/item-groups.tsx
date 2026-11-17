'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { ChevronDown, ChevronRight, Loader2, Plus, Warehouse, X } from 'lucide-react';
import { labelKey, loadItemCatalog } from './request-card';
import type { RoleItem, SystemCode } from './types';

/**
 * One role's items grouped by หมวด / เมนู — the same collapsible list as the admin "รายละเอียดสิทธิ์" dialog.
 * Each group header carries a tri-state tick for the whole menu and (ATMS) a + that asks for the menu's missing
 * permissions; rows inside are the per-permission checkboxes. Requested items show inside their own group.
 */

/** ATMS imports put warehouses under this category (item = warehouse name). */
const ATMS_WAREHOUSE_CATEGORY = 'คลังสินค้า';
/** Warehouses get their own pinned group; the คลังสินค้า MENU's actions (no item) stay a normal menu group. */
const WAREHOUSE_KEY = '\u0000warehouse';
const WAREHOUSE_LABEL = 'คลังสินค้า';

export const isWarehouse = (it: RoleItem) => it.category === ATMS_WAREHOUSE_CATEGORY && !!it.item;
const groupKeyOf = (it: RoleItem) => isWarehouse(it) ? WAREHOUSE_KEY : it.category;

/** ATMS action order, so every menu reads แสดง → ค้นหา → บันทึก → แก้ไข → ลบ (same as the admin dialog). */
const PERMISSION_ORDER = ['แสดง', 'ค้นหา', 'บันทึก', 'แก้ไข', 'ลบ', 'พิมพ์', 'อนุมัติ'];
const permRank = (p: string | null) => { const i = PERMISSION_ORDER.indexOf(p ?? ''); return i < 0 ? PERMISSION_ORDER.length : i; };
const byLabel = (a: RoleItem, b: RoleItem) => (a.item ?? '').localeCompare(b.item ?? '', 'th') || permRank(a.permission) - permRank(b.permission);

const norm = (s: string) => s.toLowerCase();

/** Inside a group the category is the header, so a row is its sub-item (or, for ATMS menus, the action). */
const rowLabel = (it: RoleItem) => it.item ?? it.permission ?? 'ทั้งเมนู';
const rowTag = (it: RoleItem) => it.item ? it.permission : null;

interface Group {
    key: string;
    label: string;
    own: RoleItem[];
    requested: RoleItem[];
}

function buildGroups(items: RoleItem[], requested: RoleItem[]): Group[] {
    const map = new Map<string, Group>();
    const at = (it: RoleItem) => {
        const key = groupKeyOf(it);
        let g = map.get(key);
        if (!g) map.set(key, g = { key, label: key === WAREHOUSE_KEY ? WAREHOUSE_LABEL : it.category, own: [], requested: [] });
        return g;
    };
    for (const it of items) at(it).own.push(it);
    for (const it of requested) at(it).requested.push(it);
    return [...map.values()]
        .map(g => ({
            ...g,
            own: g.own.sort(byLabel),
            requested: g.requested.sort(byLabel),
        }))
        .sort((a, b) => a.key === WAREHOUSE_KEY ? -1 : b.key === WAREHOUSE_KEY ? 1 : a.label.localeCompare(b.label, 'th', { sensitivity: 'base' }));
}

function TriCheckbox({ checked, indeterminate, disabled, onChange, label }: {
    checked: boolean; indeterminate: boolean; disabled: boolean; onChange: () => void; label: string;
}) {
    const ref = useRef<HTMLInputElement>(null);
    useEffect(() => { if (ref.current) ref.current.indeterminate = indeterminate; }, [indeterminate]);
    return (
        <input
            ref={ref}
            type="checkbox"
            checked={checked}
            disabled={disabled}
            onChange={onChange}
            aria-label={label}
            className="size-4 shrink-0 accent-brand-600 cursor-pointer disabled:cursor-default disabled:opacity-60"
        />
    );
}

/** The menu's missing permissions as toggle chips — catalog items of this group the role doesn't hold yet. */
function GroupAddChips({ system, group, ownKeys, picked, onToggle, onClose }: {
    system: SystemCode;
    group: Group;
    ownKeys: Set<string>;
    picked: Set<number>;
    onToggle: (it: RoleItem) => void;
    onClose: () => void;
}) {
    const [catalog, setCatalog] = useState<RoleItem[] | null>(null);
    const [error, setError] = useState<string | null>(null);
    useEffect(() => {
        let alive = true;
        loadItemCatalog(system)
            .then(list => { if (alive) setCatalog(list); })
            .catch(err => { if (alive) setError(err instanceof Error ? err.message : 'โหลดรายการไม่สำเร็จ'); });
        return () => { alive = false; };
    }, [system]);

    const options = useMemo(
        () => (catalog ?? []).filter(c => groupKeyOf(c) === group.key && !ownKeys.has(labelKey(c))).sort(byLabel),
        [catalog, group.key, ownKeys],
    );

    return (
        <div className="mx-3 mb-2 rounded-lg border border-dashed border-brand-300 bg-brand-50/40 px-3 py-2">
            <div className="mb-1.5 flex items-center gap-2">
                <span className="flex-1 text-[11px] font-semibold text-brand-700">
                    {group.key === WAREHOUSE_KEY ? 'เลือกคลังสินค้าที่ต้องการเพิ่ม' : `เลือกสิทธิ์ที่ต้องการเพิ่มในเมนู ${group.label}`}
                </span>
                <button type="button" onClick={onClose} className="shrink-0 rounded-full bg-brand-600 px-2.5 py-0.5 text-[11px] font-semibold text-white hover:bg-brand-700 cursor-pointer">เสร็จ</button>
            </div>
            {error ? (
                <p className="text-[11px] text-rose-600">{error}</p>
            ) : !catalog ? (
                <p className="flex items-center gap-1.5 text-[11px] text-gray-400"><Loader2 className="size-3.5 animate-spin" /> กำลังโหลดรายการ...</p>
            ) : options.length === 0 ? (
                <p className="text-[11px] text-gray-400">มีสิทธิ์ในเมนูนี้ครบทุกรายการแล้ว</p>
            ) : (
                <div className="flex flex-wrap gap-1.5">
                    {options.map(opt => {
                        const on = picked.has(opt.id);
                        const tag = rowTag(opt);
                        return (
                            <button
                                key={opt.id}
                                type="button"
                                aria-pressed={on}
                                onClick={() => onToggle(opt)}
                                className={`inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-xs transition-colors cursor-pointer ${on
                                    ? 'border-mint-500 bg-emerald-50 text-mint-700 font-medium'
                                    : 'border-gray-200 bg-white text-gray-600 hover:border-brand-400 hover:text-brand-700'}`}
                            >
                                <Plus className={`size-3 ${on ? 'rotate-45' : ''} transition-transform`} strokeWidth={2.5} />
                                {rowLabel(opt)}{tag && <span className="text-[10px] text-gray-400">· {tag}</span>}
                            </button>
                        );
                    })}
                </div>
            )}
        </div>
    );
}

function GroupSection({
    group, system, open, onToggleOpen, addOpen, onAddOpen, onAddClose, visibleOwn, visibleRequested, uncheckedSet, readOnly,
    canRequest, ownKeys, pickedIds, onToggleItem, onToggleMany, onToggleRequest, headless = false,
}: {
    /** Rows only — the panel header already carries the tick-all / + (flat warehouse panel) */
    headless?: boolean;
    group: Group;
    system: SystemCode;
    open: boolean;
    onToggleOpen: () => void;
    addOpen: boolean;
    onAddOpen: () => void;
    onAddClose: () => void;
    visibleOwn: RoleItem[];
    visibleRequested: RoleItem[];
    uncheckedSet: Set<number>;
    readOnly: boolean;
    canRequest: boolean;
    ownKeys: Set<string>;
    pickedIds: Set<number>;
    onToggleItem?: (itemId: number) => void;
    onToggleMany?: (itemIds: number[], checked: boolean) => void;
    onToggleRequest: (it: RoleItem) => void;
}) {
    // Inactive items (removed from the source system) never count toward "all ticked" and the group tick never touches them.
    const active = group.own.filter(it => it.is_active);
    const ticked = active.filter(it => !uncheckedSet.has(it.id)).length;
    const removed = group.own.length - ticked;
    const allTicked = active.length > 0 && ticked === active.length;
    const isNew = group.own.length === 0;
    const Icon = group.key === WAREHOUSE_KEY ? Warehouse : null;

    return (
        <div className="border-b border-gray-100 last:border-b-0">
            {!headless && <div className={`flex items-center gap-2 px-3 py-2 ${open ? 'bg-brand-50' : 'bg-brand-50/40 hover:bg-brand-50'}`}>
                {active.length > 0 ? (
                    <TriCheckbox
                        checked={allTicked}
                        indeterminate={ticked > 0 && !allTicked}
                        disabled={readOnly}
                        onChange={() => onToggleMany?.(active.map(i => i.id), !allTicked)}
                        label={`เลือกทั้งเมนู ${group.label}`}
                    />
                ) : <span className="size-4 shrink-0" />}
                <button type="button" onClick={onToggleOpen} aria-expanded={open} className="flex min-w-0 flex-1 items-center gap-2 text-left cursor-pointer">
                    {open ? <ChevronDown className="size-4 shrink-0 text-gray-400" /> : <ChevronRight className="size-4 shrink-0 text-gray-400" />}
                    {Icon && <Icon className="size-4 shrink-0 text-brand-600" />}
                    <span className={`min-w-0 truncate text-sm font-semibold ${removed > 0 && ticked === 0 && !isNew ? 'text-rose-700' : 'text-ink-900'}`} title={group.label}>{group.label}</span>
                    {!isNew && <span className="shrink-0 text-[11px] tabular-nums text-gray-400">{ticked}/{group.own.length}</span>}
                    {isNew && <span className="shrink-0 rounded-full bg-emerald-50 px-1.5 text-[10px] font-semibold text-mint-700">เมนูใหม่</span>}
                </button>
                {removed > 0 && <span className="shrink-0 rounded-full bg-rose-50 px-1.5 text-[10px] font-semibold tabular-nums text-rose-700">ไม่ใช้ {removed}</span>}
                {group.requested.length > 0 && (
                    <span className="shrink-0 rounded-full bg-emerald-50 px-1.5 text-[10px] font-semibold tabular-nums text-mint-700">ขอเพิ่ม {group.requested.length}</span>
                )}
                {canRequest && (
                    <button
                        type="button"
                        onClick={addOpen ? onAddClose : onAddOpen}
                        title={group.key === WAREHOUSE_KEY ? 'ขอเพิ่มคลังสินค้า' : 'ขอเพิ่มสิทธิ์ในเมนูนี้'}
                        className={`shrink-0 rounded-md p-1 transition-colors cursor-pointer ${addOpen ? 'bg-brand-600 text-white' : 'text-gray-400 hover:bg-brand-50 hover:text-brand-600'}`}
                    >
                        <Plus className="size-4" />
                    </button>
                )}
            </div>}

            {(open || headless) && (
                <div className="pb-1">
                    {addOpen && canRequest && !headless && (
                        <GroupAddChips system={system} group={group} ownKeys={ownKeys} picked={pickedIds} onToggle={onToggleRequest} onClose={onAddClose} />
                    )}
                    <ul className="divide-y divide-gray-50">
                        {visibleOwn.map(it => {
                            const checked = it.is_active && !uncheckedSet.has(it.id);
                            const locked = readOnly || !it.is_active;
                            const label = rowLabel(it);
                            const tag = rowTag(it);
                            return (
                                <li key={it.id}>
                                    <label className={`flex items-center gap-2 py-1.5 pl-9 pr-3 text-[13px] transition-colors ${checked ? 'hover:bg-gray-50' : 'bg-rose-50/70 hover:bg-rose-50'} ${locked ? 'cursor-default' : 'cursor-pointer'}`}>
                                        <input
                                            type="checkbox"
                                            checked={checked}
                                            disabled={locked}
                                            onChange={() => onToggleItem?.(it.id)}
                                            className="size-3.5 shrink-0 accent-brand-400 disabled:opacity-60"
                                        />
                                        <span className={`min-w-0 flex-1 truncate ${checked ? 'text-gray-700' : 'text-rose-700 line-through decoration-rose-300'}`} title={label}>{label}</span>
                                        {tag && <span className="shrink-0 rounded bg-gray-100 px-1.5 py-px text-[10px] font-medium text-gray-500">{tag}</span>}
                                        {!it.is_active
                                            ? <span className="shrink-0 text-[10px] font-semibold text-gray-400">(ยกเลิกในระบบแล้ว)</span>
                                            : !checked && <span className="shrink-0 text-[10px] font-semibold text-rose-600">ไม่ใช้</span>}
                                    </label>
                                </li>
                            );
                        })}
                        {visibleRequested.map(it => {
                            const label = rowLabel(it);
                            const tag = rowTag(it);
                            return (
                                <li key={`r${it.id}`} className="flex items-center gap-2 bg-emerald-50/60 py-1.5 pl-9 pr-3 text-[13px]">
                                    <Plus className="size-3.5 shrink-0 text-mint-600" strokeWidth={2.5} />
                                    <span className="min-w-0 flex-1 truncate text-gray-800" title={label}>{label}</span>
                                    {tag && <span className="shrink-0 rounded bg-white px-1.5 py-px text-[10px] font-medium text-gray-500">{tag}</span>}
                                    <span className="shrink-0 text-[10px] font-semibold text-mint-700">ขอเพิ่ม</span>
                                    {!readOnly && (
                                        <button type="button" onClick={() => onToggleRequest(it)} aria-label={`ยกเลิกขอเพิ่ม ${label}`} className="shrink-0 rounded-full p-0.5 text-gray-400 hover:bg-white hover:text-rose-600 cursor-pointer">
                                            <X className="size-3.5" />
                                        </button>
                                    )}
                                </li>
                            );
                        })}
                    </ul>
                </div>
            )}
        </div>
    );
}

export function ItemGroups({
    system, title, icon: TitleIcon, flat = false, items, requested, uncheckedSet, readOnly, onlyUnchecked, search,
    onToggleItem, onToggleMany, onRequestChange,
}: {
    system: SystemCode;
    /** Panel title (ATMS: คลังสินค้าปัจจุบัน / เมนูสิทธิ์ปัจจุบัน); without it the header shows the usage hint */
    title?: string;
    icon?: React.ComponentType<{ className?: string }>;
    /** One-group panel (warehouses): no group header — tick-all and + live in the panel header */
    flat?: boolean;
    items: RoleItem[];
    requested: RoleItem[];
    uncheckedSet: Set<number>;
    readOnly: boolean;
    onlyUnchecked: boolean;
    search: string;
    onToggleItem?: (itemId: number) => void;
    onToggleMany?: (itemIds: number[], checked: boolean) => void;
    /** Present = per-menu "ขอเพิ่ม" is on (ATMS) */
    onRequestChange?: (items: RoleItem[]) => void;
}) {
    const groups = useMemo(() => buildGroups(items, requested), [items, requested]);
    const [expanded, setExpanded] = useState<Set<string>>(new Set());
    const [adding, setAdding] = useState<string | null>(null);
    const ownKeys = useMemo(() => new Set(items.map(labelKey)), [items]);
    const pickedIds = useMemo(() => new Set(requested.map(r => r.id)), [requested]);
    const canRequest = !readOnly && Boolean(onRequestChange);

    // Search: a matching menu keeps all its rows; otherwise only the matching rows stay. Either way the group opens.
    const term = norm(search.trim());
    const filtering = Boolean(term) || onlyUnchecked;
    const shown = useMemo(() => groups
        .map(g => {
            const groupHit = !term || norm(g.label).includes(term);
            const rowHit = (it: RoleItem) => groupHit || norm(rowLabel(it)).includes(term) || norm(it.permission ?? '').includes(term);
            return {
                group: g,
                own: g.own.filter(it => rowHit(it) && (!onlyUnchecked || uncheckedSet.has(it.id))),
                requested: onlyUnchecked ? [] : g.requested.filter(rowHit),
            };
        })
        .filter(s => s.own.length + s.requested.length > 0 || (!filtering && s.group.key === adding)),
    [groups, term, onlyUnchecked, uncheckedSet, filtering, adding]);

    const toggleOpen = (key: string) => setExpanded(prev => {
        const next = new Set(prev);
        if (next.has(key)) next.delete(key); else next.add(key);
        return next;
    });
    const allOpen = shown.length > 0 && shown.every(s => expanded.has(s.group.key));
    const toggleRequest = (it: RoleItem) =>
        onRequestChange?.(pickedIds.has(it.id) ? requested.filter(r => r.id !== it.id) : [...requested, it]);

    const active = items.filter(it => it.is_active);
    const ticked = active.filter(it => !uncheckedSet.has(it.id)).length;
    const allTicked = active.length > 0 && ticked === active.length;
    const removed = items.length - ticked;
    // flat panel: its single group (or an empty warehouse group, so + still works when nothing is held)
    const flatGroup: Group = groups[0] ?? { key: WAREHOUSE_KEY, label: WAREHOUSE_LABEL, own: [], requested: [] };
    const flatAdding = flat && adding === flatGroup.key;

    return (
        <div className="rounded-xl border border-gray-100 bg-white overflow-hidden">
            <div className="flex items-center gap-2 border-b border-gray-100 bg-gray-50/60 px-3 py-2">
                {flat && active.length > 0 && (
                    <TriCheckbox
                        checked={allTicked}
                        indeterminate={ticked > 0 && !allTicked}
                        disabled={readOnly}
                        onChange={() => onToggleMany?.(active.map(i => i.id), !allTicked)}
                        label={`เลือกทั้งหมด ${title ?? ''}`}
                    />
                )}
                {TitleIcon && <TitleIcon className="size-4 shrink-0 text-brand-600" />}
                {title
                    ? <span className="min-w-0 flex-1 text-sm font-semibold leading-tight text-ink-900">{title}</span>
                    : <span className="flex-1 text-[11px] text-gray-500">{groups.length.toLocaleString()} หมวด · ติ๊กที่หัวหมวดเพื่อเลือกทั้งหมวด</span>}
                {title && <span className="shrink-0 text-[11px] tabular-nums text-gray-400">{ticked}/{active.length}</span>}
                {flat && removed > 0 && <span className="shrink-0 rounded-full bg-rose-50 px-1.5 text-[10px] font-semibold tabular-nums text-rose-700">ไม่ใช้ {removed}</span>}
                {flat && requested.length > 0 && <span className="shrink-0 rounded-full bg-emerald-50 px-1.5 text-[10px] font-semibold tabular-nums text-mint-700">ขอเพิ่ม {requested.length}</span>}
                {flat && canRequest && (
                    <button
                        type="button"
                        onClick={() => setAdding(flatAdding ? null : flatGroup.key)}
                        title="ขอเพิ่มคลังสินค้า"
                        className={`shrink-0 rounded-md p-1 transition-colors cursor-pointer ${flatAdding ? 'bg-brand-600 text-white' : 'text-gray-400 hover:bg-brand-50 hover:text-brand-600'}`}
                    >
                        <Plus className="size-4" />
                    </button>
                )}
                {!flat && !filtering && groups.length > 1 && (
                    <button type="button" onClick={() => setExpanded(allOpen ? new Set() : new Set(shown.map(s => s.group.key)))} className="shrink-0 text-xs font-medium text-brand-600 hover:underline cursor-pointer">
                        {allOpen ? 'ย่อทั้งหมด' : 'ขยายทั้งหมด'}
                    </button>
                )}
            </div>
            {flatAdding && (
                <div className="pt-2">
                    <GroupAddChips system={system} group={flatGroup} ownKeys={ownKeys} picked={pickedIds} onToggle={toggleRequest} onClose={() => setAdding(null)} />
                </div>
            )}
            {shown.length === 0 ? (
                <p className="px-3 py-3 text-xs text-gray-400">{groups.length === 0 ? '-' : onlyUnchecked ? 'ไม่มีรายการที่ไม่ติ๊ก' : 'ไม่พบรายการที่ค้นหา'}</p>
            ) : shown.map(({ group, own, requested: req }) => (
                <GroupSection
                    key={group.key}
                    headless={flat}
                    group={group}
                    system={system}
                    open={filtering || expanded.has(group.key) || adding === group.key}
                    onToggleOpen={() => { toggleOpen(group.key); if (adding === group.key) setAdding(null); }}
                    addOpen={adding === group.key}
                    onAddOpen={() => { setAdding(group.key); setExpanded(prev => new Set(prev).add(group.key)); }}
                    onAddClose={() => setAdding(null)}
                    visibleOwn={own}
                    visibleRequested={req}
                    uncheckedSet={uncheckedSet}
                    readOnly={readOnly}
                    canRequest={canRequest}
                    ownKeys={ownKeys}
                    pickedIds={pickedIds}
                    onToggleItem={onToggleItem}
                    onToggleMany={onToggleMany}
                    onToggleRequest={toggleRequest}
                />
            ))}
        </div>
    );
}
