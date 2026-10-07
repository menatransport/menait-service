'use client';

import { Suspense, useEffect, useMemo, useState } from 'react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { CircleAlert } from 'lucide-react';
import { Navbar } from '@/components/navbar';
import { SubmitSuccess } from '@/components/ui/submit-success';
import { DropdownSearch } from '@/components/ui/dropdown/issue';
import { useSessionContext } from '@/app/context/SessionContext';
import { cn } from '@/lib/utils';
import { createIssue, listProjects, OpsRequestError } from '../api';
import type { Project } from '../types';
import {
    AttachmentPicker, FieldError, FieldLabel, FormActions, OpsFormShell, RequesterCard,
    StatusBadge, TEXTAREA_CLASS, fieldBorder,
} from '../components';

const MIN_DESCRIPTION = 10;

/** /ops/issue/{OPS-…} → that project is picked */
const projectIdFrom = (pathname: string) => {
    const m = pathname.match(/^\/ops\/issue\/([^/]+)/);
    return m ? decodeURIComponent(m[1]) : null;
};

/**
 * Keeps the picked project in the URL without a Next navigation (history API),
 * so the link can be shared and opens with the project already filled in.
 */
const syncProjectUrl = (id: string) => {
    window.history.replaceState(null, '', `/ops/issue${id ? `/${encodeURIComponent(id)}` : ''}`);
};

function ProjectIssueForm() {
    const router = useRouter();
    const pathname = usePathname();
    const searchParams = useSearchParams();
    const { user } = useSessionContext();

    const [projects, setProjects] = useState<Project[]>([]);
    const [loadingProjects, setLoadingProjects] = useState(true);
    // ?project= is the older link shape, still honoured
    const [projectId, setProjectId] = useState(projectIdFrom(pathname) ?? searchParams.get('project') ?? '');
    const [description, setDescription] = useState('');
    const [files, setFiles] = useState<File[]>([]);
    const [errors, setErrors] = useState<Record<string, string>>({});
    const [submitting, setSubmitting] = useState(false);
    const [createdId, setCreatedId] = useState<string | null>(null);

    useEffect(() => {
        if (!user) return;
        listProjects('all')
            // Issues are only for projects that were accepted
            .then(list => setProjects(list.filter(p => p.status !== 'Reject' && p.status !== 'Open')))
            .catch(err => console.error('Error fetching OPS projects:', err))
            .finally(() => setLoadingProjects(false));
    }, [user]);

    const options = useMemo(() => projects.map(p => ({
        option_value: p.project_id,
        option_label: `${p.project_id} · ${p.title}`,
    })), [projects]);

    const clearError = (key: string) => setErrors(prev => {
        const next = { ...prev };
        delete next[key];
        return next;
    });

    const selected = projects.find(p => p.project_id === projectId);

    const pickProject = (id: string) => {
        setProjectId(id);
        clearError('project_id');
        syncProjectUrl(id);
    };

    const reset = () => { pickProject(''); setDescription(''); setFiles([]); setErrors({}); };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        const found: Record<string, string> = {};
        if (!projectId) found.project_id = 'กรุณาเลือกโปรเจคที่พบปัญหา';
        if (description.trim().length < MIN_DESCRIPTION) found.description = `กรุณาอธิบายปัญหาอย่างน้อย ${MIN_DESCRIPTION} ตัวอักษร`;
        setErrors(found);
        if (Object.keys(found).length || !user) return;

        setSubmitting(true);
        try {
            const { issue_id } = await createIssue({ project_id: projectId, description: description.trim() }, files);
            setCreatedId(issue_id);
        } catch (err) {
            if (err instanceof OpsRequestError && err.body.field_errors) setErrors(err.body.field_errors);
            const { default: Swal } = await import('sweetalert2');
            Swal.fire({ icon: 'error', title: 'แจ้งปัญหาไม่สำเร็จ', text: err instanceof Error ? err.message : 'กรุณาลองใหม่อีกครั้ง', confirmButtonText: 'ตกลง' });
        } finally {
            setSubmitting(false);
        }
    };

    if (createdId) {
        return (
            <SubmitSuccess
                title="แจ้งปัญหาสำเร็จ!"
                description={`เลขที่ ${createdId} · ทีมงานจะตรวจสอบและอัปเดตสถานะให้ทราบ`}
                buttonText="ไปที่ Project Status"
                onButtonClick={() => router.push('/ops/status?view=issues')}
            />
        );
    }

    return (
        <OpsFormShell icon={CircleAlert} title="แจ้งปัญหาโปรเจกต์" subtitle="แจ้งปัญหาที่พบในระบบที่พัฒนาไปแล้ว">
            <form onSubmit={handleSubmit} noValidate className="space-y-5">
                <RequesterCard user={user} label="ผู้แจ้ง" />

                <div>
                    <FieldLabel no={1} label="ชื่อโปรเจค / Project ID ที่พบปัญหา" required />
                    <DropdownSearch
                        value={projectId}
                        onChange={pickProject}
                        options={options}
                        placeholder={loadingProjects ? 'กำลังโหลดรายการโปรเจกต์...' : '-- เลือกโปรเจกต์ --'}
                        searchPlaceholder="ค้นหาด้วยชื่อหรือ Project ID..."
                        disabled={loadingProjects}
                        error={!!errors.project_id}
                    />
                    {selected && (
                        <div className="mt-2 flex items-center gap-2 text-xs text-gray-500">
                            สถานะโปรเจกต์ <StatusBadge status={selected.status} />
                        </div>
                    )}
                    <FieldError message={errors.project_id} />
                </div>

                <div>
                    <FieldLabel no={2} htmlFor="description" label="รายละเอียดปัญหาที่พบ" required />
                    <textarea
                        id="description"
                        value={description}
                        onChange={(e) => { setDescription(e.target.value); clearError('description'); }}
                        rows={6}
                        maxLength={5000}
                        placeholder={'ขั้นตอนที่ทำก่อนเกิดปัญหา:\nผลลัพธ์ที่เกิดขึ้น / ข้อความ Error:\nสิ่งที่คาดหวังให้ระบบทำ:'}
                        className={cn(TEXTAREA_CLASS, 'min-h-40', fieldBorder(!!errors.description))}
                    />
                    <FieldError message={errors.description} />
                </div>

                <div>
                    <FieldLabel no={3} label="แนบรูปภาพ" optional hint="ภาพหน้าจอ ข้อความ Error หรือไฟล์ที่เกี่ยวข้อง" />
                    <AttachmentPicker
                        files={files}
                        onChange={setFiles}
                        accept="image/png,image/jpeg,application/pdf,.xlsx,.xls,.csv"
                        acceptLabel="PNG, JPEG, PDF, Excel"
                    />
                </div>

                <FormActions submitting={submitting} submitLabel="ส่งเรื่องแจ้งปัญหา" onReset={reset} />
            </form>
        </OpsFormShell>
    );
}

export default function ProjectIssuePage() {
    return (
        <Navbar isHome={false} title="Project Issue">
            <Suspense>
                <ProjectIssueForm />
            </Suspense>
        </Navbar>
    );
}
