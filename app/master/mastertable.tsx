'use client';
import React, { useState, useMemo, useCallback, memo } from "react";
import { Button } from "@/components/ui/button";
import { TableSkeleton } from "@/components/ui/loading";
import {
    FileSpreadsheet, Search, X, Users, ChevronDown, ChevronRight,
    Building2, MapPin, Briefcase, AlertCircle, RotateCcw,
    ChevronLeft, ChevronRight as ChevronRightNav,
    CaseUpper, Eye
} from "lucide-react";
import { UserDetailSheet } from './user-detail-sheet';
import type { UserData } from '@/components/profile-form';
export type { UserData } from '@/components/profile-form';

interface MasterTableProps {
    data: UserData[];
    isLoading: boolean;
    error: string | null;
    onRetry: () => void;
}

interface DepartmentGroup {
    department: string;
    users: UserData[];
}

// rendering-hoist-jsx: Hoist static constants outside component
const ITEMS_PER_PAGE = 20;

// Columns for grouped table (no department column — it's in group header)
const GROUP_COLUMNS: { key: string; label: string }[] = [
    { key: 'employee_id', label: 'รหัสพนักงาน' },
    { key: 'firstname', label: 'ชื่อ-นามสกุล' },
    { key: 'site', label: 'สาขา' },
    { key: 'position', label: 'ตำแหน่ง' },
    { key: 'position_level', label: 'ระดับ' },
    { key: 'employee_status', label: 'สถานะ' },
    { key: 'actions', label: 'จัดการ' },
];

// rendering-hoist-jsx: Static status config
const STATUS_STYLES: Record<string, string> = {
    active: 'bg-emerald-50 text-emerald-700 border-emerald-200',
    inactive: 'bg-red-50 text-red-700 border-red-200',
    probation: 'bg-amber-50 text-amber-700 border-amber-200',
};

const getStatusStyle = (status: string | null): string => {
    if (!status) return 'bg-gray-50 text-gray-500 border-gray-200';
    return STATUS_STYLES[status.toLowerCase()] || 'bg-gray-50 text-gray-600 border-gray-200';
};

// rendering-hoist-jsx: Static position level ranking map
const POSITION_LEVEL_MAP: Record<string, number> = {
    'Chief Executive Officer': 9,
    'C-Level': 8,
    'Deputy C-level': 7,
    'Senior Manager': 6,
    'Manager': 5,
    'Assistant Manager': 4,
    'Supervisor': 3,
    'Assistant Supervisor': 2,
    'Officer': 1,
};

// Parse position_level to number for sorting (higher = first)
const parseLevelNum = (level: string | null): number => {
    if (!level) return -1;
    const mapped = POSITION_LEVEL_MAP[level];
    if (mapped !== undefined) return mapped;
    // Fallback: try case-insensitive match
    const lower = level.toLowerCase();
    for (const [key, val] of Object.entries(POSITION_LEVEL_MAP)) {
        if (key.toLowerCase() === lower) return val;
    }
    // Fallback: try parsing as number
    const num = parseFloat(level);
    return isNaN(num) ? 0 : num;
};

// ===================== SUB COMPONENTS (rerender-memo) =====================

const StatusBadge = memo(({ status }: { status: string | null }) => (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 text-xs font-medium rounded-full border ${getStatusStyle(status)}`}>
        <span className="w-1.5 h-1.5 rounded-full bg-current shrink-0" />
        {status || '-'}
    </span>
));
StatusBadge.displayName = 'StatusBadge';

const EmptyState = memo(() => (
    <div className="flex flex-col items-center gap-3 py-16">
        <div className="w-14 h-14 bg-gray-100 rounded-2xl flex items-center justify-center">
            <Users className="w-6 h-6 text-gray-400" />
        </div>
        <p className="text-sm text-gray-500 font-medium">ไม่พบข้อมูลพนักงาน</p>
        <p className="text-xs text-gray-400">ลองปรับเงื่อนไขการค้นหา</p>
    </div>
));
EmptyState.displayName = 'EmptyState';

// Department group header row (desktop)
const DepartmentHeaderRow = memo(({ department, count, isOpen, onToggle }: {
    department: string; count: number; isOpen: boolean; onToggle: () => void;
}) => (
    <tr
        className="bg-[#026a75]/5 cursor-pointer hover:bg-[#026a75]/10 transition-colors select-none"
        onClick={onToggle}
    >
        <td colSpan={GROUP_COLUMNS.length} className="px-4 py-2.5">
            <div className="flex items-center gap-2.5">
                {isOpen
                    ? <ChevronDown className="w-4 h-4 text-[#026a75] shrink-0" />
                    : <ChevronRight className="w-4 h-4 text-[#026a75] shrink-0" />
                }
                <Building2 className="w-4 h-4 text-[#026a75] shrink-0" />
                <span className="text-sm font-semibold text-[#026a75]">
                    {department || 'ไม่ระบุแผนก'}
                </span>
                <span className="text-[11px] text-[#026a75]/60 font-medium bg-[#026a75]/10 px-2 py-0.5 rounded-full">
                    {count} คน
                </span>
            </div>
        </td>
    </tr>
));
DepartmentHeaderRow.displayName = 'DepartmentHeaderRow';

// User row in desktop table
const UserRow = memo(({ user, onView }: { user: UserData; onView: (u: UserData) => void }) => (
    <tr className="transition-colors hover:bg-gray-50/80 even:bg-gray-50/40">
        <td className="whitespace-nowrap px-4 py-2.5 pl-11">
            <span className="font-mono text-xs font-semibold text-[#026a75]">
                {user.employee_id}
            </span>
        </td>
        <td className="whitespace-nowrap px-4 py-2.5">
            <div className="flex items-center gap-2.5">
                <div className="w-7 h-7 rounded-lg flex items-center justify-center text-[10px] font-bold shrink-0 bg-[#026a75]/10 text-[#026a75]">
                    {(user.email?.charAt(0)).toUpperCase()}{(user.email?.charAt(user.email.indexOf('@') - 1)).toUpperCase()}
                </div>
                <div className="min-w-0">
                    <p className="text-sm font-medium text-gray-800 truncate">{user.firstname} {user.lastname}</p>
                    <p className="text-[11px] text-gray-400 truncate">{user.email}</p>
                </div>
            </div>
        </td>
        <td className="whitespace-nowrap px-4 py-2.5 text-sm text-gray-600">
            {user.site || '-'}
        </td>
        <td className="max-w-50 px-4 py-2.5 text-sm text-gray-600 truncate" title={user.position}>
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


const UserMobileCard = memo(({ user, onView }: { user: UserData; onView: (u: UserData) => void }) => (
    <div className="bg-white border border-gray-100 rounded-xl p-3.5 space-y-2">
        <div className="flex items-center justify-between">
            <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-lg flex items-center justify-center text-[10px] font-bold shrink-0 bg-[#026a75]/10 text-[#026a75]">
                    {(user.email?.charAt(0)).toUpperCase()}{(user.email?.charAt(user.email.indexOf('@') - 1)).toUpperCase()}
                </div>
                <div className="min-w-0">
                    <p className="text-sm font-semibold text-gray-800 truncate">{user.firstname} {user.lastname}</p>
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

// Mobile department group
const MobileDepartmentGroup = memo(({ group, isOpen, onToggle, onViewUser }: {
    group: DepartmentGroup; isOpen: boolean; onToggle: () => void; onViewUser: (u: UserData) => void;
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
                {group.department || 'ไม่ระบุแผนก'}
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

// ===================== MAIN COMPONENT =====================
export const MasterTable = memo(({ data, isLoading, error, onRetry }: MasterTableProps) => {
    const [searchTerm, setSearchTerm] = useState('');
    const [collapsedDeps, setCollapsedDeps] = useState<Set<string>>(new Set());
    const [selectedUser, setSelectedUser] = useState<UserData | null>(null);
    const [sheetOpen, setSheetOpen] = useState(false);

    const handleViewUser = useCallback((user: UserData) => {
        setSelectedUser(user);
        setSheetOpen(true);
    }, []);

    const handleSearchChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
        setSearchTerm(e.target.value);
    }, []);

    const handleClearSearch = useCallback(() => {
        setSearchTerm('');
    }, []);

    const toggleDepartment = useCallback((dept: string) => {
        setCollapsedDeps(prev => {
            const next = new Set(prev);
            if (next.has(dept)) {
                next.delete(dept);
            } else {
                next.add(dept);
            }
            return next;
        });
    }, []);

    const expandAll = useCallback(() => setCollapsedDeps(new Set()), []);
    const collapseAll = useCallback(() => {
        setCollapsedDeps(prev => {
            const allDeps = new Set(data.map(u => u.department || ''));
            return allDeps;
        });
    }, [data]);

    const { groups, totalFiltered } = useMemo(() => {
        let filtered = data;

        if (searchTerm.trim()) {
            const term = searchTerm.toLowerCase();
            filtered = data.filter(u =>
                u.employee_id?.toLowerCase().includes(term) ||
                u.firstname?.toLowerCase().includes(term) ||
                u.lastname?.toLowerCase().includes(term) ||
                u.department?.toLowerCase().includes(term) ||
                u.site?.toLowerCase().includes(term) ||
                u.position?.toLowerCase().includes(term) ||
                u.email?.toLowerCase().includes(term)
            );
        }

        const groupMap = new Map<string, UserData[]>();
        for (const user of filtered) {
            const dept = user.department || '';
            const arr = groupMap.get(dept);
            if (arr) {
                arr.push(user);
            } else {
                groupMap.set(dept, [user]);
            }
        }

        const result: DepartmentGroup[] = [];
        for (const [dept, users] of groupMap) {
            users.sort((a, b) => parseLevelNum(b.position_level) - parseLevelNum(a.position_level));
            result.push({ department: dept, users });
        }

        // Sort departments alphabetically
        result.sort((a, b) => a.department.localeCompare(b.department, 'th'));

        return { groups: result, totalFiltered: filtered.length };
    }, [data, searchTerm]);

    // Error state
    if (error) {
        return (
            <div className="overflow-hidden rounded-2xl border border-red-100 bg-white shadow-sm">
                <div className="flex flex-col items-center gap-4 p-12">
                    <div className="w-14 h-14 bg-red-50 rounded-2xl flex items-center justify-center">
                        <AlertCircle className="w-6 h-6 text-red-400" />
                    </div>
                    <div className="text-center">
                        <p className="text-sm font-medium text-gray-700">{error}</p>
                        <p className="text-xs text-gray-400 mt-1">กรุณาลองใหม่อีกครั้ง</p>
                    </div>
                    <Button variant="outline" onClick={onRetry} className="gap-2 rounded-xl">
                        <RotateCcw className="w-4 h-4" />
                        ลองใหม่
                    </Button>
                </div>
            </div>
        );
    }

    return (
        <div className="overflow-hidden rounded-2xl border border-gray-100 bg-white shadow-sm">

            {/* ── Header ── */}
            <div className="bg-linear-to-r from-[#026a75] to-[#037a86] px-4 sm:px-6 py-4 sm:py-5">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                    <div>
                        <h2 className="text-lg font-bold text-white flex items-center gap-2">
                            <Users className="w-5 h-5" />
                            ข้อมูลองค์กร
                        </h2>
                        <p className="text-white/60 text-xs mt-0.5">
                            {groups.length} แผนก · {totalFiltered.toLocaleString()} คน (จาก {data.length.toLocaleString()} รายการ)
                        </p>
                    </div>

                    <div className="flex items-center gap-2">
                        <button
                            className="bg-emerald-500/20 border border-emerald-300/30 hover:bg-emerald-500/30 text-white px-3 py-2 rounded-xl flex items-center gap-2 text-sm font-medium transition-all duration-200 cursor-pointer"
                        >
                            <FileSpreadsheet className="w-4 h-4" />
                            <span className="hidden sm:inline">Excel</span>
                        </button>
                    </div>
                </div>

                {/* Search */}
                <div className="relative mt-3">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                    <input
                        type="text"
                        value={searchTerm}
                        onChange={handleSearchChange}
                        placeholder="ค้นหาชื่อ, รหัส, แผนก, สาขา..."
                        className="w-1/3 h-10 pl-10 pr-10 bg-[#f6fefffd] border border-white/15 rounded-xl text-sm text-gray-800 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-[#026a75] focus:ring-opacity-50 transition-all"
                    />
                    {searchTerm && (
                        <button onClick={handleClearSearch} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 transition-colors cursor-pointer">
                            <X className="w-4 h-4" />
                        </button>
                    )}
                </div>
            </div>

            {/* ── Toolbar ── */}
            {!isLoading && groups.length > 0 && (
                <div className="px-4 sm:px-6 py-2.5 border-b border-gray-100 flex items-center justify-between bg-gray-50/50">
                    <p className="text-[11px] text-gray-400">
                        จัดกลุ่มตามแผนก · เรียงตามระดับตำแหน่ง (มาก → น้อย)
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

            {/* Card Stat : พนักงานทั้งหมด ,  */}

            {isLoading ? (
                <div className="p-4">
                    <TableSkeleton rows={8} />
                </div>
            ) : groups.length === 0 ? (
                <EmptyState />
            ) : (
                <>
                    {/* ── Desktop Grouped Table ── */}
                    <div className="hidden lg:block overflow-x-auto">
                        <table className="w-full">
                            <thead>
                                <tr className="bg-gray-50 border-b border-gray-100">
                                    {GROUP_COLUMNS.map(col => (
                                        <th
                                            key={col.key}
                                            className="px-4 py-2.5 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider select-none"
                                        >
                                            {col.label}
                                        </th>
                                    ))}
                                </tr>
                            </thead>
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

                    {/* ── Mobile Grouped Cards ── */}
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

            {/* ── User Detail Sheet ── */}
            <UserDetailSheet
                user={selectedUser}
                open={sheetOpen}
                onOpenChange={setSheetOpen}
            />
        </div>
    );
});
MasterTable.displayName = 'MasterTable';
