'use client';
import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { DropdownSearch } from "@/components/ui/dropdown/issue";
import { NavElse } from "@/components/navbar";
import { Card, CardContent } from "@/components/ui/card";
import { Search } from "lucide-react";
import { useParams } from 'next/navigation'
import { PreviewForm } from "@/components/previewform";
import swal from "sweetalert2";

type formSetup = {
    id: string;
    form_name: string;
    form_code: string;
    form_type: string;
    created_by: string;
    created_at: string;
}

type formDataType = {
    created_by: string;
    form_code: string;
    values: [{
        question_id: number;
        value_text: string;
    }];
}

export default function ServicePage() {
    const router = useRouter();
    const params = useParams();
    const [form, setForm] = useState<formSetup[]>([]);
    const [formData, setFormData] = useState<any>(null);
    const [selectedFormId, setSelectedFormId] = useState<string>("");
    const [clearAfterSubmit, setClearAfterSubmit] = useState<boolean>(true);

    useEffect(() => {
        const getForm = async () => {
            const query = `SELECT id, form_code, form_name FROM form_masters WHERE form_type = 'Service' ORDER BY created_at DESC`;
            const res = await fetch("/api/form/?query=" + encodeURIComponent(query), {
                method: "GET",
            });
            const data = await res.json();
            console.log('data : ', data)
            setForm(data)
        }
        getForm();
    }, [])

    useEffect(() => {
        const fetchFormData = async () => {
            const formId = params?.slug?.[0];
            if (formId) {
                setSelectedFormId(formId);
                try {
                    const res = await fetch(`/api/formsubmit?path=${formId}`, {
                        method: "GET",
                    });

                    if (!res.ok) {
                        throw new Error(`Error: ${res.status}`);
                    }

                    const data = await res.json();
                    console.log('Data fetched:', data);
                    if (data) {
                        setFormData(data);
                    }

                } catch (error) {
                    console.error("เกิดข้อผิดพลาดในการดึงข้อมูล:", error);
                }
            } else {
                console.log('ไม่มี ID (เป็นการสร้างใหม่)');

            }
        };

        fetchFormData();
    }, [params]);

    const handleSearch = (value: string) => {
        router.push(`/service/${value}`);
    }

    const handleSubmit = async (data: formDataType) => {
        console.log('Submitting data:', data);
        const employee_id = localStorage.getItem('user') ? JSON.parse(localStorage.getItem('user') || '{}').employee_id : null;
        const res = await fetch('/api/formsubmit', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ ...data, created_by: employee_id }),
        })
        const resData = await res.json();
        console.log('resData : ', resData)
        if (res.ok) {
            swal.fire({
                icon: 'success',
                title: 'ส่งแบบฟอร์มสำเร็จ',
                text: 'ขอบคุณที่ใช้บริการ',
                confirmButtonText: 'ตกลง',
            })
            setClearAfterSubmit(true);
        } else {
            swal.fire({
                icon: 'error',
                title: 'เกิดข้อผิดพลาด',
                text: resData.error || 'ไม่สามารถส่งแบบฟอร์มได้',
                confirmButtonText: 'ตกลง',
            })
        }
    }

    return (
        <div className="h-screen flex flex-col overflow-hidden bg-linear-to-br from-[#026a75] via-[#037a86] to-[#025f68]">

            <NavElse title="ขอบริการสนับสนุนจากฝ่าย IT" />

            <main className="flex-1 min-h-0 bg-[#f0fafa] rounded-t-[1.5rem] sm:rounded-t-[2rem] lg:rounded-t-[3rem] shadow-2xl overflow-y-auto">
                <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-8">

                    <Card className="border-0 shadow-lg mb-6">
                        <CardContent className="p-5">
                            <div className="flex items-center gap-3 mb-4">
                                <div className="w-10 h-10 bg-linear-to-br from-[#026a75] to-[#03969a] rounded-xl flex items-center justify-center shadow-md">
                                    <Search className="w-5 h-5 text-white" />
                                </div>
                                <div>
                                    <h2 className="font-semibold text-xl text-[#055058]">ค้นหาแบบฟอร์มบริการ</h2>
                                    <p className="text-xs text-gray-500">พิมพ์ชื่อหรือรหัสฟอร์มเพื่อค้นหา</p>
                                </div>
                            </div>

                            <div className="relative">
                                <DropdownSearch
                                    options={form.map(f => ({
                                        option_value: f.form_code,
                                        option_label: ` ${f.form_code}  ${f.form_name}`
                                    }))}
                                    onChange={(value) => handleSearch(value)}
                                    value={selectedFormId}
                                />
                            </div>
                        </CardContent>
                    </Card>

                    {formData && (
                        <PreviewForm
                            formData={formData}
                            clearAfterSubmit={clearAfterSubmit}
                            submitData={(data) => handleSubmit(data)}
                        />
                    )}


                </div>
            </main>
        </div>
    );
}