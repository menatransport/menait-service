'use client'
import { useMemo, useState, useCallback, useEffect } from "react";
import { type Ticket } from "@/app/mytickets/page";
import { DataTable, Viewer, type TabType } from "./ticketstable";

// ===================== MAIN COMPONENT =====================
export const TicketComponent = ({
    tickets,
    onSelect,
    formData,
    onApprove,
    onReject,
    activeTab,
    onTabChange,
    onStatusChange,
    onFormDataUpdate,
    loading,
    role
}: {
    tickets: Ticket[];
    onSelect: (ticket: Ticket) => void;
    formData: any | null;
    onApprove?: (ticket: Ticket, remark: string) => Promise<void> | void;
    onReject?: (ticket: Ticket, remark: string) => Promise<void> | void;
    activeTab: TabType;
    onTabChange: (tab: TabType) => void;
    onStatusChange?: (ticket: Ticket, newStatus: string) => void;
    onFormDataUpdate?: (ticket: Ticket) => void;
    loading: boolean;
    role?: string | null;
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

    return (
        <main className="flex-1 min-h-0 bg-[#f0fafa] rounded-t-[1.5rem] sm:rounded-t-[2rem] lg:rounded-t-[3rem] shadow-2xl overflow-y-auto">
            <div className="w-full max-w-screen-2xl mx-auto px-3 py-6 sm:px-6 lg:px-10 sm:py-8">

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

            </div>

            <Viewer
                ticket={selectedTicket}
                formData={formData}
                isOpen={isDrawerOpen}
                onClose={handleCloseDrawer}
                onApprove={onApprove || (() => {})}
                onReject={onReject || (() => {})}
                onStatusChange={onStatusChange}
                onFormDataUpdate={onFormDataUpdate}
                role={role}
            />

        </main>
    );
};
