'use client';
import { useState, useEffect, useTransition, useCallback } from "react";
import { useRouter, useParams } from "next/navigation";
import { Navbar } from "@/components/navbar";
import { ServiceComponent } from "./servicecontent";

const showSuccessAlert = () => import('sweetalert2').then(({ default: Swal }) => 
    Swal.fire({
        icon: 'success',
        title: 'ส่งแบบฟอร์มสำเร็จ',
        text: 'ขอบคุณที่ใช้บริการ',
        confirmButtonText: 'ตกลง',
    })
);

const showErrorAlert = (message: string) => import('sweetalert2').then(({ default: Swal }) => 
    Swal.fire({
        icon: 'error',
        title: 'เกิดข้อผิดพลาด',
        text: message || 'ไม่สามารถส่งแบบฟอร์มได้',
        confirmButtonText: 'ตกลง',
    })
);

export type formSetup = {
    id: string;
    form_name: string;
    form_code: string;
    form_type: string;
    created_by: string;
    created_at: string;
    form_status: string;
    need_approval: boolean;
    questions: Question[];
    values: Question[];
}

export type Question = {
    id: number;
    name: string;
    label: string;
    type: string;
    required: boolean;
    options: Option[];
}

export type Option = {
    value: string;
    label: string;
    filter: string;
}

export type formDataType = {
    created_by?: string;
    form_code: string;
    values: {
        question_id: number;
        value_text: string;
    }[];
}

export default function ServicePage() {
    const router = useRouter();
    const params = useParams();
    const [isPending, startTransition] = useTransition();

    
    // Lazy state initialization (rerender-lazy-state-init)
    const [form, setForm] = useState<formSetup[]>([]);
    const [formData, setFormData] = useState<formSetup | null>(null);
    const [selectedFormId, setSelectedFormId] = useState<string>("");
    const [isLoadingForms, setIsLoadingForms] = useState(true);
    const [isLoadingFormData, setIsLoadingFormData] = useState(false);

    useEffect(() => {
        const getForm = async () => {
            setIsLoadingForms(true);
            try {
                const query = `SELECT id, form_code, form_name FROM form_masters WHERE form_type = 'Service' AND form_status = 'Active' ORDER BY created_at DESC`;
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

    const handleSearch = useCallback((value: string) => {
        startTransition(() => {
            router.push(`/service/${value}`);
        });
    }, [router, startTransition]);

    const handleSubmit = useCallback(async (data: formDataType) => {
        console.log('Submitting data:', data);
        const employee_id = localStorage.getItem('user') ? JSON.parse(localStorage.getItem('user') || '{}').employee_id : null;
        setIsLoadingForms(true);
        try {
            const res = await fetch('/api/formsubmit', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ ...data, created_by: employee_id }),
            });
            const resData = await res.json();
            setIsLoadingForms(false);
            if (res.ok) {
                await showSuccessAlert();
                router.push('/home');
            } else {
                await showErrorAlert(resData.error);
            }
            
        } catch (error) {
            setIsLoadingForms(false);
            console.error('Submit error:', error);
            await showErrorAlert('เกิดข้อผิดพลาดในการเชื่อมต่อ');
        }
    }, []);

    return (
        <Navbar isHome={false} title="ขอบริการสนับสนุนจากฝ่าย IT">
            <ServiceComponent
                form={form}
                selectedFormId={selectedFormId}
                formData={formData}
                handleSearch={handleSearch}
                onSubmit={handleSubmit}
                isLoadingForms={isLoadingForms}
                isLoadingFormData={isLoadingFormData}
            />
        </Navbar>
    );
}