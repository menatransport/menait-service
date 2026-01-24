'use client'
import { useEffect, useState } from "react";

import { AlertCircle, ArrowUpDown, Calendar, ChevronDown, Eye, CircleCheck, FileText, FunnelX, X } from "lucide-react"

import {
    DropdownMenu,
    DropdownMenuCheckboxItem,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuLabel,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"

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

import { Input } from "./ui/input";

import { Button } from "@/components/ui/button";



{/* เพิ่ม DataTable Shadcn โดยใช้ข้อมูล tickets */ }

{/* เมื่อกด Action View ให้เรียก onSelect และแสดง Drawer Shadcn มาฝั่งขวา โดยใช้ Design ของ previewform.tsx ด้านใน ให้ Responsive ทั้ง PC และ Mobile */ }

export const TicketComponent = ({ tickets, onSelect, formData }: { tickets: Ticket[], onSelect: (ticket: Ticket) => void, formData: any | null }) => {
    const [columnFilters, setColumnFilters] = useState<Record<string, Set<string>>>({});

    const filterableColumns = [
        {
            key: 'status',
            label: 'Status',
            icon: <CircleCheck className="h-4 w-4" />,
        },
        {
            key: 'form_code',
            label: 'Form',
            icon: <FileText className="h-4 w-4" />,
        }
    ];

    const getUniqueValues = (key: string) => {
        console.log('Tickets : ', tickets);
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
        <main className="flex-1 min-h-0 bg-[#f0fafa] rounded-t-[1.5rem] sm:rounded-t-[2rem] lg:rounded-t-[3rem] shadow-2xl overflow-y-auto">
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-8">
                <div className="w-full">
                    <div className="flex items-center gap-2 py-4 flex-wrap">
                        <Input
                            placeholder="ค้นหาไอดีคำร้อง..."
                            className="max-w-sm flex-1"
                            style={{ backgroundColor: "#ffffff" }}
                        // onChange={}
                        />
                        {filterableColumns.map(column => {
                            const uniqueValues = getUniqueValues(column.key);
                            const activeFilters = columnFilters[column.key]?.size || 0;

                            return (
                                <DropdownMenu key={column.key}>
                                    <DropdownMenuTrigger asChild>
                                        <Button
                                            variant="outline"
                                            size="sm"
                                            className="h-8 border-dashed"
                                        >
                                            {column.icon}
                                            <span className="ml-2">{column.label}</span>
                                            {activeFilters > 0 && (
                                                <span className="ml-2 rounded-full bg-primary px-1.5 py-0.5 text-xs text-primary-foreground">
                                                    {activeFilters}
                                                </span>
                                            )}
                                        </Button>
                                    </DropdownMenuTrigger>
                                    <DropdownMenuContent align="start" className="w-48">
                                        <div className="flex justify-between">
                                            <DropdownMenuLabel>
                                                {column.label}
                                            </DropdownMenuLabel>
                                            <Button
                                                variant="ghost"
                                                size="sm"
                                                onClick={() => clearColumnFilter(column.key)}
                                            ><FunnelX className="w-12 text-red-700" /></Button>
                                        </div>
                                        <DropdownMenuSeparator />
                                        {uniqueValues.map((value) => (
                                            <DropdownMenuCheckboxItem
                                                key={String(value)}
                                                checked={columnFilters[column.key]?.has(String(value)) || false}
                                                onCheckedChange={() => toggleFilter(column.key, String(value))}
                                            >
                                                {String(value)}
                                            </DropdownMenuCheckboxItem>
                                        ))}
                                    </DropdownMenuContent>
                                </DropdownMenu>
                            );
                        })}

                        {Object.keys(columnFilters).length > 0 && (
                            <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => setColumnFilters({})}
                                className="h-8 px-2 lg:px-3"
                            >
                                Reset
                                <X className="ml-2 h-4 w-4" />
                            </Button>
                        )}
                    </div>
                    <div className="bg-white rounded-lg shadow-md overflow-x-auto p-4">
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead>Form ID</TableHead>
                                    <TableHead>Form Code</TableHead>
                                    <TableHead>Status</TableHead>
                                    <TableHead>Created At</TableHead>
                                    <TableHead>Action</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {filteredTickets.map((ticket) => (
                                    <TableRow key={ticket.submission_id}>
                                        <TableCell>{ticket.form_id}</TableCell>
                                        <TableCell>{ticket.form_code}</TableCell>
                                        <TableCell>{ticket.status}</TableCell>
                                        <TableCell>{new Date(ticket.created_at).toLocaleDateString()}</TableCell>
                                        <TableCell>
                                            <Sheet>
                                                <SheetTrigger asChild>
                                                    <Button variant="outline" onClick={() => onSelect(ticket)}>View</Button>
                                                </SheetTrigger>
                                                <SheetContent>
                                                    {/* <PreviewForm
                                                    formData={formData}
                                                    clearAfterSubmit={false}
                                                /> */}
                                                    <SheetFooter>
                                                        <Button type="submit">Save changes</Button>
                                                        <SheetClose asChild>
                                                            <Button variant="outline">Close</Button>
                                                        </SheetClose>
                                                    </SheetFooter>
                                                </SheetContent>
                                            </Sheet>
                                        </TableCell>
                                    </TableRow>
                                ))}
                            </TableBody>
                        </Table>
                    </div>


                    {/* Use Drawer side Right */}  {/* <PreviewForm /> */}
                    {/* {selectedTicket && ( 
                <div className="fixed top-0 right-0 h-full w-full sm:w-1/2 md:w-1/3 lg:w-1/4 bg-white shadow-lg p-6 overflow-y-auto">
                    <div className="flex justify-between items-center mb-4">
                        <h2 className="text-xl font-semibold">Ticket Details</h2>
                    </div>
                   
                    </div>
            )} */}








                </div>
            </div>
        </main>
    );
};