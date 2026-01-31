'use client'
import { useMemo, useState } from "react";
import { type Ticket } from "@/app/mytickets/page";
import { ChartPie, Table } from "lucide-react";
import { TicketsFilter } from "./ticketsfilter";
import { StatCards } from "./ticketsdashboard";
import { DataTable, Viewer } from "./ticketstable";
import Swal from "sweetalert2";

// ===================== CONSTANTS =====================
const paging = [
    {
        value: 'table', label: 'รายการ', icon: Table
    },
    {
        value: 'dashboard', label: 'แดชบอร์ด', icon: ChartPie
    }
];

// ===================== SUB COMPONENTS =====================

const Toggle = ({ setActiveView, activeView, paging }: { setActiveView: any, activeView: string, paging: any[] }) => {
    return (
        <div className="flex rounded-lg bg-gray-200 p-1 w-fit mb-5 text-sm shadow-sm">
            {paging.map(({ value, icon: Icon, label }) => (
                <label key={value} className="cursor-pointer">
                    <input
                        type="radio"
                        name="viewType"
                        value={value}
                        checked={activeView === value}
                        onChange={() => setActiveView(value)}
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
    )
}

// ===================== MAIN COMPONENT =====================
export const TicketComponent = ({
    tickets,
    onSelect,
    formData,
    onApprove,
    onReject
}: {
    tickets: Ticket[];
    onSelect: (ticket: Ticket) => void;
    formData: any | null;
    onApprove?: (ticket: Ticket) => Promise<void> | void;
    onReject?: (ticket: Ticket) => Promise<void> | void;
}) => {
    const [activeView, setActiveView] = useState<string>('table');
    const [loading] = useState(false);
    const [selectedTicket, setSelectedTicket] = useState<Ticket | null>(null);
    const [isDrawerOpen, setIsDrawerOpen] = useState(false);
    const [filterStatus, setFilterStatus] = useState<string>('all');

    // =================== COMPUTED VALUES ===================

    const stats = useMemo(() => ({
        total: tickets.length,
        cancelled: tickets.filter(t => t.status === 'Rejected' || t.status === 'Closed').length,
        pending: tickets.filter(t => t.status === 'Pending' || t.status === 'Open').length,
        inProgress: tickets.filter(t => t.status === 'In Progress').length,
        completed: tickets.filter(t => t.status === 'Approved').length,
    }), [tickets]);

    const filteredTickets = useMemo(() =>
        filterStatus === 'all' ? tickets : tickets.filter(t => t.status === filterStatus),
        [tickets, filterStatus]
    );

    // =================== HANDLERS ===================

    const handleView = (ticket: Ticket) => {
        setSelectedTicket(ticket);
        setIsDrawerOpen(true);
        onSelect(ticket);
    };

    const handleFilterChange = (status: string) => {
        setFilterStatus(status);
    };

    const handleExportExcel = () => alert('Coming soon');

    const handleApprove = async (ticket: Ticket) => {
        Swal.fire({
            title: 'ยืนยันการอนุมัติคำร้อง',
            text: 'คุณแน่ใจหรือไม่ว่าต้องการอนุมัติคำร้องนี้?',
            icon: 'warning',
            showCancelButton: true,
            allowOutsideClick: false,
            confirmButtonText: 'ใช่, อนุมัติ',
            cancelButtonText: 'ยกเลิก',
        }).then(async (result) => {
            if (result.isConfirmed && onApprove) {
                console.log('Approval:', ticket);
            }
        });
    };

    const handleReject = async (ticket: Ticket) => {
       Swal.fire({
            title: 'เหตุผลการปฏิเสธคำร้อง',
            input: 'textarea',
            allowOutsideClick: false,
            inputPlaceholder: 'กรุณาระบุเหตุผล...',
            showCancelButton: true,
            confirmButtonText: 'ส่ง',
            cancelButtonText: 'ยกเลิก',
            preConfirm: (reason) => {
                if (!reason) {
                    Swal.showValidationMessage('กรุณาระบุเหตุผลการปฏิเสธ');
                }
            }   
        }).then(async (result) => {
            if (result.isConfirmed && onReject) {
               console.log('Rejection reason:', result.value ,ticket);
            }
        });
    };

    return (
        <main className="flex-1 min-h-0 bg-[#f0fafa] rounded-t-[1.5rem] sm:rounded-t-[2rem] lg:rounded-t-[3rem] shadow-2xl overflow-y-auto">
            <div className="w-full max-w-screen-2xl mx-auto px-3 py-6 sm:px-6 lg:px-10 sm:py-8">

                <TicketsFilter filterStatus={filterStatus} handleFilterChange={handleFilterChange} />

                <StatCards stats={stats} />

                <Toggle activeView={activeView} setActiveView={setActiveView} paging={paging} />

                {activeView === 'table' && (
                    <DataTable
                        data={filteredTickets}
                        title="รายการคำร้องทั้งหมด"
                        loading={loading}
                        handleExportExcel={handleExportExcel}
                        onViewTicket={handleView}
                    />
                    
                )}
            </div>

            <Viewer
                ticket={selectedTicket}
                formData={formData}
                isOpen={isDrawerOpen}
                onClose={() => setIsDrawerOpen(false)}
                onApprove={handleApprove}
                onReject={handleReject}
            />

        </main>
    );
};
