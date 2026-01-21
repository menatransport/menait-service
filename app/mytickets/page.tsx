'use client';
import { NavElse, getUserProfile } from '@/components/navbar';
import { TicketComponent } from '@/components/tickets';
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
    const user = getUserProfile();
    const [ tickets, setTickets ] = useState<Ticket[]>([]);
    const [ selectedTicket, setSelectedTicket ] = useState<Ticket | null>(null);
    useEffect(() => {

        const fetchData = async () => {
            try {
                const employee_id = user?.employee_id ;
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

    const handleSelected = (ticket: Ticket) => {
        console.log('Selected ticket:', ticket);
        setSelectedTicket(ticket);
    }

    return (
        <div className="h-screen flex flex-col overflow-hidden bg-linear-to-br from-[#026a75] via-[#037a86] to-[#025f68]">

            <NavElse title="ติดตามสถานะคำร้อง" />

            <main className="flex-1 min-h-0 bg-[#f0fafa] rounded-t-[1.5rem] sm:rounded-t-[2rem] lg:rounded-t-[3rem] shadow-2xl overflow-y-auto">
                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-8">
                   <TicketComponent tickets={tickets} selectedTicket={selectedTicket} onSelect={(e) => handleSelected(e)} />
                </div>
            </main>
        </div>
    );
}