'use client'
import { useMemo, useState, useCallback } from "react";
import { type Ticket } from "@/app/mytickets/[id]/page";
import { DataTable, Viewer, type TabType } from "./ticketstable";
import { WaveBackground } from "@/components/wave-background";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";

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
    onAutoOpenClose
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
}) => {
    const [selectedTicket, setSelectedTicket] = useState<Ticket | null>(null);
    const [isDrawerOpen, setIsDrawerOpen] = useState(false);
    const [filterStatus, setFilterStatus] = useState<string>('all');

    // =================== COMPUTED VALUES ===================

    const filteredTickets = useMemo(() =>
        filterStatus === 'all' ? tickets : tickets.filter(t => t.status === filterStatus),
        [tickets, filterStatus]
    );

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
        console.log('Export to Excel - Coming soon');
    }, []);

    // =================== TAB CHANGE HANDLER ===================
    const handleTabChange = useCallback((value: string) => {
        onTabChange(value as TabType);
    }, [onTabChange]);

    return (
        <main className="flex-1 min-h-0 bg-[#026a75] rounded-t-[1.5rem] sm:rounded-t-[2rem] lg:rounded-t-[3rem] shadow-2xl overflow-y-auto relative">
            <WaveBackground />
            <div className="w-full max-w-screen-2xl mx-auto px-3 py-6 sm:px-6 lg:px-10 sm:py-8 relative z-10">
                <Tabs value={activeTab} onValueChange={handleTabChange}>
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
                    </TabsList>

                    <DataTable
                        data={filteredTickets}
                        title={activeTab === 'my' ? 'รายการคำร้องของฉัน' : 'รายการรออนุมัติ'}
                        loading={loading}
                        handleExportExcel={handleExportExcel}
                        onViewTicket={handleView}
                        activeTab={activeTab}
                        onTabChange={onTabChange}
                        role={role}
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
