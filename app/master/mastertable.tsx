'use client';

import React, { useState, useMemo, useCallback, useEffect, memo } from 'react';
import { Button } from '@/components/ui/button';
import { TableSkeleton } from '@/components/ui/loading';
import {
    FileSpreadsheet, Users, ChevronDown, ChevronRight,
    Building2, MapPin, Briefcase, Eye, ExternalLink, UserPlus
} from 'lucide-react';
import { UserDetailSheet } from './user-detail-sheet';
import { AddUserDialog } from './add-user-dialog';

// Local imports - bundle-barrel-imports: Import directly
import {
    USER_COLUMNS, FORM_COLUMNS,
    parseLevelNum, formatThaiDate, getUserInitials
} from './constants';
import {
    StatusBadge, UserEmptyState, FormEmptyState, ErrorState,
    TableHeader, TableWrapper, TableHead, ExcelButton
} from './shared-components';
import type {
    UserData, FormData, DepartmentGroup,
    MasterTableProps, TableFormProps
} from './types';

// Re-export types for external use
export type { UserData, FormData } from './types';

// ===================== USER TABLE SUB-COMPONENTS =====================

const DepartmentHeaderRow = memo(({
    department, count, isOpen, onToggle
}: {
    department: string;
    count: number;
    isOpen: boolean;
    onToggle: () => void;
}) => (
    <tr
        className="bg-[#026a75]/5 cursor-pointer hover:bg-[#026a75]/10 transition-colors select-none"
        onClick={onToggle}
    >
        <td colSpan={USER_COLUMNS.length} className="px-4 py-2.5">
            <div className="flex items-center gap-2.5">
                {isOpen
                    ? <ChevronDown className="w-4 h-4 text-[#026a75] shrink-0" />
                    : <ChevronRight className="w-4 h-4 text-[#026a75] shrink-0" />
                }
                <Building2 className="w-4 h-4 text-[#026a75] shrink-0" />
                <span className="text-sm font-semibold text-[#026a75]">
                    {department || 'ไม่ระบุฝ่าย'}
                </span>
                <span className="text-[11px] text-[#026a75]/60 font-medium bg-[#026a75]/10 px-2 py-0.5 rounded-full">
                    {count} คน
                </span>
            </div>
        </td>
    </tr>
));
DepartmentHeaderRow.displayName = 'DepartmentHeaderRow';

const UserRow = memo(({
    user, onView
}: {
    user: UserData;
    onView: (u: UserData) => void
}) => (
    <tr className="transition-colors hover:bg-gray-50/80 even:bg-gray-50/40">
        <td className="whitespace-nowrap px-4 py-2.5 pl-11">
            <span className="font-mono text-xs font-semibold text-[#026a75]">
                {user.employee_id}
            </span>
        </td>
        <td className="whitespace-nowrap px-4 py-2.5">
            <div className="flex items-center gap-2.5">
                <div className="w-7 h-7 rounded-lg flex items-center justify-center text-[10px] font-bold shrink-0 bg-[#026a75]/10 text-[#026a75]">
                    {getUserInitials(user.email)}
                </div>
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
                <span className="inline-flex items-center gap-1.5 h-6 px-2 text-xs font-medium rounded-md bg-[#026a75]/10 text-[#026a75]">
                    <span className="font-bold">Lv.{parseLevelNum(user.position_level)}</span>
                    <span className="text-[#026a75]/60">{user.position_level}</span>
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
                className="inline-flex items-center justify-center w-7 h-7 rounded-lg text-gray-400 hover:text-[#026a75] hover:bg-[#026a75]/10 transition-colors cursor-pointer"
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
                <div className="w-8 h-8 rounded-lg flex items-center justify-center text-[10px] font-bold shrink-0 bg-[#026a75]/10 text-[#026a75]">
                    {getUserInitials(user.email)}
                </div>
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
                    <span className="inline-flex items-center gap-1 px-1.5 py-0.5 text-[10px] font-bold rounded-md bg-[#026a75]/10 text-[#026a75]">
                        Lv.{parseLevelNum(user.position_level)} · {user.position_level}
                    </span>
                </div>
            )}
        </div>
    </div>
));
UserMobileCard.displayName = 'UserMobileCard';

const MobileDepartmentGroup = memo(({
    group, isOpen, onToggle, onViewUser
}: {
    group: DepartmentGroup;
    isOpen: boolean;
    onToggle: () => void;
    onViewUser: (u: UserData) => void;
}) => (
    <div className="border border-gray-100 rounded-xl overflow-hidden">
        <button
            onClick={onToggle}
            className="w-full flex items-center gap-2.5 px-3.5 py-3 bg-[#026a75]/5 hover:bg-[#026a75]/10 transition-colors"
        >
            {isOpen
                ? <ChevronDown className="w-4 h-4 text-[#026a75] shrink-0" />
                : <ChevronRight className="w-4 h-4 text-[#026a75] shrink-0" />
            }
            <Building2 className="w-4 h-4 text-[#026a75] shrink-0" />
            <span className="text-sm font-semibold text-[#026a75] flex-1 text-left truncate">
                {group.department || 'ไม่ระบุฝ่าย'}
            </span>
            <span className="text-[11px] text-[#026a75]/60 font-medium bg-[#026a75]/10 px-2 py-0.5 rounded-full shrink-0">
                {group.users.length} คน
            </span>
        </button>
        {isOpen && (
            <div className="p-2.5 space-y-2 bg-gray-50/50">
                {group.users.map(user => (
                    <UserMobileCard key={user.id} user={user} onView={onViewUser} />
                ))}
            </div>
        )}
    </div>
));
MobileDepartmentGroup.displayName = 'MobileDepartmentGroup';

// ===================== MASTER TABLE (USER) =====================

export const MasterTable = memo(({ data, isLoading, error, onRetry, onUpdate, onAdd }: MasterTableProps) => {
    const [searchTerm, setSearchTerm] = useState('');
    const [collapsedDeps, setCollapsedDeps] = useState<Set<string>>(new Set());
    const [selectedUser, setSelectedUser] = useState<UserData | null>(null);
    const [sheetOpen, setSheetOpen] = useState(false);
    const [addDialogOpen, setAddDialogOpen] = useState(false);

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

    const toggleDepartment = useCallback((dept: string) => {
        setCollapsedDeps(prev => {
            const next = new Set(prev);
            next.has(dept) ? next.delete(dept) : next.add(dept);
            return next;
        });
    }, []);

    const expandAll = useCallback(() => setCollapsedDeps(new Set()), []);

    const collapseAll = useCallback(() => {
        const allDeps = new Set(data.map(u => u.department || ''));
        setCollapsedDeps(allDeps);
    }, [data]);

    // js-combine-iterations: Single pass for filter + group
    const { groups, totalFiltered } = useMemo(() => {
        const term = searchTerm.trim().toLowerCase();
        const groupMap = new Map<string, UserData[]>();
        let count = 0;

        for (const user of data) {
            // Filter
            if (term) {
                const matches =
                    user.employee_id?.toLowerCase().includes(term) ||
                    user.firstname?.toLowerCase().includes(term) ||
                    user.lastname?.toLowerCase().includes(term) ||
                    user.department?.toLowerCase().includes(term) ||
                    user.site?.toLowerCase().includes(term) ||
                    user.position?.toLowerCase().includes(term) ||
                    user.email?.toLowerCase().includes(term);
                if (!matches) continue;
            }

            // Group
            const dept = user.department || '';
            const arr = groupMap.get(dept);
            if (arr) {
                arr.push(user);
            } else {
                groupMap.set(dept, [user]);
            }
            count++;
        }

        // Sort and build result
        const result: DepartmentGroup[] = [];
        for (const [dept, users] of groupMap) {
            users.sort((a, b) => parseLevelNum(b.position_level) - parseLevelNum(a.position_level));
            result.push({ department: dept, users });
        }
        result.sort((a, b) => a.department.localeCompare(b.department, 'th'));

        return { groups: result, totalFiltered: count };
    }, [data, searchTerm]);

    // js-early-exit: Handle error state first
    if (error) {
        return <ErrorState message={error} onRetry={onRetry} />;
    }

    return (
        <TableWrapper>
            <TableHeader
                icon={<Users className="w-5 h-5" />}
                title="ข้อมูลองค์กร"
                subtitle={`${groups.length} ฝ่าย · ${totalFiltered.toLocaleString()} คน (จาก ${data.length.toLocaleString()} รายการ)`}
                actions={
                    <>
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
                searchPlaceholder="ค้นหาชื่อ, รหัส, ฝ่าย, สาขา..."
            />

            {/* Toolbar */}
            {!isLoading && groups.length > 0 && (
                <div className="px-4 sm:px-6 py-2.5 border-b border-gray-100 flex items-center justify-between bg-gray-50/50">
                    <p className="text-[11px] text-gray-400">
                        จัดกลุ่มตามฝ่าย · เรียงตามระดับตำแหน่ง (มาก → น้อย)
                    </p>
                    <div className="flex items-center gap-1.5">
                        <button onClick={expandAll} className="text-[11px] text-[#026a75] hover:underline cursor-pointer px-1.5 py-0.5">
                            ขยายทั้งหมด
                        </button>
                        <span className="text-gray-300">|</span>
                        <button onClick={collapseAll} className="text-[11px] text-[#026a75] hover:underline cursor-pointer px-1.5 py-0.5">
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
                                    const isOpen = !collapsedDeps.has(group.department);
                                    return (
                                        <React.Fragment key={group.department}>
                                            <DepartmentHeaderRow
                                                department={group.department}
                                                count={group.users.length}
                                                isOpen={isOpen}
                                                onToggle={() => toggleDepartment(group.department)}
                                            />
                                            {isOpen && group.users.map(user => (
                                                <UserRow key={user.id} user={user} onView={handleViewUser} />
                                            ))}
                                        </React.Fragment>
                                    );
                                })}
                            </tbody>
                        </table>
                    </div>

                    {/* Mobile Cards */}
                    <div className="lg:hidden p-3 space-y-2.5">
                        {groups.map(group => (
                            <MobileDepartmentGroup
                                key={group.department}
                                group={group}
                                isOpen={!collapsedDeps.has(group.department)}
                                onToggle={() => toggleDepartment(group.department)}
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
                allUsers={data}
            />

            {onAdd && (
                <AddUserDialog
                    open={addDialogOpen}
                    onOpenChange={setAddDialogOpen}
                    onAdd={onAdd}
                />
            )}
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
                <span className="font-mono text-xs font-semibold text-[#026a75] bg-[#026a75]/10 px-2 py-1 rounded">
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
                    className="cursor-pointer hover:scale-110 h-8 px-3 text-xs font-medium text-[#026a75] border-[#026a75]/30 hover:bg-[#026a75]/10 hover:border-[#026a75] transition-colors"
                >
                    <ExternalLink className="w-3.5 h-3.5 text-[#026a75]" />
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
                <span className="font-mono text-xs font-semibold text-[#026a75] bg-[#026a75]/10 px-2 py-1 rounded">
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
                    className="h-7 px-2.5 text-xs font-medium text-[#026a75] border-[#026a75]/30 hover:bg-[#026a75]/10"
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
