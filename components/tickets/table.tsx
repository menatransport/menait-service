'use client';

import { useState, useMemo } from 'react';
import { Button } from "../ui/button";
import { Badge } from "../ui/badge";
import { type Ticket } from "@/app/mytickets/page";
import { FormData, STATUS_CONFIG } from "./types";
import { 
    ChevronLeft, 
    ChevronRight, 
    ChevronsLeft, 
    ChevronsRight,
    Calendar,
    Mail,
    FileText,
    Eye,
    CheckCircle2,
    XCircle,
    Clock,
    Hash
} from "lucide-react";

interface TicketsTableProps {
    filteredTickets: Ticket[];
    onSelect: (ticket: Ticket) => void;
    formData: FormData | null;
    onApprove?: () => void;
    onReject?: () => void;
    isLoading?: boolean;
}

// Items per page
const ITEMS_PER_PAGE = 50;

// Generate avatar colors based on name
const getAvatarColor = (name: string): string => {
    const colors = [
        'bg-gradient-to-br from-rose-400 to-rose-600',
        'bg-gradient-to-br from-orange-400 to-orange-600',
        'bg-gradient-to-br from-amber-400 to-amber-600',
        'bg-gradient-to-br from-emerald-400 to-emerald-600',
        'bg-gradient-to-br from-teal-400 to-teal-600',
        'bg-gradient-to-br from-cyan-400 to-cyan-600',
        'bg-gradient-to-br from-blue-400 to-blue-600',
        'bg-gradient-to-br from-indigo-400 to-indigo-600',
        'bg-gradient-to-br from-violet-400 to-violet-600',
        'bg-gradient-to-br from-purple-400 to-purple-600',
        'bg-gradient-to-br from-fuchsia-400 to-fuchsia-600',
        'bg-gradient-to-br from-pink-400 to-pink-600',
    ];
    const index = name.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0) % colors.length;
    return colors[index];
};

// Get initials from email or name
const getInitials = (email: string): string => {
    if (!email) return '??';
    const name = email.split('@')[0];
    const parts = name.split(/[._-]/);
    if (parts.length >= 2) {
        return (parts[0][0] + parts[1][0]).toUpperCase();
    }
    return name.substring(0, 2).toUpperCase();
};

// User Avatar Component
const UserAvatar = ({ email, size = 'md' }: { email: string; size?: 'sm' | 'md' | 'lg' }) => {
    const initials = getInitials(email);
    const colorClass = getAvatarColor(email);
    
    const sizeClasses = {
        sm: 'w-8 h-8 text-xs',
        md: 'w-10 h-10 text-sm',
        lg: 'w-12 h-12 text-base'
    };

    return (
        <div 
            className={`${sizeClasses[size]} ${colorClass} rounded-full flex items-center justify-center text-white font-semibold shadow-lg ring-2 ring-white/50 transition-transform hover:scale-110`}
        >
            {initials}
        </div>
    );
};

// Status Badge for table
const TableStatusBadge = ({ status }: { status: string }) => {
    const config = STATUS_CONFIG[status] || {
        label: status,
        variant: 'outline' as const,
        className: 'bg-gray-100 text-gray-800 border-gray-300'
    };

    const getStatusIcon = (status: string) => {
        switch (status) {
            case 'Approved': return <CheckCircle2 className="w-3 h-3" />;
            case 'Rejected': return <XCircle className="w-3 h-3" />;
            case 'Pending': return <Clock className="w-3 h-3" />;
            default: return null;
        }
    };

    return (
        <Badge variant={config.variant} className={`${config.className} text-xs flex items-center gap-1 px-2.5 py-1`}>
            {getStatusIcon(status)}
            {config.label}
        </Badge>
    );
};

// Format date for display
const formatDate = (dateString: string): string => {
    try {
        const date = new Date(dateString);
        return date.toLocaleDateString('th-TH', {
            year: 'numeric',
            month: 'short',
            day: 'numeric'
        });
    } catch {
        return dateString.split('T')[0];
    }
};

// Format relative time
const formatRelativeTime = (dateString: string): string => {
    try {
        const date = new Date(dateString);
        const now = new Date();
        const diffMs = now.getTime() - date.getTime();
        const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
        
        if (diffDays === 0) return 'วันนี้';
        if (diffDays === 1) return 'เมื่อวาน';
        if (diffDays < 7) return `${diffDays} วันที่แล้ว`;
        if (diffDays < 30) return `${Math.floor(diffDays / 7)} สัปดาห์ที่แล้ว`;
        if (diffDays < 365) return `${Math.floor(diffDays / 30)} เดือนที่แล้ว`;
        return `${Math.floor(diffDays / 365)} ปีที่แล้ว`;
    } catch {
        return '';
    }
};

// Ticket Card Component
const TicketCard = ({ 
    ticket, 
    onSelect,
    index 
}: { 
    ticket: Ticket; 
    onSelect: (ticket: Ticket) => void;
    index: number;
}) => {
    return (
        <div 
            className="group bg-white rounded-xl border border-slate-200/80 hover:border-[#026a75]/30 shadow-sm hover:shadow-lg transition-all duration-300 overflow-hidden animate-fadeIn"
            style={{ animationDelay: `${index * 30}ms` }}
        >
            {/* Card Header */}
            <div className="p-4 sm:p-5">
                <div className="flex items-start gap-3 sm:gap-4">
                    {/* User Avatar */}
                    <div className="flex-shrink-0">
                        <UserAvatar email={ticket.created_by_email} size="lg" />
                    </div>
                    
                    {/* Content */}
                    <div className="flex-1 min-w-0">
                        {/* Form Name & Status */}
                        <div className="flex flex-wrap items-start justify-between gap-2 mb-2">
                            <h3 className="text-sm sm:text-base font-semibold text-slate-800 truncate max-w-[200px] sm:max-w-none group-hover:text-[#026a75] transition-colors">
                                {ticket.form_name}
                            </h3>
                            <TableStatusBadge status={ticket.status} />
                        </div>
                        
                        {/* Meta Info */}
                        <div className="space-y-1.5">
                            {/* Form ID */}
                            <div className="flex items-center gap-2 text-xs text-slate-500">
                                <Hash className="w-3.5 h-3.5 text-slate-400" />
                                <span className="font-mono truncate">{ticket.form_id}</span>
                            </div>
                            
                            {/* Email */}
                            <div className="flex items-center gap-2 text-xs text-slate-500">
                                <Mail className="w-3.5 h-3.5 text-slate-400" />
                                <span className="truncate">{ticket.created_by_email}</span>
                            </div>
                            
                            {/* Date */}
                            <div className="flex items-center gap-2 text-xs text-slate-500">
                                <Calendar className="w-3.5 h-3.5 text-slate-400" />
                                <span>{formatDate(ticket.created_at)}</span>
                                <span className="text-slate-300">•</span>
                                <span className="text-slate-400">{formatRelativeTime(ticket.created_at)}</span>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
            
            {/* Card Footer - Actions */}
            <div className="px-4 sm:px-5 py-3 bg-gradient-to-r from-slate-50 to-slate-100/50 border-t border-slate-100 flex items-center justify-between gap-2">
                <div className="flex items-center gap-1.5">
                    <FileText className="w-3.5 h-3.5 text-slate-400" />
                    <span className="text-xs text-slate-500 font-medium">{ticket.form_code}</span>
                </div>
                
                <Button
                    size="sm"
                    onClick={() => onSelect(ticket)}
                    className="bg-[#026a75] hover:bg-[#015a63] text-white shadow-md hover:shadow-lg transition-all duration-200 text-xs sm:text-sm px-3 sm:px-4 group-hover:scale-105"
                >
                    <Eye className="w-3.5 h-3.5 mr-1.5" />
                    ดูรายละเอียด
                </Button>
            </div>
        </div>
    );
};

// Pagination Component
const Pagination = ({
    currentPage,
    totalPages,
    onPageChange,
    totalItems,
    startIndex,
    endIndex
}: {
    currentPage: number;
    totalPages: number;
    onPageChange: (page: number) => void;
    totalItems: number;
    startIndex: number;
    endIndex: number;
}) => {
    const getPageNumbers = () => {
        const pages: (number | string)[] = [];
        const showPages = 5;
        
        if (totalPages <= showPages + 2) {
            for (let i = 1; i <= totalPages; i++) pages.push(i);
        } else {
            pages.push(1);
            
            if (currentPage > 3) pages.push('...');
            
            const start = Math.max(2, currentPage - 1);
            const end = Math.min(totalPages - 1, currentPage + 1);
            
            for (let i = start; i <= end; i++) pages.push(i);
            
            if (currentPage < totalPages - 2) pages.push('...');
            
            pages.push(totalPages);
        }
        
        return pages;
    };

    return (
        <div className="flex flex-col sm:flex-row items-center justify-between gap-4 px-2">
            {/* Info */}
            <div className="text-sm text-slate-500 order-2 sm:order-1">
                แสดง <span className="font-semibold text-slate-700">{startIndex + 1}-{Math.min(endIndex, totalItems)}</span> จาก <span className="font-semibold text-slate-700">{totalItems}</span> รายการ
            </div>
            
            {/* Pagination Controls */}
            <div className="flex items-center gap-1 order-1 sm:order-2">
                {/* First Page */}
                <Button
                    variant="outline"
                    size="sm"
                    onClick={() => onPageChange(1)}
                    disabled={currentPage === 1}
                    className="hidden sm:flex h-9 w-9 p-0 border-slate-200 hover:bg-[#026a75]/10 hover:border-[#026a75]/30 disabled:opacity-40"
                >
                    <ChevronsLeft className="w-4 h-4" />
                </Button>
                
                {/* Previous Page */}
                <Button
                    variant="outline"
                    size="sm"
                    onClick={() => onPageChange(currentPage - 1)}
                    disabled={currentPage === 1}
                    className="h-9 w-9 p-0 border-slate-200 hover:bg-[#026a75]/10 hover:border-[#026a75]/30 disabled:opacity-40"
                >
                    <ChevronLeft className="w-4 h-4" />
                </Button>
                
                {/* Page Numbers */}
                <div className="flex items-center gap-1">
                    {getPageNumbers().map((page, index) => (
                        typeof page === 'number' ? (
                            <Button
                                key={index}
                                variant={currentPage === page ? 'default' : 'outline'}
                                size="sm"
                                onClick={() => onPageChange(page)}
                                className={`h-9 w-9 p-0 text-sm font-medium transition-all duration-200 ${
                                    currentPage === page 
                                        ? 'bg-[#026a75] hover:bg-[#015a63] text-white shadow-md' 
                                        : 'border-slate-200 hover:bg-[#026a75]/10 hover:border-[#026a75]/30'
                                }`}
                            >
                                {page}
                            </Button>
                        ) : (
                            <span key={index} className="px-2 text-slate-400">...</span>
                        )
                    ))}
                </div>
                
                {/* Next Page */}
                <Button
                    variant="outline"
                    size="sm"
                    onClick={() => onPageChange(currentPage + 1)}
                    disabled={currentPage === totalPages}
                    className="h-9 w-9 p-0 border-slate-200 hover:bg-[#026a75]/10 hover:border-[#026a75]/30 disabled:opacity-40"
                >
                    <ChevronRight className="w-4 h-4" />
                </Button>
                
                {/* Last Page */}
                <Button
                    variant="outline"
                    size="sm"
                    onClick={() => onPageChange(totalPages)}
                    disabled={currentPage === totalPages}
                    className="hidden sm:flex h-9 w-9 p-0 border-slate-200 hover:bg-[#026a75]/10 hover:border-[#026a75]/30 disabled:opacity-40"
                >
                    <ChevronsRight className="w-4 h-4" />
                </Button>
            </div>
        </div>
    );
};

// Empty State Component
const EmptyState = () => (
    <div className="flex flex-col items-center justify-center py-16 px-4">
        <div className="w-20 h-20 rounded-full bg-gradient-to-br from-slate-100 to-slate-200 flex items-center justify-center mb-4">
            <FileText className="w-10 h-10 text-slate-400" />
        </div>
        <h3 className="text-lg font-semibold text-slate-700 mb-1">ไม่พบรายการ</h3>
        <p className="text-sm text-slate-500 text-center max-w-sm">
            ไม่พบคำร้องที่ตรงกับเงื่อนไขการค้นหา กรุณาลองปรับตัวกรองใหม่
        </p>
    </div>
);

// Loading Skeleton
const LoadingSkeleton = () => (
    <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
        {[...Array(6)].map((_, i) => (
            <div key={i} className="bg-white rounded-xl border border-slate-200/80 p-5 animate-pulse">
                <div className="flex items-start gap-4">
                    <div className="w-12 h-12 rounded-full bg-slate-200"></div>
                    <div className="flex-1 space-y-3">
                        <div className="h-4 bg-slate-200 rounded w-3/4"></div>
                        <div className="h-3 bg-slate-100 rounded w-1/2"></div>
                        <div className="h-3 bg-slate-100 rounded w-2/3"></div>
                    </div>
                </div>
            </div>
        ))}
    </div>
);

export const TicketsTable = ({ 
    filteredTickets, 
    onSelect, 
    formData,
    onApprove,
    onReject,
    isLoading = false
}: TicketsTableProps) => {
    const [currentPage, setCurrentPage] = useState(1);
    
    // Reset to page 1 when filtered tickets change
    useMemo(() => {
        setCurrentPage(1);
    }, [filteredTickets.length]);
    
    // Calculate pagination
    const totalPages = Math.ceil(filteredTickets.length / ITEMS_PER_PAGE);
    const startIndex = (currentPage - 1) * ITEMS_PER_PAGE;
    const endIndex = startIndex + ITEMS_PER_PAGE;
    const currentTickets = filteredTickets.slice(startIndex, endIndex);
    
    const handlePageChange = (page: number) => {
        setCurrentPage(page);
        // Scroll to top smoothly
        window.scrollTo({ top: 0, behavior: 'smooth' });
    };

    if (isLoading) {
        return (
            <div className="bg-white rounded-xl shadow-sm border border-slate-200/60 overflow-hidden p-6">
                <LoadingSkeleton />
            </div>
        );
    }

    return (
        <div className="space-y-6">
            {/* Results Header */}
            <div className="flex items-center justify-between">
                <h2 className="text-lg font-semibold text-slate-800">
                    รายการคำร้อง
                    <span className="ml-2 text-sm font-normal text-slate-500">
                        ({filteredTickets.length} รายการ)
                    </span>
                </h2>
            </div>
            
            {filteredTickets.length === 0 ? (
                <div className="bg-white rounded-xl shadow-sm border border-slate-200/60 overflow-hidden">
                    <EmptyState />
                </div>
            ) : (
                <>
                    {/* Cards Grid */}
                    <div className="grid grid-cols-1 gap-4">
                        {currentTickets.map((ticket, index) => (
                            <TicketCard
                                key={ticket.form_id}
                                ticket={ticket}
                                onSelect={onSelect}
                                index={index}
                            />
                        ))}
                    </div>
                    
                    {/* Pagination */}
                    {totalPages > 1 && (
                        <div className="bg-white rounded-xl shadow-sm border border-slate-200/60 p-4">
                            <Pagination
                                currentPage={currentPage}
                                totalPages={totalPages}
                                onPageChange={handlePageChange}
                                totalItems={filteredTickets.length}
                                startIndex={startIndex}
                                endIndex={endIndex}
                            />
                        </div>
                    )}
                </>
            )}
            
            {/* Custom CSS for animations */}
            <style jsx global>{`
                @keyframes fadeIn {
                    from {
                        opacity: 0;
                        transform: translateY(10px);
                    }
                    to {
                        opacity: 1;
                        transform: translateY(0);
                    }
                }
                
                .animate-fadeIn {
                    animation: fadeIn 0.4s ease-out forwards;
                    opacity: 0;
                }
            `}</style>
        </div>
    );
}