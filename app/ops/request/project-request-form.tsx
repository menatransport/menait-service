'use client';

import { useCallback, useState } from 'react';
import type { UserInfo } from '@/app/context/SessionContext';
import { cn } from '@/lib/utils';
import { createProject, OpsRequestError } from '../api';
import {
    AttachmentPicker, DateField, FieldError, FieldLabel, FormActions, INPUT_CLASS,
    PriorityPicker, RequesterCard, SectionTitle, TEXTAREA_CLASS, fieldBorder,
} from '../components';
import { EMPTY_PROJECT_FORM as EMPTY, type ProjectFormState as FormState, toProjectInput as toInput, validateProjectForm as validate } from '../project-form';
import { RichTextEditor } from '../rich-text';
import { UserGroupPicker } from '../user-group-picker';

/** A brand-new system or piece of work — goes to the board as a project card in Open. */
export function ProjectRequestForm({ user, onCreated }: { user: UserInfo | null; onCreated: (projectId: string) => void }) {
    const [form, setForm] = useState<FormState>(EMPTY);
    const [files, setFiles] = useState<File[]>([]);
    const [errors, setErrors] = useState<Record<string, string>>({});
    const [submitting, setSubmitting] = useState(false);

    const set = useCallback(<K extends keyof FormState>(key: K, value: FormState[K]) => {
        setForm(prev => ({ ...prev, [key]: value }));
        setErrors(prev => {
            if (!prev[key]) return prev;
            const next = { ...prev };
            delete next[key];
            return next;
        });
    }, []);

    const text = (key: keyof FormState) => ({
        id: key,
        value: String(form[key] ?? ''),
        onChange: (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => set(key, e.target.value as never),
        'aria-invalid': Boolean(errors[key]),
    });

    const reset = () => { setForm(EMPTY); setFiles([]); setErrors({}); };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        const found = validate(form);
        setErrors(found);
        if (Object.keys(found).length) {
            (document.getElementById(Object.keys(found)[0]) ?? e.currentTarget as HTMLElement).scrollIntoView({ behavior: 'smooth', block: 'center' });
            return;
        }
        if (!user) return;
        setSubmitting(true);
        try {
            const { project_id } = await createProject(toInput(form), files);
            onCreated(project_id);
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

            {/* ── 1. what & why ── */}
            <SectionTitle step={1} title="โปรเจกต์นี้คืออะไร" />
            <div className="space-y-5">
                <div>
                    <FieldLabel no={1} htmlFor="title" label="ชื่อโปรเจค / ชื่อคำขอ" required />
                    <input {...text('title')} maxLength={200} placeholder="เช่น ระบบจองคิวรถขนส่งออนไลน์" className={cn(INPUT_CLASS, fieldBorder(!!errors.title))} />
                    <FieldError message={errors.title} />
                </div>
                <div>
                    <FieldLabel no={2} htmlFor="objective" label="วัตถุประสงค์และปัญหาที่ต้องการแก้ไข" required />
                    <textarea {...text('objective')} rows={3} placeholder="อธิบายปัญหาที่พบในปัจจุบัน และวัตถุประสงค์ที่ต้องการให้ระบบช่วยแก้ไข" className={cn(TEXTAREA_CLASS, fieldBorder(!!errors.objective))} />
                    <FieldError message={errors.objective} />
                </div>
                <div>
                    <FieldLabel no={3} htmlFor="requirement" label="รายละเอียดความต้องการ (Requirement)" required />
                    <RichTextEditor
                        id="requirement"
                        value={form.requirement}
                        onChange={(html) => set('requirement', html)}
                        invalid={!!errors.requirement}
                        placeholder={'อธิบายการทำงานที่ต้องการ ขั้นตอนการทำงาน (Workflow) หรือฟังก์ชันที่คาดหวัง\nเช่น 1) ผู้ใช้กรอก... 2) หัวหน้าอนุมัติ... 3) ระบบแจ้งเตือน...'}
                        className={fieldBorder(!!errors.requirement)}
                    />
                    <FieldError message={errors.requirement} />
                </div>
            </div>

            {/* ── 2. value ── */}
            <SectionTitle step={2} title="คุ้มค่าแค่ไหน"/>
            <div className="space-y-5">
                <div>
                    <FieldLabel no={4} htmlFor="expected_benefit" label="ประโยชน์และความคุ้มค่า" required />
                    <textarea {...text('expected_benefit')} rows={3} placeholder="สิ่งที่จะดีขึ้นหลังใช้ระบบ เช่น ลดเวลาทำงาน 2 ชม./วัน ลดข้อผิดพลาด หรือลดค่าใช้จ่าย" className={cn(TEXTAREA_CLASS, fieldBorder(!!errors.expected_benefit))} />
                    <FieldError message={errors.expected_benefit} />
                </div>
                <div>
                    <FieldLabel no={5} htmlFor="estimated_users" label="จำนวนผู้ใช้งานโดยประมาณ" required />
                    <div className="grid grid-cols-1 sm:grid-cols-[10rem_1fr] items-start gap-3">
                        <div className="relative">
                            <input {...text('estimated_users')} type="number" inputMode="numeric" min={1} placeholder="0" className={cn(INPUT_CLASS, 'pr-10', fieldBorder(!!errors.estimated_users))} />
                            <span className="absolute right-4 top-1/2 -translate-y-1/2 text-sm text-gray-400">คน</span>
                        </div>
                        <UserGroupPicker id="user_groups" value={form.user_groups ?? ''} onChange={(v) => set('user_groups', v)} className={fieldBorder()} />
                    </div>
                    <FieldError message={errors.estimated_users} />
                </div>
            </div>

            {/* ── 3. priority & timeline ── */}
            <SectionTitle step={3} title="ความเร่งด่วน"/>
            <div className="space-y-5">
                <div id="priority">
                    <FieldLabel no={6} label="ระดับความสำคัญ (Priority)" required />
                    <PriorityPicker value={form.priority} onChange={(p) => set('priority', p)} />
                    <FieldError message={errors.priority} />
                </div>
                <div>
                    <FieldLabel no={7} htmlFor="target_date" label="วันที่ต้องการเริ่มใช้งาน" optional />
                    <div className="sm:max-w-xs">
                        <DateField id="target_date" value={form.target_date ?? ''} onChange={(v) => set('target_date', v)} />
                    </div>
                </div>
            </div>

            {/* ── 4. attachments ── */}
            <SectionTitle step={4} title="เอกสารประกอบ" />
            <div>
                <FieldLabel no={8} label="เอกสารอ้างอิงที่เกี่ยวข้อง" optional />
                <AttachmentPicker
                    files={files}
                    onChange={setFiles}
                    accept="image/png,image/jpeg,application/pdf,.xlsx,.xls,.csv,.docx,.doc,.pptx"
                    acceptLabel="รูปภาพ, PDF, Excel, Word, PowerPoint"
                />
            </div>

            <FormActions submitting={submitting} submitLabel="ส่งคำขอโปรเจกต์" onReset={reset} />
        </form>
    );
}
