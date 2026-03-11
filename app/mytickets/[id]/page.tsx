'use client';
import { Navbar } from '@/components/navbar';
import dynamic from 'next/dynamic';
import { useEffect, useState, useCallback } from 'react';
import { type TabType } from "@/app/mytickets/[id]/tickets/ticketstable"
import { useSessionContext } from '@/app/context/SessionContext';
import { useParams, useRouter } from "next/navigation";
import { WaveBackground } from '@/components/wave-background';

// bundle-dynamic-imports: Lazy load heavy ticket components
const TicketComponent = dynamic(
    () => import('./tickets/ticketscontent').then(mod => ({ default: mod.TicketComponent })),
    { ssr: false }
);

const showSuccessAlert = (title: string) => import('sweetalert2').then(({ default: Swal }) =>
    Swal.fire({
        title,
        icon: 'success',
        showConfirmButton: false,
        timer: 2000
    })
);

export type Ticket = {
    form_id: string;
    form_version: number;
    current_level: number;
    submission_id: string;
    form_code: string;
    form_name: string;
    status: string;
    status_approve: string;
    firstname: string;
    lastname: string;
    email: string;
    point: number;
    comment: string;
    survey_at: string;
    created_by: string;
    created_by_email: string;
    action_by_firstname: string;
    action_by_lastname: string;
    department_name_th: string;
    created_at: string;
    action_at: string;
    image_url?: string;
    remark?: string;
    admin_comment?: string;
};

export type Survey = {
    point: number;
    comment: string;
    create_at: string;
}

export default function TicketsPage() {
    const { user } = useSessionContext();
    const { id: formIdFromUrl } = useParams<{ id: string }>();
    const [tickets, setTickets] = useState<Ticket[]>([]);
    const [selectedTicket, setSelectedTicket] = useState<Ticket | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [activeTab, setActiveTab] = useState<TabType>('apv');
    const router = useRouter();
    const employeeId = user?.employee_id ?? null;
    const role = user?.role ?? null;

    // State for auto-open from URL
    const [autoOpenTicket, setAutoOpenTicket] = useState<Ticket | null>(null);
    const [autoOpenFormData, setAutoOpenFormData] = useState<any>(null);
    const [isAutoOpenSheetOpen, setIsAutoOpenSheetOpen] = useState(false);
    const [isAutoOpenLoading, setIsAutoOpenLoading] = useState(false);

    const fetchTickets = useCallback(async (tab: TabType) => {
        if (!employeeId) return;
        setIsLoading(true);
        const api = tab === "suv" ? `/api/survey-it?employee_id=${employeeId}&tab=${tab}&role=${role}` : `/api/tickets?employee_id=${employeeId}&tab=${tab}&role=${role}`;
        try {
            const response = await fetch(api, {
                method: 'GET',
                headers: {
                    'Content-Type': 'application/json',
                },
            });
            const data = await response.json();
            // console.log('Fetched tickets data:', data);
            setTickets(Array.isArray(data) ? data : []);
        } catch (error) {
            console.error('Error fetching tickets data:', error);
            setTickets([]);
        } finally {
            setIsLoading(false);
        }
    }, [employeeId, role]);

    useEffect(() => {
        if (!employeeId) return;
        fetchTickets(activeTab);
    }, [employeeId, activeTab, fetchTickets]);

    // Fetch ticket directly by form_id from URL (for /mytickets/{form_id})
    useEffect(() => {
        if (!formIdFromUrl || formIdFromUrl === 'all' || !employeeId) return;

        const fetchTicketById = async () => {
            setIsAutoOpenLoading(true);
            try {
                // Fetch ticket data by form_id
                const ticketRes = await fetch(`/api/formselect?path=${formIdFromUrl}`);
                const ticketData = await ticketRes.json();

                if (ticketRes.ok && ticketData?.[0]) {
                    setAutoOpenTicket(ticketData[0]);
                    setAutoOpenFormData(ticketData[0]);
                    setIsAutoOpenSheetOpen(true);
                } else {
                    console.error('Ticket not found for form_id:', formIdFromUrl);
                }
            } catch (error) {
                console.error('Error fetching ticket by ID:', error);
            } finally {
                setIsAutoOpenLoading(false);
            }
        };

        fetchTicketById();
    }, [formIdFromUrl, employeeId]);

    // Close auto-open sheet and navigate to /mytickets/all
    const handleAutoOpenClose = useCallback(() => {
        setIsAutoOpenSheetOpen(false);
        setAutoOpenTicket(null);
        setAutoOpenFormData(null);
        router.replace('/mytickets/all', { scroll: false });
    }, [router]);

    const handleTabChange = useCallback((tab: TabType) => {
        setActiveTab(tab);
    }, []);

    const handleSelected = async (ticket: Ticket) => {
        const res = await fetch(`/api/formselect?path=${ticket.form_id}`, {
            method: "GET",
        });

        const data = await res.json();
        // console.log('Selected ticket data[0]:', data[0]);
        setSelectedTicket(data[0]);
    }

    const handleApprove = async (ticket: Ticket, remark: string) => {
        // console.log('Approving ticket:', ticket);
        try {
            const res = await fetch('/api/tickets', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    form_id: ticket.form_id,
                    employee_id: employeeId,
                    remark: remark || '',
                    action: 'approve',
                }),
            });

            if (res.ok) {
                setTickets(prev => prev.map(t =>
                    t.form_id === ticket.form_id
                        ? { ...t, status: 'Approved' }
                        : t
                ));
                setSelectedTicket(prev =>
                    prev && prev.form_id === ticket.form_id
                        ? { ...prev, status: 'Approved' }
                        : prev
                );
                await showSuccessAlert('อนุมัติคำร้องสำเร็จ');
            } else {
                const errorData = await res.json().catch(() => ({}));
                alert(`เกิดข้อผิดพลาดในการอนุมัติ: ${errorData.error || res.statusText}`);
            }
        } catch (error) {
            console.error('Error approving ticket:', error);
            alert('เกิดข้อผิดพลาดในการอนุมัติ');
        }
    };

    const handleReject = async (ticket: Ticket, remark: string) => {
        try {
            const response = await fetch('/api/tickets', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    form_id: ticket.form_id,
                    employee_id: employeeId,
                    remark: remark || '',
                    action: 'reject',
                }),
            });
            if (response.ok) {
                setTickets(prev => prev.map(t =>
                    t.form_id === ticket.form_id
                        ? { ...t, status: 'Rejected' }
                        : t
                ));
                setSelectedTicket(prev =>
                    prev && prev.form_id === ticket.form_id
                        ? { ...prev, status: 'Rejected' }
                        : prev
                );
                await showSuccessAlert('ปฏิเสธคำร้องสำเร็จ');
            } else {
                const errorData = await response.json().catch(() => ({}));
                alert(`เกิดข้อผิดพลาดในการปฏิเสธ: ${errorData.error || response.statusText}`);
            }
        } catch (error) {
            console.error('Error rejecting ticket:', error);
            alert('เกิดข้อผิดพลาดในการปฏิเสธ');
        }
    };

    if (isLoading) {
        return (
            <Navbar isHome={false} title="ติดตามสถานะคำร้อง">
                <main className="flex-1 min-h-0 bg-[#026a75] rounded-t-[1.5rem] sm:rounded-t-[2rem] lg:rounded-t-[3rem] shadow-2xl overflow-y-auto relative">
                    <WaveBackground />
                    <div className="flex items-center justify-center h-64 relative z-10">
                        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-white"></div>
                    </div>
                </main>
            </Navbar>
        );
    }

    const handleUpdateStatus = (ticket: Ticket, newStatus: string) => {
        setTickets(prev => prev.map(t =>
            t.form_id === ticket.form_id
                ? { ...t, status: newStatus }
                : t
        ));
    };

    return (
        <Navbar isHome={false} title="ติดตามสถานะคำร้อง">
            <TicketComponent
                tickets={tickets}
                selectTicketBack={selectedTicket}
                onSelect={(e) => handleSelected(e)}
                onApprove={handleApprove}
                onReject={handleReject}
                activeTab={activeTab}
                onTabChange={handleTabChange}
                onStatusChange={(ticket, newStatus) => handleUpdateStatus(ticket, newStatus)}
                onFormDataUpdate={(ticket) => handleSelected(ticket)}
                loading={isLoading}
                role={role}
                // Auto-open Sheet from URL
                autoOpenTicket={autoOpenTicket}
                autoOpenFormData={autoOpenFormData}
                isAutoOpenSheetOpen={isAutoOpenSheetOpen}
                isAutoOpenLoading={isAutoOpenLoading}
                onAutoOpenClose={handleAutoOpenClose}
            />
        </Navbar>
    );
}