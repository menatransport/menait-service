'use client';

import { useCallback, useState } from 'react';
import { useRouter } from 'next/navigation';
import { FolderKanban } from 'lucide-react';
import { Navbar } from '@/components/navbar';
import { SubmitSuccess } from '@/components/ui/submit-success';
import { useSessionContext } from '@/app/context/SessionContext';
import { cn } from '@/lib/utils';
import { createProject, OpsRequestError } from '../api';
import { OPS_PRIORITIES, type OpsPriority, type ProjectRequestInput } from '../types';
import {
    AttachmentPicker, DateField, FieldError, FieldLabel, FormActions, INPUT_CLASS, OpsFormShell,
    PRIORITY_META, RequesterCard, SectionTitle, TEXTAREA_CLASS, fieldBorder, toPerson,
} from '../components';
import { RichTextEditor } from '../rich-text';
import { UserGroupPicker } from '../user-group-picker';

type FormState = Omit<ProjectRequestInput, 'estimated_users' | 'priority'> & {
    estimated_users: string;
    priority: OpsPriority | '';
};

const EMPTY: FormState = {
    title: '', objective: '', requirement: '', expected_benefit: '',
    estimated_users: '', user_groups: '', priority: '', priority_reason: '', target_date: '',
};

const REQUIRED: Partial<Record<keyof FormState, string>> = {
    title: 'กรุณาระบุชื่อโปรเจค',
    objective: 'กรุณาอธิบายปัญหาและวัตถุประสงค์',
    requirement: 'กรุณาระบุรายละเอียดความต้องการ',
    expected_benefit: 'กรุณาระบุประโยชน์และความคุ้มค่า',
    priority: 'กรุณาเลือกระดับความสำคัญ',
    priority_reason: 'กรุณาระบุเหตุผลประกอบ',
};

const validate = (f: FormState) => {
    const errors: Record<string, string> = {};
    for (const [key, msg] of Object.entries(REQUIRED)) {
        if (!String(f[key as keyof FormState] ?? '').trim()) errors[key] = msg;
    }
    const users = Number(f.estimated_users);
    if (!Number.isInteger(users) || users < 1) errors.estimated_users = 'กรุณาระบุจำนวนผู้ใช้งาน (ตัวเลขตั้งแต่ 1)';
    return errors;
};

const toInput = (f: FormState): ProjectRequestInput => ({
    title: f.title.trim(),
    objective: f.objective.trim(),
    requirement: f.requirement.trim(),
    expected_benefit: f.expected_benefit.trim(),
    estimated_users: Number(f.estimated_users),
    user_groups: f.user_groups?.trim() || null,
    priority: f.priority as OpsPriority,
    priority_reason: f.priority_reason.trim(),
    target_date: f.target_date || null,
});

export default function ProjectRequestPage() {
    const router = useRouter();
    const { user } = useSessionContext();
    const [form, setForm] = useState<FormState>(EMPTY);
    const [files, setFiles] = useState<File[]>([]);
    const [errors, setErrors] = useState<Record<string, string>>({});
    const [submitting, setSubmitting] = useState(false);
    const [createdId, setCreatedId] = useState<string | null>(null);

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
            document.getElementById(Object.keys(found)[0])?.scrollIntoView({ behavior: 'smooth', block: 'center' });
            return;
        }
        if (!user) return;
        setSubmitting(true);
        try {
            const { project_id } = await createProject(toInput(form), files, { me: toPerson(user) });
            setCreatedId(project_id);
        } catch (err) {
            if (err instanceof OpsRequestError && err.body.field_errors) setErrors(err.body.field_errors);
            const { default: Swal } = await import('sweetalert2');
            Swal.fire({ icon: 'error', title: 'ส่งคำขอไม่สำเร็จ', text: err instanceof Error ? err.message : 'กรุณาลองใหม่อีกครั้ง', confirmButtonText: 'ตกลง' });
        } finally {
            setSubmitting(false);
        }
    };

    if (createdId) {
        return (
            <Navbar isHome={false} title="Project Request">
                <SubmitSuccess
                    title="ส่งคำขอโปรเจกต์สำเร็จ!"
                    description={`เลขที่คำขอ ${createdId} · สถานะ Open (รอพิจารณา) — ติดตามความคืบหน้าได้ที่หน้า Project Status`}
                    buttonText="ไปที่ Project Status"
                    onButtonClick={() => router.push('/ops/status')}
                />
            </Navbar>
        );
    }

    return (
        <Navbar isHome={false} title="Project Request">
            <OpsFormShell icon={FolderKanban} title="ยื่นคำขอโปรเจกต์ใหม่" subtitle="กรอกให้ครบเท่าที่ทราบ ทีมจะติดต่อกลับหากต้องการข้อมูลเพิ่ม">
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
                            <div role="radiogroup" aria-label="ระดับความสำคัญ" className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                                {OPS_PRIORITIES.map(p => {
                                    const m = PRIORITY_META[p];
                                    const active = form.priority === p;
                                    return (
                                        <button
                                            key={p}
                                            type="button"
                                            role="radio"
                                            aria-checked={active}
                                            onClick={() => set('priority', p)}
                                            className={cn(
                                                'text-left rounded-xl border-2 p-3 transition-all cursor-pointer',
                                                active ? cn(m.active, 'ring-4') : 'border-gray-200 bg-white hover:border-gray-300',
                                            )}
                                        >
                                            <span className="flex items-center gap-2">
                                                <span className={cn('grid size-7 shrink-0 place-items-center rounded-lg border', m.chip)}>
                                                    <m.icon className="size-4" strokeWidth={2.5} />
                                                </span>
                                                <span className="text-sm font-semibold text-gray-800">{m.label}</span>
                                            </span>
                                            <span className="block mt-2 text-[11px] leading-snug text-gray-500">{m.hint}</span>
                                        </button>
                                    );
                                })}
                            </div>
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
            </OpsFormShell>
        </Navbar>
    );
}
