'use client';
import { NavElse } from '@/components/navbar';

export default function TicketsPage() {
    return (
        <div>
            <NavElse title="ติดตามสถานะคำร้อ" />
            <main className="p-4">
                <h1 className="text-2xl font-bold mb-4">Tickets Page</h1>
                {/* Ticket content goes here */}
            </main>
        </div>
    );
}