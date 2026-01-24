'use client';
import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Navbar } from "@/components/navbar";
import { useParams } from 'next/navigation'
import { ServiceComponent } from "@/components/servicecontent"; 
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
    const [isLoadingForms, setIsLoadingForms] = useState<boolean>(true);
    const [isLoadingFormData, setIsLoadingFormData] = useState<boolean>(false);

    useEffect(() => {
        const getForm = async () => {
            setIsLoadingForms(true);
            try {
                const query = `SELECT id, form_code, form_name FROM form_masters WHERE form_type = 'Service' ORDER BY created_at DESC`;
                const res = await fetch("/api/form/?query=" + encodeURIComponent(query), {
                    method: "GET",
                });
                const data = await res.json();
                console.log('data : ', data);
                setForm(data);
            } catch (error) {
                console.error("Error fetching forms:", error);
            } finally {
                setIsLoadingForms(false);
            }
        }
        getForm();
    }, []);

    useEffect(() => {
        const fetchFormData = async () => {
            const formId = params?.slug?.[0];
            if (formId) {
                setSelectedFormId(formId as string);
                setIsLoadingFormData(true);
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
                } finally {
                    setIsLoadingFormData(false);
                }
            } else {
                console.log('ไม่มี ID (เป็นการสร้างใหม่)');
                setFormData(null);
                setIsLoadingFormData(false);
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
        <Navbar isHome={false} title="ขอบริการสนับสนุนจากฝ่าย IT">
            <ServiceComponent
                form={form}
                selectedFormId={selectedFormId}
                formData={formData}
                clearAfterSubmit={clearAfterSubmit}
                handleSearch={handleSearch}
                handleSubmit={handleSubmit}
                isLoadingForms={isLoadingForms}
                isLoadingFormData={isLoadingFormData}
            />
        </Navbar>
    );
}