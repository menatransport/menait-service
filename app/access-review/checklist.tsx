'use client';

import { memo, useMemo, useState } from 'react';
import { ChevronDown, ChevronRight, ListChecks, Search, Warehouse } from 'lucide-react';
import { SYSTEM_META, SystemIcon } from './components';
import type { Decision, RoleItem, SystemCode } from './types';

/**
 * The "ยืนยันสิทธิ์การเข้าถึง" checklist — every system on one scrollable page (no tabs), grouped
 * system → role → category, matching the Apps Script prototype (gas-modal.png). Everything starts
 * ticked; an unticked row is what gets removed.
 */

export interface ChecklistRoleData {
    user_role_id: number;
    role_id: number;
    role_name: string;
    account_name: string;
    item_count: number;
    items: RoleItem[];
}

export interface ChecklistSystemData {
    code: SystemCode;
    name: string;
    roles: ChecklistRoleData[];
}

interface ChecklistProps {
    systems: ChecklistSystemData[];
    readOnly: boolean;
    /** user_role_id → set of unticked item ids (items NOT in the set stay granted) */
    unchecked: Map<number, Set<number>>;
    onToggleItem?: (userRoleId: number, itemId: number) => void;
    onToggleMany?: (userRoleId: number, itemIds: number[], checked: boolean) => void;
    /** For item-less roles (item_count === 0) — a single whole-role tick */
    decisions: Map<number, Decision>;
    onDecision?: (userRoleId: number, decision: Decision) => void;
}

// A handful of V2 gradient tiles cycled per category box — keeps the prototype's colourful feel
// without hardcoding hex (CLAUDE: tokens only).
const CATEGORY_TILES = ['v2-tile-mint', 'v2-tile-blue', 'v2-tile-sun'] as const;

const norm = (s: string) => s.toLowerCase();

/** ATMS imports put warehouses under this category; every other ATMS category is a menu/module. */
const ATMS_WAREHOUSE_CATEGORY = 'คลังสินค้า';

const warehouseLabel = (it: RoleItem) => it.item ?? it.category;
const menuLabel = (it: RoleItem) => it.item ? `${it.category} · ${it.item}` : it.category;

/**
 * ATMS role body: warehouses on the left, every menu permission in one compact list on the right
 * (ATMS menus are one item per category, so a box per category was mostly headers).
 */
function AtmsRoleBody({
    items, userRoleId, uncheckedSet, readOnly, onlyUnchecked, search, onToggleItem, onToggleMany,
}: {
    items: RoleItem[];
    userRoleId: number;
    uncheckedSet: Set<number>;
    readOnly: boolean;
    onlyUnchecked: boolean;
    search: string;
    onToggleItem?: (userRoleId: number, itemId: number) => void;
    onToggleMany?: (userRoleId: number, itemIds: number[], checked: boolean) => void;
}) {
    const warehouses = useMemo(() => items.filter(it => it.category === ATMS_WAREHOUSE_CATEGORY), [items]);
    const menus = useMemo(() => items.filter(it => it.category !== ATMS_WAREHOUSE_CATEGORY), [items]);
    const shared = { userRoleId, uncheckedSet, readOnly, onlyUnchecked, search, onToggleItem, onToggleMany };
    return (
        <div className="px-3 pb-3 grid gap-3 sm:grid-cols-[minmax(0,2fr)_minmax(0,3fr)] items-start">
            <ItemPanel {...shared} title="คลังสินค้า" icon={Warehouse} items={warehouses} labelOf={warehouseLabel} />
            <ItemPanel {...shared} title="เมนูสิทธิ์" icon={ListChecks} items={menus} labelOf={menuLabel} />
        </div>
    );
}

/** One titled, dense checklist column used by the ATMS layout. Stays visible (with a dash) when empty. */
function ItemPanel({
    title, icon: Icon, items, labelOf, userRoleId, uncheckedSet, readOnly, onlyUnchecked, search, onToggleItem, onToggleMany,
}: {
    title: string;
    icon: React.ComponentType<{ className?: string }>;
    items: RoleItem[];
    labelOf: (it: RoleItem) => string;
    userRoleId: number;
    uncheckedSet: Set<number>;
    readOnly: boolean;
    onlyUnchecked: boolean;
    search: string;
    onToggleItem?: (userRoleId: number, itemId: number) => void;
    onToggleMany?: (userRoleId: number, itemIds: number[], checked: boolean) => void;
}) {
    const visible = useMemo(() => {
        const term = norm(search.trim());
        return items.filter(it => {
            if (onlyUnchecked && !uncheckedSet.has(it.id)) return false;
            if (!term) return true;
            return norm(labelOf(it)).includes(term) || norm(it.permission ?? '').includes(term);
        });
    }, [items, uncheckedSet, onlyUnchecked, search, labelOf]);

    const activeItems = items.filter(it => it.is_active);
    const tickedCount = activeItems.filter(it => !uncheckedSet.has(it.id)).length;
    const allChecked = activeItems.length > 0 && tickedCount === activeItems.length;

    return (
        <div className="rounded-xl border border-gray-100 bg-white overflow-hidden">
            <div className="flex items-center gap-2 px-3 py-2 border-b border-gray-100 bg-gray-50/60">
                <Icon className="size-4 text-brand-600 shrink-0" />
                <span className="text-sm font-semibold text-ink-900 flex-1 truncate">{title}</span>
                <span className="text-[11px] text-gray-400 tabular-nums shrink-0">{tickedCount}/{activeItems.length}</span>
                {!readOnly && activeItems.length > 0 && (
                    <button
                        type="button"
                        onClick={() => onToggleMany?.(userRoleId, activeItems.map(i => i.id), !allChecked)}
                        className="text-xs font-medium text-brand-600 hover:underline cursor-pointer shrink-0"
                    >
                        {allChecked ? 'ไม่เลือกทั้งหมด' : 'เลือกทั้งหมด'}
                    </button>
                )}
            </div>
            {visible.length === 0 ? (
                <p className="px-3 py-3 text-xs text-gray-400">-</p>
            ) : (
                <ul className="divide-y divide-gray-50">
                    {visible.map(it => {
                        const checked = it.is_active && !uncheckedSet.has(it.id);
                        const locked = readOnly || !it.is_active;
                        const label = labelOf(it);
                        return (
                            <li key={it.id}>
                                <label className={`flex items-center gap-2 px-3 py-1.5 text-[13px] transition-colors ${checked ? 'hover:bg-gray-50' : 'bg-rose-50/70 hover:bg-rose-50'} ${locked ? 'cursor-default' : 'cursor-pointer'}`}>
                                    <input
                                        type="checkbox"
                                        checked={checked}
                                        disabled={locked}
                                        onChange={() => onToggleItem?.(userRoleId, it.id)}
                                        className="size-3.5 shrink-0 accent-brand-600 disabled:opacity-60"
                                    />
                                    <span className={`flex-1 min-w-0 truncate ${checked ? 'text-gray-700' : 'text-rose-700 line-through decoration-rose-300'}`} title={label}>{label}</span>
                                    {it.permission && (
                                        <span className="shrink-0 rounded bg-gray-100 px-1.5 py-px text-[10px] font-medium text-gray-500">{it.permission}</span>
                                    )}
                                    {!it.is_active && <span className="shrink-0 text-[10px] font-semibold text-gray-400">(ยกเลิกแล้ว)</span>}
                                </label>
                            </li>
                        );
                    })}
                </ul>
            )}
        </div>
    );
}

function CategoryBox({
    category, items, userRoleId, uncheckedSet, readOnly, onlyUnchecked, search, tileClass, onToggleItem, onToggleMany,
}: {
    category: string;
    items: RoleItem[];
    userRoleId: number;
    uncheckedSet: Set<number>;
    readOnly: boolean;
    onlyUnchecked: boolean;
    search: string;
    tileClass: string;
    onToggleItem?: (userRoleId: number, itemId: number) => void;
    onToggleMany?: (userRoleId: number, itemIds: number[], checked: boolean) => void;
}) {
    const visible = useMemo(() => {
        const term = norm(search.trim());
        return items.filter(it => {
            if (onlyUnchecked && !uncheckedSet.has(it.id)) return false;
            if (!term) return true;
            return norm(it.item ?? '').includes(term) || norm(category).includes(term) || norm(it.permission ?? '').includes(term);
        });
    }, [items, uncheckedSet, onlyUnchecked, search, category]);

    if (visible.length === 0) return null;

    // Inactive items (removed from the source system) can only ever appear unticked — they never
    // count toward "all checked" and "เลือกทั้งหมด" never touches them.
    const activeItems = items.filter(it => it.is_active);
    const allChecked = activeItems.length > 0 && activeItems.every(it => !uncheckedSet.has(it.id));

    return (
        <div className="rounded-xl border border-gray-100 bg-white overflow-hidden">
            <div className="flex items-center gap-2 px-3 py-2 border-b border-gray-100">
                <span className={`${tileClass} size-6 rounded-lg flex items-center justify-center shrink-0`}>
                    <span className="size-1.5 rounded-full bg-white/90" />
                </span>
                <span className="text-sm font-semibold text-ink-900 flex-1 truncate">{category}</span>
                {!readOnly && activeItems.length > 0 && (
                    <button
                        type="button"
                        onClick={() => onToggleMany?.(userRoleId, activeItems.map(i => i.id), !allChecked)}
                        className="text-xs font-medium text-brand-600 hover:underline cursor-pointer shrink-0"
                    >
                        เลือกทั้งหมด
                    </button>
                )}
            </div>
            <ul className="divide-y divide-gray-50">
                {visible.map(it => {
                    const checked = it.is_active && !uncheckedSet.has(it.id);
                    const locked = readOnly || !it.is_active;
                    return (
                        <li key={it.id}>
                            <label className={`flex items-center gap-2.5 px-3 py-2 text-sm transition-colors ${checked ? 'hover:bg-gray-50' : 'bg-rose-50/70 hover:bg-rose-50'} ${locked ? 'cursor-default' : 'cursor-pointer'}`}>
                                <input
                                    type="checkbox"
                                    checked={checked}
                                    disabled={locked}
                                    onChange={() => onToggleItem?.(userRoleId, it.id)}
                                    className="size-4 shrink-0 accent-brand-600 disabled:opacity-60"
                                />
                                <span className={`flex-1 min-w-0 truncate ${checked ? 'text-gray-700' : 'text-rose-700'}`}>{it.item}</span>
                                {it.permission && (
                                    <span className="shrink-0 rounded border border-gray-200 px-1.5 py-0.5 text-[10px] text-gray-500">{it.permission}</span>
                                )}
                                {!it.is_active ? (
                                    <span className="shrink-0 text-[10px] font-semibold text-gray-400">(ยกเลิกในระบบแล้ว)</span>
                                ) : !checked ? (
                                    <span className="shrink-0 text-[10px] font-semibold text-rose-600">ไม่ได้รับสิทธิ์</span>
                                ) : null}
                            </label>
                        </li>
                    );
                })}
            </ul>
        </div>
    );
}

const RoleBlock = memo(({
    role, systemCode, readOnly, uncheckedSet, decision, onlyUnchecked, search, expanded, onToggleExpand, onToggleItem, onToggleMany, onDecision,
}: {
    role: ChecklistRoleData;
    systemCode: SystemCode;
    readOnly: boolean;
    uncheckedSet: Set<number>;
    decision: Decision | undefined;
    onlyUnchecked: boolean;
    search: string;
    expanded: boolean;
    onToggleExpand: () => void;
    onToggleItem?: (userRoleId: number, itemId: number) => void;
    onToggleMany?: (userRoleId: number, itemIds: number[], checked: boolean) => void;
    onDecision?: (userRoleId: number, decision: Decision) => void;
}) => {
    const categories = useMemo(() => {
        const map = new Map<string, RoleItem[]>();
        for (const it of role.items) {
            if (!map.has(it.category)) map.set(it.category, []);
            map.get(it.category)!.push(it);
        }
        return Array.from(map.entries());
    }, [role.items]);

    const tickedCount = role.items.filter(it => it.is_active && !uncheckedSet.has(it.id)).length;
    const term = norm(search.trim());
    const roleMatches = !term || norm(role.role_name).includes(term) || norm(role.account_name).includes(term);

    // Item-less role (e.g. an Email role with nothing to list) — one whole-role tick instead of a grid.
    if (role.items.length === 0) {
        if (term && !roleMatches) return null;
        const checked = (decision ?? 'keep') === 'keep';
        if (onlyUnchecked && checked) return null;
        return (
            <div className="rounded-xl border border-gray-100 bg-white px-3.5 py-3">
                <label className={`flex items-center gap-2.5 text-sm ${readOnly ? '' : 'cursor-pointer'}`}>
                    <input
                        type="checkbox"
                        checked={checked}
                        disabled={readOnly}
                        onChange={() => onDecision?.(role.user_role_id, checked ? 'remove' : 'keep')}
                        className="size-4 shrink-0 accent-brand-600 disabled:opacity-60"
                    />
                    <span className="min-w-0 flex-1">
                        <span className={`font-medium ${checked ? 'text-gray-800' : 'text-rose-700'}`}>{role.role_name}</span>
                        {role.account_name && <span className="ml-1.5 text-xs text-gray-400 font-mono">{role.account_name}</span>}
                    </span>
                    {!checked && <span className="shrink-0 text-[10px] font-semibold text-rose-600">ไม่ได้รับสิทธิ์</span>}
                </label>
            </div>
        );
    }

    return (
        <div className="rounded-2xl border border-gray-100 bg-gray-50/60 overflow-hidden">
            <button
                type="button"
                onClick={onToggleExpand}
                className="flex w-full items-center gap-2 px-3.5 py-2.5 text-left hover:bg-gray-100/60 transition-colors cursor-pointer"
            >
                {expanded ? <ChevronDown className="size-4 text-gray-400 shrink-0" /> : <ChevronRight className="size-4 text-gray-400 shrink-0" />}
                <div className="min-w-0 flex-1">
                    <p className="text-sm font-semibold text-ink-900 truncate">{role.role_name}</p>
                    {role.account_name && <p className="text-[11px] text-gray-400 font-mono truncate">{role.account_name}</p>}
                </div>
                <span className={`shrink-0 text-xs font-medium tabular-nums rounded-full px-2 py-0.5 ${tickedCount === role.items.length ? 'bg-emerald-50 text-mint-700' : 'bg-rose-50 text-rose-700'}`}>
                    ติ๊กอยู่ {tickedCount} / {role.items.length}
                </span>
            </button>
            {expanded && systemCode === 'ATMS' && (
                <AtmsRoleBody
                    items={role.items}
                    userRoleId={role.user_role_id}
                    uncheckedSet={uncheckedSet}
                    readOnly={readOnly}
                    onlyUnchecked={onlyUnchecked}
                    search={search}
                    onToggleItem={onToggleItem}
                    onToggleMany={onToggleMany}
                />
            )}
            {expanded && systemCode !== 'ATMS' && (
                <div className="px-3 pb-3 grid gap-3 sm:grid-cols-2">
                    {categories.map(([category, items], i) => (
                        <CategoryBox
                            key={category}
                            category={category}
                            items={items}
                            userRoleId={role.user_role_id}
                            uncheckedSet={uncheckedSet}
                            readOnly={readOnly}
                            onlyUnchecked={onlyUnchecked}
                            search={search}
                            tileClass={CATEGORY_TILES[i % CATEGORY_TILES.length]}
                            onToggleItem={onToggleItem}
                            onToggleMany={onToggleMany}
                        />
                    ))}
                </div>
            )}
        </div>
    );
});
RoleBlock.displayName = 'RoleBlock';

export function Checklist({ systems, readOnly, unchecked, onToggleItem, onToggleMany, decisions, onDecision }: ChecklistProps) {
    const [search, setSearch] = useState('');
    const [onlyUnchecked, setOnlyUnchecked] = useState(false);
    const [collapsedAll, setCollapsedAll] = useState(false);
    const [manualExpanded, setManualExpanded] = useState<Map<number, boolean>>(new Map());

    const totalItems = systems.reduce((n, s) => n + s.roles.reduce((m, r) => m + r.items.length, 0), 0);

    return (
        <div className="flex flex-col h-full min-h-0">
            <div className="flex flex-wrap items-center gap-2 border-b border-gray-100 px-4 sm:px-6 py-2.5 shrink-0 bg-white">
                <button
                    type="button"
                    onClick={() => { setCollapsedAll(v => !v); setManualExpanded(new Map()); }}
                    className="inline-flex items-center gap-1 rounded-full border border-gray-200 bg-gray-50 px-3 py-1 text-xs font-medium text-gray-600 hover:bg-gray-100 cursor-pointer"
                >
                    {collapsedAll ? <ChevronRight className="size-3.5" /> : <ChevronDown className="size-3.5" />}
                    ขยาย/ย่อรายการ
                </button>
                {readOnly && (
                    <label className="flex items-center gap-1.5 text-xs text-gray-500">
                        <input type="checkbox" checked={onlyUnchecked} onChange={e => setOnlyUnchecked(e.target.checked)} className="size-3.5 accent-rose-600" />
                        แสดงเฉพาะที่ไม่ติ๊ก
                    </label>
                )}
                {totalItems > 20 && (
                    <div className="relative ml-auto w-full sm:w-56">
                        <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 size-3.5 text-gray-400" />
                        <input
                            value={search}
                            onChange={e => setSearch(e.target.value)}
                            placeholder="ค้นหาสิทธิ์..."
                            className="h-8 w-full rounded-full border border-gray-200 bg-gray-50 pl-8 pr-3 text-xs text-gray-700 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-brand-600/30"
                        />
                    </div>
                )}
                {!readOnly && <p className="w-full sm:w-auto sm:ml-auto text-[11px] text-gray-400 shrink-0">รายการที่ไม่ได้ติ๊ก = ไม่ได้รับสิทธิ์</p>}
            </div>

            <div className="flex-1 min-h-0 overflow-y-auto px-4 sm:px-6 py-4 space-y-5">
                {systems.map(sys => (
                    <div key={sys.code} className="space-y-2.5">
                        <div className="flex items-center gap-2">
                            <span className="v2-tile-blue size-7 rounded-xl flex items-center justify-center shrink-0">
                                <SystemIcon code={sys.code} className="size-3.5" />
                            </span>
                            <h3 className="text-sm font-bold text-ink-900">{SYSTEM_META[sys.code]?.label ?? sys.name}</h3>
                        </div>
                        <div className="space-y-2.5">
                            {sys.roles.map(role => (
                                <RoleBlock
                                    key={role.user_role_id}
                                    role={role}
                                    systemCode={sys.code}
                                    readOnly={readOnly}
                                    uncheckedSet={unchecked.get(role.user_role_id) ?? new Set()}
                                    decision={decisions.get(role.user_role_id)}
                                    onlyUnchecked={onlyUnchecked}
                                    search={search}
                                    expanded={manualExpanded.get(role.user_role_id) ?? !collapsedAll}
                                    onToggleExpand={() => setManualExpanded(prev => {
                                        const next = new Map(prev);
                                        next.set(role.user_role_id, !(prev.get(role.user_role_id) ?? !collapsedAll));
                                        return next;
                                    })}
                                    onToggleItem={onToggleItem}
                                    onToggleMany={onToggleMany}
                                    onDecision={onDecision}
                                />
                            ))}
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
}
