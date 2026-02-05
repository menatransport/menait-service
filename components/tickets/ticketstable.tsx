'use client';
import { Ticket } from "@/app/mytickets/page";
import { FileSpreadsheet, User, Calendar, Eye, FileText, Clock, CheckCircle, XCircle, CircleIcon, ArrowUp, ArrowDown, Filter, Search, X } from "lucide-react";
import { useState, useMemo } from "react";
import { Badge } from "@/components/ui/badge";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from "@/components/ui/sheet";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Textarea } from "@/components/ui/textarea";
import { STATUS_CONFIG } from "./types";
import { Button } from "../ui/button";
import type { formSetup, Question } from "@/app/service/[[...slug]]/page";
import { renderFormField, buildSubmitValues, prefillFormValues, formatDatetime } from "../renderForm";
import { SelectStatus } from "../ui/selectstatus";
import Swal from "sweetalert2";

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
        <span className={`inline-block px-3 py-1 text-sm font-medium rounded-full border ${config.className}`}>
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
                {email.charAt(0).toUpperCase()}
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
] as const;

export type TabType = 'my' | 'apv';
export type SortOrder = 'asc' | 'desc';

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
    role
}: {
    data: Ticket[];
    title: string;
    loading: boolean;
    handleExportExcel: () => void;
    onViewTicket: (ticket: Ticket) => void;
    activeTab: TabType;
    onTabChange: (tab: TabType) => void;
    role?: string | null;
}) => {
    const [currentPage, setCurrentPage] = useState(1);
    const [sortOrder, setSortOrder] = useState<SortOrder>('desc');
    const [filterStatus, setFilterStatus] = useState<string>('all');
    const [searchText, setSearchText] = useState<string>('');
    const [showFilters, setShowFilters] = useState(false);

    const processedData = useMemo(() => {
        let result = [...data];

        if (filterStatus !== 'all') {
            result = result.filter(item => item.status === filterStatus);
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
    }, [data, sortOrder, filterStatus, searchText]);

    const totalPages = Math.ceil(processedData.length / ITEMS_PER_PAGE);

    const paginatedTickets = useMemo(() => {
        const start = (currentPage - 1) * ITEMS_PER_PAGE;
        return processedData.slice(start, start + ITEMS_PER_PAGE);
    }, [processedData, currentPage]);

    const toggleSort = () => {
        setSortOrder(prev => prev === 'desc' ? 'asc' : 'desc');
    };

    const clearFilters = () => {
        setFilterStatus('all');
        setSearchText('');
        setCurrentPage(1);
    };

    const hasActiveFilters = filterStatus !== 'all' || searchText.trim() !== '';

    return (
        <section className="bg-white rounded-2xl shadow-xl border border-white/30 overflow-hidden relative">
            <div className="p-4 lg:p-5 bg-[#04555e]">
                <div className="lg:hidden mb-4">
                    <div className="flex bg-white/10 rounded-xl p-1">
                        {TAB_OPTIONS.map(({ value, label }) => (
                            <button
                                key={value}
                                onClick={() => onTabChange(value)}
                                className={`flex-1 py-2.5 px-4 rounded-lg text-sm font-medium transition-all cursor-pointer ${activeTab === value
                                    ? 'bg-white text-[#04555e] shadow-md'
                                    : 'text-white/80 hover:text-white'
                                    }`}
                            >
                                {label}
                            </button>
                        ))}
                    </div>
                </div>

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
                                <span className="bg-emerald-500 text-white text-xs w-5 h-5 rounded-full flex items-center justify-center font-bold">
                                    {(filterStatus !== 'all' ? 1 : 0) + (searchText.trim() ? 1 : 0)}
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

                        {/* Status Pills - Scrollable on Mobile */}
                        <div className="flex overflow-x-auto pb-1 lg:pb-0 -mx-3 px-3 lg:mx-0 lg:px-0 gap-2 scrollbar-hide">
                            {STATUS_OPTIONS.map(({ value, label }) => (
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
                            ))}
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
                                key={item.submission_id}
                                onClick={() => onViewTicket(item)}
                                className="p-4 active:bg-gray-100 transition-colors cursor-pointer"
                            >
                                {/* Card Header */}
                                <div className="flex items-start gap-3">
                                    <UserAvatar email={item.email} imageUrl={item.image_url} />
                                    <div className="flex-1 min-w-0">
                                        <div className="flex items-start justify-between gap-2">
                                            <div className="min-w-0 flex-1">
                                                <h3 className="font-semibold text-gray-800 text-sm truncate">{item.form_name}</h3>
                                                <p className="text-xs text-[#026a75] font-medium">{item.form_code}</p>
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
                                    {TAB_OPTIONS.map(({ value, label }) => (
                                        <button
                                            key={value}
                                            onClick={() => onTabChange(value)}
                                            className={`px-4 py-1.5 rounded-md text-sm font-medium transition-all cursor-pointer ${activeTab === value
                                                ? 'bg-white text-[#026a75] shadow-sm'
                                                : 'text-gray-600 hover:text-gray-800'
                                                }`}
                                        >
                                            {label}
                                        </button>
                                    ))}
                                </div>
                            </th>
                            <th className="px-4 py-4 text-left text-sm font-semibold text-gray-700 w-[15%]">สถานะ</th>
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
                            <th className="px-4 py-4 text-center text-sm font-semibold text-gray-700 w-[15%]">Action</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                        {loading ? (
                            Array.from({ length: 5 }).map((_, i) => <LoadingRow key={i} />)
                        ) : paginatedTickets.length === 0 ? (
                            <EmptyState colSpan={4} />
                        ) : (
                            paginatedTickets.map((item) => (
                                <tr key={item.submission_id} className="hover:bg-gray-50 transition-colors">
                                    <td className="px-6 py-4">
                                        <div className="flex items-center gap-4">
                                            <UserAvatar email={item.email} imageUrl={item.image_url} />
                                            <div className="min-w-0">
                                                <p className="font-semibold text-gray-800 truncate">
                                                    [{item.form_code}] {item.form_name}
                                                </p>
                                                <p className="text-xs text-[#026a75] font-medium">{item.form_id}</p>
                                                <p className="text-xs text-gray-500 flex items-center gap-1 mt-0.5">
                                                    <User size={11} /> <span className="font-bold">{item.created_by}</span> {item.firstname} {item.lastname}
                                                </p>
                                            </div>
                                        </div>
                                    </td>
                                    <td className="px-4 py-4">
                                        <StatusBadge status={item.status} />
                                    </td>
                                    <td className="px-4 py-4">
                                        <span className="text-sm text-gray-600 flex items-center gap-2">
                                            <Calendar size={14} className="text-gray-400" />
                                            {formatDatetime(item.created_at)}
                                        </span>
                                    </td>
                                    <td className="px-4 py-4">
                                        <div className="flex justify-center">
                                            <button
                                                onClick={() => onViewTicket(item)}
                                                className="cursor-pointer bg-blue-500 hover:bg-blue-600 text-white p-2.5 rounded-lg transition-colors"
                                                title="ดูรายละเอียด"
                                            >
                                                <Eye size={16} />
                                            </button>
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
    formData,
    isOpen,
    onClose,
    onApprove,
    onReject,
    onStatusChange,
    role
}: {
    ticket: Ticket | null;
    formData: any | null;
    isOpen: boolean;
    onClose: () => void;
    onApprove: (ticket: Ticket, remark: string) => void;
    onReject: (ticket: Ticket, remark: string) => void;
    onStatusChange?: (ticket: Ticket, newStatus: string) => void;
    role?: string | null;
}) => {
    const [isEditing, setIsEditing] = useState(false);
    const [formStructure, setFormStructure] = useState<formSetup | null>(null);
    const [formValues, setFormValues] = useState<Record<string, any>>({});
    const [errors, setErrors] = useState<Record<string, string>>({});
    const [isLoadingForm, setIsLoadingForm] = useState(false);
    const [showApproveDialog, setShowApproveDialog] = useState(false);
    const [showRejectDialog, setShowRejectDialog] = useState(false);
    const [showStatusChangeDialog, setShowStatusChangeDialog] = useState(false);
    const [pendingStatusChange, setPendingStatusChange] = useState<string | null>(null);
    const [remark, setRemark] = useState('');

    const handleInputChange = (name: string, value: any) => {
        setFormValues(prev => ({ ...prev, [name]: value }));
        if (errors[name]) {
            setErrors(prev => {
                const newErrors = { ...prev };
                delete newErrors[name];
                return newErrors;
            });
        }
    };

    const handlePullForm = async () => {
        if (!ticket) return;
        setIsLoadingForm(true);

        try {
            const response = await fetch(`/api/formsubmit?path=${ticket.form_code}`, {
                method: "GET",
            });
            const data = await response.json();
            console.log('Fetched form data for editing:', data);
            if (response.ok && data) {
                const form = data as formSetup;
                setFormStructure(form);

                if (formData?.values && form.questions) {
                    const initialValues = prefillFormValues(form.questions, formData.values);
                    setFormValues(initialValues);
                }

                setIsEditing(true);
                console.log('Fetched form structure:', form);
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

    const handleCancelEdit = () => {
        setIsEditing(false);
        setFormStructure(null);
        setFormValues({});
        setErrors({});
    };

    const handleSubmitEdit = () => {
        if (!formStructure?.questions || !ticket) return;

        const values = buildSubmitValues(formStructure.questions, formValues);

        const user = localStorage.getItem('user')
            ? JSON.parse(localStorage.getItem('user') || '{}')
            : {};

        const result = {
            updated_by: user.employee_id || user.email || 'unknown',
            values: values
        };

        console.log('Submit Edit Result:', result);
        console.log('JSON:', JSON.stringify(result, null, 2));

        handleCancelEdit();
    };

    const handleConfirmApprove = () => {
        if (!ticket) return;
        onApprove(ticket, remark);
        setShowApproveDialog(false);
        setRemark('');
    };

    const handleConfirmReject = () => {
        if (!ticket) return;
        onReject(ticket, remark);
        setShowRejectDialog(false);
        setRemark('');
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
                    employee_id: localStorage.getItem('user') ? JSON.parse(localStorage.getItem('user') || '{}').employee_id : 'unknown',
                }),
            });
            if (!response.ok) {
                const errorData = await response.json();
                alert(`Error updating status: ${errorData?.error || 'Unknown error'}`);
            } else {
                onStatusChange?.(ticket, pendingStatusChange);
                onClose();
                Swal.fire({
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

    return (
        <Sheet open={isOpen} onOpenChange={onClose}>
            <SheetContent side="right" className="w-full p-0 sm:max-w-lg flex flex-col h-full">
                <SheetHeader className="border-b p-4 sm:p-6 shrink-0">
                    <SheetTitle className="text-xl font-bold text-gray-800">รายละเอียดคำร้อง</SheetTitle>
                    <SheetDescription>ข้อมูลคำร้องและสถานะการดำเนินการ</SheetDescription>
                </SheetHeader>

                {/* Content - Scrollable */}
                <div className="flex-1 overflow-y-auto p-4 sm:p-6">
                    {ticket && (
                        <div className="space-y-5">
                            {/* Ticket Info */}
                            <div className="bg-gray-50 rounded-xl p-4 space-y-3">
                                {[
                                    { label: 'รหัสแบบฟอร์ม', value: ticket.form_code },
                                    { label: 'รหัสคำร้อง', value: ticket.form_id },
                                    { label: 'ชื่อแบบฟอร์ม', value: ticket.form_name },
                                    { label: 'ระดับอนุมัติปัจจุบัน', value: ticket.current_level },
                                ].map(({ label, value }) => (
                                    <div key={label} className="flex items-center justify-between">
                                        <span className="text-sm text-gray-500">{label}</span>
                                        <span className="font-medium text-gray-800">{value}</span>
                                    </div>
                                ))}
                                <div className="flex items-center justify-between">
                                    <span className="text-sm text-gray-500">สถานะ</span>
                                    {role === 'a' && ticket.status !== "In Progress" ? (
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
                            {formData?.values && (
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
                                                    onClick={handlePullForm}
                                                    size="sm"
                                                    disabled={isLoadingForm}
                                                >
                                                    {isLoadingForm ? 'กำลังโหลด...' : 'แก้ไขข้อมูล'}
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

                                    {/* Show form fields when editing */}
                                    {isEditing && formStructure?.questions ? (
                                        <div className="space-y-4 max-h-96 overflow-y-auto">
                                            {formStructure.questions.map((question, idx) =>
                                                renderFormField({
                                                    question,
                                                    index: idx,
                                                    formValues,
                                                    errors,
                                                    onInputChange: handleInputChange,
                                                    compact: true
                                                })
                                            )}
                                        </div>
                                    ) : (
                                        /* Show read-only values when not editing */
                                        <div className="space-y-2 max-h-60 overflow-y-auto grid grid-cols-2 gap-4">
                                            {formData.values.map((val: any, idx: number) => (
                                                <div key={idx} className="border-b border-gray-200 pb-2 last:border-0">
                                                    <p className="text-xs text-gray-500">{val.question_label || val.question_name}</p>
                                                    <p className="font-medium text-gray-800">
                                                        {val.value_text || val.value_number || val.value_date || (val.value_boolean !== null ? (val.value_boolean ? 'ใช่' : 'ไม่') : '-')}
                                                    </p>
                                                </div>
                                            ))}
                                        </div>
                                    )}
                                </div>
                            )}

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

                {ticket && ticket.status == "In Progress" && !isEditing && (
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

            </SheetContent>

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
        </Sheet>
    );
}