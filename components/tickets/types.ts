// Types for ticket form data

export interface FormValue {
    question_id: number;
    value_text: string | null;
    value_number: number | null;
    value_date: string | null;
    value_boolean: boolean | null;
    question_name: string;
    question_label: string;
    question_type: string;
}

export interface FormData {
    form_id: string;
    status: string;
    status_approve: string;
    created_by: string;
    created_at: string;
    form_type: string;
    form_code: string;
    form_name: string;
    values: FormValue[];
}

// Status configuration for badges
export type StatusType = 'Open' | 'Closed' | 'In Progress' | 'Pending' | 'Approved' | 'Rejected';

export interface StatusConfig {
    label: string;
    variant: 'default' | 'secondary' | 'destructive' | 'outline';
    className: string;
}

export const STATUS_CONFIG: Record<string, StatusConfig> = {
    'Open': {
        label: 'Open',
        variant: 'default',
        className: 'bg-blue-500 hover:bg-blue-600 text-white border-blue-500'
    },
    'Closed': {
        label: 'Closed',
        variant: 'secondary',
        className: 'bg-gray-500 hover:bg-gray-600 text-white border-gray-500'
    },
    'In Progress': {
        label: 'In Progress',
        variant: 'default',
        className: 'bg-amber-500 hover:bg-amber-600 text-white border-amber-500'
    },
    'Pending': {
        label: 'Pending',
        variant: 'outline',
        className: 'bg-yellow-100 text-yellow-800 border-yellow-300'
    },
    'Approved': {
        label: 'Approved',
        variant: 'default',
        className: 'bg-emerald-500 hover:bg-emerald-600 text-white border-emerald-500'
    },
    'Rejected': {
        label: 'Rejected',
        variant: 'destructive',
        className: 'bg-red-500 hover:bg-red-600 text-white border-red-500'
    }
};

// Question type icons mapping
export const QUESTION_TYPE_LABELS: Record<string, string> = {
    'text': 'ข้อความ',
    'longtext': 'ข้อความยาว',
    'number': 'ตัวเลข',
    'date': 'วันที่',
    'datetime': 'วันที่และเวลา',
    'boolean': 'ใช่/ไม่ใช่',
    'select': 'ตัวเลือก',
    'multiselect': 'ตัวเลือกหลายรายการ',
    'checkbox': 'ช่องทำเครื่องหมาย',
    'radio': 'ตัวเลือกเดียว',
    'file': 'ไฟล์แนบ',
};
