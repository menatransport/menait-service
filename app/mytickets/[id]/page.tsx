'use client';
import { Navbar } from '@/components/navbar';
import dynamic from 'next/dynamic';
import { useEffect, useState, useCallback } from 'react';
import { type TabType } from "@/app/mytickets/[id]/tickets/ticketstable"
import { useSessionContext } from '@/app/context/SessionContext';
import { useParams, useRouter, useSearchParams } from "next/navigation";

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
    created_by: string;
    created_by_email: string;
    created_at: string;
    image_url?: string;
    remark?: string;
};


export default function TicketsPage() {
    const { user } = useSessionContext();
    const { id: formIdFromUrl } = useParams<{ id: string }>();
    const [tickets, setTickets] = useState<Ticket[]>([]);
    const [selectedTicket, setSelectedTicket] = useState<Ticket | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [activeTab, setActiveTab] = useState<TabType>('apv');
    const [autoOpenAttemptedTabs, setAutoOpenAttemptedTabs] = useState<Set<TabType>>(new Set());
    const [autoOpenId, setAutoOpenId] = useState<string | undefined>(formIdFromUrl);
    const param = useSearchParams()
    const router = useRouter();
    const employeeId = user?.employee_id ?? null;
    const role = user?.role ?? null;

    const fetchTickets = useCallback(async (tab: TabType) => {
        if (!employeeId) return;
        setIsLoading(true);
        try {
            const response = await fetch(`/api/tickets?employee_id=${employeeId}&tab=${tab}&role=${role}`, {
                method: 'GET',
                headers: {
                    'Content-Type': 'application/json',
                },
            });
            const data = await response.json();
            console.log('Fetched tickets data:', data);
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

    // Auto-switch tab when autoOpenId ticket is not found in current tab
    useEffect(() => {
        if (!autoOpenId || isLoading) return;
        const found = tickets.find(t => t.form_id === autoOpenId);
        if (!found && !autoOpenAttemptedTabs.has(activeTab)) {
            setAutoOpenAttemptedTabs(prev => new Set(prev).add(activeTab));
            const otherTab: TabType = activeTab === 'apv' ? 'my' : 'apv';
            if (!autoOpenAttemptedTabs.has(otherTab)) {
                setActiveTab(otherTab);
            }
        }
    }, [autoOpenId, tickets, isLoading, activeTab, autoOpenAttemptedTabs]);

    // Clear auto-open state and remove form_id from URL
    const handleAutoOpenClose = useCallback(() => {
        setAutoOpenId(undefined);
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
        console.log('Selected ticket data[0]:', data[0]);
        setSelectedTicket(data[0]);
    }

    const handleApprove = async (ticket: Ticket, remark: string) => {
        console.log('Approving ticket:', ticket);
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
                <main className="flex-1 min-h-0 bg-[#f0fafa] rounded-t-[1.5rem] sm:rounded-t-[2rem] lg:rounded-t-[3rem] shadow-2xl overflow-y-auto">
                    <div className="flex items-center justify-center h-64">
                        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#026a75]"></div>
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
                formData={selectedTicket}
                onSelect={(e) => handleSelected(e)}
                onApprove={handleApprove}
                onReject={handleReject}
                activeTab={activeTab}
                onTabChange={handleTabChange}
                onStatusChange={(ticket, newStatus) => handleUpdateStatus(ticket, newStatus)}
                onFormDataUpdate={(ticket) => handleSelected(ticket)}
                loading={isLoading}
                role={role}
                autoOpenFormId={autoOpenId}
                onAutoOpenClose={handleAutoOpenClose}
            />
        </Navbar>
    );
}