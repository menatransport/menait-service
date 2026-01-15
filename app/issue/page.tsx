'use client';

import { useEffect, useState } from 'react';
import { Lightbulb } from 'lucide-react';
import { NavElse } from '@/components/navbar';
import { PreviewForm } from '@/components/previewform';

export default function IssuePage() {

    const [formData, setFormData] = useState<any>(null);

    useEffect(() => {
        const fetchFormData = async () => {
            try {
                const res = await fetch(`/api/formsubmit?path=ISSUE_IT_005`, {
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

        };

        fetchFormData();
    }, []);

    const handleSubmit = (data: any) => {
        console.log('ข้อมูลจากฟอร์มที่ส่งมา: ', data);
    }

    return (
        <div className="h-screen flex flex-col overflow-hidden bg-linear-to-br from-[#026a75] via-[#037a86] to-[#025f68]">

            {/* Navbar */}
            <NavElse title="แจ้งปัญหาการใช้งานระบบ อุปกรณ์ หรือโปรแกรม" />

            {/* Main Content */}
            <main className="flex-1 min-h-0 bg-[#f0fafa] rounded-t-[1.5rem] sm:rounded-t-[2rem] lg:rounded-t-[3rem] shadow-2xl overflow-y-auto">
                <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-8">

                    {/* Tips Banner */}
                    <div className=" mb-6 p-4 bg-linear-to-r from-amber-50 to-orange-50 border border-amber-200 rounded-2xl flex items-start gap-3">
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

                    {formData && (
                        <PreviewForm
                            formData={formData}
                            submitData={(data) => handleSubmit(data)}
                        />
                    )}
                </div>
            </main>
        </div>
    );
}