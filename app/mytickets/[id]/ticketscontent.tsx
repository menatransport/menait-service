'use client'
import { useMemo, useState, useCallback } from "react";
import { type Ticket } from "@/app/mytickets/[id]/page";
import { DataTable, Viewer, type TabType, type SurveyFilter, type ApvView } from "./ticketstable";
import { WaveBackground } from "@/components/wave-background";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { exportToExcel, exportToExcel_Submissions } from "@/lib/exportExcel";
import { MonthRangeFilter } from "@/components/month-range-filter";

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
    apvView,
    onApvViewChange,
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
    apvView?: ApvView;
    onApvViewChange?: (view: ApvView) => void;
    startMonth?: string;
    endMonth?: string;
    onMonthRangeChange?: (startMonth: string, endMonth: string) => void;
}) => {
    const [selectedTicket, setSelectedTicket] = useState<Ticket | null>(null);
    const [isDrawerOpen, setIsDrawerOpen] = useState(false);
    const [filterStatus, setFilterStatus] = useState<string>('all');
    const [isExporting, setIsExporting] = useState(false);
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

    const handleExportExcel = useCallback(async () => {
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
            const isApvHistory = activeTab === 'apv' && apvView === 'history';
            if (role !== "a" || isApvHistory) {
                exportToExcel<Ticket>({
                    data: filteredTickets,
                    fileName: activeTab === 'my' ? 'คำร้องของฉัน' : isApvHistory ? 'ประวัติการอนุมัติ' : 'รายการรออนุมัติ',
                    sheetName: activeTab === 'my' ? 'คำร้องของฉัน' : isApvHistory ? 'ประวัติการอนุมัติ' : 'รออนุมัติ',
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
                setIsExporting(true);
                try {
                    await exportToExcel_Submissions(filteredTickets as any);
                } finally {
                    setIsExporting(false);
                }
            }
        }
    }, [filteredTickets, activeTab, role, apvView]);

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
                        title={activeTab === 'my' ? 'รายการคำร้องของฉัน' : activeTab === 'apv' ? (apvView === 'history' ? 'รายการอนุมัติ/ปฏิเสธแล้ว' : 'รายการรออนุมัติ') : 'รายการแบบประเมิน'}
                        loading={loading}
                        handleExportExcel={handleExportExcel}
                        isExporting={isExporting}
                        onViewTicket={handleView}
                        activeTab={activeTab}
                        onTabChange={onTabChange}
                        role={role}
                        surveyFilter={surveyFilter}
                        onSurveyFilterChange={onSurveyFilterChange}
                        apvView={apvView}
                        onApvViewChange={onApvViewChange}
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
