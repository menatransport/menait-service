'use client'

import { Card, CardContent } from "./ui/card";
import { Search, Loader2 } from "lucide-react";
import { DropdownSearch } from "./ui/dropdown/issue";
import { PreviewForm } from "./previewform";

type FormSetup = {
    id: string;
    form_name: string;
    form_code: string;
    form_type: string;
    created_by: string;
    created_at: string;
}

type FormDataType = {
    created_by: string;
    form_code: string;
    values: [{
        question_id: number;
        value_text: string;
    }];
}

interface ServiceComponentProps {
    form: FormSetup[];
    selectedFormId: string;
    formData: any;
    clearAfterSubmit: boolean;
    handleSearch: (value: string) => void;
    handleSubmit: (data: FormDataType) => void;
    isLoadingForms: boolean;
    isLoadingFormData: boolean;
}

export const ServiceComponent = ({
    form,
    selectedFormId,
    formData,
    clearAfterSubmit,
    handleSearch,
    handleSubmit,
    isLoadingForms,
    isLoadingFormData
}: ServiceComponentProps) => {

    return (
        <main className="flex-1 min-h-0 bg-[#f0fafa] rounded-t-[1.5rem] sm:rounded-t-[2rem] lg:rounded-t-[3rem] shadow-2xl overflow-y-auto">
            <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-8">

                <Card className="border-0 shadow-lg mb-6">
                    <CardContent className="p-5">
                        <div className="flex items-center gap-3 mb-4">
                            <div className="w-10 h-10 bg-gradient-to-br from-[#026a75] to-[#03969a] rounded-xl flex items-center justify-center shadow-md">
                                <Search className="w-5 h-5 text-white" />
                            </div>
                            <div>
                                <h2 className="font-semibold text-xl text-[#055058]">ค้นหาแบบฟอร์มบริการ</h2>
                                <p className="text-xs text-gray-500">พิมพ์ชื่อหรือรหัสฟอร์มเพื่อค้นหา</p>
                            </div>
                        </div>

                        <div className="relative">
                            {isLoadingForms ? (
                                <div className="h-12 bg-gray-100 rounded-xl animate-pulse flex items-center justify-center">
                                    <Loader2 className="w-5 h-5 text-gray-400 animate-spin" />
                                </div>
                            ) : (
                                <DropdownSearch
                                    options={form.map(f => ({
                                        option_value: f.form_code,
                                        option_label: `${f.form_code} ${f.form_name}`
                                    }))}
                                    onChange={(value) => handleSearch(value)}
                                    value={selectedFormId}
                                />
                            )}
                        </div>
                    </CardContent>
                </Card>

                {isLoadingFormData ? (
                    <Card className="border-0 shadow-lg">
                        <CardContent className="p-8 flex flex-col items-center justify-center">
                            <Loader2 className="w-8 h-8 text-[#026a75] animate-spin mb-3" />
                            <p className="text-gray-500">กำลังโหลดแบบฟอร์ม...</p>
                        </CardContent>
                    </Card>
                ) : formData ? (
                    <PreviewForm
                        formData={formData}
                        clearAfterSubmit={clearAfterSubmit}
                        submitData={(data) => handleSubmit(data)}
                    />
                ) : selectedFormId ? (
                    <Card className="border-0 shadow-lg">
                        <CardContent className="p-8 text-center text-gray-500">
                            ไม่พบข้อมูลแบบฟอร์ม
                        </CardContent>
                    </Card>
                ) : null}

            </div>
        </main>
    )
}