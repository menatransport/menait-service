'use client'
import { useEffect, useState } from "react";

import { CircleCheck, FileText } from "lucide-react"

import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/components/ui/table"

import {
    Sheet,
    SheetClose,
    SheetContent,
    SheetDescription,
    SheetFooter,
    SheetHeader,
    SheetTitle,
    SheetTrigger,
} from "@/components/ui/sheet"


import { type Ticket } from "@/app/mytickets/page";

import { Button } from "@/components/ui/button";

import { TicketsFilter } from "./filter"
import { TicketsTable } from "./table"

const filterableColumns = [
    {
        key: 'status',
        label: 'Status',
        icon: <CircleCheck className="h-4 w-4" />,
    },
    {
        key: 'form_name',
        label: 'Form',
        icon: <FileText className="h-4 w-4" />,
    }
];


{/* เพิ่ม DataTable Shadcn โดยใช้ข้อมูล tickets */ }

{/* เมื่อกด Action View ให้เรียก onSelect และแสดง Drawer Shadcn มาฝั่งขวา โดยใช้ Design ของ previewform.tsx ด้านใน ให้ Responsive ทั้ง PC และ Mobile */ }

export const TicketComponent = ({ tickets, onSelect, formData }: { tickets: Ticket[], onSelect: (ticket: Ticket) => void, formData: any | null }) => {
    const [columnFilters, setColumnFilters] = useState<Record<string, Set<string>>>({});

    const getUniqueValues = (key: string) => {
        return Array.from(new Set(tickets.map(ticket => ticket[key as keyof Ticket])));
    };

    const toggleFilter = (columnKey: string, value: string) => {
        setColumnFilters(prev => {
            const newFilters = { ...prev };
            if (!newFilters[columnKey]) {
                newFilters[columnKey] = new Set();
            }

            if (newFilters[columnKey].has(value)) {
                newFilters[columnKey].delete(value);
            } else {
                newFilters[columnKey].add(value);
            }

            return newFilters;
        });
    };

    const clearColumnFilter = (columnKey: string) => {
        setColumnFilters(prev => {
            const newFilters = { ...prev };
            delete newFilters[columnKey];
            return newFilters;
        });
    };

    const filteredTickets = tickets.filter(ticket => {
        return Object.entries(columnFilters).every(([columnKey, selectedValues]) => {
            if (selectedValues.size === 0) return true;
            return selectedValues.has(String(ticket[columnKey as keyof Ticket]));
        });
    });

    return (
        <main className="flex-1 min-h-0 bg-[#ffffff] rounded-t-[1.5rem] sm:rounded-t-[2rem] lg:rounded-t-[3rem] shadow-2xl overflow-y-auto">
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-8">
                <div className="w-full">

                    <TicketsFilter 
                        filterableColumns={filterableColumns}
                        columnFilters={columnFilters}
                        getUniqueValues={getUniqueValues}
                        toggleFilter={toggleFilter}
                        clearColumnFilter={clearColumnFilter}
                        setColumnFilters={setColumnFilters}
                    />
                    
                    <TicketsTable 
                        filteredTickets={filteredTickets}
                        onSelect={onSelect}
                        formData={formData}
                    />
        
                </div>
            </div>
        </main>
    );
};