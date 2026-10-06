'use client';

import { useState } from 'react';
import { cn } from '@/lib/utils';
import { DateField, FieldError, FieldLabel, INPUT_CLASS, PriorityPicker, TEXTAREA_CLASS, fieldBorder } from '../components';
import { projectToForm, toProjectInput, validateProjectForm, type ProjectFormState } from '../project-form';
import { RichTextEditor } from '../rich-text';
import { UserGroupPicker } from '../user-group-picker';
import type { Project, ProjectRequestInput } from '../types';

/** The request fields of a project, editable in place on the detail sheet. Resolves true when saved. */
export const ProjectEditForm = ({ project, onSave, onCancel }: {
    project: Project;
    onSave: (input: ProjectRequestInput) => Promise<boolean>;
    onCancel: () => void;
}) => {
    const [form, setForm] = useState<ProjectFormState>(() => projectToForm(project));
    const [errors, setErrors] = useState<Record<string, string>>({});
    const [saving, setSaving] = useState(false);

    const set = <K extends keyof ProjectFormState>(key: K, value: ProjectFormState[K]) => {
        setForm(prev => ({ ...prev, [key]: value }));
        setErrors(prev => {
            if (!prev[key]) return prev;
            const next = { ...prev };
            delete next[key];
            return next;
        });
    };

    const text = (key: keyof ProjectFormState) => ({
        id: `edit-${key}`,
        value: String(form[key] ?? ''),
        onChange: (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => set(key, e.target.value as never),
        'aria-invalid': Boolean(errors[key]),
    });

    const submit = async (e: React.FormEvent) => {
        e.preventDefault();
        const found = validateProjectForm(form);
        setErrors(found);
        if (Object.keys(found).length) {
            document.getElementById(`edit-${Object.keys(found)[0]}`)?.scrollIntoView({ behavior: 'smooth', block: 'center' });
            return;
        }
        setSaving(true);
        const ok = await onSave(toProjectInput(form));
        setSaving(false);
        if (ok) onCancel();
    };

    return (
        <form
            onSubmit={submit}
            noValidate
            // Esc while typing here doesn't close the sheet (SheetShell checks this)
            data-local-escape
            className="rounded-[22px] border-2 border-brand-200 bg-white px-5 py-4 space-y-4"
        >
            <p className="text-[13px] font-semibold text-brand-700">แก้ไขคำขอโปรเจกต์</p>
            <div>
                <FieldLabel no={1} htmlFor="edit-title" label="ชื่อโปรเจค / ชื่อคำขอ" required />
                <input {...text('title')} maxLength={200} className={cn(INPUT_CLASS, fieldBorder(!!errors.title))} />
                <FieldError message={errors.title} />
            </div>
            <div>
                <FieldLabel no={2} htmlFor="edit-objective" label="วัตถุประสงค์และปัญหาที่ต้องการแก้ไข" required />
                <textarea {...text('objective')} rows={3} className={cn(TEXTAREA_CLASS, fieldBorder(!!errors.objective))} />
                <FieldError message={errors.objective} />
            </div>
            <div>
                <FieldLabel no={3} htmlFor="edit-requirement" label="รายละเอียดความต้องการ (Requirement)" required />
                <RichTextEditor
                    id="edit-requirement"
                    value={form.requirement}
                    onChange={(html) => set('requirement', html)}
                    invalid={!!errors.requirement}
                    className={fieldBorder(!!errors.requirement)}
                />
                <FieldError message={errors.requirement} />
            </div>
            <div>
                <FieldLabel no={4} htmlFor="edit-expected_benefit" label="ประโยชน์และความคุ้มค่า" required />
                <textarea {...text('expected_benefit')} rows={3} className={cn(TEXTAREA_CLASS, fieldBorder(!!errors.expected_benefit))} />
                <FieldError message={errors.expected_benefit} />
            </div>
            <div>
                <FieldLabel no={5} htmlFor="edit-estimated_users" label="จำนวนผู้ใช้งานโดยประมาณ" required />
                <div className="grid grid-cols-1 sm:grid-cols-[9rem_1fr] items-start gap-3">
                    <div className="relative">
                        <input {...text('estimated_users')} type="number" inputMode="numeric" min={1} className={cn(INPUT_CLASS, 'pr-10', fieldBorder(!!errors.estimated_users))} />
                        <span className="absolute right-4 top-1/2 -translate-y-1/2 text-sm text-gray-400">คน</span>
                    </div>
                    <UserGroupPicker id="edit-user_groups" value={form.user_groups ?? ''} onChange={(v) => set('user_groups', v)} className={fieldBorder()} />
                </div>
                <FieldError message={errors.estimated_users} />
            </div>
            <div id="edit-priority">
                <FieldLabel no={6} label="ระดับความสำคัญ (Priority)" required />
                <PriorityPicker compact value={form.priority} onChange={(p) => set('priority', p)} />
                <FieldError message={errors.priority} />
            </div>
            <div>
                <FieldLabel no={8} htmlFor="edit-target_date" label="วันที่ต้องการเริ่มใช้งาน" optional />
                <DateField id="edit-target_date" value={form.target_date ?? ''} onChange={(v) => set('target_date', v)} />
            </div>
            <div className="flex justify-end gap-2 pt-1">
                <button
                    type="button"
                    onClick={onCancel}
                    disabled={saving}
                    className="h-10 px-4 rounded-full text-sm font-medium text-ink-700 hover:bg-brand-50 cursor-pointer transition-colors disabled:opacity-50"
                >
                    ยกเลิก
                </button>
                <button
                    type="submit"
                    disabled={saving}
                    className="h-10 px-5 rounded-full bg-brand-600 text-sm font-semibold text-white hover:bg-brand-700 cursor-pointer transition-colors disabled:opacity-60"
                >
                    {saving ? 'กำลังบันทึก...' : 'บันทึกการแก้ไข'}
                </button>
            </div>
        </form>
    );
};
