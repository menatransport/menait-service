'use client';

import { useRef, useState } from 'react';
import { Paperclip, Pencil, Upload } from 'lucide-react';
import { deleteTaskFile, uploadTaskFile } from '../api';
import { AttachmentList, DateField, PriorityBadge, PriorityPicker, fieldBorder, formatThaiDate } from '../components';
import { RichTextEditor, RichTextView, isRichText, richTextLength } from '../rich-text';
import type { OpsAttachment, OpsPriority, ProjectTask, ProjectTaskEditInput } from '../types';

/** Keep in sync with ncacdb check_attachment_file */
const MAX_FILE_MB = 10;
const FILE_ACCEPT = 'image/png,image/jpeg,application/pdf,.xlsx,.xls,.csv,.docx,.doc,.pptx';

const errorText = (err: unknown, fallback: string) => (err instanceof Error && err.message) || fallback;

const Row = ({ label, children }: { label: string; children: React.ReactNode }) => (
    <div className="py-3.5 min-w-0">
        <p className="text-xs font-semibold text-ink-500 mb-1">{label}</p>
        <div className="text-sm leading-relaxed text-ink-900 whitespace-pre-line wrap-break-word">{children}</div>
    </div>
);

/** Plain-text detail (older tasks) → paragraphs, so the editor keeps its line breaks. */
const plainToHtml = (text: string) =>
    text.split(/\r?\n/).map(line => `<p>${line.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')}</p>`).join('');

const Empty = ({ children = '-' }: { children?: React.ReactNode }) => <span className="text-ink-500">{children}</span>;

/** In-place editor for detail / priority / target date. Resolves true when saved. */
const TaskDetailForm = ({ t, onSave, onCancel }: {
    t: ProjectTask;
    onSave: (input: ProjectTaskEditInput) => Promise<boolean>;
    onCancel: () => void;
}) => {
    const [detail, setDetail] = useState(() => (t.detail && !isRichText(t.detail) ? plainToHtml(t.detail) : t.detail ?? ''));
    const [priority, setPriority] = useState<OpsPriority | ''>(t.priority ?? '');
    const [targetDate, setTargetDate] = useState(t.target_date ?? '');
    const [saving, setSaving] = useState(false);

    const submit = async (e: React.FormEvent) => {
        e.preventDefault();
        setSaving(true);
        const ok = await onSave({ detail: richTextLength(detail) ? detail : null, priority: priority || null, target_date: targetDate || null });
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
            <p className="text-[13px] font-semibold text-brand-700">แก้ไขรายละเอียด Task</p>
            <div>
                <label htmlFor="task-edit-detail" className="block text-xs font-semibold text-ink-500 mb-1.5">รายละเอียด</label>
                <RichTextEditor
                    id="task-edit-detail"
                    value={detail}
                    onChange={setDetail}
                    placeholder="สิ่งที่ต้องทำ / ขอบเขตงาน / เงื่อนไขที่ต้องระวัง"
                    className={fieldBorder()}
                />
            </div>
            <div>
                <div className="flex items-center justify-between mb-1.5">
                    <span className="text-xs font-semibold text-ink-500">ความสำคัญ</span>
                    {priority && (
                        <button type="button" onClick={() => setPriority('')} className="text-xs text-ink-500 hover:text-brand-700 cursor-pointer">
                            ไม่ระบุ
                        </button>
                    )}
                </div>
                <PriorityPicker compact value={priority} onChange={setPriority} />
            </div>
            <div>
                <label htmlFor="task-edit-target_date" className="block text-xs font-semibold text-ink-500 mb-1.5">วันที่ต้องการใช้งาน</label>
                <DateField id="task-edit-target_date" value={targetDate} onChange={setTargetDate} />
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

/**
 * The same details card on every task — filed from /ops/request (พัฒนาเพิ่ม) or created by the OPS team.
 * OPS team / admin edit detail, priority and target date until Done.
 */
export const TaskDetailSection = ({ t, onSave }: {
    t: ProjectTask;
    /** OPS team / admin; resolves true when saved */
    onSave?: (input: ProjectTaskEditInput) => Promise<boolean>;
}) => {
    const [editing, setEditing] = useState(false);
    const canEdit = Boolean(onSave) && t.status !== 'Done';

    if (editing && canEdit) return <TaskDetailForm t={t} onSave={onSave!} onCancel={() => setEditing(false)} />;

    return (
        <section className="rounded-[22px] border border-border bg-white px-5 py-1 divide-y divide-[#eef5fd]">
            <div className="flex items-center justify-between gap-2 py-2.5 min-h-12">
                <span className="text-xs font-semibold text-ink-500">รายละเอียด Task</span>
                {canEdit && (
                    <button
                        type="button"
                        onClick={() => setEditing(true)}
                        className="h-8 px-3 rounded-full inline-flex items-center gap-1.5 text-xs font-medium text-brand-700 hover:bg-brand-50 cursor-pointer transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-400/50"
                    >
                        <Pencil className="w-3.5 h-3.5" /> แก้ไข
                    </button>
                )}
            </div>
            <Row label={t.requested_by ? 'ขอพัฒนาเพิ่มโดย' : 'สร้างโดย'}>
                {t.requested_by ? (
                    <>
                        <span className="font-semibold">{t.requested_by.name}</span>
                        {t.requested_by.department && <span className="text-ink-500"> · {t.requested_by.department}</span>}
                    </>
                ) : (
                    <>
                        <span className="font-semibold">{t.status_history[0]?.changed_by.name ?? t.owner?.name ?? '-'}</span>
                        <span className="text-ink-500"> · ทีม OPS</span>
                    </>
                )}
            </Row>
            <div className="py-3.5 grid grid-cols-2 gap-4 text-sm text-ink-900">
                <div className="min-w-0">
                    <p className="text-xs font-semibold text-ink-500 mb-1">ความสำคัญ</p>
                    {t.priority ? <PriorityBadge priority={t.priority} /> : <Empty />}
                </div>
                <div className="min-w-0">
                    <p className="text-xs font-semibold text-ink-500 mb-1">วันที่ต้องการใช้งาน</p>
                    {t.target_date ? formatThaiDate(t.target_date) : <Empty />}
                </div>
            </div>
            <Row label="รายละเอียด">
                {t.detail ? (isRichText(t.detail) ? <RichTextView html={t.detail} /> : t.detail) : <Empty>{canEdit ? 'ยังไม่มีรายละเอียด — กด "แก้ไข" เพื่อเพิ่ม' : 'ยังไม่มีรายละเอียด'}</Empty>}
            </Row>
        </section>
    );
};

/**
 * Files on any task (request_attachments). The requester and the OPS team / admin add or remove them until Done.
 */
export const TaskFilesSection = ({ t, canManage, onChange }: {
    t: ProjectTask;
    canManage: boolean;
    /** Applies a change to the page's copy of the task */
    onChange: (update: (task: ProjectTask) => ProjectTask) => void;
}) => {
    const items = t.request_attachments ?? [];
    const editable = canManage && t.status !== 'Done';
    const [uploading, setUploading] = useState(0);
    const [removing, setRemoving] = useState<string | null>(null);
    const [error, setError] = useState('');
    const fileRef = useRef<HTMLInputElement>(null);

    const add = async (list: FileList | null) => {
        if (!list?.length) return;
        setError('');
        const files = Array.from(list);
        const tooBig = files.filter(f => f.size > MAX_FILE_MB * 1024 * 1024);
        if (tooBig.length) setError(`${tooBig.map(f => f.name).join(', ')} มีขนาดเกิน ${MAX_FILE_MB} MB`);
        for (const file of files.filter(f => !tooBig.includes(f))) {
            setUploading(n => n + 1);
            try {
                const added = await uploadTaskFile(t.task_id, file);
                onChange(task => ({ ...task, request_attachments: [...(task.request_attachments ?? []), added] }));
            } catch (err) {
                setError(errorText(err, `อัปโหลด ${file.name} ไม่สำเร็จ`));
            } finally {
                setUploading(n => n - 1);
            }
        }
    };

    const remove = async (a: OpsAttachment) => {
        setRemoving(a.attachment_id);
        setError('');
        try {
            const next = await deleteTaskFile(t.task_id, a.attachment_id);
            onChange(task => ({ ...task, request_attachments: next.request_attachments ?? [] }));
        } catch (err) {
            setError(errorText(err, 'ลบไฟล์ไม่สำเร็จ'));
        } finally {
            setRemoving(null);
        }
    };

    if (!editable && items.length === 0) {
        return (
            <div className="flex items-center gap-2.5 rounded-[18px] border border-border bg-white px-4.5 py-3.5 text-[13px]">
                <span className="font-semibold text-ink-900">ไฟล์แนบ</span>
                <span className="ml-auto text-ink-500">ไม่มีไฟล์แนบ</span>
            </div>
        );
    }

    return (
        <section className="rounded-[18px] border border-border bg-white px-4.5 py-3.5 space-y-3">
            <div className="flex items-center gap-2 text-[13px]">
                <Paperclip className="w-3.5 h-3.5 text-ink-500" aria-hidden />
                <span className="font-semibold text-ink-900">ไฟล์แนบ</span>
                {items.length > 0 && <span className="text-xs text-ink-500">{items.length} ไฟล์</span>}
                {editable && (
                    <button
                        type="button"
                        onClick={() => fileRef.current?.click()}
                        disabled={uploading > 0}
                        className="ml-auto h-8 px-3 rounded-full inline-flex items-center gap-1.5 text-xs font-medium text-brand-700 hover:bg-brand-50 cursor-pointer transition-colors disabled:opacity-60 disabled:cursor-wait"
                    >
                        {uploading > 0
                            ? <><span className="w-3.5 h-3.5 border-2 border-brand-200 border-t-brand-600 rounded-full animate-spin" /> กำลังอัปโหลด...</>
                            : <><Upload className="w-3.5 h-3.5" /> แนบไฟล์</>}
                    </button>
                )}
                <input ref={fileRef} type="file" multiple accept={FILE_ACCEPT} className="hidden" onChange={(e) => { void add(e.target.files); e.target.value = ''; }} />
            </div>
            {items.length > 0
                ? <AttachmentList items={items} onRemove={editable ? remove : undefined} removing={removing} />
                : <p className="text-xs text-ink-500">ยังไม่มีไฟล์ · รูปภาพ, PDF, Excel, Word, PowerPoint ไม่เกิน {MAX_FILE_MB} MB/ไฟล์</p>}
            {error && <p className="text-xs text-rose-600">{error}</p>}
        </section>
    );
};
