'use client';

import { Loader2 } from 'lucide-react';

interface LoadingSpinnerProps {
    text?: string;
    size?: 'sm' | 'md' | 'lg';
}

export function LoadingSpinner({ text = 'กำลังโหลด...', size = 'md' }: LoadingSpinnerProps) {
    const sizeClasses = {
        sm: 'w-4 h-4',
        md: 'w-8 h-8',
        lg: 'w-12 h-12'
    };

    return (
        <div className="flex flex-col items-center justify-center gap-3 py-8">
            <Loader2 className={`${sizeClasses[size]} text-[#026a75] animate-spin`} />
            {text && <span className="text-gray-500 text-sm">{text}</span>}
        </div>
    );
}

export function PageLoading() {
    return (
        <div className="h-screen flex flex-col overflow-hidden bg-linear-to-br from-[#026a75] via-[#037a86] to-[#025f68]">
            <div className="flex-1 min-h-0 bg-[#f0fafa] rounded-t-[1.5rem] sm:rounded-t-[2rem] lg:rounded-t-[3rem] shadow-2xl flex items-center justify-center">
                <div className="flex flex-col items-center gap-4">
                    <div className="w-16 h-16 bg-white rounded-2xl shadow-lg flex items-center justify-center animate-pulse">
                        <Loader2 className="w-8 h-8 text-[#026a75] animate-spin" />
                    </div>
                    <div className="text-center">
                        <p className="text-[#026a75] font-semibold">กำลังโหลด...</p>
                        <p className="text-gray-400 text-sm">กรุณารอสักครู่</p>
                    </div>
                </div>
            </div>
        </div>
    );
}

export function ContentLoading() {
    return (
        <div className="flex items-center justify-center min-h-50">
            <LoadingSpinner />
        </div>
    );
}

// Skeleton components for different use cases
export function CardSkeleton() {
    return (
        <div className="bg-white rounded-2xl p-6 shadow-lg animate-pulse">
            <div className="flex items-center gap-4 mb-4">
                <div className="w-12 h-12 bg-gray-200 rounded-xl"></div>
                <div className="flex-1">
                    <div className="h-4 bg-gray-200 rounded w-3/4 mb-2"></div>
                    <div className="h-3 bg-gray-200 rounded w-1/2"></div>
                </div>
            </div>
            <div className="space-y-2">
                <div className="h-3 bg-gray-200 rounded w-full"></div>
                <div className="h-3 bg-gray-200 rounded w-5/6"></div>
            </div>
        </div>
    );
}

export function FormSkeleton() {
    return (
        <div className="space-y-4 animate-pulse">
            <div className="h-10 bg-gray-200 rounded-xl w-full"></div>
            <div className="h-10 bg-gray-200 rounded-xl w-full"></div>
            <div className="h-24 bg-gray-200 rounded-xl w-full"></div>
            <div className="h-10 bg-gray-200 rounded-xl w-1/3"></div>
        </div>
    );
}

export function TableSkeleton({ rows = 5 }: { rows?: number }) {
    return (
        <div className="bg-white rounded-2xl p-4 shadow-lg animate-pulse">
            <div className="h-8 bg-gray-200 rounded mb-4"></div>
            {Array.from({ length: rows }).map((_, i) => (
                <div key={i} className="h-12 bg-gray-100 rounded mb-2"></div>
            ))}
        </div>
    );
}
