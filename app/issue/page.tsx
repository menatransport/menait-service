'use client';

import { useEffect, useState, useCallback } from 'react';
import { Navbar } from '@/components/navbar';
import { IssueComponent } from './issuecontent';
import { useRouter } from 'next/navigation';
import { useSessionContext } from '@/app/context/SessionContext';

const showAlert = (options: { icon: 'success' | 'error'; title: string; text: string; confirmButtonText: string }) =>
    import('sweetalert2').then(({ default: Swal }) => Swal.fire(options));

type formDataType = {
    created_by?: string;
    form_code: string;
    values: {
        question_id: number;
        value_text: string;
    }[];
    files?: File[];
}

export default function IssuePage() {
    const router = useRouter();
    const { user } = useSessionContext();
    const [formData, setFormData] = useState<any>(null);
    const [isLoadingFormData, setIsLoadingFormData] = useState<boolean>(true);

    useEffect(() => {
        const fetchFormData = async () => {
            setIsLoadingFormData(true);
            try {
                const res = await fetch(`/api/formsubmit?path=ISSUE_IT`, {
                    method: "GET",
                });

                if (!res.ok) {
                    throw new Error(`Error: ${res.status}`);
                }

                const data = await res.json();
                // console.log('Data fetched:', data);
                if (data) {
                    setFormData(data);
                }
            } catch (error) {
                console.error("เกิดข้อผิดพลาดในการดึงข้อมูล:", error);
            } finally {
                setIsLoadingFormData(false);
            }
        };

        fetchFormData();
    }, []);

    const handleSubmit = useCallback(async (data: formDataType) => {
        const employee_id = user?.employee_id ?? null;
        const { files, ...formPayload } = data;
        setIsLoadingFormData(true);
        try {
            const res = await fetch('/api/formsubmit', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ ...formPayload, created_by: employee_id }),
            });
            const resData = await res.json();
            setIsLoadingFormData(false);
            if (res.ok) {
                // console.log('Form submitted successfully:', resData);
                if (files && files.length > 0 && resData.form_id) {
                    try {
                        const uploadForm = new FormData();
                        uploadForm.append('form_id', resData.form_id);
                        uploadForm.append('file', files[0]);
                        await fetch('/api/uploads3', { method: 'POST', body: uploadForm });
                    } catch (uploadErr) {
                        console.error('File upload error:', uploadErr);
                    }
                }

                await showAlert({
                    icon: 'success',
                    title: 'ส่งแบบฟอร์มสำเร็จ',
                    text: 'ขอบคุณที่ใช้บริการ',
                    confirmButtonText: 'ตกลง',
                });
                router.push('/home');
            } else {
                await showAlert({
                    icon: 'error',
                    title: 'เกิดข้อผิดพลาด',
                    text: resData.error || 'ไม่สามารถส่งแบบฟอร์มได้',
                    confirmButtonText: 'ตกลง',
                });
            }
        } catch (error) {
            setIsLoadingFormData(false);
            console.error('Submit error:', error);
            await showAlert({
                icon: 'error',
                title: 'เกิดข้อผิดพลาด',
                text: 'เกิดข้อผิดพลาดในการเชื่อมต่อ',
                confirmButtonText: 'ตกลง',
            });
        }
    }, []);

    return (
        <Navbar isHome={false} title="แจ้งปัญหาการใช้งานระบบ อุปกรณ์ หรือโปรแกรม">
            <IssueComponent
                formData={formData}
                onSubmit={handleSubmit}
                isLoadingFormData={isLoadingFormData}
            />
        </Navbar>
    );
}