'use client';
import { Ticket } from "@/app/mytickets/[id]/page";
import { FileSpreadsheet, User, Calendar, Eye, FileText, Loader2, Clock, CheckCircle, XCircle, CircleIcon, ArrowUp, ArrowDown, Filter, Search, X, Star, ExternalLink, Computer, Laptop } from "lucide-react";
import { useState, useMemo, useEffect, useRef, useCallback } from "react";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from "@/components/ui/sheet";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Textarea } from "@/components/ui/textarea";
import { STATUS_CONFIG } from "./types";
import { Button } from "@/components/ui/button";
import type { formSetup } from "@/app/service/[[...slug]]/page";
import { renderFormField, buildSubmitValues, prefillFormValues, formatDatetime } from "@/components/renderForm";
import { SelectStatus } from "@/components/ui/selectstatus"

const showSwal = (options: any) => import('sweetalert2').then(({ default: Swal }) => Swal.fire(options));
import { useSessionContext } from "@/app/context/SessionContext";

// ===================== CONSTANTS =====================
const ITEMS_PER_PAGE = 10;
const BadgeStatusMap: Record<string, { label: string; className: string }> = {
    'Open': { label: 'Open', className: 'bg-blue-100 text-blue-800 border-blue-200' },
    'In Progress': { label: 'In Progress', className: 'bg-yellow-100 text-yellow-800 border-yellow-200' },
    'Done': { label: 'Done', className: 'bg-green-100 text-green-800 border-green-200' },
    'Rejected': { label: 'Rejected', className: 'bg-red-100 text-red-800 border-red-200' },
    'Backlog': { label: 'Backlog', className: 'bg-purple-100 text-purple-800 border-purple-200' },
}

// ===================== SUB COMPONENTS =====================
const StatusBadge = ({ status }: { status: string }) => {
    const config = STATUS_CONFIG[status] || BadgeStatusMap[status] || { label: status, className: 'bg-gray-100 text-gray-800 border-gray-200' };
    return (
        <span className={`inline-block px-1 sm:px-3 py-1 text-xs sm:text-sm font-medium rounded-full border ${config.className}`}>
            {config.label}
        </span>
    );
};

const APPROVAL_STATUS_CONFIG: Record<string, { label: string; className: string }> = {
    'Approved': {
        label: 'อนุมัติแล้ว',
        className: 'text-emerald-600 bg-emerald-50'
    },
    'In Progress': {
        label: 'รออนุมัติ',
        className: 'text-amber-600 bg-amber-50'
    },
    'Rejected': {
        label: 'ปฏิเสธ',
        className: 'text-red-600 bg-red-50'
    },
};

const ApprovalBadge = ({ status }: { status: string }) => {
    if (!status) return null;
    const config = APPROVAL_STATUS_CONFIG[status];
    if (!config) return null;
    return (
        <span className={`inline-flex items-center gap-1 px-1.5 py-0.5 text-[10px] font-medium rounded-full ml-2 ${config.className}`}>
            <span className="w-1.5 h-1.5 rounded-full bg-current" />
            {config.label}
        </span>
    );
};

const UserAvatar = ({ email, imageUrl }: { email: string; imageUrl?: string }) => (
    <div className="relative shrink-0">
        {imageUrl ? (
            <img
                src={imageUrl}
                alt={email}
                className="w-11 h-11 rounded-full object-cover shadow-md ring-2 ring-white"
                onError={(e) => {
                    const target = e.target as HTMLImageElement;
                    target.style.display = 'none';
                    target.nextElementSibling?.classList.remove('hidden');
                }}
            />
        ) :
            <div className={`w-11 h-11 bg-linear-to-br from-[#026a75] to-[#034d54] rounded-full flex items-center justify-center text-white font-semibold text-base shadow-md ring-2 ring-white`}>
                {(email || '?').charAt(0).toUpperCase()}
            </div>
        }
    </div>
);

const PaginationControls = ({ currentPage, totalPages, onPageChange, variant = 'light' }: {
    currentPage: number;
    totalPages: number;
    onPageChange: (page: number) => void;
    variant?: 'light' | 'dark';
}) => {
    const isDark = variant === 'dark';
    const btnClass = isDark
        ? "px-3 py-1 border text-white rounded hover:bg-gray-100 hover:text-gray-600 disabled:opacity-40"
        : "px-3 py-1 border rounded hover:bg-gray-100 disabled:opacity-40";
    const textClass = isDark ? "text-gray-200" : "text-gray-600";

    return (
        <div className="flex items-center gap-2 text-sm">
            <button disabled={currentPage === 1} onClick={() => onPageChange(currentPage - 1)} className={btnClass}>
                ก่อนหน้า
            </button>
            <span className={textClass}>หน้า {currentPage} จาก {totalPages || 1}</span>
            <button disabled={currentPage >= totalPages} onClick={() => onPageChange(currentPage + 1)} className={btnClass}>
                ถัดไป
            </button>
        </div>
    );
};

const LoadingRow = () => (
    <tr className="animate-pulse">
        <td className="px-6 py-4">
            <div className="flex items-center gap-4">
                <div className="w-11 h-11 bg-gray-200 rounded-full" />
                <div className="space-y-2">
                    <div className="h-4 bg-gray-200 rounded w-48" />
                    <div className="h-3 bg-gray-200 rounded w-32" />
                </div>
            </div>
        </td>
        <td className="px-4 py-4"><div className="h-6 bg-gray-200 rounded-full w-20" /></td>
        <td className="px-4 py-4"><div className="h-4 bg-gray-200 rounded w-32" /></td>
        <td className="px-4 py-4"><div className="h-8 w-8 bg-gray-200 rounded-lg mx-auto" /></td>
    </tr>
);

const MobileLoadingCard = () => (
    <div className="border-b border-gray-200 p-4 animate-pulse">
        <div className="flex justify-between items-start mb-3">
            <div className="space-y-2">
                <div className="h-5 bg-gray-200 rounded w-40" />
                <div className="h-4 bg-gray-200 rounded w-28" />
            </div>
            <div className="h-6 bg-gray-200 rounded-full w-16" />
        </div>
        <div className="flex gap-2 mt-4">
            <div className="flex-1 h-10 bg-gray-200 rounded-lg" />
        </div>
    </div>
);

const EmptyState = ({ colSpan }: { colSpan?: number }) => (
    colSpan ? (
        <tr>
            <td colSpan={colSpan} className="px-6 py-16 text-center text-gray-500">
                <FileText size={56} className="mx-auto mb-4 text-gray-300" />
                <p className="text-lg">ไม่พบข้อมูลคำร้อง</p>
            </td>
        </tr>
    ) : (
        <div className="p-12 text-center text-gray-500">
            <FileText size={56} className="mx-auto mb-4 text-gray-300" />
            <p className="text-lg">ไม่พบข้อมูลคำร้อง</p>
        </div>
    )
);

// ===================== TAB OPTIONS =====================
const TAB_OPTIONS = [
    { value: 'apv', label: 'งานรออนุมัติ' },
    { value: 'my', label: 'งานของฉัน' },
    { value: 'suv', label: 'แบบประเมิน' },
] as const;

export type TabType = 'my' | 'apv' | 'suv';
export type SortOrder = 'asc' | 'desc';
export type SurveyFilter = 'evaluated' | 'not-evaluated' | 'all';

// Filter status options
const STATUS_OPTIONS = [
    { value: 'all', label: 'ทั้งหมด' },
    { value: 'Open', label: 'Open' },
    { value: 'In Progress', label: 'In Progress' },
    { value: 'Done', label: 'Done' },
    { value: 'Rejected', label: 'Rejected' },
    { value: 'Backlog', label: 'Backlog' },
] as const;

// ===================== MAIN COMPONENT =====================
export const DataTable = ({
    data,
    title,
    loading,
    handleExportExcel,
    onViewTicket,
    activeTab,
    onTabChange,
    role,
    surveyFilter,
    onSurveyFilterChange
}: {
    data: Ticket[];
    title: string;
    loading: boolean;
    handleExportExcel: () => void;
    onViewTicket: (ticket: Ticket) => void;
    activeTab: TabType;
    onTabChange: (tab: TabType) => void;
    role?: string | null;
    surveyFilter?: SurveyFilter;
    onSurveyFilterChange?: (filter: SurveyFilter) => void;
}) => {
    const [currentPage, setCurrentPage] = useState(1);
    const [sortOrder, setSortOrder] = useState<SortOrder>('desc');
    const [filterStatus, setFilterStatus] = useState<string>('all');
    const [searchText, setSearchText] = useState<string>('');
    const [showFilters, setShowFilters] = useState(false);
    const currentSurveyFilter = surveyFilter ?? 'evaluated';


    const processedData = useMemo(() => {
        let result = [...data];

        if (filterStatus !== 'all') {
            result = result.filter(item => item.status === filterStatus);
        }

        if (activeTab === 'suv' && currentSurveyFilter === 'evaluated') {
            result = result.filter(item => !!item.point);
        }

        if (searchText.trim()) {
            const search = searchText.toLowerCase();
            result = result.filter(item =>
                item.form_name?.toLowerCase().includes(search) ||
                item.form_code?.toLowerCase().includes(search) ||
                item.created_by?.toLowerCase().includes(search) ||
                item.form_id?.toLowerCase().includes(search)
            );
        }

        result.sort((a, b) => {
            const dateA = new Date(a.created_at).getTime();
            const dateB = new Date(b.created_at).getTime();
            return sortOrder === 'desc' ? dateB - dateA : dateA - dateB;
        });

        return result;
    }, [data, sortOrder, filterStatus, searchText, activeTab, currentSurveyFilter]);

    const totalPages = Math.ceil(processedData.length / ITEMS_PER_PAGE);

    const paginatedTickets = useMemo(() => {
        const start = (currentPage - 1) * ITEMS_PER_PAGE;
        return processedData.slice(start, start + ITEMS_PER_PAGE);
    }, [processedData, currentPage]);

    const toggleSort = () => {
        setSortOrder(prev => prev === 'desc' ? 'asc' : 'desc');
    };

    const handleSurveyFilter = (filter: SurveyFilter) => {
        onSurveyFilterChange?.(filter);
        setCurrentPage(1);
    };

    const clearFilters = () => {
        setFilterStatus('all');
        if (activeTab === 'suv') handleSurveyFilter('evaluated');
        setSearchText('');
        setCurrentPage(1);
    };

    const hasActiveFilters = filterStatus !== 'all' || searchText.trim() !== '' || (activeTab === 'suv' && currentSurveyFilter !== 'evaluated');

    return (
        <section className="bg-white rounded-2xl shadow-xl border border-white/30 overflow-hidden relative">
            <div className="p-4 lg:p-5 bg-[#04555e]">
                {/* Top Row - Title and Actions */}
                <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-3">
                    <div className="flex items-center justify-between lg:justify-start gap-4">
                        <div>
                            <h2 className="text-lg lg:text-xl text-white font-semibold">{title}</h2>
                            <p className="text-white/70 text-xs lg:text-sm mt-0.5">
                                {hasActiveFilters
                                    ? `แสดง ${processedData.length} จาก ${data.length} รายการ`
                                    : `${processedData.length} รายการ`
                                }
                            </p>
                        </div>

                        {/* Mobile Actions */}
                        <div className="flex lg:hidden items-center gap-2">
                            <button
                                onClick={toggleSort}
                                className="flex items-center justify-center w-9 h-9 rounded-lg bg-white/10 text-white hover:bg-white/20 transition-all cursor-pointer"
                                title={sortOrder === 'desc' ? 'เรียงจากใหม่ไปเก่า' : 'เรียงจากเก่าไปใหม่'}
                            >
                                {sortOrder === 'desc' ? <ArrowDown size={16} /> : <ArrowUp size={16} />}
                            </button>

                            {/* Filter Toggle - Mobile */}
                            <button
                                onClick={() => setShowFilters(!showFilters)}
                                className={`flex items-center justify-center w-9 h-9 rounded-lg transition-all cursor-pointer relative ${showFilters || hasActiveFilters
                                    ? 'bg-white text-[#04555e]'
                                    : 'bg-white/10 text-white hover:bg-white/20'
                                    }`}
                            >
                                <Filter size={16} />
                                {hasActiveFilters && (
                                    <span className="absolute -top-1 -right-1 bg-emerald-500 text-white text-[10px] w-4 h-4 rounded-full flex items-center justify-center font-bold">
                                        {(filterStatus !== 'all' ? 1 : 0) + (searchText.trim() ? 1 : 0)}
                                    </span>
                                )}
                            </button>
                        </div>
                    </div>

                    {/* Actions Group - Desktop */}
                    <div className="hidden lg:flex items-center gap-2">
                        <div className="hidden lg:block relative">
                            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-white/60" />
                            <input
                                type="text"
                                placeholder="ค้นหา..."
                                value={searchText}
                                onChange={(e) => { setSearchText(e.target.value); setCurrentPage(1); }}
                                className="w-48 pl-8 pr-8 py-1.5 text-sm bg-white/10 border border-white/20 rounded-lg text-white placeholder:text-white/50 focus:outline-none focus:bg-white/20 focus:border-white/40 transition-all"
                            />
                            {searchText && (
                                <button
                                    onClick={() => setSearchText('')}
                                    className="absolute right-2 top-1/2 -translate-y-1/2 text-white/60 hover:text-white cursor-pointer"
                                >
                                    <X size={12} />
                                </button>
                            )}
                        </div>

                        {/* Filter Toggle */}
                        <button
                            onClick={() => setShowFilters(!showFilters)}
                            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium transition-all cursor-pointer ${showFilters || hasActiveFilters
                                ? 'bg-white text-[#04555e]'
                                : 'bg-white/10 text-white hover:bg-white/20 border border-white/20'
                                }`}
                            title="ตัวกรอง"
                        >
                            <Filter size={14} />
                            <span>ตัวกรอง</span>
                            {hasActiveFilters && (
                                <span className="bg-blue-400 animate-pulse text-white text-xs w-5 h-5 rounded-full flex items-center justify-center font-bold">
                                </span>
                            )}
                        </button>

                        {/* Excel Export */}
                        <button
                            onClick={handleExportExcel}
                            className="hidden lg:flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium bg-emerald-600 text-white hover:bg-emerald-500 transition-all cursor-pointer"
                            title="ส่งออก Excel"
                        >
                            <FileSpreadsheet size={14} />
                            <span>Excel</span>
                        </button>
                    </div>
                </div>

                {/* Pagination Row */}
                <div className="flex items-center justify-between mt-4 pt-3 border-t border-white/20">
                    {/* Mobile Search */}
                    <div className="lg:hidden relative flex-1 mr-3">
                        <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-white/60" />
                        <input
                            type="text"
                            placeholder="ค้นหาชื่อ, รหัส, ผู้สร้าง..."
                            value={searchText}
                            onChange={(e) => { setSearchText(e.target.value); setCurrentPage(1); }}
                            className="w-full pl-9 pr-9 py-2 text-sm bg-white/10 border border-white/20 rounded-xl text-white placeholder:text-white/50 focus:outline-none focus:bg-white/20 focus:border-white/40 transition-all"
                        />
                        {searchText && (
                            <button
                                onClick={() => setSearchText('')}
                                className="absolute right-3 top-1/2 -translate-y-1/2 text-white/60 hover:text-white cursor-pointer"
                            >
                                <X size={14} />
                            </button>
                        )}
                    </div>

                    <div className="hidden lg:block" />

                    {/* Mobile Pagination - Simplified */}
                    <div className="lg:hidden flex items-center gap-1.5">
                        <button
                            disabled={currentPage === 1}
                            onClick={() => setCurrentPage(currentPage - 1)}
                            className="w-8 h-8 flex items-center justify-center rounded-lg bg-white/10 text-white disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
                        >
                            <ArrowUp size={14} className="-rotate-90" />
                        </button>
                        <span className="text-white/80 text-xs px-2 min-w-12 text-center">{currentPage}/{totalPages || 1}</span>
                        <button
                            disabled={currentPage >= totalPages}
                            onClick={() => setCurrentPage(currentPage + 1)}
                            className="w-8 h-8 flex items-center justify-center rounded-lg bg-white/10 text-white disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
                        >
                            <ArrowUp size={14} className="rotate-90" />
                        </button>
                    </div>

                    {/* Desktop Pagination */}
                    <div className="hidden lg:block">
                        <PaginationControls
                            currentPage={currentPage}
                            totalPages={totalPages}
                            onPageChange={setCurrentPage}
                            variant="dark"
                        />
                    </div>
                </div>
            </div>

            {/* Filter Panel */}
            {showFilters && (
                <div className="p-3 lg:p-4 bg-linear-to-r from-gray-50 to-gray-100 border-b border-gray-200">
                    <div className="flex flex-col lg:flex-row lg:items-center gap-3">
                        {/* Status Filter Label */}
                        <div className="flex items-center justify-between lg:justify-start">
                            <span className="text-sm font-medium text-gray-700">เลือกสถานะ:</span>

                            {/* Clear Filters - Mobile */}
                            {hasActiveFilters && (
                                <button
                                    onClick={clearFilters}
                                    className="lg:hidden flex items-center gap-1 text-xs text-red-500 hover:text-red-600 cursor-pointer"
                                >
                                    <X size={12} />
                                    ล้าง
                                </button>
                            )}
                        </div>

                        {/* Status / Survey Filter Pills - Scrollable on Mobile */}
                        <div className="flex overflow-x-auto pb-1 lg:pb-0 -mx-3 px-3 lg:mx-0 lg:px-0 gap-2 scrollbar-hide">
                            {activeTab === 'suv' ? (
                                [{ value: 'evaluated' as const, label: 'ประเมินแล้ว' }, { value: 'not-evaluated' as const, label: 'ยังไม่ประเมิน' }].map(({ value, label }) => (
                                    <button
                                        key={value}
                                        onClick={() => handleSurveyFilter(value)}
                                        className={`shrink-0 px-3 py-1.5 rounded-full text-xs font-medium transition-all cursor-pointer border ${currentSurveyFilter === value
                                            ? 'bg-[#026a75] text-white border-[#026a75] shadow-sm'
                                            : 'bg-white text-gray-600 border-gray-300 hover:border-[#026a75] hover:text-[#026a75]'
                                            }`}
                                    >
                                        {label}
                                    </button>
                                ))
                            ) : (
                                STATUS_OPTIONS.map(({ value, label }) => (
                                    <button
                                        key={value}
                                        onClick={() => { setFilterStatus(value); setCurrentPage(1); }}
                                        className={`shrink-0 px-3 py-1.5 rounded-full text-xs font-medium transition-all cursor-pointer border ${filterStatus === value
                                            ? 'bg-[#026a75] text-white border-[#026a75] shadow-sm'
                                            : 'bg-white text-gray-600 border-gray-300 hover:border-[#026a75] hover:text-[#026a75]'
                                            }`}
                                    >
                                        {label}
                                    </button>
                                ))
                            )}
                        </div>

                        {/* Spacer - Desktop */}
                        <div className="hidden lg:block flex-1" />

                        {/* Clear Filters - Desktop */}
                        {hasActiveFilters && (
                            <button
                                onClick={clearFilters}
                                className="hidden lg:flex items-center gap-1.5 px-3 py-1.5 text-sm text-gray-500 hover:text-red-600 hover:bg-red-50 rounded-lg cursor-pointer transition-colors"
                            >
                                <X size={14} />
                                ล้างทั้งหมด
                            </button>
                        )}
                    </div>
                </div>
            )}

            {/* Loading Overlay */}
            {loading && (
                <div className="absolute inset-0 bg-white/75 backdrop-blur-sm flex items-center justify-center z-10">
                    <div className="flex flex-col items-center gap-4">
                        <div className="w-12 h-12 border-4 border-emerald-200 border-t-emerald-500 rounded-full animate-spin" />
                        <p className="text-gray-700 font-medium">กำลังค้นหาข้อมูล...</p>
                    </div>
                </div>
            )}

            {/* Mobile View */}
            <div className="block lg:hidden">
                {loading ? (
                    <div className="divide-y divide-gray-100">
                        {Array.from({ length: 3 }).map((_, i) => <MobileLoadingCard key={i} />)}
                    </div>
                ) : paginatedTickets.length === 0 ? (
                    <EmptyState />
                ) : (
                    <div className="divide-y divide-gray-100">
                        {paginatedTickets.map((item) => (
                            <div
                                key={activeTab === "suv" ? item.form_id : item.submission_id}
                                onClick={() => onViewTicket(item)}
                                className="p-4 active:bg-gray-100 transition-colors cursor-pointer"
                            >
                                {/* Card Header */}
                                <div className="flex items-start gap-2">
                                    <UserAvatar email={item.email} imageUrl={item.image_url} />
                                    <div className="flex-1 min-w-0">
                                        <div className="flex items-start">
                                            <div className="min-w-0 flex-1">
                                                <h3 className="font-semibold text-gray-800 text-sm truncate">{item.form_name}</h3>
                                                <div className="flex items-center mt-0.5">
                                                    <p className="text-xs text-[#026a75] font-medium">{item.form_code}</p>
                                                    <ApprovalBadge status={item.status_approve} />
                                                </div>
                                            </div>
                                            <StatusBadge status={item.status} />
                                        </div>

                                        {/* Meta Info */}
                                        <div className="flex items-center gap-3 mt-2 text-xs text-gray-500">
                                            <span className="flex items-center gap-1">
                                                <User size={11} />
                                                <span className="truncate max-w-20">{item.firstname} {item.lastname}</span>
                                            </span>
                                            <span className="flex items-center gap-1">
                                                <Calendar size={11} />
                                                {formatDatetime(item.created_at)}
                                            </span>
                                        </div>
                                    </div>

                                    {/* Arrow indicator */}
                                    <div className="shrink-0 self-center text-gray-400">
                                        <ArrowUp size={16} className="rotate-90" />
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                )}

                {/* Mobile Bottom Bar - Quick Actions */}
                {!loading && paginatedTickets.length > 0 && (
                    <div className="sticky bottom-0 p-3 bg-white border-t border-gray-200 shadow-lg">
                        <div className="flex items-center justify-between">
                            <span className="text-xs text-gray-500">
                                หน้า {currentPage} จาก {totalPages}
                            </span>
                            <div className="flex items-center gap-2">
                                <button
                                    disabled={currentPage === 1}
                                    onClick={(e) => { e.stopPropagation(); setCurrentPage(currentPage - 1); }}
                                    className="px-4 py-2 text-sm font-medium rounded-lg bg-gray-100 text-gray-700 disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
                                >
                                    ก่อนหน้า
                                </button>
                                <button
                                    disabled={currentPage >= totalPages}
                                    onClick={(e) => { e.stopPropagation(); setCurrentPage(currentPage + 1); }}
                                    className="px-4 py-2 text-sm font-medium rounded-lg bg-[#026a75] text-white disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
                                >
                                    ถัดไป
                                </button>
                            </div>
                        </div>
                    </div>
                )}
            </div>

            {/* Desktop Table */}
            <div className="hidden lg:block">
                <table className="w-full">
                    <thead className="bg-gray-100">
                        <tr>
                            <th className="px-6 py-4 text-left text-sm font-semibold text-gray-700 w-[45%]">
                                <div className="flex gap-1 bg-gray-200 rounded-lg p-1 w-fit">
                                    <span>หัวข้อคำร้อง</span>
                                </div>
                            </th>
                            {activeTab !== "suv" ? <th className="px-4 py-4 text-left text-sm font-semibold text-gray-700 w-[15%]">สถานะ</th>
                                : <th className="px-4 py-4 text-left text-sm font-semibold text-gray-700 w-[15%]">คะแนน</th>}
                            {activeTab == "suv" && (<th className="px-4 py-4 text-left text-sm font-semibold text-gray-700 w-[15%]">หมายเหตุ</th>
                            )}
                            <th className="px-4 py-4 text-left text-sm font-semibold text-gray-700 w-[20%]">
                                <span className="flex items-center gap-1">
                                    วันที่สร้าง
                                    {sortOrder === 'desc' ? (
                                        <ArrowDown size={12} className="text-[#026a75]" />
                                    ) : (
                                        <ArrowUp size={12} className="text-[#026a75]" />
                                    )}
                                </span>
                            </th>
                            <th className="px-4 py-4 text-center text-sm font-semibold text-gray-700 w-[15%]">จัดการ</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                        {loading ? (
                            Array.from({ length: 5 }).map((_, i) => <LoadingRow key={i} />)
                        ) : paginatedTickets.length === 0 ? (
                            <EmptyState colSpan={4} />
                        ) : (
                            paginatedTickets.map((item) => (
                                <tr key={activeTab == "suv" ? item.form_id : item.submission_id} className="hover:bg-gray-50 transition-colors">
                                    <td className="px-6 py-4">
                                        <div className="flex items-center gap-4">
                                            <UserAvatar email={item.email} imageUrl={item.image_url} />
                                            <div className="min-w-0">
                                                <p className="font-semibold text-gray-800 truncate">
                                                    [{item.form_code}] {item.form_name}
                                                    <ApprovalBadge status={item.status_approve} />
                                                </p>
                                                <p className="text-xs text-[#026a75] font-medium">{item.form_id}</p>
                                                <p className="text-xs text-gray-500 flex items-center gap-1 mt-0.5">
                                                    <User size={11} /> <span className="font-bold">{item.created_by}</span> {item.firstname} {item.lastname} ฝ่าย: {item.department_name_th}
                                                </p>
                                            </div>
                                        </div>
                                    </td>
                                    {activeTab !== "suv" ? (
                                        <td className="px-4 py-4">
                                            <StatusBadge status={item.status} />
                                        </td>
                                    ) : (
                                        <td className="px-4 py-4">
                                            <span className="text-sm font-medium text-gray-800">
                                                {item.point ? `${item.point} / 5` : 'ยังไม่ให้คะแนน'}
                                            </span>
                                        </td>
                                    )}
                                    {activeTab === "suv" && (
                                        <td className="px-4 py-4">
                                            <span className="text-sm text-gray-600">
                                                {item.comment || '-'}
                                            </span>
                                        </td>
                                    )}
                                    <td className="px-4 py-4">
                                        <span className="text-sm text-gray-600 flex items-center gap-2">
                                            <Calendar size={14} className="text-gray-400" />
                                            {activeTab == "suv" ? formatDatetime(item.survey_at) : formatDatetime(item.created_at)}
                                        </span>
                                    </td>
                                    <td className="px-4 py-4">
                                        <div className="flex justify-center gap-2">
                                            <button
                                                onClick={() => onViewTicket(item)}
                                                className="cursor-pointer bg-blue-500 hover:bg-blue-600 text-white p-2.5 rounded-lg transition-colors"
                                                title="ดูรายละเอียด"
                                            >
                                                <Eye size={16} />
                                            </button>
                                            {/* {item.status === "Done" && (
                                            <a
                                                href={`https://menait-service.vercel.app/survey-it/${item.form_id}`}
                                                target="_blank"
                                                rel="noopener noreferrer"
                                                className="cursor-pointer p-2.5 rounded-lg bg-yellow-500 text-white hover:bg-yellow-600 shadow-sm hover:shadow-md transition-all duration-200 hover:scale-105 group"
                                                title="ให้คะแนนประเมิน"
                                            >
                                                <Star size={16} className="fill-white text-white group-hover:animate-pulse" />
                                            </a>
                                          )} */}
                                        </div>
                                    </td>
                                </tr>
                            ))
                        )}
                    </tbody>
                </table>
            </div>

            {/* Bottom Pagination */}
            <div className="flex justify-end p-4 border-t border-gray-100">
                <PaginationControls
                    currentPage={currentPage}
                    totalPages={totalPages}
                    onPageChange={setCurrentPage}
                />
            </div>
        </section>
    );
}

// ===================== VIEWER COMPONENT =====================
export const Viewer = ({
    ticket,
    selectTicketBack,
    isOpen,
    onClose,
    onApprove,
    onReject,
    onStatusChange,
    onFormDataUpdate,
    role,
    mode = 'sheet'
}: {
    ticket: Ticket | null;
    selectTicketBack: any | null;
    isOpen: boolean;
    onClose: () => void;
    onApprove: (ticket: Ticket, remark: string) => void;
    onReject: (ticket: Ticket, remark: string) => void;
    onStatusChange?: (ticket: Ticket, newStatus: string) => void;
    onFormDataUpdate?: (ticket: Ticket) => void;
    role?: string | null;
    mode?: 'sheet' | 'dialog';
}) => {
    const { user: sessionUser } = useSessionContext();
    const [isEditing, setIsEditing] = useState(false);
    const [formStructure, setFormStructure] = useState<formSetup | null>(null);
    const [formValues, setFormValues] = useState<Record<string, any>>({});
    const [errors, setErrors] = useState<Record<string, string>>({});
    const [isLoadingForm, setIsLoadingForm] = useState(false);
    const [showApproveDialog, setShowApproveDialog] = useState(false);
    const [showRejectDialog, setShowRejectDialog] = useState(false);
    const [showStatusChangeDialog, setShowStatusChangeDialog] = useState(false);
    const [pendingStatusChange, setPendingStatusChange] = useState<string | null>(null);
    const [imageUrls, setImageUrls] = useState<string[]>([]);
    const [remark, setRemark] = useState('');
    const [displayBtnNote, setDisplayBtnNote] = useState(false);
    const [adminComment, setAdminComment] = useState('');
    const [loadBtn, setLoadBtn] = useState(false);
    const selectTicketBackRef = useRef(selectTicketBack);
    selectTicketBackRef.current = selectTicketBack;

    const handleInputChange = useCallback((name: string, value: any) => {
        setFormValues(prev => ({ ...prev, [name]: value }));
        setErrors(prev => {
            if (!prev[name]) return prev;
            const newErrors = { ...prev };
            delete newErrors[name];
            return newErrors;
        });
    }, []);

    const handlePullForm = async () => {
        if (!ticket) return;
        setIsLoadingForm(true);
        try {
            const currentBack = selectTicketBackRef.current;
            const response = await fetch(`/api/formsubmit?path=${ticket.form_code}?version=${currentBack?.form_version}`, {
                method: "GET",
            });
            const data = await response.json();
            if (response.ok && data) {
                const form = data as formSetup;
                setFormStructure(form);

                const latestBack = selectTicketBackRef.current;
                if (latestBack?.values && form.questions) {
                    const initialValues = prefillFormValues(form.questions, latestBack.values);
                    setFormValues(initialValues);
                }
            } else {
                alert('เกิดข้อผิดพลาดในการดึงข้อมูลแบบฟอร์ม');
            }
        } catch (error) {
            console.error('Error fetching form:', error);
            alert('เกิดข้อผิดพลาดในการดึงข้อมูลแบบฟอร์ม');
        } finally {
            setIsLoadingForm(false);
        }
    };

    useEffect(() => {
        if (!isOpen || !selectTicketBack || !ticket || formStructure) return;
        setIsLoadingForm(true);
        const timer = setTimeout(() => {
            handlePullForm();
        }, 1000);
        return () => clearTimeout(timer);
    }, [isOpen, selectTicketBack?.form_version, ticket?.form_id]);

    useEffect(() => {
        // GET IMAGE S3 URL
        if (!isOpen || ticket?.form_code !== "ISSUE_IT" || !ticket?.form_id) return;
        const fetchImageUrls = async () => {
            const res = await fetch(`/api/uploads3?form_id=${ticket?.form_id}`);
            const data = await res.json();
            if (!res.ok) {
                console.error('Error fetching image URLs:', data?.error || 'Unknown error');
                return;
            }
            if (data.files) {
                setImageUrls(data.files.map((file: any) => file.url));
            }
        }
        fetchImageUrls();
    }, [isOpen, ticket?.form_id, ticket?.form_code]);

    // Prefill form values เมื่อ selectTicketBack.values มาถึงหลัง formStructure โหลดเสร็จแล้ว
    useEffect(() => {
        if (!isOpen || !formStructure?.questions || !selectTicketBack?.values) return;
        if (Object.keys(formValues).length > 0) return; // already prefilled
        const initialValues = prefillFormValues(formStructure.questions, selectTicketBack.values);
        setFormValues(initialValues);
    }, [isOpen, selectTicketBack?.values, formStructure]);

    useEffect(() => {
        if (!isOpen) return;
        setAdminComment(selectTicketBack?.admin_comment || '');
        setDisplayBtnNote(false);
    }, [isOpen, selectTicketBack?.admin_comment]);

    useEffect(() => {
        if (!isOpen) {
            setIsEditing(false);
            setFormStructure(null);
            setFormValues({});
            setErrors({});
            setImageUrls([]);
        }
    }, [isOpen]);

    const handleStartEdit = () => {
        setIsEditing(true);
    };

    const handleCancelEdit = () => {
        setIsEditing(false);
        const currentBack = selectTicketBackRef.current;
        if (formStructure?.questions && currentBack?.values) {
            const initialValues = prefillFormValues(formStructure.questions, currentBack.values);
            setFormValues(initialValues);
        }
        setErrors({});
    };

    const handleSubmitEdit = async () => {
        try {
            if (!formStructure?.questions || !ticket) return;

            const values = buildSubmitValues(formStructure.questions, formValues);

            const user = sessionUser ?? {};

            const result = {
                updated_by: (user as any).employee_id || (user as any).email || 'unknown',
                values: values
            };
            // console.log('json result to submit:', JSON.stringify(result));
            const res = await fetch(`/api/formsubmit?form_id=${ticket.form_id}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(result),
            });
            const data = await res.json();
            if (!res.ok) {
                showSwal({
                    icon: 'error',
                    title: 'เกิดข้อผิดพลาดในการอัปเดตแบบฟอร์ม',
                    text: data?.error || 'Unknown error',
                });
                return;
            }
            handleCancelEdit();
            showSwal({
                icon: 'success',
                title: 'อัปเดตข้อมูลสำเร็จ',
                timer: 1500,
                showConfirmButton: false,
            });

            if (onFormDataUpdate && ticket) {
                onFormDataUpdate(ticket);
            }
        } catch (error) {
            console.error('Error submitting edited form:', error);
            showSwal({
                icon: 'error',
                title: 'เกิดข้อผิดพลาดในการส่งข้อมูลที่แก้ไข',
                text: 'โปรดลองอีกครั้งภายหลัง',
            });
        }
    };

    const handleChangeNote = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
        const newValue = e.target.value;
        setAdminComment(newValue);
        setDisplayBtnNote(newValue.trim().length > 0);
    }

    const handleSubmitNote = async () => {
        try {
            setLoadBtn(true);
            if (!ticket) return;
            const res = await fetch(`/api/admincomment`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    form_id: ticket.form_id,
                    admin_comment: adminComment,
                }),
            });
            const data = await res.json();
            if (!res.ok) {
                showSwal({
                    icon: 'error',
                    title: 'เกิดข้อผิดพลาดในการอัปเดตหมายเหตุ',
                    text: data?.error || 'Unknown error',
                });
                setLoadBtn(false);
                return;
            }
            showSwal({
                icon: 'success',
                title: 'อัปเดตสำเร็จ',
                timer: 1500,
                showConfirmButton: false,
            });
            setDisplayBtnNote(false);
            setLoadBtn(false);
        } catch (error) {
            console.error('Error submitting note:', error);
            showSwal({
                icon: 'error',
                title: 'เกิดข้อผิดพลาดในการส่งหมายเหตุ',
                text: 'โปรดลองอีกครั้งภายหลัง',
            });
            setLoadBtn(false);
        }
    };

    const handleConfirmApprove = () => {
        if (!ticket) return;
        onApprove(ticket, remark);
        setShowApproveDialog(false);
        setRemark('');
        onClose();
    };

    const handleConfirmReject = () => {
        if (!ticket) return;
        onReject(ticket, remark);
        setShowRejectDialog(false);
        setRemark('');
        onClose();
    };

    const handleStatusChange = (newStatus: string) => {
        setPendingStatusChange(newStatus);
        setShowStatusChangeDialog(true);
    };

    const handleConfirmStatusChange = async () => {
        if (!ticket || !pendingStatusChange) return;

        try {
            const response = await fetch('/api/status', {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    form_id: ticket.form_id,
                    new_status: pendingStatusChange,
                    employee_id: sessionUser?.employee_id ?? 'unknown',
                }),
            });
            if (!response.ok) {
                const errorData = await response.json();
                alert(`Error updating status: ${errorData?.error || 'Unknown error'}`);
            } else {
                onStatusChange?.(ticket, pendingStatusChange);
                onClose();
                showSwal({
                    icon: 'success',
                    title: 'อัปเดตสถานะสำเร็จ',
                    timer: 1500,
                    showConfirmButton: false,
                });
            }
        } catch (error) {
            console.error('Error updating status:', error);
        } finally {
            setShowStatusChangeDialog(false);
            setPendingStatusChange(null);
        }
    };

    const isDialog = mode === 'dialog';


    const viewerContent = (
        <>
            {/* Content - Scrollable */}
            <div className={`flex-1 overflow-y-auto p-4 sm:p-6 ${isDialog ? 'h-full' : ''}`}>
                {ticket && (
                    <div className="space-y-5">
                        {/* Ticket Info */}
                        <div className="bg-gray-50 rounded-xl p-4 space-y-3">
                            {[
                                { label: 'รหัสแบบฟอร์ม', value: ticket.form_code, color: '#026a75' },
                                { label: 'รหัสคำร้อง', value: ticket.form_id },
                                { label: 'ชื่อแบบฟอร์ม', value: ticket.form_name },
                                ...(selectTicketBack?.form_type !== 'Issue' ? [
                                    { label: 'ผู้อนุมัติ', value: `${ticket.action_by_firstname} ${ticket.action_by_lastname}` || '-' },
                                    { label: 'วันที่อนุมัติ', value: formatDatetime(ticket.action_at) || '-' },
                                    { label: 'สถานะอนุมัติ', value: selectTicketBack?.status_approve === "In Progress" ? "ยังไม่อนุมัติ" : selectTicketBack?.status_approve === "Approved" ? "อนุมัติแล้ว" : "ถูกปฏิเสธ", color: selectTicketBack?.status_approve === "Approved" ? '#16a34a' : selectTicketBack?.status_approve === "Rejected" ? '#dc2626' : '#6b7280' },
                                    { label: 'หมายเหตุการอนุมัติ', value: selectTicketBack?.remark || '-' },
                                ] : []),
                            ].map(({ label, value, color }) => (
                                <div key={label} className="flex items-center justify-between">
                                    <span className="text-sm text-gray-500">{label}</span>
                                    <span className="font-medium" style={{ color: color || '#1f2937' }}>{value}</span>
                                </div>
                            ))}
                            <div className="flex items-center justify-between">
                                <span className="text-sm text-gray-500">สถานะคำร้อง</span>
                                {role === 'a' && selectTicketBack?.status_approve !== "In Progress" && ticket.status !== "Done" ? (
                                    <SelectStatus
                                        status={ticket.status}
                                        onChange={handleStatusChange}
                                    />
                                ) : (
                                    <StatusBadge status={ticket.status} />
                                )}
                            </div>
                        </div>

                        {/* Creator Info */}
                        <div className="bg-gray-50 rounded-xl p-4 space-y-3">
                            <h4 className="font-semibold text-gray-800 flex items-center gap-2">
                                <User size={18} /> ข้อมูลผู้สร้าง
                            </h4>
                            {[
                                { label: 'ผู้สร้าง', value: `${ticket.created_by} ${ticket.firstname} ${ticket.lastname}` },
                                { label: 'ฝ่าย', value: ticket.department_name_th },
                                { label: 'อีเมล', value: ticket.email },
                                { label: 'วันที่สร้าง', value: formatDatetime(ticket.created_at) },
                            ].map(({ label, value }) => (
                                <div key={label} className="flex items-center justify-between">
                                    <span className="text-sm text-gray-500">{label}</span>
                                    <span className="font-medium text-gray-800 text-sm">{value}</span>
                                </div>
                            ))}
                        </div>

                        {/* Form Data */}
                        {ticket && selectTicketBack && (
                            <div className="bg-gray-50 rounded-xl p-4 space-y-3">
                                <div className="flex justify-between items-center">
                                    <h4 className="font-semibold text-gray-800 flex items-center gap-2">
                                        <FileText size={18} /> ข้อมูลที่กรอก
                                    </h4>
                                    <div className="flex gap-2">
                                        {!isEditing && (ticket.status === 'In Progress' || role == 'a') && (
                                            <Button
                                                variant="default"
                                                className="cursor-pointer"
                                                onClick={handleStartEdit}
                                                size="sm"
                                            >
                                                แก้ไขข้อมูล
                                            </Button>
                                        )}
                                        {isEditing && (
                                            <>
                                                <Button
                                                    variant="secondary"
                                                    className="cursor-pointer"
                                                    onClick={handleCancelEdit}
                                                    size="sm"
                                                >
                                                    ยกเลิก
                                                </Button>
                                                <Button
                                                    variant="default"
                                                    className="cursor-pointer bg-emerald-600 hover:bg-emerald-700"
                                                    onClick={handleSubmitEdit}
                                                    size="sm"
                                                >
                                                    ยืนยัน
                                                </Button>
                                            </>
                                        )}
                                    </div>
                                </div>

                                {/* Show form - readonly by default, editable when isEditing */}
                                {isLoadingForm ? (
                                    <div className="flex items-center justify-center gap-2 text-gray-500">
                                        <Loader2 size={25} className="animate-spin" />
                                    </div>
                                ) : formStructure?.questions ? (
                                    <div className="space-y-4 max-h-96 overflow-y-auto">
                                        {formStructure.questions.map((question, idx) =>
                                            renderFormField({
                                                question,
                                                index: idx,
                                                formValues,
                                                errors,
                                                onInputChange: handleInputChange,
                                                compact: true,
                                                allQuestions: formStructure.questions,
                                                readOnly: !isEditing
                                            })
                                        )}
                                        {imageUrls.length > 0 && (
                                            <>
                                                <div className="flex items-center gap-2 mb-1.5">
                                                    <div className="flex items-center justify-center w-5 h-5 rounded-md bg-[#026a75]/10 text-[#026a75] text-[10px] font-bold shrink-0">
                                                        {formStructure.questions.length + 1}
                                                    </div>
                                                    <label className="text-sm font-medium text-gray-700">แนบรูปภาพ (ถ้ามี)</label>
                                                </div>
                                                <div className="w-full">
                                                    {imageUrls.map((url, idx) => (
                                                        <a
                                                            key={idx}
                                                            href={url}
                                                            target="_blank"
                                                            rel="noopener noreferrer"
                                                            className="group relative block rounded-xl overflow-hidden border border-gray-200 hover:border-[#026a75]/40 transition-all"
                                                        >
                                                            <img
                                                                src={url}
                                                                alt={`แนบรูปภาพ ${idx + 1}`}
                                                                className="w-full h-36 object-cover bg-gray-50"
                                                            />
                                                            <div className="absolute inset-0 flex items-center justify-center bg-black/0 group-hover:bg-black/30 transition-all duration-200">
                                                                <div className="w-9 h-9 rounded-full bg-white/80 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity duration-200 shadow-md">
                                                                    <Eye className="w-4 h-4 text-gray-700" />
                                                                </div>
                                                            </div>
                                                        </a>
                                                    ))}
                                                </div>
                                            </>
                                        )}
                                    </div>
                                ) : (
                                    <p className="text-sm text-gray-500">ไม่พบข้อมูลแบบฟอร์ม</p>
                                )}
                            </div>
                        )}

                        {/* Comment Admin */}
                        <div className="bg-gray-50 rounded-xl p-4 space-y-3">
                            <div className="flex justify-between">
                                <h4 className="font-semibold text-gray-800 flex items-center gap-2">
                                    <Laptop size={18} /> หมายเหตุจากฝ่าย IT
                                </h4>
                                {displayBtnNote && (
                                    !loadBtn ? <Button
                                        variant="default"
                                        className="cursor-pointer bg-emerald-600 hover:bg-emerald-700"
                                        onClick={handleSubmitNote as any}
                                        size="sm"
                                    >
                                        บันทึก
                                    </Button>
                                        : <div className="flex items-center gap-2 text-gray-500">
                                            <Loader2 size={20} className="animate-spin" />
                                            กำลังบันทึก...
                                        </div>
                                )}
                            </div>
                            <div className="flex items-center justify-between">
                                <textarea className="text-sm bg-white text-gray-700 border overflow-x-hidden border-gray-300 rounded-md p-3 w-full min-h-20 resize-none focus:ring-2 focus:ring-[#026a75]/50 focus:outline-none"
                                    value={adminComment}
                                    onChange={(e) => {
                                        handleChangeNote(e);
                                    }}
                                    readOnly={role !== 'a'}
                                />
                            </div>
                        </div>

                        {/* Timeline */}
                        <div className="bg-gray-50 rounded-xl p-4">
                            <h4 className="font-semibold text-gray-800 flex items-center gap-2 mb-4">
                                <Clock size={18} /> ประวัติการดำเนินการ
                            </h4>
                            <div className="flex items-start gap-3">
                                <div className="w-3 h-3 bg-[#026a75] rounded-full mt-1" />
                                <div>
                                    <p className="text-sm font-medium text-gray-800">สร้างคำร้อง</p>
                                    <p className="text-xs text-gray-500">{formatDatetime(ticket.created_at)}</p>
                                </div>
                            </div>
                        </div>
                    </div>
                )}
            </div>

            {selectTicketBack && selectTicketBack.form_type !== 'Issue' && selectTicketBack.status_approve === 'In Progress' && !isEditing && (
                <div className="border-t p-4 sm:p-6 shrink-0 bg-white">
                    <div className="flex gap-3">
                        <button
                            onClick={() => setShowRejectDialog(true)}
                            className="flex-1 cursor-pointer bg-red-500 hover:bg-red-600 disabled:bg-red-300 text-white py-3 rounded-xl flex items-center justify-center gap-2 transition-colors font-medium"
                        >
                            <XCircle size={20} />
                            ปฏิเสธ
                        </button>
                        <button
                            onClick={() => setShowApproveDialog(true)}
                            className="flex-1 cursor-pointer bg-emerald-500 hover:bg-emerald-600 disabled:bg-emerald-300 text-white py-3 rounded-xl flex items-center justify-center gap-2 transition-colors font-medium"
                        >
                            <CheckCircle size={20} />
                            อนุมัติ
                        </button>
                    </div>
                </div>
            )}
        </>
    );

    // Shared Alert Dialogs
    const alertDialogs = (
        <>
            {/* Approve Dialog */}
            <AlertDialog open={showApproveDialog} onOpenChange={setShowApproveDialog}>
                <AlertDialogContent className="swal-on-sheet">
                    <AlertDialogHeader>
                        <AlertDialogTitle className="flex items-center gap-2">
                            <CheckCircle size={24} className="text-emerald-500" />
                            ยืนยันการอนุมัติคำร้อง
                        </AlertDialogTitle>
                        <AlertDialogDescription>
                            คุณแน่ใจหรือไม่ว่าต้องการอนุมัติคำร้องนี้?
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <div className="py-4">
                        <label className="text-sm font-medium text-gray-700 mb-2 block">
                            หมายเหตุ (ถ้ามี)
                        </label>
                        <Textarea
                            placeholder="ระบุหมายเหตุเพิ่มเติม..."
                            value={remark}
                            onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => setRemark(e.target.value)}
                            className="min-h-25"
                        />
                    </div>
                    <AlertDialogFooter>
                        <AlertDialogCancel onClick={() => setRemark('')}>ยกเลิก</AlertDialogCancel>
                        <AlertDialogAction
                            onClick={handleConfirmApprove}
                            variant="success"
                            className="bg-emerald-500 hover:bg-emerald-600"
                        >
                            ยืนยันการอนุมัติ
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>

            {/* Reject Dialog */}
            <AlertDialog open={showRejectDialog} onOpenChange={setShowRejectDialog}>
                <AlertDialogContent className="swal-on-sheet">
                    <AlertDialogHeader>
                        <AlertDialogTitle className="flex items-center gap-2">
                            <XCircle size={24} className="text-red-500" />
                            ยืนยันการปฏิเสธคำร้อง
                        </AlertDialogTitle>
                        <AlertDialogDescription>
                            คุณแน่ใจหรือไม่ว่าต้องการปฏิเสธคำร้องนี้?
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <div className="py-4">
                        <label className="text-sm font-medium text-gray-700 mb-2 block">
                            หมายเหตุ (จำเป็น)
                        </label>
                        <Textarea
                            placeholder="ระบุเหตุผลการปฏิเสธ..."
                            value={remark}
                            onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => setRemark(e.target.value)}
                            className="min-h-25"
                            required
                        />
                    </div>
                    <AlertDialogFooter>
                        <AlertDialogCancel onClick={() => setRemark('')}>ยกเลิก</AlertDialogCancel>
                        <AlertDialogAction
                            onClick={handleConfirmReject}
                            variant="destructive"
                            disabled={!remark.trim()}
                        >
                            ยืนยันการปฏิเสธ
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>

            {/* Status Change Dialog */}
            <AlertDialog open={showStatusChangeDialog} onOpenChange={setShowStatusChangeDialog}>
                <AlertDialogContent className="swal-on-sheet">
                    <AlertDialogHeader>
                        <AlertDialogTitle className="flex items-center gap-2">
                            <span className="w-3 h-3 rounded-full bg-orange-500 animate-pulse" ></span>
                            ยืนยันการเปลี่ยนสถานะ
                        </AlertDialogTitle>
                        <AlertDialogDescription>
                            คุณแน่ใจหรือไม่ว่าต้องการเปลี่ยนสถานะ
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel className="cursor-pointer" onClick={() => setPendingStatusChange(null)}>ยกเลิก</AlertDialogCancel>
                        <AlertDialogAction
                            onClick={handleConfirmStatusChange}
                            className="bg-blue-500 hover:bg-blue-600 cursor-pointer"
                        >
                            ยืนยัน
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        </>
    );

    // Render Dialog mode (for opening from URL link)
    if (isDialog) {
        return (
            <>
                <Dialog open={isOpen} onOpenChange={onClose}>
                    <DialogContent className="sm:max-w-2xl p-0 flex flex-col max-h-[90vh]">
                        <DialogHeader className="border-b p-4 sm:p-6 shrink-0">
                            <div className="flex items-center justify-between gap-3">
                                <div>
                                    <SheetTitle className="text-xl font-bold text-gray-800">รายละเอียดคำร้อง</SheetTitle>
                                    <SheetDescription>ข้อมูลคำร้องและสถานะการดำเนินการ</SheetDescription>
                                </div>
                                {/* Button Survey-it */}
                                {ticket?.status == "Done" && (
                                    <a
                                        href={`https://menait-service.vercel.app/survey-it/${ticket?.form_id}`}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="inline-flex items-center gap-2 px-2 py-2.5 mr-5 rounded-xl bg-linear-to-r from-[#026a75] to-[#038a96] text-white text-sm font-semibold shadow-md hover:shadow-lg hover:from-[#025f68] hover:to-[#026a75] transition-all duration-300 hover:scale-[1.02] shrink-0 group"
                                    >
                                        <Star size={16} className="fill-yellow-300 text-yellow-300 group-hover:animate-pulse" />
                                        <span className="hidden sm:inline">ให้คะแนนประเมิน</span>
                                        <ExternalLink size={14} className="opacity-60 group-hover:opacity-100 transition-opacity" />
                                    </a>
                                )}
                            </div>
                        </DialogHeader>
                        {viewerContent}
                    </DialogContent>
                </Dialog>
                {alertDialogs}
            </>
        );
    }

    // Render Sheet mode (default)
    return (
        <>
            <Sheet open={isOpen} onOpenChange={onClose}>
                <SheetContent side="right" className="w-full p-0 sm:max-w-lg flex flex-col h-full">
                    <SheetHeader className="border-b p-4 sm:p-6 shrink-0">
                        <div className="flex items-center justify-between gap-2">
                            <div>
                                <SheetTitle className="text-xl font-bold text-gray-800">รายละเอียดคำร้อง</SheetTitle>
                                <SheetDescription>ข้อมูลคำร้องและสถานะการดำเนินการ</SheetDescription>
                            </div>
                            {/* Button Survey-it */}
                            {ticket?.status == "Done" && (
                                <a
                                    href={`https://menait-service.vercel.app/survey-it/${ticket?.form_id}`}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="inline-flex items-center gap-2 px-2 py-2.5 mr-5 rounded-xl bg-linear-to-r from-[#026a75] to-[#038a96] text-white text-sm font-semibold shadow-md hover:shadow-lg hover:from-[#025f68] hover:to-[#026a75] transition-all duration-300 hover:scale-[1.02] shrink-0 group"
                                >
                                    <Star size={16} className="fill-yellow-300 text-yellow-300 group-hover:animate-pulse" />
                                    <span className="hidden sm:inline">ให้คะแนนประเมิน</span>
                                    <ExternalLink size={14} className="opacity-60 group-hover:opacity-100 transition-opacity" />
                                </a>
                            )}
                        </div>
                    </SheetHeader>
                    {viewerContent}
                </SheetContent>
            </Sheet>
            {alertDialogs}
        </>
    );
}