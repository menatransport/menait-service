'use client'

import { Card } from "./ui/card";
import { Lightbulb, Loader2 } from "lucide-react";
import { PreviewForm } from "./previewform";

type FormDataType = {
    created_by: string;
    form_code: string;
    values: [{
        question_id: number;
        value_text: string;
    }];
}

interface IssueComponentProps {
    formData: any;
    clearAfterSubmit: boolean;
    handleSubmit: (data: FormDataType) => void;
    isLoadingFormData: boolean;
}

export const IssueComponent = ({
    formData,
    clearAfterSubmit,
    handleSubmit,
    isLoadingFormData
}: IssueComponentProps) => {

    return (
        <main className="flex-1 min-h-0 bg-[#f0fafa] rounded-t-[1.5rem] sm:rounded-t-[2rem] lg:rounded-t-[3rem] shadow-2xl overflow-y-auto">
            <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-8">

                <div className="mb-6 p-4 bg-gradient-to-r from-amber-50 to-orange-50 border border-amber-200 rounded-2xl flex items-start gap-3">
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

                {isLoadingFormData ? (
                    <Card className="border-0 shadow-lg p-8 flex flex-col items-center justify-center">
                        <Loader2 className="w-8 h-8 text-[#026a75] animate-spin mb-3" />
                        <p className="text-gray-500">กำลังโหลดแบบฟอร์ม...</p>
                    </Card>
                ) : formData ? (
                    <PreviewForm
                        formData={formData}
                        clearAfterSubmit={clearAfterSubmit}
                        submitData={(data) => handleSubmit(data)}
                    />
                ) : (
                    <Card className="border-0 shadow-lg p-8 text-center text-gray-500">
                        ไม่พบข้อมูลแบบฟอร์ม
                    </Card>
                )}

            </div>
        </main>
    )
}
