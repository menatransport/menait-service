'use client';
import { Navbar } from '@/components/navbar';
import { TicketComponent } from './tickets/ticketscontent';
import { useEffect, useState, useCallback } from 'react';
import { type TabType } from "@/app/mytickets/tickets/ticketstable"
;


const showSuccessAlert = (title: string) => import('sweetalert2').then(({ default: Swal }) =>
    Swal.fire({
        title,
        icon: 'success',
        showConfirmButton: false,
        timer: 2000
    })
);

export type Ticket = {
    drivercode: string,
    status_approve: string,
    form_code: string,
    title: string,
    description: string,
    img_url: string | null,
    category: string,
    complaint_id: string,
    status: string,
    form_id: string,
    created_at: string,
    updated_at: string | null,
    admin_note: string | null
};


export default function TicketsPage() {
    const [tickets, setTickets] = useState<Ticket[]>([]);
    const [selectedTicket, setSelectedTicket] = useState<Ticket | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [activeTab, setActiveTab] = useState<TabType>('apv');
    const [employeeId, setEmployeeId] = useState<string | null>(null);
    const [role, setRole] = useState<string | null>(null);

    useEffect(() => {
        const user = localStorage.getItem('user');
        if (user) {
            try {
                const parsed = JSON.parse(user);
                setEmployeeId(parsed.employee_id || null);
                setRole(parsed.role || null);
            } catch {
                setEmployeeId(null);
                setRole(null);
            }
        }
    }, []);

    const fetchTickets = useCallback(async (tab: TabType) => {
        if (!employeeId) return;
        setIsLoading(true);
        try {
            const response = await fetch(`https://main-api-mena-548129382487.asia-southeast1.run.app/driver-complaints/?offset=0&limit=10`, {
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
        if( activeTab === 'apv') {
            fetchTickets(activeTab);
        } else if( activeTab === 'my') {
            fetchTickets(activeTab);
        }
        
    }, [employeeId, activeTab, fetchTickets]);

    const handleTabChange = useCallback((tab: TabType) => {
        setActiveTab(tab);
    }, []);

    const handleSelected = async (ticket: Ticket) => {
        const res = await fetch(`/api/formselect?path=${ticket.form_id}`, {
            method: "GET",
        });
        const data = await res.json();
        setSelectedTicket(data[0]);
    }

    const handleApprove = async (ticket: Ticket) => {
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

    const handleReject = async (ticket: Ticket) => {
        try {
            const response = await fetch('/api/tickets', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    form_id: ticket.form_id,
                    employee_id: employeeId,
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
            <Navbar isHome={false} title="ติดตามคำร้องพจส.">
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
        <Navbar isHome={false} title="ติดตามคำร้องพจส." pagelock={true}>
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
            />
        </Navbar>
    );
}