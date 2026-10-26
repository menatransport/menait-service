// ===================== USER TABLE TYPES =====================

export type { UserData } from '@/components/profile-form';

/** แผนก */
export interface DepartmentGroup {
    key: string;
    department: string;
    departmentEn: string;
    users: import('@/components/profile-form').UserData[];
}

/** ฝ่าย → แผนก. A ฝ่าย with a single แผนก lists its users directly (no sub-group). */
export interface DivisionGroup {
    key: string;
    division: string;
    divisionEn: string;
    code: string | null;
    departments: DepartmentGroup[];
    total: number;
}

export interface LookupOption {
    option_value: string;
    option_label: string;
}

export interface MasterLookups {
    departments: LookupOption[];
    sites: LookupOption[];
    positions: LookupOption[];
}

export interface MasterTableProps {
    data: import('@/components/profile-form').UserData[];
    isLoading: boolean;
    error: string | null;
    onRetry: () => void;
    onUpdate?: (data: import('@/components/profile-form').UserData) => Promise<boolean>;
    /** Resolves true on success, or an error message for the form */
    onAdd?: (data: Omit<import('@/components/profile-form').UserCreate, 'id'>) => Promise<true | string>;
    /** Lookup options (id -> label) used by the edit dropdowns */
    lookups?: MasterLookups;
    /** สายงาน → ฝ่าย → แผนก tree for the add/edit pickers */
    org: import('./org-structure').OrgIndex;
    onDepartmentCreated?: (department: import('./org-structure').OrgDepartment) => void;
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
