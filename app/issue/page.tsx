'use client';

import { useEffect, useState } from 'react';
import { Navbar } from '@/components/navbar';
import { IssueComponent } from '@/components/issuecontent';
import swal from 'sweetalert2';
import { useRouter } from 'next/navigation';

type formDataType = {
    created_by: string;
    form_code: string;
    values: [{
        question_id: number;
        value_text: string;
    }];
}

export default function IssuePage() {
    const router = useRouter();
    const [formData, setFormData] = useState<any>(null);
    const [clearAfterSubmit, setClearAfterSubmit] = useState<boolean>(true);
    const [isLoadingFormData, setIsLoadingFormData] = useState<boolean>(true);

    useEffect(() => {
        const fetchFormData = async () => {
            setIsLoadingFormData(true);
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
            } finally {
                setIsLoadingFormData(false);
            }
        };

        fetchFormData();
    }, []);

    const handleSubmit = async (data: formDataType) => {
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
        <Navbar isHome={false} title="แจ้งปัญหาการใช้งานระบบ อุปกรณ์ หรือโปรแกรม">
            <IssueComponent
                formData={formData}
                clearAfterSubmit={clearAfterSubmit}
                handleSubmit={handleSubmit}
                isLoadingFormData={isLoadingFormData}
            />
        </Navbar>
    );
}