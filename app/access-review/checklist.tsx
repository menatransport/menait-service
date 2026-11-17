'use client';

import { memo, useMemo, useState } from 'react';
import { ChevronDown, ChevronRight, ListChecks, Search, Warehouse } from 'lucide-react';
import { SYSTEM_META, SystemIcon } from './components';
import { GroupRequestCard, RequestCard, type PickerCopy, type PickerGroup } from './request-card';
import { ItemGroups, isWarehouse } from './item-groups';
import type { CatalogRole, Decision, RoleItem, SystemCode } from './types';

/**
 * The "ยืนยันสิทธิ์การเข้าถึง" checklist — one tab per system, each role → collapsible หมวด / เมนู groups
 * (item-groups.tsx, same pattern as the admin รายละเอียดสิทธิ์ dialog). Everything starts ticked; an unticked
 * row is what gets removed.
 */

export interface ChecklistRoleData {
    user_role_id: number;
    role_id: number;
    role_name: string;
    account_name: string;
    item_count: number;
    items: RoleItem[];
}

const NO_ITEMS: RoleItem[] = [];

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
    /** user_role_id → items the requester asked to ADD ("ต้องการเพิ่มสิทธิ์") */
    requested?: Map<number, RoleItem[]>;
    onRequestChange?: (userRoleId: number, items: RoleItem[]) => void;
    /** Whole Email groups the requester asked to join ("ต้องการเพิ่มอีเมลกลุ่ม") */
    requestedRoles?: CatalogRole[];
    onRequestRolesChange?: (roles: CatalogRole[]) => void;
    /** Controlled tab (optional — uncontrolled when omitted) */
    activeTab?: SystemCode;
    onTabChange?: (code: SystemCode) => void;
    /** Tabs the user hasn't opened yet — marked with a dot */
    unseenTabs?: SystemCode[];
}

/** The section the "ต้องการเพิ่มอีเมลกลุ่ม" picker lives in — shown even when the requester has no group yet. */
const GROUP_SYSTEM: SystemCode = 'EMAIL';

/** Checklist-only section names ("what you hold now"); badges/admin keep SYSTEM_META's label. */
const SECTION_TITLE: Partial<Record<SystemCode, string>> = { EMAIL: 'กลุ่มอีเมล์สิทธิ์ปัจจุบัน' };

export const sectionTitle = (sys: { code: SystemCode; name: string }) =>
    SECTION_TITLE[sys.code] ?? SYSTEM_META[sys.code]?.label ?? sys.name;

/** The tabs the checklist shows — the user's systems, plus the Email group picker tab when it's on. */
export function checklistSections(systems: ChecklistSystemData[], showGroups: boolean): ChecklistSystemData[] {
    return showGroups && !systems.some(s => s.code === GROUP_SYSTEM)
        ? [...systems, { code: GROUP_SYSTEM, name: 'Email Group', roles: [] }]
        : systems;
}

const norm = (s: string) => s.toLowerCase();

const warehouseLabel = (it: RoleItem) => it.item ?? it.category;
const menuLabel = (it: RoleItem) => it.item ? `${it.category} · ${it.item}` : it.category;

/** "ค้นหาเพื่อขอเพิ่มเมนูอื่น" picker sections — warehouses first, like the grouped list below. */
const ATMS_REQUEST_GROUPS: PickerGroup[] = [
    { key: 'warehouse', label: 'คลังสินค้า', icon: Warehouse },
    { key: 'menu', label: 'สิทธิ์', icon: ListChecks },
];
const atmsRequestGroup = (it: RoleItem) => isWarehouse(it) ? 'warehouse' : 'menu';
// Inside the คลังสินค้า section the category prefix is redundant — show just the warehouse name.
const atmsRequestLabel = (it: RoleItem) => isWarehouse(it) ? warehouseLabel(it) : menuLabel(it);

/** Picks are listed inside their menu group, so this picker only searches across every menu (incl. ones not held). */
const ATMS_SEARCH_COPY: PickerCopy = {
    title: 'สิทธิ์และคลังสินค้าที่ต้องการเพิ่ม',
    trigger: 'ค้นหาเพื่อขอเพิ่มเมนูหรือคลังสินค้าอื่น',
    triggerMore: 'ค้นหาเพื่อขอเพิ่มเมนูหรือคลังสินค้าอื่น',
    hint: 'รายการที่เลือกจะแสดงในเมนูนั้น',
    placeholder: 'ค้นหาคลังสินค้า เมนู หรือสิทธิ์...',
    allTaken: 'มีสิทธิ์และคลังสินค้าครบทุกรายการแล้ว',
    unit: 'รายการ',
    readOnlyNote: 'ผู้แจ้งขอเพิ่มสิทธิ์เหล่านี้ในกลุ่มนี้',
};

/**
 * ATMS role body: warehouses on the left, menus on the right — each side a collapsible grouped list (item-groups.tsx).
 * Requests are split the same way, so each side only edits its own half.
 */
function AtmsRoleBody({
    role, requested, uncheckedSet, readOnly, onlyUnchecked, search, onToggleItem, onToggleMany, onRequestChange,
}: {
    role: ChecklistRoleData;
    requested: RoleItem[];
    uncheckedSet: Set<number>;
    readOnly: boolean;
    onlyUnchecked: boolean;
    search: string;
    onToggleItem?: (userRoleId: number, itemId: number) => void;
    onToggleMany?: (userRoleId: number, itemIds: number[], checked: boolean) => void;
    onRequestChange?: (userRoleId: number, items: RoleItem[]) => void;
}) {
    const id = role.user_role_id;
    const warehouses = useMemo(() => role.items.filter(isWarehouse), [role.items]);
    const menus = useMemo(() => role.items.filter(it => !isWarehouse(it)), [role.items]);
    const reqWarehouses = useMemo(() => requested.filter(isWarehouse), [requested]);
    const reqMenus = useMemo(() => requested.filter(it => !isWarehouse(it)), [requested]);
    const shared = {
        system: 'ATMS' as const, uncheckedSet, readOnly, onlyUnchecked, search,
        onToggleItem: onToggleItem && ((itemId: number) => onToggleItem(id, itemId)),
        onToggleMany: onToggleMany && ((ids: number[], checked: boolean) => onToggleMany(id, ids, checked)),
    };
    return (
        <div className="px-3 pb-3 grid gap-3 sm:grid-cols-[minmax(0,2fr)_minmax(0,3fr)] items-start">
            <ItemGroups
                {...shared}
                title="คลังสินค้าปัจจุบัน"
                icon={Warehouse}
                flat
                items={warehouses}
                requested={reqWarehouses}
                onRequestChange={onRequestChange && (next => onRequestChange(id, [...next, ...reqMenus]))}
            />
            <div className="space-y-3 min-w-0">
                <RequestCard
                    system="ATMS"
                    ownItems={role.items}
                    requested={requested}
                    readOnly={readOnly}
                    labelOf={atmsRequestLabel}
                    groups={ATMS_REQUEST_GROUPS}
                    groupOf={atmsRequestGroup}
                    copy={ATMS_SEARCH_COPY}
                    showPicked={false}
                    onChange={next => onRequestChange?.(id, next)}
                />
                <ItemGroups
                    {...shared}
                    title="เมนูสิทธิ์ปัจจุบัน"
                    icon={ListChecks}
                    items={menus}
                    requested={reqMenus}
                    onRequestChange={onRequestChange && (next => onRequestChange(id, [...reqWarehouses, ...next]))}
                />
            </div>
        </div>
    );
}

const RoleBlock = memo(({
    role, systemCode, readOnly, uncheckedSet, decision, onlyUnchecked, search, expanded, onToggleExpand, onToggleItem, onToggleMany, onDecision,
    requested, onRequestChange,
}: {
    requested: RoleItem[];
    onRequestChange?: (userRoleId: number, items: RoleItem[]) => void;
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
                {requested.length > 0 && (
                    <span className="shrink-0 text-xs font-medium tabular-nums rounded-full px-2 py-0.5 bg-emerald-50 text-mint-700">
                        ขอเพิ่ม {requested.length}
                    </span>
                )}
                <span className={`shrink-0 text-xs font-medium tabular-nums rounded-full px-2 py-0.5 ${tickedCount === role.items.length ? 'bg-emerald-50 text-mint-700' : 'bg-rose-50 text-rose-700'}`}>
                    ติ๊กอยู่ {tickedCount} / {role.items.length}
                </span>
            </button>
            {expanded && systemCode === 'ATMS' && (
                <AtmsRoleBody
                    role={role}
                    requested={requested}
                    uncheckedSet={uncheckedSet}
                    readOnly={readOnly}
                    onlyUnchecked={onlyUnchecked}
                    search={search}
                    onToggleItem={onToggleItem}
                    onToggleMany={onToggleMany}
                    onRequestChange={onRequestChange}
                />
            )}
            {expanded && systemCode !== 'ATMS' && (
                <div className="px-3 pb-3">
                    <ItemGroups
                        system={systemCode}
                        items={role.items}
                        requested={NO_ITEMS}
                        uncheckedSet={uncheckedSet}
                        readOnly={readOnly}
                        onlyUnchecked={onlyUnchecked}
                        search={search}
                        onToggleItem={onToggleItem && (id => onToggleItem(role.user_role_id, id))}
                        onToggleMany={onToggleMany && ((ids, checked) => onToggleMany(role.user_role_id, ids, checked))}
                    />
                </div>
            )}
        </div>
    );
});
RoleBlock.displayName = 'RoleBlock';

export function Checklist({
    systems, readOnly, unchecked, onToggleItem, onToggleMany, decisions, onDecision, requested, onRequestChange,
    requestedRoles = [], onRequestRolesChange, activeTab, onTabChange, unseenTabs,
}: ChecklistProps) {
    const [search, setSearch] = useState('');
    const [onlyUnchecked, setOnlyUnchecked] = useState(false);
    const [collapsedAll, setCollapsedAll] = useState(false);
    const [manualExpanded, setManualExpanded] = useState<Map<number, boolean>>(new Map());
    const [ownTab, setOwnTab] = useState<SystemCode | null>(null);

    const totalItems = systems.reduce((n, s) => n + s.roles.reduce((m, r) => m + r.items.length, 0), 0);
    const groupPickerOn = !readOnly && Boolean(onRequestRolesChange);
    const showGroups = groupPickerOn || requestedRoles.length > 0;
    const shownSystems = useMemo(() => checklistSections(systems, showGroups), [systems, showGroups]);

    const wanted = activeTab ?? ownTab;
    const current = shownSystems.find(s => s.code === wanted) ?? shownSystems[0];
    const selectTab = (code: SystemCode) => { setOwnTab(code); onTabChange?.(code); };

    /** Unticked (to-be-removed) rows per tab — shown as a badge so nothing hides behind a tab. */
    const removalsOf = (sys: ChecklistSystemData) => sys.roles.reduce((n, r) => n + (r.items.length > 0
        ? unchecked.get(r.user_role_id)?.size ?? 0
        : (decisions.get(r.user_role_id) ?? 'keep') === 'remove' ? 1 : 0), 0);
    const requestsOf = (sys: ChecklistSystemData) =>
        sys.roles.reduce((n, r) => n + (requested?.get(r.user_role_id)?.length ?? 0), 0)
        + (sys.code === GROUP_SYSTEM ? requestedRoles.length : 0);

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

            {shownSystems.length > 0 && (
                <div role="tablist" className="flex gap-1.5 overflow-x-auto border-b border-gray-100 px-4 sm:px-6 py-2 shrink-0 bg-white">
                    {shownSystems.map(sys => {
                        const active = sys.code === current?.code;
                        const unseen = !active && unseenTabs?.includes(sys.code);
                        const removals = removalsOf(sys);
                        const requests = requestsOf(sys);
                        return (
                            <button
                                key={sys.code}
                                type="button"
                                role="tab"
                                aria-selected={active}
                                onClick={() => selectTab(sys.code)}
                                className={`relative inline-flex shrink-0 items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-semibold transition-colors cursor-pointer ${active
                                    ? 'bg-brand-600 text-white shadow-sm'
                                    : 'bg-gray-50 text-gray-600 hover:bg-gray-100 border border-gray-200'}`}
                            >
                                <SystemIcon code={sys.code} className="size-3.5" />
                                {sectionTitle(sys)}
                                {removals > 0 && (
                                    <span className={`rounded-full px-1.5 text-[10px] tabular-nums ${active ? 'bg-white/20 text-white' : 'bg-rose-50 text-rose-700'}`}>-{removals}</span>
                                )}
                                {requests > 0 && (
                                    <span className={`rounded-full px-1.5 text-[10px] tabular-nums ${active ? 'bg-white/20 text-white' : 'bg-emerald-50 text-mint-700'}`}>+{requests}</span>
                                )}
                                {unseen && <span aria-label="ยังไม่ได้เปิดดู" className="absolute -right-0.5 -top-0.5 size-2 rounded-full bg-amber-500 ring-2 ring-white" />}
                            </button>
                        );
                    })}
                </div>
            )}

            <div className="flex-1 min-h-0 overflow-y-auto px-4 sm:px-6 py-4 space-y-5">
                {current && [current].map(sys => (
                    <div key={sys.code} className="space-y-2.5">
                        <div className="flex items-center gap-2">
                            <span className="v2-tile-blue size-7 rounded-xl flex items-center justify-center shrink-0">
                                <SystemIcon code={sys.code} className="size-3.5" />
                            </span>
                            <h3 className="text-sm font-bold text-ink-900">{sectionTitle(sys)}</h3>
                        </div>
                        <div className="space-y-2.5">
                            {sys.code === GROUP_SYSTEM && showGroups && (
                                <GroupRequestCard
                                    system={GROUP_SYSTEM}
                                    heldRoleIds={sys.roles.map(r => r.role_id)}
                                    requested={requestedRoles}
                                    readOnly={!groupPickerOn}
                                    onChange={onRequestRolesChange}
                                />
                            )}
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
                                    requested={requested?.get(role.user_role_id) ?? NO_ITEMS}
                                    onRequestChange={onRequestChange}
                                />
                            ))}
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
}
