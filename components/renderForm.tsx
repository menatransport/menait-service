'use client';
import React from 'react';
import { AlertCircle, Clock, Calendar as CalendarIcon } from "lucide-react";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { DropdownSearch } from "@/components/ui/dropdown/issue";
import { Checkbox } from "@/components/ui/checkbox";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { format } from "date-fns";
import { th } from "date-fns/locale";
import type { Question } from "@/app/service/[[...slug]]/page";

// ===================== TYPES =====================
export type FormFieldValue = string | string[] | number | boolean | null;

export interface RenderFieldProps {
    question: Question;
    index: number;
    formValues: Record<string, any>;
    errors: Record<string, string>;
    onInputChange: (name: string, value: any) => void;
    compact?: boolean;
}

export interface SubmitValue {
    question_id: number;
    value_text?: string | null;
    value_number?: number | null;
    value_date?: string | null;
    value_boolean?: boolean | null;
}

// ===================== HELPER FUNCTIONS =====================
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

// ===================== RENDER FIELD FUNCTION =====================
export const renderFormField = ({
    question,
    index,
    formValues,
    errors,
    onInputChange,
    compact = false
}: RenderFieldProps): React.ReactNode => {
    const widthClass = compact ? '' : 'w-full sm:w-1/2';

    const renderLabel = () => (
        <div className="flex items-center gap-2 mb-2">
            <div className="flex items-center justify-center w-6 h-6 rounded-full bg-[#026a75] text-white text-xs font-bold">
                {index + 1}
            </div>
            <Label className="text-sm font-semibold text-gray-700 flex items-center gap-1">
                {question.label}
                {question.required && <span className="text-rose-500">*</span>}
            </Label>
        </div>
    );

    const renderError = () => (
        errors[question.name] && (
            <p className="text-rose-500 text-xs flex items-center gap-1 mt-1">
                <AlertCircle className="w-3 h-3" />
                {errors[question.name]}
            </p>
        )
    );

    const inputBaseClass = `w-full h-12 px-4 bg-white border-2 rounded-xl text-sm transition-all duration-300 focus:outline-none focus:ring-2 focus:ring-[#026a75]/20 focus:border-[#026a75] hover:border-[#026a75]/50`;
    const getInputClass = (hasError: boolean) => 
        `${inputBaseClass} ${hasError ? 'border-rose-300 bg-rose-50' : 'border-gray-200'}`;

    switch (question.type) {
        case 'dropdown':
            return (
                <div key={question.name} className={`space-y-2 ${widthClass}`}>
                    {renderLabel()}
                    <DropdownSearch
                        value={formValues[question.name] as string || ''}
                        onChange={(value: string) => onInputChange(question.name, value)}
                        options={(question.options || []).map(opt => ({
                            option_value: opt.value,
                            option_label: opt.label
                        }))}
                        placeholder="-- กรุณาเลือก --"
                        searchPlaceholder="ค้นหา..."
                        error={!!errors[question.name]}
                    />
                    {renderError()}
                </div>
            );

        case 'datetime':
            return (
                <div key={question.name} className={`space-y-2 ${widthClass}`}>
                    {renderLabel()}
                    <Popover>
                        <PopoverTrigger asChild>
                            <Button
                                variant="outline"
                                className={`w-full h-12 justify-start text-left font-normal bg-white border-2 rounded-xl transition-all duration-300 hover:border-[#026a75]/50 ${
                                    errors[question.name] ? 'border-rose-300 bg-rose-50' : 'border-gray-200'
                                } ${!formValues[question.name] && "text-gray-500"}`}
                            >
                                <CalendarIcon className="mr-2 h-4 w-4" />
                                {formValues[question.name] 
                                    ? format(new Date(formValues[question.name] as string), "d MMM yyyy, HH:mm น.", { locale: th })
                                    : <span>เลือกวันที่และเวลา</span>
                                }
                            </Button>
                        </PopoverTrigger>
                        <PopoverContent className="w-auto p-0" align="start">
                            <Calendar
                                mode="single"
                                selected={formValues[question.name] ? new Date(formValues[question.name] as string) : undefined}
                                onSelect={(date) => {
                                    if (date) {
                                        const currentTime = formValues[question.name]
                                            ? new Date(formValues[question.name] as string)
                                            : new Date();
                                        date.setHours(currentTime.getHours());
                                        date.setMinutes(currentTime.getMinutes());
                                        onInputChange(question.name, date.toISOString());
                                    }
                                }}
                                initialFocus
                            />
                            <div className="p-3 border-t border-gray-200">
                                <Label className="text-xs font-medium text-gray-700 mb-2 flex items-center gap-1">
                                    <Clock className="w-3 h-3" />
                                    เวลา
                                </Label>
                                <div className="flex gap-2 items-center">
                                    <select
                                        value={formValues[question.name]
                                            ? format(new Date(formValues[question.name] as string), "HH")
                                            : "00"}
                                        onChange={(e) => {
                                            const date = formValues[question.name]
                                                ? new Date(formValues[question.name] as string)
                                                : new Date();
                                            date.setHours(parseInt(e.target.value));
                                            onInputChange(question.name, date.toISOString());
                                        }}
                                        className="flex-1 h-9 px-3 text-sm border-2 border-gray-200 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-[#026a75]/20 focus:border-[#026a75]"
                                    >
                                        {Array.from({ length: 24 }, (_, i) => (
                                            <option key={i} value={i.toString().padStart(2, '0')}>
                                                {i.toString().padStart(2, '0')}
                                            </option>
                                        ))}
                                    </select>
                                    <span className="text-gray-500 font-medium">:</span>
                                    <select
                                        value={formValues[question.name]
                                            ? format(new Date(formValues[question.name] as string), "mm")
                                            : "00"}
                                        onChange={(e) => {
                                            const date = formValues[question.name]
                                                ? new Date(formValues[question.name] as string)
                                                : new Date();
                                            date.setMinutes(parseInt(e.target.value));
                                            onInputChange(question.name, date.toISOString());
                                        }}
                                        className="flex-1 h-9 px-3 text-sm border-2 border-gray-200 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-[#026a75]/20 focus:border-[#026a75]"
                                    >
                                        {Array.from({ length: 60 }, (_, i) => (
                                            <option key={i} value={i.toString().padStart(2, '0')}>
                                                {i.toString().padStart(2, '0')}
                                            </option>
                                        ))}
                                    </select>
                                </div>
                                <p className="text-xs text-gray-500 mt-2">ชั่วโมง : นาที</p>
                            </div>
                        </PopoverContent>
                    </Popover>
                    {renderError()}
                </div>
            );

        case 'multiselect':
            return (
                <div key={question.name} className="space-y-2">
                    {renderLabel()}
                    <div className={`space-y-3 p-4 bg-white border-2 rounded-xl ${
                        errors[question.name] ? 'border-rose-300 bg-rose-50' : 'border-gray-200'
                    }`}>
                        {(question.options || []).map((option) => (
                            <div key={option.value} className="flex items-center space-x-3">
                                <Checkbox
                                    id={`${question.name}-${option.value}`}
                                    checked={((formValues[question.name] as string[]) || []).includes(option.value)}
                                    onCheckedChange={(checked) => {
                                        const currentValues = (formValues[question.name] as string[]) || [];
                                        if (checked) {
                                            onInputChange(question.name, [...currentValues, option.value]);
                                        } else {
                                            onInputChange(question.name, currentValues.filter(v => v !== option.value));
                                        }
                                    }}
                                    className="border-2 border-gray-300 data-[state=checked]:bg-[#026a75] data-[state=checked]:border-[#026a75]"
                                />
                                <Label
                                    htmlFor={`${question.name}-${option.value}`}
                                    className="text-sm font-medium text-gray-700 cursor-pointer"
                                >
                                    {option.label}
                                </Label>
                            </div>
                        ))}
                    </div>
                    {renderError()}
                </div>
            );

        case 'longtext':
            return (
                <div key={question.name} className="space-y-2">
                    {renderLabel()}
                    <textarea
                        value={formValues[question.name] as string || ''}
                        onChange={(e) => onInputChange(question.name, e.target.value)}
                        placeholder="กรุณาระบุรายละเอียดเพิ่มเติม..."
                        rows={4}
                        className={`w-full px-4 py-3 bg-white border-2 rounded-xl text-sm resize-none transition-all duration-300 focus:outline-none focus:ring-2 focus:ring-[#026a75]/20 focus:border-[#026a75] hover:border-[#026a75]/50 ${
                            errors[question.name] ? 'border-rose-300 bg-rose-50' : 'border-gray-200'
                        }`}
                    />
                    {renderError()}
                </div>
            );

        case 'number':
            return (
                <div key={question.name} className={`space-y-2 ${widthClass}`}>
                    {renderLabel()}
                    <input
                        type="number"
                        value={formValues[question.name] as string || ''}
                        onChange={(e) => onInputChange(question.name, e.target.value)}
                        placeholder=""
                        className={getInputClass(!!errors[question.name])}
                    />
                    {renderError()}
                </div>
            );

        case 'text':
        default:
            return (
                <div key={question.name} className={`space-y-2 ${widthClass}`}>
                    {renderLabel()}
                    <input
                        type="text"
                        value={formValues[question.name] as string || ''}
                        onChange={(e) => onInputChange(question.name, e.target.value)}
                        placeholder=""
                        className={getInputClass(!!errors[question.name])}
                    />
                    {renderError()}
                </div>
            );
    }
};

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
                // Handle multiselect stored as comma-separated
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
