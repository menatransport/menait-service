import type { ColumnConfig } from './types';

// ===================== THEME COLORS =====================
// rendering-hoist-jsx: Hoist theme constants outside components

export const THEME = {
    primary: '#026a75',
    primaryDark: '#064b50',
    primaryLight: '#046c75',
} as const;

// ===================== STATUS STYLES =====================
// rendering-hoist-jsx: Hoist static status config

export const STATUS_STYLES: Record<string, string> = {
    active: 'bg-emerald-50 text-emerald-700 border-emerald-200',
    inactive: 'bg-red-50 text-red-700 border-red-200',
    probation: 'bg-amber-50 text-amber-700 border-amber-200',
    draft: 'bg-amber-50 text-amber-700 border-amber-200',
};

export const getStatusStyle = (status: string | null): string => {
    if (!status) return 'bg-gray-50 text-gray-500 border-gray-200';
    return STATUS_STYLES[status.toLowerCase()] || 'bg-gray-50 text-gray-600 border-gray-200';
};

// ===================== POSITION LEVEL MAP =====================
// rendering-hoist-jsx: Hoist static position level ranking map

export const POSITION_LEVEL_MAP: Record<string, number> = {
    'Chief Executive Officer': 9,
    'C-Level': 8,
    'Deputy C-level': 7,
    'Senior Manager': 6,
    'Manager': 5,
    'Assistant Manager': 4,
    'Supervisor': 3,
    'Assistant Supervisor': 2,
    'Officer': 1,
};

/**
 * Parse position_level to number for sorting (higher = first)
 * - js-early-exit: Return early for null/undefined
 * - js-cache-property-access: Cache mapped value
 */
export const parseLevelNum = (level: string | null): number => {
    if (!level) return -1;
    
    const mapped = POSITION_LEVEL_MAP[level];
    if (mapped !== undefined) return mapped;
    
    // Fallback: case-insensitive match
    const lower = level.toLowerCase();
    for (const [key, val] of Object.entries(POSITION_LEVEL_MAP)) {
        if (key.toLowerCase() === lower) return val;
    }
    
    // Fallback: parse as number
    const num = parseFloat(level);
    return isNaN(num) ? 0 : num;
};

// ===================== TABLE COLUMNS =====================
// rendering-hoist-jsx: Hoist column config outside components

export const USER_COLUMNS: ColumnConfig[] = [
    { key: 'employee_id', label: 'รหัสพนักงาน' },
    { key: 'firstname', label: 'ชื่อ-นามสกุล' },
    { key: 'site', label: 'สาขา' },
    { key: 'position', label: 'ตำแหน่ง' },
    { key: 'position_level', label: 'ระดับ' },
    { key: 'employee_status', label: 'สถานะ' },
    { key: 'actions', label: 'จัดการ' },
];

export const FORM_COLUMNS: ColumnConfig[] = [
    { key: 'form_code', label: 'รหัสฟอร์ม' },
    { key: 'form_name', label: 'ชื่อแบบฟอร์ม' },
    { key: 'form_type', label: 'ประเภท' },
    { key: 'form_status', label: 'สถานะ' },
    { key: 'created_at', label: 'วันที่สร้าง' },
    { key: 'open', label: 'เปิด' },
];

// ===================== UTILITY FUNCTIONS =====================
// js-cache-function-results: Reusable date formatter

export const formatThaiDate = (dateString: string): string => {
    if (!dateString) return '-';
    const date = new Date(dateString);
    return date.toLocaleDateString('th-TH', {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
    });
};

/**
 * Get user initials from email
 * - js-early-exit: Handle edge cases early
 */
export const getUserInitials = (email: string | null | undefined): string => {
    if (!email || !email.includes('@')) return '??';
    const atIndex = email.indexOf('@');
    const first = email.charAt(0).toUpperCase();
    const last = email.charAt(atIndex - 1).toUpperCase();
    return `${first}${last}`;
};
