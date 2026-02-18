'use client';
import React, { memo, useMemo, useCallback } from 'react';
import { AlertCircle, Clock, Calendar as CalendarIcon } from "lucide-react";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { DropdownSearch } from "@/components/ui/dropdown/issue";
import { Checkbox } from "@/components/ui/checkbox";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { format } from "date-fns";
import { th } from "date-fns/locale";
import type { Question, Option } from "@/app/service/[[...slug]]/page";

// ===================== TYPES =====================
export type FormFieldValue = string | string[] | number | boolean | null;

export interface RenderFieldProps {
    question: Question;
    index: number;
    formValues: Record<string, any>;
    errors: Record<string, string>;
    onInputChange: (name: string, value: any) => void;
    compact?: boolean;
    allQuestions?: Question[];
}

export interface SubmitValue {
    question_id: number;
    value_text?: string | null;
    value_number?: number | null;
    value_date?: string | null;
    value_boolean?: boolean | null;
}

// ===================== HELPER FUNCTIONS =====================

// rendering-hoist-jsx: Hoist static arrays outside component
const HOURS = Array.from({ length: 24 }, (_, i) => i.toString().padStart(2, '0'));
const MINUTES = Array.from({ length: 60 }, (_, i) => i.toString().padStart(2, '0'));

// rendering-hoist-jsx: Static base class
const INPUT_BASE_CLASS = `w-full h-11 px-4 bg-white border rounded-xl text-sm transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-[#026a75]/20 focus:border-[#026a75] hover:border-[#026a75]/40`;

export const formatDatetime = (dateString: string): string => {
    if (!dateString) return '-';
    try {
        return new Date(dateString).toLocaleDateString('th-TH', {
            year: 'numeric',
            month: 'short',
            day: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
        });
    } catch {
        return dateString;
    }
};

// ===================== FILTER OPTIONS =====================
const getFilteredOptions = (
    options: Option[],
    allQuestions: Question[] | undefined,
    currentIndex: number,
    formValues: Record<string, any>
): Option[] => {
    if (!options || options.length === 0) return [];
    // js-length-check-first: Early exit before expensive work
    const hasFilter = options.some(opt => !!opt.filter);
    if (!hasFilter || !allQuestions) return options;

    // js-set-map-lookups: Use Set for O(1) lookups
    const previousValues = new Set<string>();
    for (let i = 0; i < currentIndex; i++) {
        const q = allQuestions[i];
        const val = formValues[q.name];
        if (val !== undefined && val !== null && val !== '') {
            if (Array.isArray(val)) {
                for (const v of val) previousValues.add(v);
            } else {
                previousValues.add(String(val));
            }
        }
    }

    return options.filter(opt => !opt.filter || previousValues.has(opt.filter));
};

// Sort options with "อื่นๆ" / "Other" last (reusable, hoisted)
const sortOptions = (opts: Option[]): Option[] =>
    opts.slice().sort((a, b) => {
        const aIsOther = a.label === 'อื่นๆ' || a.value === 'Other';
        const bIsOther = b.label === 'อื่นๆ' || b.value === 'Other';
        if (aIsOther && !bIsOther) return 1;
        if (!aIsOther && bIsOther) return -1;
        return a.label.localeCompare(b.label, 'th');
    });

// ===================== FIELD LABEL (rerender-memo) =====================
const FieldLabel = memo(({ index, label, required }: { index: number; label: string; required: boolean }) => (
    <div className="flex items-center gap-2 mb-1.5">
        <div className="flex items-center justify-center w-5 h-5 rounded-md bg-[#026a75]/10 text-[#026a75] text-[10px] font-bold shrink-0">
            {index + 1}
        </div>
        <Label className="text-sm font-medium text-gray-700 flex items-center gap-1">
            {label}
            {required && <span className="text-rose-400 text-xs">*</span>}
        </Label>
    </div>
));
FieldLabel.displayName = 'FieldLabel';

// ===================== ERROR MESSAGE =====================
const FieldError = memo(({ message }: { message?: string }) => {
    if (!message) return null;
    return (
        <p className="text-rose-500 text-xs flex items-center gap-1 mt-1 animate-fade-in-up">
            <AlertCircle className="w-3 h-3 shrink-0" />
            {message}
        </p>
    );
});
FieldError.displayName = 'FieldError';

// ===================== FORM FIELD COMPONENT (rerender-memo) =====================
export const FormField = memo(({
    question,
    index,
    formValues,
    errors,
    onInputChange,
    compact = false,
    allQuestions
}: RenderFieldProps) => {
    const widthClass = compact ? '' : 'w-full';
    const hasError = !!errors[question.name];
    const currentValue = formValues[question.name];
    const errorMsg = errors[question.name];

    const inputClass = `${INPUT_BASE_CLASS} ${hasError ? 'border-rose-300 bg-rose-50/50' : 'border-gray-200'}`;

    // Memoize filtered + sorted options
    const filteredOptions = useMemo(() => {
        const filtered = getFilteredOptions(question.options, allQuestions, index, formValues);
        return sortOptions(filtered);
    }, [question.options, allQuestions, index, formValues]);

    // Auto-clear invalid values when options change
    useMemo(() => {
        if (!currentValue || filteredOptions.length === 0) return;
        if (question.type === 'dropdown') {
            const isValid = filteredOptions.some(opt => opt.value === currentValue);
            if (!isValid) {
                // Use setTimeout to avoid setState during render
                setTimeout(() => onInputChange(question.name, ''), 0);
            }
        } else if (question.type === 'multiselect' && Array.isArray(currentValue)) {
            const validValues = currentValue.filter((v: string) => filteredOptions.some(opt => opt.value === v));
            if (validValues.length !== currentValue.length) {
                setTimeout(() => onInputChange(question.name, validValues), 0);
            }
        }
    }, [filteredOptions, currentValue, question.type, question.name, onInputChange]);

    // Memoize dropdown options mapping (avoid creating new array each render)
    const dropdownOptions = useMemo(() =>
        filteredOptions.map(opt => ({
            option_value: opt.value,
            option_label: opt.label
        })),
        [filteredOptions]
    );

    // Stable callback for text/number input
    const handleTextChange = useCallback((e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
        onInputChange(question.name, e.target.value);
    }, [question.name, onInputChange]);

    // Stable callback for dropdown
    const handleDropdownChange = useCallback((value: string) => {
        onInputChange(question.name, value);
    }, [question.name, onInputChange]);

    switch (question.type) {
        case 'dropdown':
            return (
                <div className={`space-y-1.5 ${widthClass}`}>
                    <FieldLabel index={index} label={question.label} required={question.required} />
                    <DropdownSearch
                        value={currentValue}
                        onChange={handleDropdownChange}
                        options={dropdownOptions}
                        placeholder="-- กรุณาเลือก --"
                        searchPlaceholder="ค้นหา..."
                        error={hasError}
                    />
                    <FieldError message={errorMsg} />
                </div>
            );

        case 'datetime':
            return (
                <div className={`space-y-1.5 ${widthClass}`}>
                    <FieldLabel index={index} label={question.label} required={question.required} />
                    <Popover>
                        <PopoverTrigger asChild>
                            <Button
                                variant="outline"
                                className={`w-full h-11 justify-start text-left font-normal bg-white border rounded-xl transition-all duration-200 hover:border-[#026a75]/40 ${
                                    hasError ? 'border-rose-300 bg-rose-50/50' : 'border-gray-200'
                                } ${!currentValue && "text-gray-400"}`}
                            >
                                <CalendarIcon className="mr-2 h-4 w-4 shrink-0" />
                                {currentValue
                                    ? format(new Date(currentValue as string), "d MMM yyyy, HH:mm น.", { locale: th })
                                    : <span>เลือกวันที่และเวลา</span>
                                }
                            </Button>
                        </PopoverTrigger>
                        <PopoverContent className="w-auto p-0" align="start">
                            <Calendar
                                mode="single"
                                selected={currentValue ? new Date(currentValue as string) : undefined}
                                onSelect={(date) => {
                                    if (date) {
                                        const currentTime = currentValue
                                            ? new Date(currentValue as string)
                                            : new Date();
                                        date.setHours(currentTime.getHours());
                                        date.setMinutes(currentTime.getMinutes());
                                        onInputChange(question.name, date.toISOString());
                                    }
                                }}
                                initialFocus
                            />
                            <div className="p-3 border-t border-gray-100">
                                <Label className="text-xs font-medium text-gray-600 mb-2 flex items-center gap-1">
                                    <Clock className="w-3 h-3" />
                                    เวลา
                                </Label>
                                <div className="flex gap-2 items-center">
                                    <select
                                        value={currentValue ? format(new Date(currentValue as string), "HH") : "00"}
                                        onChange={(e) => {
                                            const date = currentValue ? new Date(currentValue as string) : new Date();
                                            date.setHours(parseInt(e.target.value));
                                            onInputChange(question.name, date.toISOString());
                                        }}
                                        className="flex-1 h-9 px-3 text-sm border border-gray-200 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-[#026a75]/20 focus:border-[#026a75]"
                                    >
                                        {HOURS.map(h => <option key={h} value={h}>{h}</option>)}
                                    </select>
                                    <span className="text-gray-400 font-medium">:</span>
                                    <select
                                        value={currentValue ? format(new Date(currentValue as string), "mm") : "00"}
                                        onChange={(e) => {
                                            const date = currentValue ? new Date(currentValue as string) : new Date();
                                            date.setMinutes(parseInt(e.target.value));
                                            onInputChange(question.name, date.toISOString());
                                        }}
                                        className="flex-1 h-9 px-3 text-sm border border-gray-200 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-[#026a75]/20 focus:border-[#026a75]"
                                    >
                                        {MINUTES.map(m => <option key={m} value={m}>{m}</option>)}
                                    </select>
                                </div>
                                <p className="text-[10px] text-gray-400 mt-1.5">ชั่วโมง : นาที</p>
                            </div>
                        </PopoverContent>
                    </Popover>
                    <FieldError message={errorMsg} />
                </div>
            );

        case 'multiselect':
            return (
                <div className="space-y-1.5">
                    <FieldLabel index={index} label={question.label} required={question.required} />
                    <div className={`space-y-2 p-3 bg-white border rounded-xl ${
                        hasError ? 'border-rose-300 bg-rose-50/50' : 'border-gray-200'
                    }`}>
                        {filteredOptions.map((option) => (
                            <label key={option.value} htmlFor={`${question.name}-${option.value}`} className="flex items-center space-x-2.5 py-1 px-1 rounded-lg hover:bg-gray-50 transition-colors cursor-pointer">
                                <Checkbox
                                    id={`${question.name}-${option.value}`}
                                    checked={((currentValue as string[]) || []).includes(option.value)}
                                    onCheckedChange={(checked) => {
                                        const currentValues = (currentValue as string[]) || [];
                                        if (checked) {
                                            onInputChange(question.name, [...currentValues, option.value]);
                                        } else {
                                            onInputChange(question.name, currentValues.filter(v => v !== option.value));
                                        }
                                    }}
                                    className="border-gray-300 data-[state=checked]:bg-[#026a75] data-[state=checked]:border-[#026a75]"
                                />
                                <span className="text-sm text-gray-700">{option.label}</span>
                            </label>
                        ))}
                    </div>
                    <FieldError message={errorMsg} />
                </div>
            );

        case 'longtext':
            return (
                <div className="space-y-1.5">
                    <FieldLabel index={index} label={question.label} required={question.required} />
                    <textarea
                        value={currentValue as string || ''}
                        onChange={handleTextChange}
                        placeholder="กรุณาระบุรายละเอียดเพิ่มเติม..."
                        rows={4}
                        className={`w-full px-4 py-3 bg-white border rounded-xl text-sm resize-none transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-[#026a75]/20 focus:border-[#026a75] hover:border-[#026a75]/40 ${
                            hasError ? 'border-rose-300 bg-rose-50/50' : 'border-gray-200'
                        }`}
                    />
                    <FieldError message={errorMsg} />
                </div>
            );

        case 'number':
            return (
                <div className={`space-y-1.5 ${widthClass}`}>
                    <FieldLabel index={index} label={question.label} required={question.required} />
                    <input
                        type="number"
                        value={currentValue as string || ''}
                        onChange={handleTextChange}
                        placeholder=""
                        className={inputClass}
                    />
                    <FieldError message={errorMsg} />
                </div>
            );

        case 'text':
        default:
            return (
                <div className={`space-y-1.5 ${widthClass}`}>
                    <FieldLabel index={index} label={question.label} required={question.required} />
                    <input
                        type="text"
                        value={currentValue as string || ''}
                        onChange={handleTextChange}
                        placeholder=""
                        className={inputClass}
                    />
                    <FieldError message={errorMsg} />
                </div>
            );
    }
});
FormField.displayName = 'FormField';

// ===================== BACKWARD COMPAT: renderFormField function =====================
export const renderFormField = (props: RenderFieldProps): React.ReactNode => (
    <FormField {...props} />
);

// ===================== BUILD SUBMIT VALUES =====================
export const buildSubmitValues = (
    questions: Question[],
    formValues: Record<string, any>
): SubmitValue[] => {
    return questions.map(question => {
        const value = formValues[question.name];
        const valueObj: SubmitValue = {
            question_id: question.id,
            value_text: null,
            value_number: null,
            value_date: null,
            value_boolean: null,
        };

        switch (question.type) {
            case 'text':
            case 'longtext':
            case 'dropdown':
                valueObj.value_text = value ? String(value) : null;
                break;
            case 'number':
                valueObj.value_number = value !== undefined && value !== '' ? Number(value) : null;
                break;
            case 'datetime':
            case 'date':
                valueObj.value_date = value || null;
                break;
            case 'checkbox':
            case 'boolean':
                valueObj.value_boolean = value !== undefined ? Boolean(value) : null;
                break;
            case 'multiselect':
                valueObj.value_text = Array.isArray(value) ? value.join(',') : null;
                break;
            default:
                valueObj.value_text = value ? String(value) : null;
        }

        return valueObj;
    });
};

// ===================== PREFILL FORM VALUES =====================
export const prefillFormValues = (
    questions: Question[],
    existingValues: any[]
): Record<string, any> => {
    const initialValues: Record<string, any> = {};
    
    existingValues.forEach((val: any) => {
        const question = questions.find(q => q.id === val.question_id);
        if (question) {
            if (val.value_text) {
                if (question.type === 'multiselect') {
                    initialValues[question.name] = val.value_text.split(',');
                } else {
                    initialValues[question.name] = val.value_text;
                }
            } else if (val.value_number !== null && val.value_number !== undefined) {
                initialValues[question.name] = val.value_number;
            } else if (val.value_date) {
                initialValues[question.name] = val.value_date;
            } else if (val.value_boolean !== null && val.value_boolean !== undefined) {
                initialValues[question.name] = val.value_boolean;
            }
        }
    });
    
    return initialValues;
};
