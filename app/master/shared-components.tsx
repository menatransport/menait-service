'use client';

import { memo, type ReactNode, type ChangeEvent } from 'react';
import { Button } from '@/components/ui/button';
import {
    Search, X, AlertCircle, RotateCcw, FileSpreadsheet, Users
} from 'lucide-react';
import { getStatusStyle } from './constants';
import type { ColumnConfig } from './types';

// ===================== STATUS BADGE =====================
// rerender-memo: Memoize for performance

interface StatusBadgeProps {
    status: string | null;
}

export const StatusBadge = memo(({ status }: StatusBadgeProps) => (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 text-xs font-medium rounded-full border ${getStatusStyle(status)}`}>
        <span className="w-1.5 h-1.5 rounded-full bg-current shrink-0" />
        {status || '-'}
    </span>
));
StatusBadge.displayName = 'StatusBadge';

// ===================== EMPTY STATES =====================
// rendering-hoist-jsx: Extract static empty state components

interface EmptyStateProps {
    icon?: ReactNode;
    title: string;
    description?: string;
}

export const EmptyState = memo(({ icon, title, description }: EmptyStateProps) => (
    <div className="flex flex-col items-center gap-3 py-16">
        <div className="w-14 h-14 bg-gray-100 rounded-2xl flex items-center justify-center">
            {icon || <Users className="w-6 h-6 text-gray-400" />}
        </div>
        <p className="text-sm text-gray-500 font-medium">{title}</p>
        {description && <p className="text-xs text-gray-400">{description}</p>}
    </div>
));
EmptyState.displayName = 'EmptyState';

// Preset empty states
export const UserEmptyState = memo(() => (
    <EmptyState
        icon={<Users className="w-6 h-6 text-gray-400" />}
        title="ไม่พบข้อมูลพนักงาน"
        description="ลองปรับเงื่อนไขการค้นหา"
    />
));
UserEmptyState.displayName = 'UserEmptyState';

export const FormEmptyState = memo(() => (
    <EmptyState
        icon={<FileSpreadsheet className="w-6 h-6 text-gray-400" />}
        title="ไม่พบแบบฟอร์ม"
        description="ยังไม่มีแบบฟอร์มในระบบ"
    />
));
FormEmptyState.displayName = 'FormEmptyState';

// ===================== ERROR STATE =====================

interface ErrorStateProps {
    message: string;
    onRetry: () => void;
}

export const ErrorState = memo(({ message, onRetry }: ErrorStateProps) => (
    <div className="overflow-hidden rounded-2xl border border-red-100 bg-white shadow-sm">
        <div className="flex flex-col items-center gap-4 p-12">
            <div className="w-14 h-14 bg-red-50 rounded-2xl flex items-center justify-center">
                <AlertCircle className="w-6 h-6 text-red-400" />
            </div>
            <div className="text-center">
                <p className="text-sm font-medium text-gray-700">{message}</p>
                <p className="text-xs text-gray-400 mt-1">กรุณาลองใหม่อีกครั้ง</p>
            </div>
            <Button variant="outline" onClick={onRetry} className="gap-2 rounded-xl">
                <RotateCcw className="w-4 h-4" />
                ลองใหม่
            </Button>
        </div>
    </div>
));
ErrorState.displayName = 'ErrorState';

// ===================== SEARCH INPUT =====================

interface SearchInputProps {
    value: string;
    onChange: (e: ChangeEvent<HTMLInputElement>) => void;
    onClear: () => void;
    placeholder?: string;
    className?: string;
}

export const SearchInput = memo(({
    value,
    onChange,
    onClear,
    placeholder = 'ค้นหา...',
    className = 'w-full'
}: SearchInputProps) => (
    <div className="relative mt-3">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
        <input
            type="text"
            value={value}
            onChange={onChange}
            placeholder={placeholder}
            className={`${className} sm:w-1/3 h-10 pl-10 pr-10 bg-[#f6fefffd] border border-white/15 rounded-xl text-sm text-gray-800 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-[#026a75] focus:ring-opacity-50 transition-all`}
        />
        {value && (
            <button
                onClick={onClear}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 transition-colors cursor-pointer"
            >
                <X className="w-4 h-4" />
            </button>
        )}
    </div>
));
SearchInput.displayName = 'SearchInput';

// ===================== TABLE HEADER =====================

interface TableHeaderProps {
    icon: ReactNode;
    title: string;
    subtitle: string;
    actions?: ReactNode;
    searchValue: string;
    onSearchChange: (e: ChangeEvent<HTMLInputElement>) => void;
    onSearchClear: () => void;
    searchPlaceholder?: string;
}

export const TableHeader = memo(({
    icon,
    title,
    subtitle,
    actions,
    searchValue,
    onSearchChange,
    onSearchClear,
    searchPlaceholder
}: TableHeaderProps) => (
    <div className="bg-linear-to-r from-[#064b50] to-[#046c75] px-4 sm:px-6 py-4 sm:py-5">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
                <h2 className="text-lg font-bold text-white flex items-center gap-2">
                    {icon}
                    {title}
                </h2>
                <p className="text-white/60 text-xs mt-0.5">{subtitle}</p>
            </div>
            {actions && <div className="flex items-center gap-2">{actions}</div>}
        </div>
        <SearchInput
            value={searchValue}
            onChange={onSearchChange}
            onClear={onSearchClear}
            placeholder={searchPlaceholder}
        />
    </div>
));
TableHeader.displayName = 'TableHeader';

// ===================== TABLE WRAPPER =====================

interface TableWrapperProps {
    children: ReactNode;
}

export const TableWrapper = memo(({ children }: TableWrapperProps) => (
    <div className="overflow-hidden rounded-2xl border border-gray-100 bg-white shadow-sm">
        {children}
    </div>
));
TableWrapper.displayName = 'TableWrapper';

// ===================== TABLE HEAD =====================

interface TableHeadProps {
    columns: ColumnConfig[];
}

export const TableHead = memo(({ columns }: TableHeadProps) => (
    <thead>
        <tr className="bg-gray-50 border-b border-gray-100">
            {columns.map(col => (
                <th
                    key={col.key}
                    className="px-4 py-2.5 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider select-none"
                >
                    {col.label}
                </th>
            ))}
        </tr>
    </thead>
));
TableHead.displayName = 'TableHead';

// ===================== EXCEL EXPORT BUTTON =====================

interface ExcelButtonProps {
    onClick?: () => void;
}

export const ExcelButton = memo(({ onClick }: ExcelButtonProps) => (
    <button
        onClick={onClick}
        className="bg-emerald-500/20 border border-emerald-300/30 hover:bg-emerald-500/30 text-white px-3 py-2 rounded-xl flex items-center gap-2 text-sm font-medium transition-all duration-200 cursor-pointer"
    >
        <FileSpreadsheet className="w-4 h-4" />
        <span className="hidden sm:inline">Excel</span>
    </button>
));
ExcelButton.displayName = 'ExcelButton';
