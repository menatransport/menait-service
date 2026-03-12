// ===================== USER TABLE TYPES =====================

export type { UserData } from '@/components/profile-form';

export interface DepartmentGroup {
    department: string;
    users: import('@/components/profile-form').UserData[];
}

export interface MasterTableProps {
    data: import('@/components/profile-form').UserData[];
    isLoading: boolean;
    error: string | null;
    onRetry: () => void;
    onUpdate?: (data: import('@/components/profile-form').UserData) => Promise<boolean>;
    onAdd?: (data: Omit<import('@/components/profile-form').UserCreate, 'id'>) => Promise<boolean>;
}

// ===================== FORM TABLE TYPES =====================

export interface FormData {
    id: number;
    form_type: string;
    form_code: string;
    form_name: string;
    form_status: string;
    created_at: string;
}

export interface TableFormProps {
    data: FormData[];
    isLoading: boolean;
    error: string | null;
    onRetry: () => void;
}

// ===================== COLUMN TYPES =====================

export interface ColumnConfig {
    key: string;
    label: string;
}
