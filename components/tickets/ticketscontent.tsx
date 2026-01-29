'use client'
import { useMemo, useState } from "react";
import { type Ticket } from "@/app/mytickets/page";
import { ChartPie, Check, ChevronDown, ChevronUp, CircleX, Clock, Eye, FileSpreadsheet, Filter, MessageSquareQuote, Table, User, Calendar, FileText } from "lucide-react";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from "@/components/ui/sheet";
import { Badge } from "@/components/ui/badge";
import { STATUS_CONFIG } from "./types";

// ===================== CONSTANTS =====================
const ITEMS_PER_PAGE = 10;

// ===================== HELPER FUNCTIONS =====================
const formatDate = (dateString: string): string => {
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

// Avatar Component
const UserAvatar = ({ name }: { name: string }) => (
    <div className="relative shrink-0">
        <div className="w-11 h-11 bg-linear-to-br from-[#026a75] to-[#034d54] rounded-full flex items-center justify-center text-white font-semibold text-base shadow-md">
            {getInitial("Bew")}
        </div>
    </div>
);

// Statistics Card
const StatCard = ({ label, value, icon: Icon, colorClass }: {
    label: string;
    value: number;
    icon: React.ElementType;
    colorClass: { text: string; bg: string };
}) => (
    <div className="bg-white rounded-xl shadow-lg border border-white/30 p-4">
        <div className="flex items-center justify-between">
            <div>
                <p className="text-sm text-gray-600">{label}</p>
                <p className={`text-2xl font-bold ${colorClass.text}`}>{value}</p>
            </div>
            <div className={`${colorClass.bg} p-3 rounded-full`}>
                <Icon className={colorClass.text} size={24} />
            </div>
        </div>
    </div>
);

// Pagination Controls
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
export const TicketComponent = ({
    tickets,
    onSelect,
    formData
}: {
    tickets: Ticket[];
    onSelect: (ticket: Ticket) => void;
    formData: any | null;
}) => {
    // View & UI States
    const [activeView, setActiveView] = useState<'table' | 'dashboard'>('table');
    const [currentPage, setCurrentPage] = useState(1);
    const [loading] = useState(false);
    const [showFilters, setShowFilters] = useState(true);

    // Drawer States
    const [selectedTicket, setSelectedTicket] = useState<Ticket | null>(null);
    const [isDrawerOpen, setIsDrawerOpen] = useState(false);

    // Filter States
    const [filterStatus, setFilterStatus] = useState<string>('all');

    // =================== COMPUTED VALUES ===================

    // Statistics
    const stats = useMemo(() => ({
        total: tickets.length,
        cancelled: tickets.filter(t => t.status === 'Rejected' || t.status === 'Closed').length,
        pending: tickets.filter(t => t.status === 'Pending' || t.status === 'Open').length,
        inProgress: tickets.filter(t => t.status === 'In Progress').length,
        completed: tickets.filter(t => t.status === 'Approved').length,
    }), [tickets]);

    // Filtered & Paginated Data
    const filteredTickets = useMemo(() =>
        filterStatus === 'all' ? tickets : tickets.filter(t => t.status === filterStatus),
        [tickets, filterStatus]
    );

    const totalPages = Math.ceil(filteredTickets.length / ITEMS_PER_PAGE);

    const paginatedTickets = useMemo(() => {
        const start = (currentPage - 1) * ITEMS_PER_PAGE;
        return filteredTickets.slice(start, start + ITEMS_PER_PAGE);
    }, [filteredTickets, currentPage]);

    // =================== HANDLERS ===================

    const handleView = (ticket: Ticket) => {
        setSelectedTicket(ticket);
        setIsDrawerOpen(true);
        onSelect(ticket);
    };

    const handleFilterChange = (status: string) => {
        setFilterStatus(status);
        setCurrentPage(1);
    };

    const handleExportExcel = () => alert('Coming soon');

    // =================== RENDER ===================
    return (
        <main className="flex-1 min-h-0 bg-[#f0fafa] rounded-t-[1.5rem] sm:rounded-t-[2rem] lg:rounded-t-[3rem] shadow-2xl overflow-y-auto">
            <div className="w-full max-w-screen-2xl mx-auto px-3 py-6 sm:px-6 lg:px-10 sm:py-8">

                {/* ========== FILTER SECTION ========== */}
                <section className="bg-white rounded-2xl shadow-xl border border-white/30 p-5 mb-6">
                    <div className="flex justify-between items-center mb-4">
                        <h2 className="text-lg font-semibold text-gray-800 flex items-center gap-2">
                            <Filter size={22} />
                            ตัวกรองข้อมูล
                        </h2>
                        <button
                            onClick={() => setShowFilters(!showFilters)}
                            className="md:hidden bg-gray-200 hover:bg-gray-300 p-2 rounded-lg transition-colors"
                        >
                            {showFilters ? <ChevronUp size={20} /> : <ChevronDown size={20} />}
                        </button>
                    </div>

                    {showFilters && (
                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-2">สถานะ</label>
                                <select
                                    value={filterStatus}
                                    onChange={(e) => handleFilterChange(e.target.value)}
                                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#026a75] focus:border-transparent"
                                >
                                    <option value="all">ทั้งหมด</option>
                                    <option value="Open">Open</option>
                                    <option value="In Progress">In Progress</option>
                                    <option value="Closed">Closed</option>
                                </select>
                            </div>
                        </div>
                    )}
                </section>

                {/* ========== STATISTICS CARDS ========== */}
                <section className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3 lg:gap-4 mb-6">
                    <StatCard label="รายการทั้งหมด" value={stats.total} icon={FileText} colorClass={{ text: 'text-gray-800', bg: 'bg-blue-100' }} />
                    <StatCard label="ยกเลิก" value={stats.cancelled} icon={CircleX} colorClass={{ text: 'text-red-600', bg: 'bg-red-100' }} />
                    <StatCard label="รอดำเนินการ" value={stats.pending} icon={Clock} colorClass={{ text: 'text-yellow-600', bg: 'bg-yellow-100' }} />
                    <StatCard label="กำลังดำเนินการ" value={stats.inProgress} icon={MessageSquareQuote} colorClass={{ text: 'text-blue-600', bg: 'bg-blue-100' }} />
                    <StatCard label="เสร็จสิ้น" value={stats.completed} icon={Check} colorClass={{ text: 'text-green-600', bg: 'bg-green-100' }} />
                </section>

                {/* ========== VIEW TOGGLE ========== */}
                <div className="flex rounded-lg bg-gray-200 p-1 w-fit mb-5 text-sm shadow-sm">
                    {[
                        { value: 'table', icon: Table, label: 'รายการ' },
                        { value: 'dashboard', icon: ChartPie, label: 'แดชบอร์ด' }
                    ].map(({ value, icon: Icon, label }) => (
                        <label key={value} className="cursor-pointer">
                            <input
                                type="radio"
                                name="viewType"
                                value={value}
                                checked={activeView === value}
                                onChange={() => setActiveView(value as 'table' | 'dashboard')}
                                className="hidden"
                            />
                            <span className={`flex items-center gap-2 rounded-md py-2 px-5 transition-all ${activeView === value
                                ? 'bg-white font-semibold text-slate-700 shadow-sm'
                                : 'text-slate-600 hover:text-slate-700'
                                }`}>
                                <Icon size={16} />
                                {label}
                            </span>
                        </label>
                    ))}
                </div>

                {/* ========== TABLE VIEW ========== */}
                {activeView === 'table' && (
                    <section className="bg-white rounded-2xl shadow-xl border border-white/30 overflow-hidden">
                        {/* Header */}
                        <div className="p-4 lg:p-5 bg-[#04555e] flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
                            <div>
                                <h2 className="text-xl text-white font-semibold">สถานะรายการขอ</h2>
                                <p className="text-white/80 text-sm mt-1">พบข้อมูล {filteredTickets.length} รายการ</p>
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
                                            <span className="flex items-center gap-1"><Calendar size={12} />{formatDate(item.created_at)}</span>
                                        </div>
                                        <button
                                            onClick={() => handleView(item)}
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
                                                        {formatDate(item.created_at)}
                                                    </span>
                                                </td>
                                                <td className="px-4 py-4">
                                                    <div className="flex justify-center">
                                                        <button
                                                            onClick={() => handleView(item)}
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
                )}
            </div>

            {/* ========== TICKET DETAIL DRAWER ========== */}
            <Sheet open={isDrawerOpen} onOpenChange={setIsDrawerOpen}>
                <SheetContent side="right" className="w-full p-4 sm:p-6 sm:max-w-lg overflow-y-auto">
                    <SheetHeader className="border-b pb-4">
                        <SheetTitle className="text-xl font-bold text-gray-800">รายละเอียดคำร้อง</SheetTitle>
                        <SheetDescription>ข้อมูลคำร้องและสถานะการดำเนินการ</SheetDescription>
                    </SheetHeader>

                    {selectedTicket && (
                        <div className="mt-6 space-y-5">
                            {/* Ticket Info */}
                            <div className="bg-gray-50 rounded-xl p-4 space-y-3">
                                {[
                                    { label: 'รหัสแบบฟอร์ม', value: selectedTicket.form_code },
                                    { label: 'ชื่อแบบฟอร์ม', value: selectedTicket.form_name },
                                    { label: 'ระดับอนุมัติปัจจุบัน', value: selectedTicket.current_level },
                                ].map(({ label, value }) => (
                                    <div key={label} className="flex items-center justify-between">
                                        <span className="text-sm text-gray-500">{label}</span>
                                        <span className="font-medium text-gray-800">{value}</span>
                                    </div>
                                ))}
                                <div className="flex items-center justify-between">
                                    <span className="text-sm text-gray-500">สถานะ</span>
                                    <StatusBadge status={selectedTicket.status} />
                                </div>
                            </div>

                            {/* Creator Info */}
                            <div className="bg-gray-50 rounded-xl p-4 space-y-3">
                                <h4 className="font-semibold text-gray-800 flex items-center gap-2">
                                    <User size={18} /> ข้อมูลผู้สร้าง
                                </h4>
                                {[
                                    { label: 'ผู้สร้าง', value: selectedTicket.created_by },
                                    { label: 'อีเมล', value: selectedTicket.created_by_email },
                                    { label: 'วันที่สร้าง', value: formatDate(selectedTicket.created_at) },
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
                                    <h4 className="font-semibold text-gray-800 flex items-center gap-2">
                                        <FileText size={18} /> ข้อมูลที่กรอก
                                    </h4>
                                    <div className="space-y-2">
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
                                        <p className="text-xs text-gray-500">{formatDate(selectedTicket.created_at)}</p>
                                    </div>
                                </div>
                            </div>
                        </div>
                    )}
                </SheetContent>
            </Sheet>
        </main>
    );
};
