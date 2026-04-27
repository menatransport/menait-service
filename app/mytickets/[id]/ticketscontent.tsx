'use client'
import { useMemo, useState, useCallback, useEffect } from "react";
import { type Ticket } from "@/app/mytickets/[id]/page";
import { DataTable, Viewer, type TabType, type SurveyFilter } from "./ticketstable";
import { WaveBackground } from "@/components/wave-background";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { exportToExcel, exportToExcel_Submissions } from "@/lib/exportExcel";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar as CalendarIcon, ChevronLeft, ChevronRight } from "lucide-react";

// ===================== MAIN COMPONENT =====================
export const TicketComponent = ({
    tickets,
    onSelect,
    selectTicketBack,
    onApprove,
    onReject,
    activeTab,
    onTabChange,
    onStatusChange,
    onFormDataUpdate,
    loading,
    role,
    autoOpenTicket,
    autoOpenFormData,
    isAutoOpenSheetOpen,
    isAutoOpenLoading,
    onAutoOpenClose,
    surveyFilter,
    onSurveyFilterChange,
    startMonth,
    endMonth,
    onMonthRangeChange
}: {
    tickets: Ticket[];
    onSelect: (ticket: Ticket) => void;
    selectTicketBack: Ticket | null;
    onApprove?: (ticket: Ticket, remark: string) => Promise<void> | void;
    onReject?: (ticket: Ticket, remark: string) => Promise<void> | void;
    activeTab: TabType;
    onTabChange: (tab: TabType) => void;
    onStatusChange?: (ticket: Ticket, newStatus: string) => void;
    onFormDataUpdate?: (ticket: Ticket) => void;
    loading: boolean;
    role?: string | null;
    // New props types
    autoOpenTicket?: Ticket | null;
    autoOpenFormData?: any;
    isAutoOpenSheetOpen?: boolean;
    isAutoOpenLoading?: boolean;
    onAutoOpenClose?: () => void;
    surveyFilter?: SurveyFilter;
    onSurveyFilterChange?: (filter: SurveyFilter) => void;
    startMonth?: string;
    endMonth?: string;
    onMonthRangeChange?: (startMonth: string, endMonth: string) => void;
}) => {
    const [selectedTicket, setSelectedTicket] = useState<Ticket | null>(null);
    const [isDrawerOpen, setIsDrawerOpen] = useState(false);
    const [filterStatus, setFilterStatus] = useState<string>('all');
    const [viewMode, setViewMode] = useState<'sheet' | 'dialog'>(() => {
        if (typeof window !== 'undefined') {
            const saved = localStorage.getItem('ticket_view_mode');
            if (saved === 'sheet' || saved === 'dialog') return saved;
        }
        return 'sheet';
    });

    const handleViewModeChange = useCallback((mode: 'sheet' | 'dialog') => {
        setViewMode(mode);
        localStorage.setItem('ticket_view_mode', mode);
    }, []);

    // =================== COMPUTED VALUES ===================

    const filteredTickets = useMemo(() =>
        filterStatus === 'all' ? tickets : tickets.filter(t => t.status === filterStatus),
        [tickets, filterStatus]
    );

    // console.log('Filtered Tickets:', filteredTickets);
    // =================== EVENT HANDLERS ===================
    const handleView = useCallback((ticket: Ticket) => {
        setSelectedTicket(ticket);
        setIsDrawerOpen(true);
        onSelect(ticket);
    }, [onSelect]);

    const handleCloseDrawer = useCallback(() => {
        setIsDrawerOpen(false);
    }, []);

    const handleExportExcel = useCallback(() => {
        if (activeTab === 'suv') {
            exportToExcel<Ticket>({
                data: filteredTickets,
                fileName: 'แบบประเมิน',
                sheetName: 'แบบประเมิน',
                columns: [
                    { header: 'รหัสฟอร์ม', key: 'form_code', width: 16 },
                    { header: 'ชื่อฟอร์ม', key: 'form_name', width: 30 },
                    { header: 'รหัสคำร้อง', key: 'form_id', width: 22 },
                    { header: 'รหัสพนักงาน', key: 'created_by', width: 22 },
                    { header: 'ผู้สร้าง', key: (r) => `${r.firstname || ''} ${r.lastname || ''}`.trim() || r.created_by || '', width: 22 },
                    { header: 'อีเมล', key: 'email', width: 26 },
                    { header: 'ฝ่าย', key: 'department_name_th', width: 22 },
                    { header: 'คะแนน (5)', key: (r) => r.point ? `${r.point}` : 'ยังไม่ให้คะแนน', width: 14 },
                    { header: 'ความคิดเห็น', key: (r) => r.comment || '-', width: 30 },
                    { header: 'วันที่ประเมิน', key: (r) => r.survey_at ? new Date(r.survey_at).toLocaleDateString('th-TH') : '', width: 16 },
                ],
            });
        } else {
            if (role !== "a") {
                exportToExcel<Ticket>({
                    data: filteredTickets,
                    fileName: activeTab === 'my' ? 'คำร้องของฉัน' : 'รายการรออนุมัติ',
                    sheetName: activeTab === 'my' ? 'คำร้องของฉัน' : 'รออนุมัติ',
                    columns: [
                        { header: 'รหัสฟอร์ม', key: 'form_code', width: 16 },
                        { header: 'ชื่อฟอร์ม', key: 'form_name', width: 30 },
                        { header: 'รหัสคำร้อง', key: 'form_id', width: 22 },
                        { header: 'รหัสพนักงาน', key: 'created_by', width: 22 },
                        { header: 'ผู้สร้าง', key: (r) => `${r.firstname || ''} ${r.lastname || ''}`.trim() || r.created_by || '', width: 22 },
                        { header: 'อีเมล', key: 'email', width: 26 },
                        { header: 'ฝ่าย', key: 'department_name_th', width: 22 },
                        { header: 'สถานะ', key: 'status', width: 14 },
                        { header: 'ผู้อนุมัติ', key: (r) => `${r.action_by_firstname || ''} ${r.action_by_lastname || ''}`.trim() || '-', width: 22 },
                        { header: 'สถานะอนุมัติ', key: (r) => r.status_approve || '-', width: 14 },
                        { header: 'หมายเหตุผู้อนุมัติ', key: 'remark', width: 30 },
                        { header: 'วันที่อนุมัติ', key: (r) => r.action_at ? new Date(r.action_at).toLocaleDateString('th-TH') : '', width: 16 },
                        { header: 'วันที่สร้าง', key: (r) => r.created_at ? new Date(r.created_at).toLocaleDateString('th-TH') : '', width: 16 },
                        { header: 'หมายเหตุไอที', key: 'admin_comment', width: 30 },
                    ],
                });
            } else {
                exportToExcel_Submissions(filteredTickets as any);
            }
        }
    }, [filteredTickets, activeTab, role]);

    // =================== TAB CHANGE HANDLER ===================
    const handleTabChange = useCallback((value: string) => {
        onTabChange(value as TabType);
    }, [onTabChange]);

    return (
        <main className="flex-1 min-h-0 bg-[#026a75] rounded-t-[1.5rem] sm:rounded-t-[2rem] lg:rounded-t-[3rem] shadow-2xl overflow-y-auto relative">
            <WaveBackground />
            <div className="w-full max-w-screen-2xl mx-auto px-3 py-6 sm:px-6 lg:px-10 sm:py-8 relative z-10">
                <Tabs value={activeTab} onValueChange={handleTabChange}>
                    <div className="flex items-center justify-between mb-6">
                        <TabsList className="mb-6 bg-gray-800/50 backdrop-blur-sm p-1 rounded-full">
                            <TabsTrigger
                                value="apv"
                                className="px-5 py-2 rounded-full text-white/70 font-medium transition-all data-[state=active]:bg-white data-[state=active]:text-teal-700 data-[state=active]:shadow-md hover:text-white"
                            >
                                งานรออนุมัติ
                            </TabsTrigger>
                            <TabsTrigger
                                value="my"
                                className="px-5 py-2 rounded-full text-white/70 font-medium transition-all data-[state=active]:bg-white data-[state=active]:text-teal-700 data-[state=active]:shadow-md hover:text-white"
                            >
                                งานของฉัน
                            </TabsTrigger>
                            {role == "a" && (<TabsTrigger
                                value="suv"
                                className="px-5 py-2 rounded-full text-white/70 font-medium transition-all data-[state=active]:bg-white data-[state=active]:text-teal-700 data-[state=active]:shadow-md hover:text-white"
                            >
                                แบบประเมิน
                            </TabsTrigger>
                            )}
                        </TabsList>

                        {/* Date range filter — month-only picker. Default = last 2 months. */}
                        <MonthRangeFilter
                            startMonth={startMonth}
                            endMonth={endMonth}
                            onChange={onMonthRangeChange}
                        />

                    </div>

                    <DataTable
                        data={filteredTickets}
                        title={activeTab === 'my' ? 'รายการคำร้องของฉัน' : activeTab === 'apv' ? 'รายการรออนุมัติ' : 'รายการแบบประเมิน'}
                        loading={loading}
                        handleExportExcel={handleExportExcel}
                        onViewTicket={handleView}
                        activeTab={activeTab}
                        onTabChange={onTabChange}
                        role={role}
                        surveyFilter={surveyFilter}
                        onSurveyFilterChange={onSurveyFilterChange}
                        viewMode={viewMode}
                        onViewModeChange={handleViewModeChange}
                    />
                </Tabs>

            </div>

            <Viewer
                ticket={selectedTicket}
                selectTicketBack={selectTicketBack}
                isOpen={isDrawerOpen}
                onClose={handleCloseDrawer}
                onApprove={onApprove || (() => { })}
                onReject={onReject || (() => { })}
                onStatusChange={onStatusChange}
                onFormDataUpdate={onFormDataUpdate}
                role={role}
                mode={viewMode}
            />

            {/* Dialog modal for auto-open from URL (/mytickets/{form_id}) */}
            {autoOpenTicket && (
                <Viewer
                    ticket={autoOpenTicket}
                    selectTicketBack={autoOpenFormData}
                    isOpen={isAutoOpenSheetOpen ?? false}
                    onClose={() => onAutoOpenClose?.()}
                    onApprove={onApprove || (() => { })}
                    onReject={onReject || (() => { })}
                    onStatusChange={onStatusChange}
                    onFormDataUpdate={onFormDataUpdate}
                    role={role}
                    mode="dialog"
                />
            )}
        </main>
    );
};

// ===================== MONTH RANGE FILTER =====================
const THAI_MONTHS_SHORT = ['ม.ค.', 'ก.พ.', 'มี.ค.', 'เม.ย.', 'พ.ค.', 'มิ.ย.', 'ก.ค.', 'ส.ค.', 'ก.ย.', 'ต.ค.', 'พ.ย.', 'ธ.ค.'];

const parseYM = (ym?: string): { y: number; m: number } | null => {
    if (!ym) return null;
    const [y, m] = ym.split('-').map(Number);
    if (!y || !m) return null;
    return { y, m };
};
const fmtYM = (y: number, m: number) => `${y}-${String(m).padStart(2, '0')}`;
const ymToNum = (ym: string) => {
    const p = parseYM(ym);
    return p ? p.y * 12 + (p.m - 1) : 0;
};
const formatMonthLabel = (ym?: string) => {
    const p = parseYM(ym);
    if (!p) return '';
    return `${THAI_MONTHS_SHORT[p.m - 1]} ${(p.y + 543).toString().slice(-2)}`;
};
const shiftMonths = (months: number) => {
    const now = new Date();
    const d = new Date(now.getFullYear(), now.getMonth() - months, 1);
    return fmtYM(d.getFullYear(), d.getMonth() + 1);
};
const currentMonth = () => {
    const now = new Date();
    return fmtYM(now.getFullYear(), now.getMonth() + 1);
};

const PRESETS: { label: string; getRange: () => { start: string; end: string } }[] = [
    { label: 'เดือนนี้', getRange: () => ({ start: currentMonth(), end: currentMonth() }) },
    { label: '3 เดือน', getRange: () => ({ start: shiftMonths(2), end: currentMonth() }) },
    { label: '6 เดือน', getRange: () => ({ start: shiftMonths(5), end: currentMonth() }) },
    { label: '1 ปี', getRange: () => ({ start: shiftMonths(11), end: currentMonth() }) },
];

const MonthRangeFilter = ({
    startMonth,
    endMonth,
    onChange,
}: {
    startMonth?: string;
    endMonth?: string;
    onChange?: (startMonth: string, endMonth: string) => void;
}) => {
    const [open, setOpen] = useState(false);
    const [draftStart, setDraftStart] = useState<string | undefined>(startMonth);
    const [draftEnd, setDraftEnd] = useState<string | undefined>(endMonth);
    const [hover, setHover] = useState<string | null>(null);
    const [viewYear, setViewYear] = useState<number>(parseYM(endMonth)?.y ?? new Date().getFullYear());

    // Sync drafts when popover opens or external props change
    useEffect(() => {
        if (open) {
            setDraftStart(startMonth);
            setDraftEnd(endMonth);
            setHover(null);
            setViewYear(parseYM(endMonth)?.y ?? new Date().getFullYear());
        }
    }, [open, startMonth, endMonth]);

    const apply = useCallback((s: string, e: string) => {
        const [a, b] = ymToNum(s) > ymToNum(e) ? [e, s] : [s, e];
        onChange?.(a, b);
        setOpen(false);
    }, [onChange]);

    const handleMonthClick = (ym: string) => {
        // If no start yet, or both already set -> begin new range
        if (!draftStart || (draftStart && draftEnd)) {
            setDraftStart(ym);
            setDraftEnd(undefined);
            return;
        }
        // Have start, no end -> set end and apply
        const s = ymToNum(draftStart) > ymToNum(ym) ? ym : draftStart;
        const e = ymToNum(draftStart) > ymToNum(ym) ? draftStart : ym;
        setDraftStart(s);
        setDraftEnd(e);
        apply(s, e);
    };

    const applyPreset = (p: typeof PRESETS[number]) => {
        const { start, end } = p.getRange();
        setDraftStart(start);
        setDraftEnd(end);
        apply(start, end);
    };

    // Range checks for cell highlighting (include hover preview)
    const sNum = draftStart ? ymToNum(draftStart) : null;
    const eNum = draftEnd ? ymToNum(draftEnd) : (draftStart && hover ? ymToNum(hover) : null);
    const [lo, hi] = sNum != null && eNum != null
        ? (sNum <= eNum ? [sNum, eNum] : [eNum, sNum])
        : [null, null];

    const buttonLabel = startMonth && endMonth
        ? (startMonth === endMonth
            ? formatMonthLabel(startMonth)
            : `${formatMonthLabel(startMonth)} – ${formatMonthLabel(endMonth)}`)
        : 'เลือกช่วงเดือน';

    return (
        <Popover open={open} onOpenChange={setOpen}>
            <PopoverTrigger asChild>
                <button
                    type="button"
                    className="inline-flex items-center gap-2 bg-teal-800/10 hover:bg-teal-500/20 text-white text-xs sm:text-sm font-medium rounded-full px-3 sm:px-4 py-2 ring-1 ring-white/20 transition-all cursor-pointer mb-6"
                >
                    <CalendarIcon className="w-4 h-4 opacity-90" />
                    <span>{buttonLabel}</span>
                </button>
            </PopoverTrigger>
            <PopoverContent align="end" className="w-70 p-3 rounded-2xl shadow-xl border-gray-200">
                {/* Year navigator */}
                <div className="flex items-center justify-between mb-3">
                    <button
                        type="button"
                        onClick={() => setViewYear((y) => y - 1)}
                        className="p-1.5 rounded-full hover:bg-gray-100 cursor-pointer"
                        aria-label="ปีก่อนหน้า"
                    >
                        <ChevronLeft className="w-4 h-4 text-gray-600" />
                    </button>
                    <div className="text-sm font-semibold text-gray-800">พ.ศ. {viewYear + 543}</div>
                    <button
                        type="button"
                        onClick={() => setViewYear((y) => y + 1)}
                        className="p-1.5 rounded-full hover:bg-gray-100 cursor-pointer"
                        aria-label="ปีถัดไป"
                    >
                        <ChevronRight className="w-4 h-4 text-gray-600" />
                    </button>
                </div>

                {/* Month grid 4x3 */}
                <div className="grid grid-cols-4 gap-1">
                    {THAI_MONTHS_SHORT.map((label, i) => {
                        const ym = fmtYM(viewYear, i + 1);
                        const num = ymToNum(ym);
                        const isStart = draftStart === ym;
                        const isEnd = draftEnd === ym;
                        const inRange = lo != null && hi != null && num >= lo && num <= hi;
                        const isEdge = isStart || isEnd;
                        return (
                            <button
                                key={ym}
                                type="button"
                                onClick={() => handleMonthClick(ym)}
                                onMouseEnter={() => setHover(ym)}
                                onMouseLeave={() => setHover(null)}
                                className={[
                                    "py-2 text-xs rounded-md transition-colors cursor-pointer",
                                    isEdge
                                        ? "bg-teal-600 text-white font-semibold shadow-sm"
                                        : inRange
                                            ? "bg-teal-100 text-teal-800"
                                            : "text-gray-700 hover:bg-gray-100",
                                ].join(' ')}
                            >
                                {label}
                            </button>
                        );
                    })}
                </div>

                {/* Presets */}
                <div className="mt-3 pt-3 border-t border-gray-100 flex flex-wrap gap-1.5">
                    {PRESETS.map((p) => (
                        <button
                            key={p.label}
                            type="button"
                            onClick={() => applyPreset(p)}
                            className="text-[11px] px-2.5 py-1 rounded-full bg-gray-100 hover:bg-teal-100 hover:text-teal-700 text-gray-700 transition-colors cursor-pointer"
                        >
                            {p.label}
                        </button>
                    ))}
                </div>

                {/* Helper text */}
                <p className="mt-2 text-[10px] text-gray-400 text-center">
                    {!draftStart || draftEnd ? 'แตะเดือนเริ่มต้น' : 'แตะเดือนสิ้นสุด'}
                </p>
            </PopoverContent>
        </Popover>
    );
};
