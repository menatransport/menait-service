'use client';

import React, { useState, useMemo, useCallback, useEffect, memo } from 'react';
import { Button } from '@/components/ui/button';
import { TableSkeleton } from '@/components/ui/loading';
import {
    FileSpreadsheet, Users, ChevronDown, ChevronRight,
    Building2, Layers, MapPin, Briefcase, Eye, ExternalLink, UserPlus, UserX
} from 'lucide-react';
import { UserDetailSheet } from './user-detail-sheet';
import { AddUserDialog } from './add-user-dialog';
import { InactiveUsersDialog } from './inactive-users-dialog';
import { UserAvatar } from '@/components/ui/user-avatar';

// Local imports - bundle-barrel-imports: Import directly
import {
    USER_COLUMNS, FORM_COLUMNS,
    parseLevelNum, formatThaiDate
} from './constants';
import {
    StatusBadge, UserEmptyState, FormEmptyState, ErrorState,
    TableHeader, TableWrapper, TableHead, ExcelButton
} from './shared-components';
import { groupUsersByDivision } from './group-users';
import type {
    UserData, FormData, DivisionGroup,
    MasterTableProps, TableFormProps
} from './types';

// Re-export types for external use
export type { UserData, FormData } from './types';

// ===================== USER TABLE SUB-COMPONENTS =====================

const Chevron = ({ open, className = '' }: { open: boolean; className?: string }) => open
    ? <ChevronDown className={`w-4 h-4 shrink-0 ${className}`} />
    : <ChevronRight className={`w-4 h-4 shrink-0 ${className}`} />;

const CountChip = ({ children, strong }: { children: React.ReactNode; strong?: boolean }) => (
    <span className={`text-[11px] font-medium px-2 py-0.5 rounded-full shrink-0 ${strong ? 'bg-brand-600 text-white' : 'bg-brand-600/10 text-brand-600'}`}>
        {children}
    </span>
);

/** ฝ่าย summary: "3 แผนก · 12 คน", or just "12 คน" when the ฝ่าย has one แผนก */
const divisionCount = (group: DivisionGroup) =>
    group.departments.length > 1
        ? `${group.departments.length} แผนก · ${group.total} คน`
        : `${group.total} คน`;

const DivisionHeaderRow = memo(({
    group, isOpen, onToggle
}: {
    group: DivisionGroup;
    isOpen: boolean;
    onToggle: () => void;
}) => (
    <tr
        className="bg-brand-600/10 border-t border-brand-600/15 cursor-pointer hover:bg-brand-600/15 transition-colors select-none"
        onClick={onToggle}
    >
        <td colSpan={USER_COLUMNS.length} className="px-4 py-3">
            <div className="flex items-center gap-2.5">
                <Chevron open={isOpen} className="text-brand-700" />
                <span className="w-7 h-7 rounded-lg bg-brand-600 text-white flex items-center justify-center shrink-0">
                    <Building2 className="w-4 h-4" />
                </span>
                <span className="text-sm font-bold text-brand-800">{group.division}</span>
                {group.code && (
                    <span className="font-mono text-[10px] font-bold text-brand-700 border border-brand-600/30 px-1.5 py-0.5 rounded">
                        {group.code}
                    </span>
                )}
                {group.divisionEn && group.divisionEn !== group.division && (
                    <span className="text-xs text-brand-700/50 truncate">{group.divisionEn}</span>
                )}
                <span className="ml-auto"><CountChip strong>{divisionCount(group)}</CountChip></span>
            </div>
        </td>
    </tr>
));
DivisionHeaderRow.displayName = 'DivisionHeaderRow';

const DepartmentHeaderRow = memo(({
    department, departmentEn, count, isOpen, onToggle
}: {
    department: string;
    departmentEn: string;
    count: number;
    isOpen: boolean;
    onToggle: () => void;
}) => (
    <tr
        className="bg-brand-600/[0.03] border-t border-gray-100 cursor-pointer hover:bg-brand-600/[0.07] transition-colors select-none"
        onClick={onToggle}
    >
        <td colSpan={USER_COLUMNS.length} className="py-2 pl-11 pr-4">
            <div className="flex items-center gap-2 border-l-2 border-brand-600/30 pl-3">
                <Chevron open={isOpen} className="text-brand-600/70" />
                <Layers className="w-3.5 h-3.5 text-brand-600/70 shrink-0" />
                <span className="text-sm font-semibold text-gray-700">{department}</span>
                {departmentEn && departmentEn !== department && (
                    <span className="text-[11px] text-gray-400 truncate">{departmentEn}</span>
                )}
                <CountChip>{count} คน</CountChip>
            </div>
        </td>
    </tr>
));
DepartmentHeaderRow.displayName = 'DepartmentHeaderRow';

const UserRow = memo(({
    user, onView, nested
}: {
    user: UserData;
    onView: (u: UserData) => void;
    /** sits under a แผนก sub-header → one more indent step */
    nested?: boolean;
}) => (
    <tr className="transition-colors hover:bg-gray-50/80 even:bg-gray-50/40">
        <td className={`whitespace-nowrap px-4 py-2.5 ${nested ? 'pl-[4.5rem]' : 'pl-11'}`}>
            <span className="font-mono text-xs font-semibold text-brand-600">
                {user.employee_id}
            </span>
        </td>
        <td className="whitespace-nowrap px-4 py-2.5">
            <div className="flex items-center gap-2.5">
                <UserAvatar
                    imageUrl={user.image_url}
                    name={`${user.firstname ?? ''} ${user.lastname ?? ''}`}
                    email={user.email}
                    className="w-7 h-7"
                    rounded="rounded-lg"
                    fallbackClassName="bg-brand-600/10 text-brand-600"
                    textClassName="text-[10px] font-bold"
                />
                <div className="min-w-0">
                    <p className="text-sm font-medium text-gray-800 truncate">
                        {user.firstname} {user.lastname}
                    </p>
                    <p className="text-[11px] text-gray-400 truncate">{user.email}</p>
                </div>
            </div>
        </td>
        <td className="whitespace-nowrap px-4 py-2.5 text-sm text-gray-600">
            {user.site || '-'}
        </td>
        <td className="max-w-50 px-4 py-2.5 text-sm text-gray-600 truncate" title={user.position ?? undefined}>
            {user.position || '-'}
        </td>
        <td className="whitespace-nowrap px-4 py-2.5">
            {user.position_level ? (
                <span className="inline-flex items-center gap-1.5 h-6 px-2 text-xs font-medium rounded-md bg-brand-600/10 text-brand-600">
                    <span className="font-bold">Lv.{parseLevelNum(user.position_level)}</span>
                    <span className="text-brand-600/60">{user.position_level}</span>
                </span>
            ) : (
                <span className="text-sm text-gray-400">-</span>
            )}
        </td>
        <td className="whitespace-nowrap px-4 py-2.5">
            <StatusBadge status={user.employee_status} />
        </td>
        <td className="whitespace-nowrap px-4 py-2.5">
            <button
                onClick={() => onView(user)}
                className="inline-flex items-center justify-center w-7 h-7 rounded-lg text-gray-400 hover:text-brand-600 hover:bg-brand-600/10 transition-colors cursor-pointer"
                title="ดูรายละเอียด"
            >
                <Eye className="w-4 h-4" />
            </button>
        </td>
    </tr>
));
UserRow.displayName = 'UserRow';

const UserMobileCard = memo(({
    user, onView
}: {
    user: UserData;
    onView: (u: UserData) => void
}) => (
    <div className="bg-white border border-gray-100 rounded-xl p-3.5 space-y-2">
        <div className="flex items-center justify-between">
            <div className="flex items-center gap-2.5">
                <UserAvatar
                    imageUrl={user.image_url}
                    name={`${user.firstname ?? ''} ${user.lastname ?? ''}`}
                    email={user.email}
                    className="w-8 h-8"
                    rounded="rounded-lg"
                    fallbackClassName="bg-brand-600/10 text-brand-600"
                    textClassName="text-[10px] font-bold"
                />
                <div className="min-w-0">
                    <p className="text-sm font-semibold text-gray-800 truncate">
                        {user.firstname} {user.lastname}
                    </p>
                    <p className="text-[11px] text-gray-400 font-mono">{user.employee_id}</p>
                </div>
            </div>
            <StatusBadge status={user.employee_status} />
        </div>
        <div className="grid grid-cols-2 gap-1.5 text-xs text-gray-500">
            <div className="flex items-center gap-1.5">
                <MapPin className="w-3 h-3 text-gray-400 shrink-0" />
                <span className="truncate">{user.site || '-'}</span>
            </div>
            <div className="flex items-center gap-1.5">
                <Briefcase className="w-3 h-3 text-gray-400 shrink-0" />
                <span className="truncate">{user.position || '-'}</span>
            </div>
            {user.position_level && (
                <div className="col-span-2">
                    <span className="inline-flex items-center gap-1 px-1.5 py-0.5 text-[10px] font-bold rounded-md bg-brand-600/10 text-brand-600">
                        Lv.{parseLevelNum(user.position_level)} · {user.position_level}
                    </span>
                </div>
            )}
        </div>
    </div>
));
UserMobileCard.displayName = 'UserMobileCard';

const MobileDivisionGroup = memo(({
    group, isOpen, isDeptOpen, onToggle, onToggleDept, onViewUser
}: {
    group: DivisionGroup;
    isOpen: boolean;
    isDeptOpen: (key: string) => boolean;
    onToggle: (key: string) => void;
    onToggleDept: (key: string) => void;
    onViewUser: (u: UserData) => void;
}) => {
    const single = group.departments.length === 1;
    return (
        <div className="border border-brand-600/15 rounded-xl overflow-hidden">
            <button
                onClick={() => onToggle(group.key)}
                className="w-full flex items-center gap-2.5 px-3.5 py-3 bg-brand-600/10 hover:bg-brand-600/15 transition-colors"
            >
                <Chevron open={isOpen} className="text-brand-700" />
                <span className="w-7 h-7 rounded-lg bg-brand-600 text-white flex items-center justify-center shrink-0">
                    <Building2 className="w-4 h-4" />
                </span>
                <span className="flex-1 min-w-0 text-left">
                    <span className="block text-sm font-bold text-brand-800 truncate">{group.division}</span>
                    {group.code && <span className="block font-mono text-[10px] text-brand-700/60">{group.code}</span>}
                </span>
                <CountChip strong>{divisionCount(group)}</CountChip>
            </button>
            {isOpen && (single ? (
                <div className="p-2.5 space-y-2 bg-gray-50/50">
                    {group.departments[0].users.map(user => (
                        <UserMobileCard key={user.id} user={user} onView={onViewUser} />
                    ))}
                </div>
            ) : (
                <div className="divide-y divide-gray-100 bg-gray-50/50">
                    {group.departments.map(dept => {
                        const open = isDeptOpen(dept.key);
                        return (
                            <div key={dept.key}>
                                <button
                                    onClick={() => onToggleDept(dept.key)}
                                    className="w-full flex items-center gap-2 pl-5 pr-3.5 py-2.5 hover:bg-brand-600/5 transition-colors"
                                >
                                    <Chevron open={open} className="text-brand-600/70" />
                                    <Layers className="w-3.5 h-3.5 text-brand-600/70 shrink-0" />
                                    <span className="text-sm font-semibold text-gray-700 flex-1 text-left truncate">{dept.department}</span>
                                    <CountChip>{dept.users.length} คน</CountChip>
                                </button>
                                {open && (
                                    <div className="pl-5 pr-2.5 pb-2.5 space-y-2">
                                        {dept.users.map(user => (
                                            <UserMobileCard key={user.id} user={user} onView={onViewUser} />
                                        ))}
                                    </div>
                                )}
                            </div>
                        );
                    })}
                </div>
            ))}
        </div>
    );
});
MobileDivisionGroup.displayName = 'MobileDivisionGroup';

// ===================== MASTER TABLE (USER) =====================

export const MasterTable = memo(({ data, isLoading, error, onRetry, onUpdate, onAdd, lookups, org, onDepartmentCreated }: MasterTableProps) => {
    const [searchTerm, setSearchTerm] = useState('');
    const [collapsed, setCollapsed] = useState<Set<string>>(new Set());
    const [selectedUser, setSelectedUser] = useState<UserData | null>(null);
    const [sheetOpen, setSheetOpen] = useState(false);
    const [addDialogOpen, setAddDialogOpen] = useState(false);
    const [inactiveDialogOpen, setInactiveDialogOpen] = useState(false);

    // Sync selectedUser with latest data after update
    useEffect(() => {
        if (selectedUser) {
            const updated = data.find(u => u.id === selectedUser.id);
            if (updated && updated !== selectedUser) setSelectedUser(updated);
        }
    }, [data]);

    // rerender-functional-setstate: Use callbacks for stable handlers
    const handleViewUser = useCallback((user: UserData) => {
        setSelectedUser(user);
        setSheetOpen(true);
    }, []);

    const handleSearchChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
        setSearchTerm(e.target.value);
    }, []);

    const handleClearSearch = useCallback(() => setSearchTerm(''), []);

    // Collapsed ฝ่าย and แผนก keys share one set (keys are `div:..` / `div:../dep:..`)
    const toggleGroup = useCallback((key: string) => {
        setCollapsed(prev => {
            const next = new Set(prev);
            next.has(key) ? next.delete(key) : next.add(key);
            return next;
        });
    }, []);

    // แผนก names in Thai come from the lookup — the user row only carries the English name
    const deptLabels = useMemo(
        () => new Map((lookups?.departments ?? []).map(d => [d.option_value, d.option_label])),
        [lookups?.departments]
    );

    // js-combine-iterations: Single pass for filter + group
    const { groups, totalFiltered, departmentCount, hasDivisions } = useMemo(
        () => groupUsersByDivision(data, searchTerm, deptLabels),
        [data, searchTerm, deptLabels]
    );

    const expandAll = useCallback(() => setCollapsed(new Set()), []);

    const collapseAll = useCallback(() => {
        setCollapsed(new Set(groups.map(g => g.key)));
    }, [groups]);

    // While searching, show every match instead of hiding hits inside collapsed groups
    const searching = searchTerm.trim() !== '';
    const isOpen = useCallback(
        (key: string) => searching || !collapsed.has(key),
        [searching, collapsed]
    );

    // js-early-exit: Handle error state first
    if (error) {
        return <ErrorState message={error} onRetry={onRetry} />;
    }

    return (
        <TableWrapper>
            <TableHeader
                icon={<Users className="w-5 h-5" />}
                title="ข้อมูลองค์กร"
                subtitle={`${hasDivisions ? `${groups.length} ฝ่าย · ` : ''}${departmentCount} แผนก · ${totalFiltered.toLocaleString()} คน (จาก ${data.length.toLocaleString()} รายการ)`}
                actions={
                    <>
                        <button
                            onClick={() => setInactiveDialogOpen(true)}
                            title="ดูพนักงานที่ออก"
                            className="bg-linear-to-r from-slate-600 to-slate-500 border border-white/30 hover:bg-white/20 text-white px-3 py-2 rounded-xl flex items-center gap-2 text-sm font-medium transition-all duration-200 cursor-pointer"
                        >
                            <UserX className="w-4 h-4" />
                            <span className="hidden sm:inline">ลาออก</span>
                        </button>
                        {onAdd && (
                            <button
                                onClick={() => setAddDialogOpen(true)}
                                className="bg-indigo-600/30 border border-white/30 hover:bg-indigo-600/50 text-white px-3 py-2 rounded-xl flex items-center gap-2 text-sm font-medium transition-all duration-200 cursor-pointer"
                            >
                                <UserPlus className="w-4 h-4" />
                                <span className="hidden sm:inline">เพิ่มผู้ใช้</span>
                            </button>
                        )}
                        <ExcelButton />
                    </>
                }
                searchValue={searchTerm}
                onSearchChange={handleSearchChange}
                onSearchClear={handleClearSearch}
                searchPlaceholder="ค้นหาชื่อ, รหัส, ฝ่าย, แผนก, สาขา..."
            />

            {/* Toolbar */}
            {!isLoading && groups.length > 0 && (
                <div className="px-4 sm:px-6 py-2.5 border-b border-gray-100 flex items-center justify-between bg-gray-50/50">
                    <p className="text-[11px] text-gray-400">
                        จัดกลุ่มตามฝ่าย → แผนก · เรียงตามระดับตำแหน่ง (มาก → น้อย)
                    </p>
                    <div className="flex items-center gap-1.5">
                        <button onClick={expandAll} className="text-[11px] text-brand-600 hover:underline cursor-pointer px-1.5 py-0.5">
                            ขยายทั้งหมด
                        </button>
                        <span className="text-gray-300">|</span>
                        <button onClick={collapseAll} className="text-[11px] text-brand-600 hover:underline cursor-pointer px-1.5 py-0.5">
                            ย่อทั้งหมด
                        </button>
                    </div>
                </div>
            )}

            {/* Content */}
            {isLoading ? (
                <div className="p-4"><TableSkeleton rows={8} /></div>
            ) : groups.length === 0 ? (
                <UserEmptyState />
            ) : (
                <>
                    {/* Desktop Table */}
                    <div className="hidden lg:block overflow-x-auto">
                        <table className="w-full">
                            <TableHead columns={USER_COLUMNS} />
                            <tbody>
                                {groups.map(group => {
                                    const divOpen = isOpen(group.key);
                                    const single = group.departments.length === 1;
                                    return (
                                        <React.Fragment key={group.key}>
                                            <DivisionHeaderRow
                                                group={group}
                                                isOpen={divOpen}
                                                onToggle={() => toggleGroup(group.key)}
                                            />
                                            {divOpen && (single
                                                ? group.departments[0].users.map(user => (
                                                    <UserRow key={user.id} user={user} onView={handleViewUser} />
                                                ))
                                                : group.departments.map(dept => {
                                                    const deptOpen = isOpen(dept.key);
                                                    return (
                                                        <React.Fragment key={dept.key}>
                                                            <DepartmentHeaderRow
                                                                department={dept.department}
                                                                departmentEn={dept.departmentEn}
                                                                count={dept.users.length}
                                                                isOpen={deptOpen}
                                                                onToggle={() => toggleGroup(dept.key)}
                                                            />
                                                            {deptOpen && dept.users.map(user => (
                                                                <UserRow key={user.id} user={user} onView={handleViewUser} nested />
                                                            ))}
                                                        </React.Fragment>
                                                    );
                                                })
                                            )}
                                        </React.Fragment>
                                    );
                                })}
                            </tbody>
                        </table>
                    </div>

                    {/* Mobile Cards */}
                    <div className="lg:hidden p-3 space-y-2.5">
                        {groups.map(group => (
                            <MobileDivisionGroup
                                key={group.key}
                                group={group}
                                isOpen={isOpen(group.key)}
                                isDeptOpen={isOpen}
                                onToggle={toggleGroup}
                                onToggleDept={toggleGroup}
                                onViewUser={handleViewUser}
                            />
                        ))}
                    </div>
                </>
            )}

            <UserDetailSheet
                user={selectedUser}
                open={sheetOpen}
                onOpenChange={setSheetOpen}
                onUpdate={onUpdate}
                lookups={lookups}
                org={org}
                onDepartmentCreated={onDepartmentCreated}
            />

            {onAdd && (
                <AddUserDialog
                    open={addDialogOpen}
                    onOpenChange={setAddDialogOpen}
                    onAdd={onAdd}
                    org={org}
                    lookups={lookups}
                    existingUsers={data}
                    onDepartmentCreated={onDepartmentCreated}
                />
            )}

            <InactiveUsersDialog
                open={inactiveDialogOpen}
                onOpenChange={setInactiveDialogOpen}
            />
        </TableWrapper>
    );
});
MasterTable.displayName = 'MasterTable';

// ===================== FORM TABLE SUB-COMPONENTS =====================

const FormRow = memo(({ form }: { form: FormData }) => {
    const handleOpenBuilder = useCallback(() => {
        window.open(`/builder/${form.form_code}`, '_blank');
    }, [form.form_code]);

    return (
        <tr className="transition-colors hover:bg-gray-50/80 even:bg-gray-50/40">
            <td className="whitespace-nowrap px-4 py-3">
                <span className="font-mono text-xs font-semibold text-brand-600 bg-brand-600/10 px-2 py-1 rounded">
                    {form.form_code}
                </span>
            </td>
            <td className="px-4 py-3">
                <p className="text-sm font-medium text-gray-800">{form.form_name}</p>
            </td>
            <td className="whitespace-nowrap px-4 py-3">
                <span className="inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-medium rounded-lg bg-blue-50 text-blue-700">
                    <FileSpreadsheet className="w-3.5 h-3.5" />
                    {form.form_type}
                </span>
            </td>
            <td className="whitespace-nowrap px-4 py-3">
                <StatusBadge status={form.form_status} />
            </td>
            <td className="whitespace-nowrap px-4 py-3 text-sm text-gray-500">
                {formatThaiDate(form.created_at)}
            </td>
            <td className="whitespace-nowrap px-4 py-3">
                <Button
                    variant="outline"
                    size="sm"
                    onClick={handleOpenBuilder}
                    className="cursor-pointer hover:scale-110 h-8 px-3 text-xs font-medium text-brand-600 border-brand-600/30 hover:bg-brand-600/10 hover:border-brand-600 transition-colors"
                >
                    <ExternalLink className="w-3.5 h-3.5 text-brand-600" />
                </Button>
            </td>
        </tr>
    );
});
FormRow.displayName = 'FormRow';

const FormMobileCard = memo(({ form }: { form: FormData }) => {
    const handleOpenBuilder = useCallback(() => {
        window.open(`/builder/${form.form_code}`, '_blank');
    }, [form.form_code]);

    return (
        <div className="bg-white border border-gray-100 rounded-xl p-3.5 space-y-2.5">
            <div className="flex items-center justify-between">
                <span className="font-mono text-xs font-semibold text-brand-600 bg-brand-600/10 px-2 py-1 rounded">
                    {form.form_code}
                </span>
                <StatusBadge status={form.form_status} />
            </div>
            <p className="text-sm font-semibold text-gray-800">{form.form_name}</p>
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-3 text-xs text-gray-500">
                    <span className="inline-flex items-center gap-1">
                        <FileSpreadsheet className="w-3 h-3" />
                        {form.form_type}
                    </span>
                    <span>{formatThaiDate(form.created_at)}</span>
                </div>
                <Button
                    variant="outline"
                    size="sm"
                    onClick={handleOpenBuilder}
                    className="h-7 px-2.5 text-xs font-medium text-brand-600 border-brand-600/30 hover:bg-brand-600/10"
                >
                    <ExternalLink className="w-3 h-3" />
                </Button>
            </div>
        </div>
    );
});
FormMobileCard.displayName = 'FormMobileCard';

// ===================== TABLE FORM =====================

export const TableForm = memo(({ data, isLoading, error, onRetry }: TableFormProps) => {
    const [searchTerm, setSearchTerm] = useState('');

    const handleSearchChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
        setSearchTerm(e.target.value);
    }, []);

    const handleClearSearch = useCallback(() => setSearchTerm(''), []);

    const filteredData = useMemo(() => {
        if (!searchTerm.trim()) return data;
        const term = searchTerm.toLowerCase();
        return data.filter(form =>
            form.form_code?.toLowerCase().includes(term) ||
            form.form_name?.toLowerCase().includes(term) ||
            form.form_type?.toLowerCase().includes(term)
        );
    }, [data, searchTerm]);

    // js-early-exit: Handle error state first
    if (error) {
        return <ErrorState message={error} onRetry={onRetry} />;
    }

    return (
        <TableWrapper>
            <TableHeader
                icon={<FileSpreadsheet className="w-5 h-5" />}
                title="รายการแบบฟอร์ม"
                subtitle={`${filteredData.length.toLocaleString()} รายการ (จาก ${data.length.toLocaleString()} รายการ)`}
                actions={<ExcelButton />}
                searchValue={searchTerm}
                onSearchChange={handleSearchChange}
                onSearchClear={handleClearSearch}
                searchPlaceholder="ค้นหารหัสฟอร์ม, ชื่อ, ประเภท..."
            />

            {/* Content */}
            {isLoading ? (
                <div className="p-4"><TableSkeleton rows={8} /></div>
            ) : filteredData.length === 0 ? (
                <FormEmptyState />
            ) : (
                <>
                    {/* Desktop Table */}
                    <div className="hidden lg:block overflow-x-auto">
                        <table className="w-full">
                            <TableHead columns={FORM_COLUMNS} />
                            <tbody>
                                {filteredData.map(form => (
                                    <FormRow key={form.id} form={form} />
                                ))}
                            </tbody>
                        </table>
                    </div>

                    {/* Mobile Cards */}
                    <div className="lg:hidden p-3 space-y-2.5">
                        {filteredData.map(form => (
                            <FormMobileCard key={form.id} form={form} />
                        ))}
                    </div>
                </>
            )}
        </TableWrapper>
    );
});
TableForm.displayName = 'TableForm';
