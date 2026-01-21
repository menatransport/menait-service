'use client'
import { useEffect, useState } from "react";
import { Card, CardContent } from "./ui/card";
import { Label } from "./ui/label";
import { AlertCircle, Send, CalendarIcon, ClipboardList, Clock } from "lucide-react";
import { Button } from "./ui/button";
import { DropdownSearch } from "./ui/dropdown/issue";
import { Checkbox } from "./ui/checkbox";
import { Calendar } from "./ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "./ui/popover";
import { format } from "date-fns";
import { th } from "date-fns/locale";

type FormData = {
    form_type: string;
    form_code: string;
    form_name: string;
    form_status: string;
    need_approval: boolean;
    questions: Question[];
}

type Question = {
    id: number;
    name: string;
    label: string;
    type: string;
    required: boolean;
    options: Option[];
}

type Option = {
    value: string;
    label: string;
    filter: string;
}

type SubmitValue = {
    question_id: number;
    value_text?: string;
    value_date?: string;
    value_boolean?: boolean;
    value_number?: number;
}

export const PreviewForm = ({ formData, submitData, clearAfterSubmit }: { formData: FormData; submitData: (data: any) => void; clearAfterSubmit: boolean }) => {

    const [formValues, setFormValues] = useState<Record<string, string | string[]>>({});
    const [errors, setErrors] = useState<Record<string, string>>({});

    useEffect(() => {
        if (clearAfterSubmit) {
            setFormValues({});
        }
    }, [clearAfterSubmit]);

    const handleInputChange = (name: string, value: string | string[]) => {
        setFormValues(prev => ({ ...prev, [name]: value }));
        if (errors[name]) {
            setErrors(prev => ({ ...prev, [name]: '' }));
        }
    };

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();

        const newErrors: Record<string, string> = {};
        formData.questions.forEach((q: Question) => {
            if (q.required && !formValues[q.name]) {
                newErrors[q.name] = `กรุณาระบุ${q.label}`;
            }
        });

        if (Object.keys(newErrors).length > 0) {
            setErrors(newErrors);
            return;
        }

        const values: SubmitValue[] = formData.questions
            .filter(q => formValues[q.name] !== undefined && formValues[q.name] !== '')
            .map(q => {
                const value = formValues[q.name];
                const submitValue: SubmitValue = {
                    question_id: q.id
                };

                switch (q.type) {
                    case 'dropdown':
                    case 'longtext':
                        submitValue.value_text = value as string;
                        break;

                    case 'multiselect':
                        submitValue.value_text = Array.isArray(value) ? value.join(',') : '';
                        break;

                    case 'datetime':
                        submitValue.value_date = value as string;
                        break;

                    case 'number':
                        submitValue.value_number = parseFloat(value as string);
                        break;

                    case 'boolean':
                    case 'checkbox':
                        submitValue.value_boolean = value === 'true';
                        break;

                    default:
                        submitValue.value_text = value as string;
                }

                return submitValue;
            });

        const dataToSubmit = {
            form_code: formData.form_code,
            values: values
        };

        submitData(dataToSubmit);
    };


    const renderField = (question: Question, index: number) => {
        switch (question.type) {
            case 'dropdown':
                return (
                    <div key={question.name} className="space-y-2 w-1/2">
                        <div className="flex items-center gap-2 mb-2">
                            <div className="flex items-center justify-center w-6 h-6 rounded-full bg-[#026a75] text-white text-xs font-bold">{index + 1}</div>
                            <Label className="text-sm font-semibold text-gray-700 flex items-center gap-2">
                                {question.label}
                                {question.required && <span className="text-rose-500">*</span>}
                            </Label>
                        </div>

                        <DropdownSearch
                            value={formValues[question.name] as string || ''}
                            onChange={(value) => handleInputChange(question.name, value)}
                            options={question.options.map(opt => ({
                                option_value: opt.value,
                                option_label: opt.label
                            }))}
                            placeholder="-- กรุณาเลือก --"
                            searchPlaceholder="ค้นหา..."
                            error={!!errors[question.name]}
                        />
                        {errors[question.name] && (
                            <p className="text-rose-500 text-xs flex items-center gap-1 mt-1">
                                <AlertCircle className="w-3 h-3" />
                                {errors[question.name]}
                            </p>
                        )}
                    </div>
                );

            case 'datetime':
                return (
                    <div key={question.name} className="space-y-2 w-1/2">
                        <div className="flex items-center gap-2 mb-2">
                            <div className="flex items-center justify-center w-6 h-6 rounded-full bg-[#026a75] text-white text-xs font-bold">{index + 1}</div>
                            <Label className="text-sm font-semibold text-gray-700 flex items-center gap-1">
                                {question.label}
                                {question.required && <span className="text-rose-500">*</span>}
                            </Label>
                        </div>
                        <Popover>
                            <PopoverTrigger asChild>
                                <Button
                                    variant="outline"
                                    className={`w-full h-12 justify-start text-left font-normal bg-white border-2 rounded-xl transition-all duration-300 hover:border-[#026a75]/50 ${errors[question.name]
                                        ? 'border-rose-300 bg-rose-50'
                                        : 'border-gray-200'
                                        } ${!formValues[question.name] && "text-gray-500"
                                        }`}
                                >
                                    <CalendarIcon className="mr-2 h-4 w-4" />
                                    {formValues[question.name] ? (
                                        format(new Date(formValues[question.name] as string), "d MMM yyyy, HH:mm น.", { locale: th })
                                    ) : (
                                        <span>เลือกวันที่และเวลา</span>
                                    )}
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
                                            handleInputChange(question.name, date.toISOString());
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
                                                handleInputChange(question.name, date.toISOString());
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
                                                handleInputChange(question.name, date.toISOString());
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
                        {errors[question.name] && (
                            <p className="text-rose-500 text-xs flex items-center gap-1 mt-1">
                                <AlertCircle className="w-3 h-3" />
                                {errors[question.name]}
                            </p>
                        )}
                    </div>
                );

            case 'multiselect':
                return (
                    <div key={question.name} className="space-y-2">
                        <div className="flex items-center gap-2 mb-2">
                            <div className="flex items-center justify-center w-6 h-6 rounded-full bg-[#026a75] text-white text-xs font-bold">{index + 1}</div>
                            <Label className="text-sm font-semibold text-gray-700 flex items-center gap-1">
                                {question.label}
                                {question.required && <span className="text-rose-500">*</span>}
                            </Label>
                        </div>
                        <div className={`space-y-3 p-4 bg-white border-2 rounded-xl ${errors[question.name]
                            ? 'border-rose-300 bg-rose-50'
                            : 'border-gray-200'
                            }`}>
                            {question.options.map((option) => (
                                <div key={option.value} className="flex items-center space-x-3">
                                    <Checkbox
                                        id={`${question.name}-${option.value}`}
                                        checked={(formValues[question.name] as string[] || []).includes(option.value)}
                                        onCheckedChange={(checked) => {
                                            const currentValues = (formValues[question.name] as string[]) || [];
                                            if (checked) {
                                                handleInputChange(question.name, [...currentValues, option.value]);
                                            } else {
                                                handleInputChange(question.name, currentValues.filter(v => v !== option.value));
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
                        {errors[question.name] && (
                            <p className="text-rose-500 text-xs flex items-center gap-1 mt-1">
                                <AlertCircle className="w-3 h-3" />
                                {errors[question.name]}
                            </p>
                        )}
                    </div>
                );

            case 'longtext':
                return (
                    <div key={question.name} className="space-y-2">
                        <div className="flex items-center gap-2 mb-2">
                            <div className="flex items-center justify-center w-6 h-6 rounded-full bg-[#026a75] text-white text-xs font-bold">{index + 1}</div>
                            <Label className="text-sm font-semibold text-gray-700 flex items-center gap-1">
                                {question.label}
                                {question.required && <span className="text-rose-500">*</span>}
                            </Label>
                        </div>
                        <textarea
                            value={formValues[question.name] as string || ''}
                            onChange={(e) => handleInputChange(question.name, e.target.value)}
                            placeholder="กรุณาระบุรายละเอียดเพิ่มเติม..."
                            rows={4}
                            className={`w-full px-4 py-3 bg-white border-2 rounded-xl text-sm resize-none transition-all duration-300 focus:outline-none focus:ring-2 focus:ring-[#026a75]/20 focus:border-[#026a75] hover:border-[#026a75]/50 ${errors[question.name]
                                ? 'border-rose-300 bg-rose-50'
                                : 'border-gray-200'
                                }`}
                        />
                        {errors[question.name] && (
                            <p className="text-rose-500 text-xs flex items-center gap-1 mt-1">
                                <AlertCircle className="w-3 h-3" />
                                {errors[question.name]}
                            </p>
                        )}
                    </div>
                );

            default:
                return null;
        }
    };

    return (
        <Card className="border-0 shadow-xl rounded-2xl sm:rounded-3xl overflow-hidden">
            <CardContent className="p-4 sm:p-6 lg:p-8">
                {/* Form Header */}
                <div className="mb-6 pb-4 border-b border-gray-200">
                    <div className="flex flex-wrap items-center gap-3 mb-2">
                        <div className="w-10 h-10 bg-linear-to-br from-[#026a75] to-[#03969a] rounded-xl flex items-center justify-center shadow-md">
                            <ClipboardList className="w-5 h-5 text-white" />
                        </div>
                        <div>
                            <h2 className="text-xl sm:text-xl font-semibold text-[#055058] mb-1">แบบฟอร์ม: {formData.form_code} {formData.form_name}</h2>
                            <p className="text-xs text-gray-500">พิมพ์ชื่อหรือรหัสฟอร์มเพื่อค้นหา</p>
                        </div>
                    </div>

                    {formData.need_approval && (
                        <span className="inline-block mt-2 px-3 py-1 bg-amber-100 text-amber-700 text-xs font-medium rounded-full">
                            ต้องได้รับการอนุมัติ
                        </span>
                    )}
                </div>

                <form onSubmit={handleSubmit} className="space-y-5">
                    {/* Render all questions in order */}
                    <div className="space-y-5">
                        {formData.questions
                            .sort((a, b) => a.id - b.id)
                            .map((question, index) => renderField(question, index))}
                    </div>

                    {/* Submit Button */}
                    <div className="pt-4 flex flex-col sm:flex-row gap-3">
                        <Button
                            type="submit"
                            className="flex-1 h-12 sm:h-14 bg-linear-to-r from-[#026a75] to-[#037a86] hover:from-[#025f68] hover:to-[#026a75] text-white font-semibold rounded-xl sm:rounded-2xl shadow-lg hover:shadow-xl transition-all duration-300 hover:scale-[1.02]"
                        >
                            <Send className="w-4 h-4 sm:w-5 sm:h-5 mr-2" />
                            ส่งคำร้อง
                        </Button>
                        <Button
                            type="button"
                            variant="ghost"
                            onClick={() => setFormValues({})}
                            className="h-12 sm:h-14 px-6 sm:px-8 text-[#026a75] font-medium rounded-xl sm:rounded-2xl hover:bg-[#026a75]/10 hover:text-[#025f68] transition-all duration-300 group"
                        >
                            <svg
                                className="w-4 h-4 sm:w-5 sm:h-5 mr-2 group-hover:rotate-180 transition-transform duration-500"
                                fill="none"
                                stroke="currentColor"
                                viewBox="0 0 24 24"
                            >
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                            </svg>
                            ล้างฟอร์ม
                        </Button>
                    </div>
                </form>
            </CardContent>
        </Card>
    )
}