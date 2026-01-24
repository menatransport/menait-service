'use client';
import { Navbar } from '@/components/navbar';
import { TicketComponent } from '@/components/ticketscontent';
import { Ticket } from 'lucide-react';
import { useEffect, useState } from 'react';


export type Ticket = {
    form_id: string;
    current_level: number;
    submission_id: string;
    form_code: string;
    status: string;
    created_by: string;
    created_at: string;
};

export default function TicketsPage() {
    const [tickets, setTickets] = useState<Ticket[]>([]);
    const [selectedTicket, setSelectedTicket] = useState<Ticket | null>(null);
    
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
        fetchData();

    }, []);

    const handleSelected = async (ticket: Ticket) => {
        const res = await fetch(`/api/formsubmit?path=${ticket.form_id}`, {
            method: "GET",
        });
        const data = await res.json();
        console.log('Fetched form data for selected ticket:', data);
        setSelectedTicket(data);
    }

    return (
        <Navbar isHome={false} title="ติดตามสถานะคำร้อง">
            <TicketComponent tickets={tickets} formData={selectedTicket} onSelect={(e) => handleSelected(e)} />
        </Navbar>
    );
}