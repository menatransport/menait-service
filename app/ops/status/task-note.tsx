'use client';

import { useRef, useState } from 'react';
import { ImagePlus, NotebookPen, X } from 'lucide-react';
import { cn } from '@/lib/utils';
import { deleteTaskImage, updateTaskNote, uploadTaskImage } from '../api';
import type { ProjectTask } from '../types';
import { formatThaiDate } from '../components';
import { compressImage } from '../image-compress';
import { ImageViewer } from '../image-viewer';

/** Keep in sync with ncacdb ops_logic (TASK_IMAGE_MIME / MAX_TASK_IMAGES) and TaskNoteInput */
const MAX_IMAGES = 10;
const IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];
const MAX_IMAGE_MB = 10;
const MAX_LENGTH = 5000;

const errorText = (err: unknown, fallback: string) => (err instanceof Error && err.message) || fallback;

/**
 * The responsible people's work note + pictures on a task.
 * Owner / co-assignees / admin (task.can_note) edit it until the task is Done; everyone else reads it.
 * Pictures: the add tile, Ctrl+V of a screenshot into the note, or drag & drop onto the card.
 */
export const TaskNoteSection = ({ t, onChange }: {
    t: ProjectTask;
    /** Applies a change to the page's copy of the task */
    onChange: (update: (task: ProjectTask) => ProjectTask) => void;
}) => {
    const canEdit = Boolean(t.can_note);
    const saved = t.note ?? '';
    const images = t.attachments ?? [];
    const [text, setText] = useState(saved);
    const [saving, setSaving] = useState(false);
    const [uploading, setUploading] = useState(0);
    const [removing, setRemoving] = useState<string | null>(null);
    const [error, setError] = useState('');
    const [dragging, setDragging] = useState(false);
    const [viewing, setViewing] = useState<number | null>(null);
    const fileRef = useRef<HTMLInputElement>(null);
    const dirty = text.trim() !== saved.trim();

    // another save (or a reload) brought a new note: follow it unless the viewer is mid-edit
    const [seenSaved, setSeenSaved] = useState(saved);
    if (saved !== seenSaved) {
        setSeenSaved(saved);
        if (!dirty) setText(saved);
    }

    const save = async () => {
        if (!dirty || saving) return;
        setSaving(true);
        setError('');
        try {
            const next = await updateTaskNote(t.task_id, text.trim() || null);
            onChange(() => next);
            setText(next.note ?? '');
        } catch (err) {
            setError(errorText(err, 'บันทึกโน้ตไม่สำเร็จ'));
        }
        setSaving(false);
    };

    const addImages = async (list: File[]) => {
        const picked = list.filter(f => IMAGE_TYPES.includes(f.type));
        const room = MAX_IMAGES - images.length - uploading;
        const ok = picked.filter(f => f.size <= MAX_IMAGE_MB * 1024 * 1024).slice(0, Math.max(0, room));
        setError(
            list.length > 0 && picked.length === 0 ? 'แนบได้เฉพาะไฟล์รูปภาพ (PNG, JPEG, GIF, WebP)'
                : picked.some(f => f.size > MAX_IMAGE_MB * 1024 * 1024) ? `รูปต้องไม่เกิน ${MAX_IMAGE_MB} MB`
                    : picked.length > room ? `แนบรูปได้สูงสุด ${MAX_IMAGES} รูปต่อ Task`
                        : '',
        );
        if (ok.length === 0) return;
        setUploading(n => n + ok.length);
        // one at a time — each request stays under the Vercel proxy's body limit
        for (const file of ok) {
            try {
                const a = await uploadTaskImage(t.task_id, await compressImage(file));
                onChange(task => ({ ...task, attachments: [...(task.attachments ?? []), a] }));
            } catch (err) {
                setError(errorText(err, `อัปโหลด ${file.name} ไม่สำเร็จ`));
            }
            setUploading(n => n - 1);
        }
    };

    const removeImage = async (attachmentId: string) => {
        setRemoving(attachmentId);
        setError('');
        try {
            const next = await deleteTaskImage(t.task_id, attachmentId);
            onChange(task => ({ ...task, attachments: next.attachments ?? [], updated_at: next.updated_at }));
        } catch (err) {
            setError(errorText(err, 'ลบรูปไม่สำเร็จ'));
        }
        setRemoving(null);
    };

    const empty = !saved && images.length === 0;

    return (
        <section
            aria-label="โน้ตผู้รับผิดชอบ"
            onDragOver={canEdit ? (e) => { if (e.dataTransfer.types.includes('Files')) { e.preventDefault(); setDragging(true); } } : undefined}
            onDragLeave={(e) => { if (!e.currentTarget.contains(e.relatedTarget as Node | null)) setDragging(false); }}
            onDrop={canEdit ? (e) => {
                if (!e.dataTransfer.files.length) return;
                e.preventDefault();
                setDragging(false);
                void addImages(Array.from(e.dataTransfer.files));
            } : undefined}
            className={cn(
                'rounded-[22px] bg-white shadow-soft p-4.5 sm:p-5 space-y-3 border transition-colors',
                dragging ? 'border-brand-400 border-dashed bg-brand-50/60' : 'border-transparent',
            )}
        >
            <header className="flex items-center gap-2">
                <span className="w-7 h-7 rounded-[10px] bg-sun-300/30 text-sun-700 grid place-items-center shrink-0">
                    <NotebookPen className="w-4 h-4" />
                </span>
                <h3 className="text-[13px] font-semibold text-ink-900">โน้ตผู้รับผิดชอบ</h3>
                {images.length > 0 && <span className="text-[11px] text-ink-500 tabular-nums">· รูป {images.length}/{MAX_IMAGES}</span>}
                {t.note_updated_at && t.note_updated_by && (
                    <span className="ml-auto text-[11px] text-ink-500 truncate" title={formatThaiDate(t.note_updated_at, true)}>
                        แก้ไขโดย {t.note_updated_by.name.split(' ')[0]} · {formatThaiDate(t.note_updated_at)}
                    </span>
                )}
            </header>

            {canEdit ? (
                <div>
                    <textarea
                        // Esc with unsaved text only discards it; otherwise it closes the sheet as usual
                        data-local-escape={dirty ? '' : undefined}
                        value={text}
                        onChange={(e) => setText(e.target.value)}
                        onKeyDown={(e) => {
                            if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) { e.preventDefault(); void save(); }
                            if (e.key === 'Escape' && dirty) { e.preventDefault(); setText(saved); }
                        }}
                        onPaste={(e) => {
                            const files = Array.from(e.clipboardData.files).filter(f => f.type.startsWith('image/'));
                            if (files.length === 0) return;
                            // a pure screenshot has no text — keep the browser from pasting anything else
                            if (!e.clipboardData.getData('text/plain')) e.preventDefault();
                            void addImages(files);
                        }}
                        maxLength={MAX_LENGTH}
                        rows={3}
                        placeholder={dragging ? 'วางรูปที่นี่...' : 'จดความคืบหน้า สิ่งที่ทำไป หรือสิ่งที่ต้องรู้... (Ctrl+V วางรูปได้)'}
                        aria-label="โน้ตผู้รับผิดชอบ"
                        className="w-full field-sizing-content min-h-20 max-h-80 resize-none rounded-[14px] border border-border bg-brand-50/40 px-3.5 py-2.5 text-sm leading-relaxed text-ink-900 placeholder:text-ink-300 focus:outline-none focus:border-brand-300 focus:bg-white focus:ring-4 focus:ring-brand-400/15 transition-colors"
                    />
                    {dirty && (
                        <div className="mt-2 flex items-center justify-end gap-2">
                            <span className="mr-auto text-[11px] text-ink-500">Ctrl+Enter บันทึก · Esc ยกเลิก</span>
                            <button
                                type="button"
                                onClick={() => setText(saved)}
                                disabled={saving}
                                className="h-8 px-3.5 rounded-full text-xs font-medium text-ink-500 hover:bg-slate-100 cursor-pointer transition-colors"
                            >
                                ยกเลิก
                            </button>
                            <button
                                type="button"
                                onClick={() => void save()}
                                disabled={saving}
                                className="h-8 px-4 rounded-full text-xs font-semibold text-white bg-brand-600 hover:bg-brand-700 disabled:bg-brand-200 cursor-pointer disabled:cursor-not-allowed transition-colors"
                            >
                                {saving ? 'กำลังบันทึก…' : 'บันทึกโน้ต'}
                            </button>
                        </div>
                    )}
                </div>
            ) : saved ? (
                <p className="text-sm leading-relaxed text-ink-700 whitespace-pre-line wrap-break-word">{saved}</p>
            ) : empty ? (
                <p className="text-sm text-ink-500">ยังไม่มีโน้ตจากผู้รับผิดชอบ</p>
            ) : null}

            {(images.length > 0 || uploading > 0 || canEdit) && (
                <ul className="grid grid-cols-3 sm:grid-cols-4 gap-2" aria-label="รูปแนบของ Task">
                    {images.map((a, i) => (
                        <li key={a.attachment_id} className={cn('relative group', removing === a.attachment_id && 'opacity-40 pointer-events-none')}>
                            <button
                                type="button"
                                onClick={() => setViewing(i)}
                                title={a.file_name}
                                aria-label={`ดูรูป ${a.file_name}`}
                                className="block w-full aspect-square overflow-hidden rounded-[14px] border border-border bg-slate-50 cursor-zoom-in hover:border-brand-300 transition-colors"
                            >
                                {/* eslint-disable-next-line @next/next/no-img-element -- presigned S3 URL, shown as-is */}
                                <img src={a.url} alt={a.file_name} loading="lazy" className="w-full h-full object-cover" />
                            </button>
                            {canEdit && (
                                <button
                                    type="button"
                                    onClick={() => void removeImage(a.attachment_id)}
                                    aria-label={`ลบรูป ${a.file_name}`}
                                    title="ลบรูป"
                                    className="absolute -top-1.5 -right-1.5 w-6 h-6 rounded-full grid place-items-center bg-ink-900/80 text-white hover:bg-rose-600 cursor-pointer sm:opacity-0 sm:group-hover:opacity-100 focus-visible:opacity-100 transition-opacity"
                                >
                                    <X className="w-3.5 h-3.5" />
                                </button>
                            )}
                        </li>
                    ))}
                    {Array.from({ length: uploading }, (_, i) => (
                        <li key={`up-${i}`} className="aspect-square rounded-[14px] border border-dashed border-brand-300 bg-brand-50 grid place-items-center">
                            <span className="w-5 h-5 rounded-full border-2 border-brand-200 border-t-brand-600 animate-spin" aria-label="กำลังอัปโหลด" />
                        </li>
                    ))}
                    {canEdit && images.length + uploading < MAX_IMAGES && (
                        <li>
                            <button
                                type="button"
                                onClick={() => fileRef.current?.click()}
                                className="w-full aspect-square rounded-[14px] border border-dashed border-brand-300 text-brand-700 hover:bg-brand-50 hover:border-brand-400 cursor-pointer flex flex-col items-center justify-center gap-1 transition-colors"
                            >
                                <ImagePlus className="w-5 h-5" />
                                <span className="text-[11px] font-medium">เพิ่มรูป</span>
                            </button>
                            <input
                                ref={fileRef}
                                type="file"
                                accept={IMAGE_TYPES.join(',')}
                                multiple
                                className="hidden"
                                onChange={(e) => { void addImages(Array.from(e.target.files ?? [])); e.target.value = ''; }}
                            />
                        </li>
                    )}
                </ul>
            )}

            {error && <p role="alert" className="text-[11px] text-rose-600">{error}</p>}

            <ImageViewer images={images} index={viewing} onIndexChange={setViewing} onClose={() => setViewing(null)} />
        </section>
    );
};
