'use client'

import { Card, CardContent } from "@/components/ui/card";
import { Search, Send, ClipboardList, FileText, Info, RotateCcw, CheckCircle2, AlertTriangle } from "lucide-react";
import { DropdownSearch } from "@/components/ui/dropdown/issue";
import { Question, type formSetup } from "@/app/service/[[...slug]]/page";
import { Button } from "@/components/ui/button";
import { buildSubmitValues, FormField } from "@/components/renderForm";
import { useState, useCallback, useMemo, memo } from "react";
import Loading from "@/components/loading";


type FormDataType = {
    form_code: string;
    values: any[];
}

interface ServiceComponentProps {
    form: formSetup[];
    selectedFormId: string;
    formData: formSetup | null;
    handleSearch: (value: string) => void;
    onSubmit: (data: FormDataType) => void;
    isLoadingForms: boolean;
    isLoadingFormData: boolean;
}

export const ServiceComponent = ({
    form,
    selectedFormId,
    formData,
    handleSearch,
    onSubmit,
    isLoadingForms,
    isLoadingFormData
}: ServiceComponentProps) => {

    const [formValues, setFormValues] = useState<Record<string, any>>({});
    const [errors, setErrors] = useState<Record<string, string>>({});

    // rerender-functional-setstate: Use functional setState for stable callbacks
    const handleInputChange = useCallback((name: string, value: any) => {
        setFormValues(prev => ({ ...prev, [name]: value }));
        setErrors(prev => {
            if (prev[name]) {
                const { [name]: _, ...rest } = prev;
                return rest;
            }
            return prev;
        });
    }, []);

    // js-combine-iterations: Single map instead of filter+map
    const formOptions = useMemo(() =>
        Array.isArray(form) ? form.map(f => ({
            option_value: f.form_code,
            option_label: `${f.form_code} ${f.form_name}`
        })) : [],
        [form]
    );

    // Memoize sorted questions
    const sortedQuestions = useMemo(() =>
        formData?.questions?.slice().sort((a: Question, b: Question) => a.id - b.id) || [],
        [formData?.questions]
    );

    // Count required vs answered for progress
    const progress = useMemo(() => {
        if (!sortedQuestions.length) return { total: 0, filled: 0, required: 0, requiredFilled: 0 };
        let total = sortedQuestions.length;
        let filled = 0;
        let required = 0;
        let requiredFilled = 0;
        for (const q of sortedQuestions) {
            const val = formValues[q.name];
            const isFilled = val !== undefined && val !== null && val !== '' && !(Array.isArray(val) && val.length === 0);
            if (isFilled) filled++;
            if (q.required) {
                required++;
                if (isFilled) requiredFilled++;
            }
        }
        return { total, filled, required, requiredFilled };
    }, [sortedQuestions, formValues]);

    const handleFormSubmit = useCallback((e: React.FormEvent) => {
        e.preventDefault();
        if (!formData) return;

        // js-combine-iterations: Single loop for validation
        const newErrors: Record<string, string> = {};
        for (const q of formData.questions) {
            if (q.required) {
                const val = formValues[q.name];
                if (!val || (Array.isArray(val) && val.length === 0)) {
                    newErrors[q.name] = `กรุณาระบุ${q.label}`;
                }
            }
        }

        if (Object.keys(newErrors).length > 0) {
            setErrors(newErrors);
            // Scroll to first error
            const firstErrorKey = Object.keys(newErrors)[0];
            const el = document.querySelector(`[data-field="${firstErrorKey}"]`);
            el?.scrollIntoView({ behavior: 'smooth', block: 'center' });
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
    }, [formData, formValues, onSubmit]);

    const handleClearForm = useCallback(() => {
        setFormValues({});
        setErrors({});
    }, []);


    return (
        <main className="flex-1 min-h-0 bg-[#f5f7fa] rounded-t-[1.5rem] sm:rounded-t-[2rem] lg:rounded-t-[3rem] shadow-2xl overflow-y-auto">
            <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-8">

                {/* ── Search Card ── */}
                <Card className="border border-gray-100 shadow-sm rounded-2xl mb-5 sm:mb-6">
                    <CardContent className="p-4 sm:p-5">
                        <div className="flex items-center gap-3 mb-3">
                            <div className="w-9 h-9 bg-[#026a75] rounded-lg flex items-center justify-center">
                                <Search className="w-4 h-4 text-white" />
                            </div>
                            <div className="flex-1 min-w-0">
                                <h2 className="font-semibold text-base sm:text-lg text-gray-800">เลือกแบบฟอร์ม</h2>
                                <p className="text-[11px] sm:text-xs text-gray-400">พิมพ์ชื่อหรือรหัสฟอร์มเพื่อค้นหา</p>
                            </div>
                        </div>

                        <div className="relative">
                            {isLoadingForms ? (
                                <div className="fixed inset-0 z-9999 flex items-center justify-center bg-gray-500/60">
                                    <Loading />
                                </div>
                            ) : (
                                <DropdownSearch
                                    options={formOptions}
                                    onChange={handleSearch}
                                    value={selectedFormId}
                                />
                            )}
                        </div>
                    </CardContent>
                </Card>

                {/* ── Form Content ── */}
                {isLoadingFormData ? (
                    <div className="fixed inset-0 z-9999 flex items-center justify-center bg-gray-500/60">
                        <Loading />
                    </div>
                ) : formData ? (
                    <Card className="border border-gray-100 shadow-md rounded-2xl overflow-hidden p-0 gap-0">

                        {/* Form Header */}
                        <div className="bg-linear-to-r from-[#026a75] to-[#037a86] px-4 sm:px-6 py-4 sm:py-5">
                            <div className="flex items-start gap-3">
                                <div className="w-10 h-10 bg-white/15 backdrop-blur-sm rounded-xl flex items-center justify-center shrink-0">
                                    <FileText className="w-5 h-5 text-white" />
                                </div>
                                <div className="flex-1 min-w-0">
                                    <p className="text-white/60 text-[10px] sm:text-xs font-medium tracking-wide uppercase mb-0.5">
                                        {formData.form_code}
                                    </p>
                                    <h2 className="text-base sm:text-lg font-bold text-white leading-snug">
                                        {formData.form_name}
                                    </h2>
                                </div>
                            </div>

                            {/* Info badges */}
                            <div className="flex flex-wrap gap-2 mt-3">
                                {formData.need_approval && (
                                    <span className="inline-flex items-center gap-1 px-2.5 py-0.5 bg-amber-400/20 text-amber-100 text-[10px] sm:text-xs font-medium rounded-full">
                                        <AlertTriangle className="w-3 h-3" />
                                        ต้องได้รับอนุมัติ
                                    </span>
                                )}
                                <span className="inline-flex items-center gap-1 px-2.5 py-0.5 bg-white/10 text-white/70 text-[10px] sm:text-xs font-medium rounded-full">
                                    <ClipboardList className="w-3 h-3" />
                                    {sortedQuestions.length} คำถาม
                                </span>
                            </div>
                        </div>

                        {/* Progress bar */}
                        {progress.total > 0 && (
                            <div className="px-4 sm:px-6 pt-4 pb-1">
                                <div className="flex items-center justify-between mb-1.5">
                                    <span className="text-[11px] sm:text-xs text-gray-500 font-medium">
                                        กรอกแล้ว {progress.filled}/{progress.total} ข้อ
                                    </span>
                                    {progress.required > 0 && (
                                        <span className={`text-[10px] sm:text-xs font-medium ${progress.requiredFilled === progress.required ? 'text-emerald-500' : 'text-amber-500'}`}>
                                            {progress.requiredFilled === progress.required ? (
                                                <span className="flex items-center gap-1"><CheckCircle2 className="w-3 h-3" /> ครบถ้วน</span>
                                            ) : (
                                                `จำเป็น ${progress.requiredFilled}/${progress.required}`
                                            )}
                                        </span>
                                    )}
                                </div>
                                <div className="w-full h-1.5 bg-gray-100 rounded-full overflow-hidden">
                                    <div
                                        className="h-full bg-linear-to-r from-[#026a75] to-[#8ce4cb] rounded-full transition-all duration-500 ease-out"
                                        style={{ width: `${progress.total > 0 ? (progress.filled / progress.total) * 100 : 0}%` }}
                                    />
                                </div>
                            </div>
                        )}

                        <CardContent className="p-4 sm:p-6">
                            <form onSubmit={handleFormSubmit} className="space-y-4 sm:space-y-5">
                                {sortedQuestions.map((question: Question, index: number) => (
                                    <div key={question.name} data-field={question.name}>
                                        <FormField
                                            question={question}
                                            index={index}
                                            formValues={formValues}
                                            errors={errors}
                                            onInputChange={handleInputChange}
                                            compact={false}
                                            allQuestions={sortedQuestions}
                                        />
                                    </div>
                                ))}

                                {/* Action buttons */}
                                <div className="pt-5 sm:pt-6 border-t border-gray-100 flex flex-col sm:flex-row gap-2.5">
                                    <Button
                                        type="submit"
                                        className="flex-1 h-11 sm:h-12 bg-[#026a75] hover:bg-[#025f68] text-white font-semibold rounded-xl shadow-md hover:shadow-lg transition-all duration-300 hover:scale-[1.01] cursor-pointer"
                                    >
                                        <Send className="w-4 h-4 mr-2" />
                                        ส่งคำร้อง
                                    </Button>
                                    <Button
                                        type="button"
                                        variant="outline"
                                        onClick={handleClearForm}
                                        className="h-11 sm:h-12 px-6 text-gray-500 font-medium rounded-xl border-gray-200 hover:bg-gray-50 hover:text-gray-700 transition-all duration-300 cursor-pointer"
                                    >
                                        <RotateCcw className="w-4 h-4 mr-2" />
                                        ล้างฟอร์ม
                                    </Button>
                                </div>
                            </form>
                        </CardContent>
                    </Card>

                ) : selectedFormId ? (
                    <Card className="border border-gray-100 shadow-sm rounded-2xl">
                        <CardContent className="p-8 sm:p-12 text-center">
                            <div className="w-14 h-14 bg-gray-100 rounded-2xl flex items-center justify-center mx-auto mb-4">
                                <Info className="w-6 h-6 text-gray-400" />
                            </div>
                            <p className="text-sm text-gray-500 font-medium">ไม่พบข้อมูลแบบฟอร์ม</p>
                            <p className="text-xs text-gray-400 mt-1">กรุณาเลือกแบบฟอร์มอื่น</p>
                        </CardContent>
                    </Card>
                ) : (
                   null
                )}

            </div>
        </main>
    )
}