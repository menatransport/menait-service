'use client';

import { Badge } from '../ui/badge';
import { Separator } from '../ui/separator';
import { 
    SheetHeader, 
    SheetTitle, 
    SheetDescription,
    SheetFooter 
} from '../ui/sheet';
import { Button } from '../ui/button';
import { 
    FormData, 
    FormValue, 
    STATUS_CONFIG, 
    QUESTION_TYPE_LABELS 
} from './types';
import { 
    Calendar, 
    Clock, 
    User, 
    FileText, 
    Hash,
    CheckCircle2,
    XCircle,
    AlertCircle
} from 'lucide-react';

interface TicketPreviewSheetProps {
    formData: FormData | null;
    onApprove?: () => void;
    onReject?: () => void;
    isLoading?: boolean;
}

// Format date helper
const formatDate = (dateString: string | null, includeTime = false): string => {
    if (!dateString) return '-';
    try {
        const date = new Date(dateString);
        const options: Intl.DateTimeFormatOptions = {
            year: 'numeric',
            month: 'short',
            day: 'numeric',
            ...(includeTime && { hour: '2-digit', minute: '2-digit' })
        };
        return date.toLocaleDateString('th-TH', options);
    } catch {
        return dateString;
    }
};

// Format value based on question type
const formatValue = (value: FormValue): string => {
    if (value.value_text) return value.value_text;
    if (value.value_number !== null) return value.value_number.toString();
    if (value.value_date) {
        const includeTime = value.question_type === 'datetime';
        return formatDate(value.value_date, includeTime);
    }
    if (value.value_boolean !== null) return value.value_boolean ? 'ใช่' : 'ไม่ใช่';
    return '-';
};

// Status Badge Component
const StatusBadge = ({ status }: { status: string }) => {
    const config = STATUS_CONFIG[status] || {
        label: status,
        variant: 'outline' as const,
        className: 'bg-gray-100 text-gray-800 border-gray-300'
    };

    return (
        <Badge variant={config.variant} className={config.className}>
            {config.label}
        </Badge>
    );
};

// Info Row Component
const InfoRow = ({ 
    icon: Icon, 
    label, 
    value, 
    valueComponent 
}: { 
    icon: React.ElementType; 
    label: string; 
    value?: string;
    valueComponent?: React.ReactNode;
}) => (
    <div className="flex items-center gap-3 py-2">
        <div className="flex items-center justify-center w-8 h-8 rounded-lg bg-slate-100">
            <Icon className="w-4 h-4 text-slate-600" />
        </div>
        <div className="flex-1 min-w-0">
            <p className="text-xs text-slate-500">{label}</p>
            {valueComponent || (
                <p className="text-sm font-medium text-slate-900 truncate">{value}</p>
            )}
        </div>
    </div>
);

// Question Value Card Component
const QuestionValueCard = ({ value }: { value: FormValue }) => {
    const typeLabel = QUESTION_TYPE_LABELS[value.question_type] || value.question_type;
    
    return (
        <div className="group p-4 rounded-xl bg-linear-to-br from-slate-50 to-slate-100/50 border border-slate-200/60 hover:border-slate-300 hover:shadow-sm transition-all duration-200">
            <div className="flex items-start justify-between gap-2 mb-2">
                <h4 className="text-sm font-medium text-slate-700 leading-tight">
                    {value.question_label}
                </h4>
                <span className="shrink-0 px-2 py-0.5 text-[10px] font-medium rounded-full bg-slate-200/80 text-slate-600">
                    {typeLabel}
                </span>
            </div>
            <p className="text-sm text-slate-900 leading-relaxed wrap-break-words">
                {formatValue(value)}
            </p>
        </div>
    );
};

export const TicketPreviewSheet = ({ 
    formData, 
    onApprove, 
    onReject,
    isLoading = false 
}: TicketPreviewSheetProps) => {
    if (!formData) {
        return (
            <div className="flex flex-col items-center justify-center h-full py-12 text-slate-500">
                <AlertCircle className="w-12 h-12 mb-4 text-slate-300" />
                <p className="text-sm">กรุณาเลือกรายการเพื่อดูรายละเอียด</p>
            </div>
        );
    }

    console.log('Rendering TicketPreviewSheet with formData:', formData);

    return (
        <div className="flex flex-col h-full">
            {/* Header */}
            <SheetHeader className="px-6 pt-6 pb-4 space-y-3">
                <div className="flex items-start justify-between gap-3">
                    <div className="space-y-1 min-w-0 flex-1">
                        <SheetTitle className="text-lg font-semibold text-slate-900 pr-8">
                            {formData.form_name}
                        </SheetTitle>
                        <SheetDescription className="text-xs text-slate-500 font-mono">
                            {formData.form_id}
                        </SheetDescription>
                    </div>
                </div>
                
                {/* Status Badges */}
                <div className="flex flex-wrap gap-2">
                    <StatusBadge status={formData.status} />
                    <StatusBadge status={formData.status_approve} />
                </div>
            </SheetHeader>

            <Separator className="mx-6" />

            {/* Content */}
            <div className="flex-1 overflow-y-auto px-6 py-4 space-y-6">
                {/* Form Info Section */}
                <section className="space-y-1">
                    <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-3">
                        ข้อมูลทั่วไป
                    </h3>
                    <div className="space-y-1 divide-y divide-slate-100">
                        <InfoRow 
                            icon={Hash} 
                            label="รหัสฟอร์ม" 
                            value={formData.form_code} 
                        />
                        <InfoRow 
                            icon={FileText} 
                            label="ประเภท" 
                            value={formData.form_type} 
                        />
                        <InfoRow 
                            icon={User} 
                            label="ผู้สร้าง" 
                            value={formData.created_by} 
                        />
                        <InfoRow 
                            icon={Calendar} 
                            label="วันที่สร้าง" 
                            value={formatDate(formData.created_at, true)} 
                        />
                    </div>
                </section>

                {/* Form Values Section */}
                {formData.values && formData.values.length > 0 && (
                    <section className="space-y-3">
                        <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
                            รายละเอียดคำขอ
                        </h3>
                        <div className="space-y-3">
                            {formData.values.map((value) => (
                                <QuestionValueCard 
                                    key={value.question_id} 
                                    value={value} 
                                />
                            ))}
                        </div>
                    </section>
                )}
            </div>

            {/* Footer with Action Buttons */}
            <SheetFooter className="px-6 py-4 bg-slate-50/80 border-t border-slate-200">
                <div className="flex w-full gap-3">
                    <Button
                        variant="outline"
                        className="flex-1 gap-2 border-red-200 text-red-600 hover:bg-red-50 hover:text-red-700 hover:border-red-300"
                        onClick={onReject}
                        disabled={isLoading}
                    >
                        <XCircle className="w-4 h-4" />
                        ปฏิเสธ
                    </Button>
                    <Button
                        className="flex-1 gap-2 bg-emerald-600 hover:bg-emerald-700 text-white"
                        onClick={onApprove}
                        disabled={isLoading}
                    >
                        <CheckCircle2 className="w-4 h-4" />
                        อนุมัติ
                    </Button>
                </div>
            </SheetFooter>
        </div>
    );
};
