'use client';
import { useState, useEffect, useTransition, useCallback } from "react";
import { useRouter, useParams } from "next/navigation";
import { Navbar } from "@/components/navbar";
import dynamic from 'next/dynamic';
import { useSessionContext } from "@/app/context/SessionContext";

const ServiceComponent = dynamic(
    () => import('./servicecontent').then(mod => ({ default: mod.ServiceComponent })),
    { ssr: false }
);

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
    const { user } = useSessionContext();
    const [isPending, startTransition] = useTransition();

    const [form, setForm] = useState<formSetup[]>([]);
    const [formData, setFormData] = useState<formSetup | null>(null);
    const [selectedFormId, setSelectedFormId] = useState<string>("");
    const [isLoadingForms, setIsLoadingForms] = useState(true);
    const [isLoadingFormData, setIsLoadingFormData] = useState(false);

    useEffect(() => {
        const formId = params?.slug?.[0] as string | undefined;

        const fetchFormList = async () => {
            const query = `SELECT id, form_code, form_name FROM form_masters WHERE form_type = 'Service' AND form_status = 'Active' AND is_latest = true ORDER BY form_code DESC`;
            const res = await fetch("/api/form/?query=" + encodeURIComponent(query));
            return res.json();
        };

        const fetchFormData = async (id: string) => {
            const res = await fetch(`/api/formsubmit?path=${id}`);
            if (!res.ok) throw new Error(`Error: ${res.status}`);
            return res.json();
        };

        const loadData = async () => {
            setIsLoadingForms(true);
            if (formId) {
                setSelectedFormId(formId);
                setIsLoadingFormData(true);
            }

            try {
                if (formId) {
                    // async-parallel: Run both fetches simultaneously
                    const [formList, formDetail] = await Promise.all([
                        fetchFormList(),
                        fetchFormData(formId),
                    ]);
                    setForm(formList);
                    if (formDetail) setFormData(formDetail);
                } else {
                    const formList = await fetchFormList();
                    setForm(formList);
                    setFormData(null);
                }
            } catch (error) {
                console.error("Error fetching data:", error);
            } finally {
                setIsLoadingForms(false);
                setIsLoadingFormData(false);
            }
        };

        loadData();
    }, [params]);

    const handleSearch = useCallback((value: string) => {
        startTransition(() => {
            router.push(`/service/${value}`);
        });
    }, [router, startTransition]);

    const handleSubmit = useCallback(async (data: formDataType) => {
        const employee_id = user?.employee_id ?? null;
        // console.log('Submitting data:', JSON.stringify({ ...data, created_by: employee_id }));
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