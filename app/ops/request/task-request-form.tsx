'use client';

import { useEffect, useMemo, useState } from 'react';
import type { UserInfo } from '@/app/context/SessionContext';
import { DropdownSearch } from '@/components/ui/dropdown/issue';
import { cn } from '@/lib/utils';
import { listProjects, OpsRequestError, requestTask } from '../api';
import {
    AttachmentPicker, DateField, FieldError, FieldLabel, FormActions, INPUT_CLASS,
    PriorityPicker, RequesterCard, SectionTitle, StatusBadge, TEXTAREA_CLASS, fieldBorder,
} from '../components';
import type { OpsPriority, Project, TaskRequestInput } from '../types';

const MIN_DETAIL = 10;

type FormState = Omit<TaskRequestInput, 'priority'> & { priority: OpsPriority | '' };

const EMPTY: Omit<FormState, 'project_id'> = { title: '', detail: '', priority: '', target_date: '' };

/** Element ids are prefixed — the project form stays mounted (hidden) next to this one and owns the plain ids. */
const fieldId = (key: string) => `task-${key}`;

const validate = (f: FormState) => {
    const errors: Record<string, string> = {};
    if (!f.project_id) errors.project_id = 'กรุณาเลือกโปรเจกต์ที่ต้องการพัฒนาเพิ่ม';
    if (f.title.trim().length < 3) errors.title = 'กรุณาระบุชื่อ Task อย่างน้อย 3 ตัวอักษร';
    if (f.detail.trim().length < MIN_DETAIL) errors.detail = `กรุณาอธิบายสิ่งที่ต้องการอย่างน้อย ${MIN_DETAIL} ตัวอักษร`;
    if (!f.priority) errors.priority = 'กรุณาเลือกระดับความสำคัญ';
    return errors;
};

/**
 * พัฒนาเพิ่ม: a new task under a project that is already accepted (not Open / Reject).
 * It lands on the board as a task in Open without an owner until the OPS team takes it.
 */
export function TaskRequestForm({ user, projectId, onProjectChange, onCreated }: {
    user: UserInfo | null;
    /** Kept by the page so it can live in the URL (?project=) */
    projectId: string;
    onProjectChange: (id: string) => void;
    onCreated: (taskId: string) => void;
}) {
    const [projects, setProjects] = useState<Project[]>([]);
    const [loadingProjects, setLoadingProjects] = useState(true);
    const [form, setForm] = useState(EMPTY);
    const [files, setFiles] = useState<File[]>([]);
    const [errors, setErrors] = useState<Record<string, string>>({});
    const [submitting, setSubmitting] = useState(false);

    useEffect(() => {
        if (!user) return;
        listProjects('all')
            // only systems the team has accepted — an Open request is still edited as a project request
            .then(list => setProjects(list.filter(p => p.status !== 'Reject' && p.status !== 'Open')))
            .catch(err => console.error('Error fetching OPS projects:', err))
            .finally(() => setLoadingProjects(false));
    }, [user]);

    const options = useMemo(() => projects.map(p => ({
        option_value: p.project_id,
        option_label: `${p.project_id} · ${p.title}`,
    })), [projects]);

    const selected = projects.find(p => p.project_id === projectId);

    const clearError = (key: string) => setErrors(prev => {
        if (!prev[key]) return prev;
        const next = { ...prev };
        delete next[key];
        return next;
    });

    const set = <K extends keyof typeof EMPTY>(key: K, value: (typeof EMPTY)[K]) => {
        setForm(prev => ({ ...prev, [key]: value }));
        clearError(key);
    };

    const pickProject = (id: string) => { onProjectChange(id); clearError('project_id'); };

    const reset = () => { setForm(EMPTY); setFiles([]); setErrors({}); onProjectChange(''); };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        const full: FormState = { ...form, project_id: projectId };
        const found = validate(full);
        setErrors(found);
        if (Object.keys(found).length) {
            (document.getElementById(fieldId(Object.keys(found)[0])) ?? e.currentTarget as HTMLElement).scrollIntoView({ behavior: 'smooth', block: 'center' });
            return;
        }
        if (!user) return;
        setSubmitting(true);
        try {
            const { task_id } = await requestTask({
                project_id: projectId,
                title: full.title.trim(),
                detail: full.detail.trim(),
                priority: full.priority as OpsPriority,
                target_date: full.target_date || null,
            }, files);
            onCreated(task_id);
        } catch (err) {
            if (err instanceof OpsRequestError && err.body.field_errors) setErrors(err.body.field_errors);
            const { default: Swal } = await import('sweetalert2');
            Swal.fire({ icon: 'error', title: 'ส่งคำขอไม่สำเร็จ', text: err instanceof Error ? err.message : 'กรุณาลองใหม่อีกครั้ง', confirmButtonText: 'ตกลง' });
        } finally {
            setSubmitting(false);
        }
    };

    return (
        <form onSubmit={handleSubmit} noValidate className="space-y-6">
            <RequesterCard user={user} />

            {/* ── 1. which system ── */}
            <SectionTitle step={1} title="พัฒนาเพิ่มในโปรเจกต์ไหน" caption="เลือกได้เฉพาะโปรเจกต์ที่ทีมรับเรื่องแล้ว" />
            <div id={fieldId('project_id')}>
                <FieldLabel no={1} label="ชื่อโปรเจค / Project ID" required />
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

            {/* ── 2. what to add ── */}
            <SectionTitle step={2} title="ต้องการพัฒนาอะไรเพิ่ม" />
            <div className="space-y-5">
                <div>
                    <FieldLabel no={2} htmlFor={fieldId('title')} label="ชื่อ Task / สิ่งที่ต้องการเพิ่ม" required />
                    <input
                        id={fieldId('title')}
                        value={form.title}
                        onChange={(e) => set('title', e.target.value)}
                        aria-invalid={Boolean(errors.title)}
                        maxLength={200}
                        placeholder="เช่น เพิ่มปุ่ม Export รายงานเป็น Excel"
                        className={cn(INPUT_CLASS, fieldBorder(!!errors.title))}
                    />
                    <FieldError message={errors.title} />
                </div>
                <div>
                    <FieldLabel no={3} htmlFor={fieldId('detail')} label="รายละเอียดและเหตุผล" required />
                    <textarea
                        id={fieldId('detail')}
                        value={form.detail}
                        onChange={(e) => set('detail', e.target.value)}
                        aria-invalid={Boolean(errors.detail)}
                        rows={5}
                        maxLength={5000}
                        placeholder={'ตอนนี้ระบบทำงานอย่างไร:\nอยากให้เพิ่ม / เปลี่ยนเป็นอย่างไร:\nช่วยงานอะไรได้บ้าง:'}
                        className={cn(TEXTAREA_CLASS, 'min-h-36', fieldBorder(!!errors.detail))}
                    />
                    <FieldError message={errors.detail} />
                </div>
            </div>

            {/* ── 3. priority & timeline ── */}
            <SectionTitle step={3} title="ความเร่งด่วน" />
            <div className="space-y-5">
                <div id={fieldId('priority')}>
                    <FieldLabel no={4} label="ระดับความสำคัญ (Priority)" required />
                    <PriorityPicker value={form.priority} onChange={(p) => set('priority', p)} />
                    <FieldError message={errors.priority} />
                </div>
                <div>
                    <FieldLabel no={5} htmlFor={fieldId('target_date')} label="วันที่ต้องการใช้งาน" optional />
                    <div className="sm:max-w-xs">
                        <DateField id={fieldId('target_date')} value={form.target_date ?? ''} onChange={(v) => set('target_date', v)} />
                    </div>
                </div>
            </div>

            {/* ── 4. attachments ── */}
            <SectionTitle step={4} title="เอกสารประกอบ" />
            <div>
                <FieldLabel no={6} label="ภาพหน้าจอ / ตัวอย่าง / ไฟล์ที่เกี่ยวข้อง" optional />
                <AttachmentPicker
                    files={files}
                    onChange={setFiles}
                    accept="image/png,image/jpeg,application/pdf,.xlsx,.xls,.csv,.docx,.doc,.pptx"
                    acceptLabel="รูปภาพ, PDF, Excel, Word, PowerPoint"
                />
            </div>

            <FormActions submitting={submitting} submitLabel="ส่งคำขอพัฒนาเพิ่ม" onReset={reset} />
        </form>
    );
}
