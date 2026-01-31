'use client';
import { Ticket } from "@/app/mytickets/page";
import { FileSpreadsheet, User, Calendar, Eye, FileText, Clock, CheckCircle, XCircle } from "lucide-react";
import { useState, useMemo } from "react";
import { Badge } from "@/components/ui/badge";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from "@/components/ui/sheet";
import { STATUS_CONFIG } from "./types";
import { Button } from "../ui/button";

// ===================== CONSTANTS =====================
const ITEMS_PER_PAGE = 10;

// ===================== HELPER FUNCTIONS =====================
const formatDatetime = (dateString: string): string => {
    if (!dateString) return '-';
    try {
        return new Date(dateString).toLocaleDateString('th-TH', {
            year: 'numeric',
            month: 'short',
            day: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
        });
    } catch {
        return dateString;
    }
};

const getInitial = (name: string): string => name?.charAt(0)?.toUpperCase() || 'U';

// ===================== SUB COMPONENTS =====================
const StatusBadge = ({ status }: { status: string }) => {
    const config = STATUS_CONFIG[status] || {
        label: status,
        className: 'bg-gray-500 text-white border-gray-500'
    };
    return <Badge className={`${config.className} text-xs px-2 py-1`}>{config.label}</Badge>;
};

const UserAvatar = ({ name }: { name: string }) => (
    <div className="relative shrink-0">
        <div className="w-11 h-11 bg-linear-to-br from-[#026a75] to-[#034d54] rounded-full flex items-center justify-center text-white font-semibold text-base shadow-md">
            {getInitial(name)}
        </div>
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

// ===================== MAIN COMPONENT =====================
export const DataTable = ({
    data,
    title,
    loading,
    handleExportExcel,
    onViewTicket
}: {
    data: Ticket[];
    title: string;
    loading: boolean;
    handleExportExcel: () => void;
    onViewTicket: (ticket: Ticket) => void;
}) => {
    const [currentPage, setCurrentPage] = useState(1);

    const totalPages = Math.ceil(data.length / ITEMS_PER_PAGE);

    const paginatedTickets = useMemo(() => {
        const start = (currentPage - 1) * ITEMS_PER_PAGE;
        return data.slice(start, start + ITEMS_PER_PAGE);
    }, [data, currentPage]);

    return (
        <section className="bg-white rounded-2xl shadow-xl border border-white/30 overflow-hidden relative">
            <div className="p-4 lg:p-5 bg-[#04555e] flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
                <div>
                    <h2 className="text-xl text-white font-semibold">{title}</h2>
                    <p className="text-white/80 text-sm mt-1">พบข้อมูล {data.length} รายการ</p>
                </div>
                <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3">
                    <button
                        onClick={handleExportExcel}
                        className="hidden lg:flex bg-emerald-600 border border-white/30 hover:bg-emerald-700 text-white px-2 py-1 rounded-md items-center gap-2 transition-colors shadow-lg"
                    >
                        <FileSpreadsheet size={18} />
                        <span>Excel</span>
                    </button>
                    <PaginationControls
                        currentPage={currentPage}
                        totalPages={totalPages}
                        onPageChange={setCurrentPage}
                        variant="dark"
                    />
                </div>
            </div>

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
            <div className="block lg:hidden divide-y divide-gray-100">
                {loading ? (
                    Array.from({ length: 3 }).map((_, i) => <MobileLoadingCard key={i} />)
                ) : paginatedTickets.length === 0 ? (
                    <EmptyState />
                ) : (
                    paginatedTickets.map((item) => (
                        <div key={item.submission_id} className="p-4 hover:bg-gray-50 transition-colors">
                            <div className="flex justify-between items-start mb-3">
                                <div className="flex items-center gap-3">
                                    <UserAvatar name={item.created_by} />
                                    <div>
                                        <h3 className="font-semibold text-gray-800 text-sm">{item.form_name}</h3>
                                        <p className="text-xs text-[#026a75]">{item.form_code}</p>
                                    </div>
                                </div>
                                <StatusBadge status={item.status} />
                            </div>
                            <div className="flex items-center gap-4 text-xs text-gray-500 mb-3 ml-14">
                                <span className="flex items-center gap-1"><User size={12} />{item.created_by}</span>
                                <span className="flex items-center gap-1"><Calendar size={12} />{formatDatetime(item.created_at)}</span>
                            </div>
                            <button
                                onClick={() => onViewTicket(item)}
                                className="w-full bg-[#026a75] hover:bg-[#025f66] text-white py-2.5 rounded-lg flex items-center justify-center gap-2 transition-colors text-sm font-medium"
                            >
                                <Eye size={16} />
                                ดูรายละเอียด
                            </button>
                        </div>
                    ))
                )}
            </div>

            {/* Desktop Table */}
            <div className="hidden lg:block">
                <table className="w-full">
                    <thead className="bg-gray-100">
                        <tr>
                            <th className="px-6 py-4 text-left text-sm font-semibold text-gray-700 w-[45%]">รายการ</th>
                            <th className="px-4 py-4 text-left text-sm font-semibold text-gray-700 w-[15%]">สถานะ</th>
                            <th className="px-4 py-4 text-left text-sm font-semibold text-gray-700 w-[25%]">วันที่สร้าง</th>
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
                                            <UserAvatar name={item.created_by} />
                                            <div className="min-w-0">
                                                <p className="font-semibold text-gray-800 truncate">
                                                    [{item.form_code}] {item.form_name}
                                                </p>
                                                <p className="text-xs text-[#026a75] font-medium">{item.form_id}</p>
                                                <p className="text-xs text-gray-500 flex items-center gap-1 mt-0.5">
                                                    <User size={11} /> {item.created_by}
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
                                                className="bg-blue-500 hover:bg-blue-600 text-white p-2.5 rounded-lg transition-colors"
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
    onReject
}: {
    ticket: Ticket | null;
    formData: any | null;
    isOpen: boolean;
    onClose: () => void;
    onApprove: (ticket: Ticket) => void;
    onReject: (ticket: Ticket) => void;
}) => {
    const [isProcessing, setIsProcessing] = useState(false);
    const [isEditing, setIsEditing] = useState(false);

    const handleApprove = async () => {
        if (!ticket) return;
        setIsProcessing(true);
        try {
            await onApprove(ticket);
        } finally {
            setIsProcessing(false);
        }
    };

    const handleReject = async () => {
        if (!ticket) return;
        setIsProcessing(true);
        try {
            await onReject(ticket);
        } finally {
            setIsProcessing(false);
        }
    };

    const handlePullForm = () => {
        setIsEditing(true);
        alert('ดึงข้อมูลแบบฟอร์มใหม่ - Coming soon');
    }

    return (
        <Sheet open={isOpen} onOpenChange={onClose}>
            <SheetContent side="right" className="w-full p-0 sm:max-w-lg flex flex-col h-full">
                {/* Header - Fixed */}
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
                                    <StatusBadge status={ticket.status} />
                                </div>
                            </div>

                            {/* Creator Info */}
                            <div className="bg-gray-50 rounded-xl p-4 space-y-3">
                                <h4 className="font-semibold text-gray-800 flex items-center gap-2">
                                    <User size={18} /> ข้อมูลผู้สร้าง
                                </h4>
                                {[
                                    { label: 'ผู้สร้าง', value: ticket.created_by },
                                    { label: 'อีเมล', value: ticket.created_by_email },
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
                                    <div className="flex justify-between">
                                        <h4 className="font-semibold text-gray-800 flex items-center gap-2">
                                            <FileText size={18} /> ข้อมูลที่กรอก
                                        </h4>
                                        <div className="space-x-2">
                                            {!isEditing && <Button
                                                variant="default"
                                                className="cursor-pointer"
                                                onClick={handlePullForm}
                                                size="sm"
                                            >
                                                แก้ไขข้อมูล
                                            </Button>
                                            }
                                            {isEditing && <Button
                                                variant="success"
                                                className="cursor-pointer"
                                                size="sm"
                                            >
                                                ยืนยัน
                                            </Button>
                                            }
                                            {isEditing && <Button
                                                variant="secondary"
                                                className="cursor-pointer"
                                                onClick={() => setIsEditing(false)}
                                                size="sm"
                                            >
                                                ยกเลิก
                                            </Button>
                                            }
                                        </div>
                                    </div>
                                    <div className="space-y-2 max-h-60 overflow-y-auto grid grid-cols-1 sm:grid-cols-2 gap-4">
                                        {formData.values.map((val: any, idx: number) => (
                                            <div key={idx} className="border-b border-gray-200 pb-2 last:border-0">
                                                <p className="text-xs text-gray-500">{val.question_label || val.question_name}</p>
                                                <p className="font-medium text-gray-800">
                                                    {val.value_text || val.value_number || val.value_date || (val.value_boolean !== null ? (val.value_boolean ? 'ใช่' : 'ไม่') : '-')}
                                                </p>
                                            </div>
                                        ))}
                                    </div>
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

                {ticket && ticket.status !== 'Approved' && ticket.status !== 'Rejected' && ticket.status !== 'Closed' && !isEditing && (
                    <div className="border-t p-4 sm:p-6 shrink-0 bg-white">
                        <div className="flex gap-3">
                            <button
                                onClick={handleReject}
                                disabled={isProcessing}
                                className="flex-1 bg-red-500 hover:bg-red-600 disabled:bg-red-300 text-white py-3 rounded-xl flex items-center justify-center gap-2 transition-colors font-medium"
                            >
                                <XCircle size={20} />
                                ปฏิเสธ
                            </button>
                            <button
                                onClick={handleApprove}
                                disabled={isProcessing}
                                className="flex-1 bg-emerald-500 hover:bg-emerald-600 disabled:bg-emerald-300 text-white py-3 rounded-xl flex items-center justify-center gap-2 transition-colors font-medium"
                            >
                                <CheckCircle size={20} />
                                อนุมัติ
                            </button>
                        </div>
                    </div>
                )}
            </SheetContent>
        </Sheet>
    );
}