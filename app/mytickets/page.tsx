'use client';
import { Navbar } from '@/components/navbar';
import { TicketComponent } from '@/components/tickets/ticketscontent';
import { Ticket } from 'lucide-react';
import { useEffect, useState } from 'react';


export type Ticket = {
    form_id: string;
    current_level: number;
    submission_id: string;
    form_code: string;
    form_name: string;
    status: string;
    created_by: string;
    created_by_email: string;
    created_at: string;
};

export default function TicketsPage() {
    const [tickets, setTickets] = useState<Ticket[]>([]);
    const [selectedTicket, setSelectedTicket] = useState<Ticket | null>(null);
    const [isLoading, setIsLoading] = useState(true);

    useEffect(() => {
        const fetchData = async () => {
            try {
                const employee_id = localStorage.getItem('user') ? JSON.parse(localStorage.getItem('user') || '{}').employee_id : null;
                const response = await fetch(`/api/tickets?employee_id=${employee_id}`, {
                    method: 'GET',
                    headers: {
                        'Content-Type': 'application/json',
                    },
                });
                const data = await response.json();
                console.log('Fetched tickets data:', data);
                setTickets(data);
            } catch (error) {
                console.error('Error fetching tickets data:', error);
            }
        }
        fetchData().finally(() => setIsLoading(false));

    }, []);

    const handleSelected = async (ticket: Ticket) => {
        const res = await fetch(`/api/formselect?path=${ticket.form_id}`, {
            method: "GET",
        });
        const data = await res.json();
        setSelectedTicket(data[0]);
    }

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

    return (
        <Navbar isHome={false} title="ติดตามสถานะคำร้อง">
            <TicketComponent tickets={tickets} formData={selectedTicket} onSelect={(e) => handleSelected(e)} />
        </Navbar>
    );
}