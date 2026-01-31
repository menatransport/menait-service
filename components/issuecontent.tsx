'use client'

import { useEffect, useState } from "react";
import { Card, CardContent } from "./ui/card";
import { Lightbulb, Loader2, Send, ClipboardList } from "lucide-react";
import { Button } from "./ui/button";
import { Question, type formSetup } from "@/app/service/[[...slug]]/page";
import { buildSubmitValues, renderFormField } from "./renderForm";

type FormDataType = {
    form_code: string;
    values: any[];
}

interface IssueComponentProps {
    formData: formSetup | null;
    clearAfterSubmit: boolean;
    onSubmit: (data: FormDataType) => void;
    isLoadingFormData: boolean;
}

export const IssueComponent = ({
    formData,
    clearAfterSubmit,
    onSubmit,
    isLoadingFormData
}: IssueComponentProps) => {

    const [formValues, setFormValues] = useState<Record<string, any>>({});
    const [errors, setErrors] = useState<Record<string, string>>({});

    useEffect(() => {
        if (clearAfterSubmit) {
            setFormValues({});
        }
    }, [clearAfterSubmit]);

    const handleInputChange = (name: string, value: any) => {
        setFormValues(prev => ({ ...prev, [name]: value }));
        if (errors[name]) {
            setErrors(prev => {
                const newErrors = { ...prev };
                delete newErrors[name];
                return newErrors;
            });
        }
    };

    const handleFormSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if (!formData) return;

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

        const values = buildSubmitValues(formData.questions, formValues);

        const dataToSubmit = {
            form_code: formData.form_code,
            values: values.filter(v =>
                v.value_text !== null ||
                v.value_number !== null ||
                v.value_date !== null ||
                v.value_boolean !== null
            )
        };

        onSubmit(dataToSubmit);
    };

    return (
        <main className="flex-1 min-h-0 bg-[#f0fafa] rounded-t-[1.5rem] sm:rounded-t-[2rem] lg:rounded-t-[3rem] shadow-2xl overflow-y-auto">
            <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-8">

                {/* Tips Card */}
                <div className="mb-6 p-4 bg-linear-to-r from-amber-50 to-orange-50 border border-amber-200 rounded-2xl flex items-start gap-3">
                    <div className="w-10 h-10 bg-amber-100 rounded-xl flex items-center justify-center shrink-0">
                        <Lightbulb className="w-5 h-5 text-amber-600" />
                    </div>
                    <div>
                        <h3 className="font-semibold text-gray-800 text-sm">เคล็ดลับการแจ้งปัญหา</h3>
                        <p className="text-gray-600 text-xs mt-1 leading-relaxed">
                            ระบุรายละเอียดให้ชัดเจน เช่น ปัญหาที่พบ, เหตุกาณ์ที่เกิด (ถ้ามี) เพื่อให้ทีม IT ช่วยเหลือได้รวดเร็วขึ้น
                        </p>
                    </div>
                </div>

                {/* Form Content */}
                {isLoadingFormData ? (
                    <Card className="border-0 shadow-lg">
                        <CardContent className="p-8 flex flex-col items-center justify-center">
                            <Loader2 className="w-8 h-8 text-[#026a75] animate-spin mb-3" />
                            <p className="text-gray-500">กำลังโหลดแบบฟอร์ม...</p>
                        </CardContent>
                    </Card>
                ) : formData ? (
                    <Card className="border-0 shadow-xl rounded-2xl sm:rounded-3xl overflow-hidden">
                        <CardContent className="p-4 sm:p-6 lg:p-8">
                            {/* Form Header */}
                            <div className="mb-6 pb-4 border-b border-gray-200">
                                <div className="flex flex-wrap items-center gap-3 mb-2">
                                    <div className="w-10 h-10 bg-linear-to-br from-[#026a75] to-[#03969a] rounded-xl flex items-center justify-center shadow-md">
                                        <ClipboardList className="w-5 h-5 text-white" />
                                    </div>
                                    <div>
                                        <h2 className="text-xl sm:text-xl font-semibold text-[#055058] mb-1">
                                            แบบฟอร์ม: {formData.form_code} {formData.form_name}
                                        </h2>
                                        <p className="text-xs text-gray-500">กรุณากรอกข้อมูลให้ครบถ้วน</p>
                                    </div>
                                </div>

                                {formData.need_approval && (
                                    <span className="inline-block mt-2 px-3 py-1 bg-amber-100 text-amber-700 text-xs font-medium rounded-full">
                                        ต้องได้รับการอนุมัติ
                                    </span>
                                )}
                            </div>

                            {/* Form */}
                            <form onSubmit={handleFormSubmit} className="space-y-5">
                                <div className="space-y-5">
                                    {formData.questions
                                        .sort((a, b) => a.id - b.id)
                                        .map((question, index) =>
                                            renderFormField({
                                                question,
                                                index,
                                                formValues,
                                                errors,
                                                onInputChange: handleInputChange,
                                                compact: false
                                            })
                                        )}
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
                ) : (
                    <Card className="border-0 shadow-lg">
                        <CardContent className="p-8 text-center text-gray-500">
                            ไม่พบข้อมูลแบบฟอร์ม
                        </CardContent>
                    </Card>
                )}

            </div>
        </main>
    )
}
