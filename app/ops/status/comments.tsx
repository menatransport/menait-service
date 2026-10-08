'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { formatDistanceToNowStrict } from 'date-fns';
import { th } from 'date-fns/locale';
import { Heart, ImagePlus, MessageCircle, MoreHorizontal, Pencil, SendHorizontal, Trash2, X } from 'lucide-react';
import {
    DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
    AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription,
    AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { useSessionContext } from '@/app/context/SessionContext';
import { cn } from '@/lib/utils';
import { linkifyText } from '@/lib/linkify';
import { createComment, deleteComment, listComments, setCommentLike, updateComment } from '../api';
import type { OpsAttachment, OpsComment, OpsCommentRef, OpsPerson } from '../types';
import { formatThaiDate, toPerson } from '../components';
import { ImageViewer } from '../image-viewer';
import { compressImage } from '../image-compress';
import { OPS_TEAM_USERNAMES, resolvePerson } from '../team';
import { PersonAvatar } from './kanban';

const MAX_LENGTH = 2000;
/** Keep in sync with the backend's comment image rules */
const MAX_IMAGES = 4;
const IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];
const MAX_IMAGE_MB = 10;
/** The Vercel proxy refuses bodies over ~4.5 MB */
const MAX_TOTAL_BYTES = 4 * 1024 * 1024;

const timeAgo = (iso: string) =>
    Date.now() - new Date(iso).getTime() < 60_000 ? 'เมื่อสักครู่' : formatDistanceToNowStrict(new Date(iso), { addSuffix: true, locale: th });

const isTeam = (p: OpsPerson) => Boolean(p.username && (OPS_TEAM_USERNAMES as readonly string[]).includes(p.username));

/** Same person by employee id, or by IT-system username when the ids come from different sources. */
export const isSamePerson = (a: OpsPerson, b: OpsPerson | null) =>
    Boolean(b && (a.employee_id === b.employee_id || (a.username && a.username === b.username)));

const swal = () => import('sweetalert2').then(m => m.default);

/** Toast, not a modal: inside the Sheet a modal alert would sit under its overlay and can't be clicked. */
const notifyError = async (title: string, err: unknown) =>
    (await swal()).fire({
        toast: true, position: 'top-end', icon: 'error', title,
        text: err instanceof Error ? err.message : undefined,
        showConfirmButton: false, timer: 2600, timerProgressBar: true,
    });

/** Loads a thread and exposes optimistic post / like. Split from the UI so the composer can sit in the sheet footer. */
export function useComments(ref: OpsCommentRef, refId: string) {
    const { user } = useSessionContext();
    const [comments, setComments] = useState<OpsComment[]>([]);
    const [loading, setLoading] = useState(true);
    const [freshId, setFreshId] = useState<string | null>(null);
    const pending = useRef(new Set<string>());

    useEffect(() => {
        if (!user) return;
        let alive = true;
        listComments(ref, refId)
            .then(list => { if (alive) setComments(list); })
            .catch(err => console.error('Error fetching comments:', err))
            .finally(() => { if (alive) setLoading(false); });
        return () => { alive = false; };
    }, [ref, refId, user]);

    const post = useCallback(async (body: string, images: File[] = []) => {
        if (!user) return false;
        try {
            const c = await createComment(ref, refId, body, images);
            setComments(list => [...list, c]);
            setFreshId(c.comment_id);
            return true;
        } catch (err) {
            notifyError('ส่งความคิดเห็นไม่สำเร็จ', err);
            return false;
        }
    }, [ref, refId, user]);

    const toggleLike = useCallback(async (c: OpsComment) => {
        if (!user || pending.current.has(c.comment_id)) return;
        pending.current.add(c.comment_id);
        const like = !c.liked_by_me;
        const patch = (liked_by_me: boolean, like_count: number) =>
            setComments(list => list.map(x => (x.comment_id === c.comment_id ? { ...x, liked_by_me, like_count } : x)));
        patch(like, c.like_count + (like ? 1 : -1));
        try {
            const res = await setCommentLike(c.comment_id, like);
            patch(res.liked_by_me, res.like_count);
        } catch {
            patch(c.liked_by_me, c.like_count);
        } finally {
            pending.current.delete(c.comment_id);
        }
    }, [user]);

    const edit = useCallback(async (c: OpsComment, body: string) => {
        if (!user) return false;
        const patch = (next: Partial<OpsComment>) =>
            setComments(list => list.map(x => (x.comment_id === c.comment_id ? { ...x, ...next } : x)));
        patch({ body, edited_at: new Date().toISOString() });
        try {
            patch(await updateComment(c.comment_id, body));
            return true;
        } catch (err) {
            patch({ body: c.body, edited_at: c.edited_at });
            notifyError('แก้ไขไม่สำเร็จ', err);
            return false;
        }
    }, [user]);

    const [removingIds, setRemovingIds] = useState<string[]>([]);
    /** Call after the user confirmed. Fades the card out, then drops it. */
    const remove = useCallback(async (c: OpsComment) => {
        if (!user) return;
        setRemovingIds(ids => [...ids, c.comment_id]);
        try {
            await Promise.all([deleteComment(c.comment_id), new Promise(r => setTimeout(r, 220))]);
            setComments(list => list.filter(x => x.comment_id !== c.comment_id));
        } catch (err) {
            notifyError('ลบไม่สำเร็จ', err);
        } finally {
            setRemovingIds(ids => ids.filter(id => id !== c.comment_id));
        }
    }, [user]);

    return { comments, loading, freshId, removingIds, post, edit, remove, toggleLike, me: user ? toPerson(user) : null };
}

export type CommentThread = ReturnType<typeof useComments>;

// ───────────────────────────── list ─────────────────────────────

const HeartButton = ({ liked, count, onToggle }: { liked: boolean; count: number; onToggle: () => void }) => (
    <button
        type="button"
        onClick={onToggle}
        aria-pressed={liked}
        aria-label={`${liked ? 'เลิกถูกใจ' : 'ถูกใจ'} (${count})`}
        className={cn(
            'self-center shrink-0 flex flex-col items-center gap-0.5 w-10 py-1.5 rounded-xl cursor-pointer transition-colors',
            liked ? 'text-rose-500 hover:bg-rose-100/70' : 'text-ink-300 hover:text-rose-400 hover:bg-rose-50',
        )}
    >
        {/* keyed so the pop replays each time it turns on */}
        <Heart key={String(liked)} className={cn('w-4.5 h-4.5', liked && 'fill-rose-500 v2-heart-pop')} strokeWidth={2.2} />
        <span className={cn('text-[11px] font-semibold tabular-nums leading-none min-h-3', liked ? 'text-rose-600' : 'text-ink-500')}>
            {count > 0 ? count : ''}
        </span>
    </button>
);

/** Comment text with its http(s) links clickable, each opening in a new tab. */
const LinkifiedText = ({ text }: { text: string }) => (
    <>
        {linkifyText(text).map((part, i) => part.href
            ? (
                <a key={i} href={part.href} target="_blank" rel="noopener noreferrer" onClick={(e) => e.stopPropagation()}
                    className="font-medium text-brand-700 underline decoration-brand-300 underline-offset-2 break-all hover:decoration-brand-700">
                    {part.text}
                </a>
            )
            : part.text)}
    </>
);

/** "⋯" menu on the viewer's own comment. */
const OwnMenu = ({ onEdit, onDelete }: { onEdit: () => void; onDelete: () => void }) => (
    <DropdownMenu modal={false}>
        <DropdownMenuTrigger asChild>
            <button
                type="button"
                aria-label="ตัวเลือกความคิดเห็น"
                className="ml-auto shrink-0 w-7 h-7 -my-1 rounded-full grid place-items-center text-ink-500 hover:bg-brand-50 hover:text-ink-900 cursor-pointer transition-[opacity,background-color] sm:opacity-0 sm:group-hover:opacity-100 sm:focus-visible:opacity-100 data-[state=open]:opacity-100 data-[state=open]:bg-brand-50"
            >
                <MoreHorizontal className="w-4 h-4" />
            </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-36 rounded-xl p-1">
            <DropdownMenuItem onSelect={onEdit} className="gap-2 rounded-lg cursor-pointer text-[13px]">
                <Pencil className="w-3.5 h-3.5" /> แก้ไข
            </DropdownMenuItem>
            <DropdownMenuItem onSelect={onDelete} className="gap-2 rounded-lg cursor-pointer text-[13px] text-rose-600 focus:text-rose-600 focus:bg-rose-50">
                <Trash2 className="w-3.5 h-3.5" /> ลบ
            </DropdownMenuItem>
        </DropdownMenuContent>
    </DropdownMenu>
);

/** Inline editor that replaces the comment body. Enter saves, Shift+Enter adds a line, Esc cancels. */
const EditBox = ({ initial, allowEmpty, onSave, onCancel }: {
    initial: string;
    /** A comment with images may drop its text */
    allowEmpty: boolean;
    onSave: (body: string) => Promise<boolean>;
    onCancel: () => void;
}) => {
    const [text, setText] = useState(initial);
    const [saving, setSaving] = useState(false);
    const body = text.trim();
    const canSave = Boolean(body) || allowEmpty;
    const save = async () => {
        if (!canSave || saving) return;
        if (body === initial.trim()) { onCancel(); return; }
        setSaving(true);
        if (await onSave(body)) onCancel();
        setSaving(false);
    };
    return (
        <div className="mt-1.5">
            <textarea
                autoFocus
                value={text}
                onChange={(e) => setText(e.target.value)}
                onFocus={(e) => e.currentTarget.setSelectionRange(e.currentTarget.value.length, e.currentTarget.value.length)}
                onKeyDown={(e) => {
                    // Esc closes the editor, not the whole sheet
                    if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); onCancel(); }
                    if (e.key === 'Enter' && !e.shiftKey && !e.nativeEvent.isComposing) { e.preventDefault(); save(); }
                }}
                maxLength={MAX_LENGTH}
                aria-label="แก้ไขความคิดเห็น"
                className="w-full field-sizing-content min-h-16 max-h-40 resize-none rounded-xl border border-brand-300 bg-brand-50/50 px-3 py-2 text-sm text-ink-900 focus:outline-none focus:bg-white focus:shadow-[0_0_0_4px_rgba(61,165,255,0.14)] transition-all"
            />
            <div className="mt-1.5 flex items-center gap-2">
                <span className="hidden sm:inline text-[11px] text-ink-300">Esc ยกเลิก · Enter บันทึก</span>
                <button type="button" onClick={onCancel} className="ml-auto h-8 px-3 rounded-full text-xs font-medium text-ink-700 hover:bg-slate-100 cursor-pointer">
                    ยกเลิก
                </button>
                <button
                    type="button"
                    onClick={save}
                    disabled={!canSave || saving}
                    className="h-8 px-4 rounded-full text-xs font-semibold text-white bg-brand-600 hover:bg-brand-700 disabled:bg-brand-200 cursor-pointer disabled:cursor-not-allowed transition-colors"
                >
                    {saving ? 'กำลังบันทึก…' : 'บันทึก'}
                </button>
            </div>
        </div>
    );
};

/** Pictures under a comment; click → the zoomable viewer. */
const CommentImages = ({ items }: { items: OpsAttachment[] }) => {
    const [viewing, setViewing] = useState<number | null>(null);
    return (
        <>
            <ul className={cn('mt-2 grid gap-1.5', items.length === 1 ? 'grid-cols-1 max-w-64' : 'grid-cols-2 max-w-80')}>
                {items.map((a, i) => (
                    <li key={a.attachment_id}>
                        <button
                            type="button"
                            onClick={() => setViewing(i)}
                            title={a.file_name}
                            aria-label={`ดูรูป ${a.file_name}`}
                            className="block w-full overflow-hidden rounded-xl border border-border bg-slate-50 cursor-zoom-in hover:border-brand-300 transition-colors"
                        >
                            {/* eslint-disable-next-line @next/next/no-img-element -- S3 URL, shown as-is */}
                            <img
                                src={a.url}
                                alt={a.file_name}
                                loading="lazy"
                                className={cn('w-full object-cover', items.length === 1 ? 'max-h-56' : 'aspect-[4/3]')}
                            />
                        </button>
                    </li>
                ))}
            </ul>
            <ImageViewer images={items} index={viewing} onIndexChange={setViewing} onClose={() => setViewing(null)} />
        </>
    );
};

const CommentItem = ({ c, team, mine, fresh, removing, freshRef, thread }: {
    c: OpsComment; team: OpsPerson[]; mine: boolean; fresh: boolean; removing: boolean;
    freshRef: React.RefObject<HTMLLIElement | null>; thread: CommentThread;
}) => {
    const [editing, setEditing] = useState(false);
    const [confirmDelete, setConfirmDelete] = useState(false);
    const author = resolvePerson(c.author, team);
    const images = c.attachments ?? [];
    return (
        <li
            ref={fresh ? freshRef : undefined}
            className={cn(
                'group flex items-center gap-3 rounded-[18px] border bg-white pl-3.5 pr-2 py-3 scroll-mb-28 transition-all duration-200',
                editing ? 'border-brand-300 shadow-card' : 'border-border',
                fresh && 'v2-card-in',
                removing && 'opacity-0 scale-[0.98] -translate-y-1 pointer-events-none',
            )}
        >
            <PersonAvatar person={author} className="w-9 h-9 self-start mt-0.5" textClassName="text-xs font-semibold" />
            <div className="flex-1 min-w-0">
                <div className="flex items-center gap-1.5 min-w-0">
                    <span className="shrink-0 max-w-[60%] text-[13px] font-semibold text-ink-900 truncate">{author.name}</span>
                    {isTeam(author) && (
                        <span className="shrink-0 rounded-full bg-sun-300/30 px-1.5 py-px text-[10px] font-semibold text-sun-700">ทีม OPS</span>
                    )}
                    <span className="min-w-0 truncate text-[11px] text-ink-500" title={formatThaiDate(c.created_at, true)}>
                        · {timeAgo(c.created_at)}
                        {c.edited_at && <span title={`แก้ไขเมื่อ ${formatThaiDate(c.edited_at, true)}`}> · แก้ไขแล้ว</span>}
                    </span>
                    {mine && !editing && <OwnMenu onEdit={() => setEditing(true)} onDelete={() => setConfirmDelete(true)} />}
                </div>
                {editing
                    ? <EditBox initial={c.body} allowEmpty={images.length > 0} onSave={(body) => thread.edit(c, body)} onCancel={() => setEditing(false)} />
                    : c.body && <p className="mt-0.5 text-sm leading-relaxed text-ink-700 whitespace-pre-line wrap-break-word"><LinkifiedText text={c.body} /></p>}
                {images.length > 0 && <CommentImages items={images} />}
            </div>
            {!editing && <HeartButton liked={c.liked_by_me} count={c.like_count} onToggle={() => thread.toggleLike(c)} />}

            <AlertDialog open={confirmDelete} onOpenChange={setConfirmDelete}>
                <AlertDialogContent className="swal-on-sheet rounded-[28px] sm:max-w-sm">
                    <AlertDialogHeader>
                        <AlertDialogTitle className="font-display text-ink-900">ลบความคิดเห็นนี้?</AlertDialogTitle>
                        <AlertDialogDescription className="line-clamp-3 text-ink-500">
                            {c.body ? `“${c.body}”` : `รูปภาพ ${images.length} รูป`}
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel className="rounded-full">ยกเลิก</AlertDialogCancel>
                        <AlertDialogAction onClick={() => thread.remove(c)} className="rounded-full bg-rose-600 hover:bg-rose-700 text-white">
                            ลบความคิดเห็น
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        </li>
    );
};

export const CommentList = ({ thread, team }: { thread: CommentThread; team: OpsPerson[] }) => {
    const { comments, loading, freshId, removingIds, me } = thread;
    const freshRef = useRef<HTMLLIElement>(null);
    useEffect(() => { freshRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' }); }, [freshId]);

    return (
        <section aria-label="ความคิดเห็น">
            <h3 className="flex items-center gap-2 px-1 mb-2.5 font-display text-base font-semibold text-ink-900">
                ความคิดเห็น
                {comments.length > 0 && <span className="rounded-full bg-brand-100 px-1.75 font-sans text-[11px] font-semibold text-brand-700 tabular-nums">{comments.length}</span>}
            </h3>

            {loading ? (
                <ul className="space-y-2.5" aria-hidden>
                    {[0, 1].map(i => (
                        <li key={i} className="flex items-center gap-3 rounded-[18px] bg-white px-3.5 py-3 animate-pulse">
                            <span className="w-9 h-9 rounded-full bg-slate-200" />
                            <span className="flex-1 space-y-2"><span className="block h-2.5 w-24 rounded bg-slate-200" /><span className="block h-2.5 w-3/4 rounded bg-slate-200" /></span>
                        </li>
                    ))}
                </ul>
            ) : comments.length === 0 ? (
                <div className="flex items-center gap-3 rounded-[18px] border border-dashed border-brand-200 bg-white/70 px-4 py-4 text-ink-500">
                    <MessageCircle className="w-5 h-5 text-brand-400 shrink-0" />
                    <p className="text-xs">ยังไม่มีความคิดเห็น — เริ่มพูดคุยได้ที่ช่องด้านล่าง</p>
                </div>
            ) : (
                <ul className="space-y-2.5">
                    {comments.map(c => (
                        <CommentItem
                            key={c.comment_id}
                            c={c}
                            team={team}
                            mine={isSamePerson(c.author, me)}
                            fresh={c.comment_id === freshId}
                            removing={removingIds.includes(c.comment_id)}
                            freshRef={freshRef}
                            thread={thread}
                        />
                    ))}
                </ul>
            )}
        </section>
    );
};

// ───────────────────────────── composer ─────────────────────────────

interface Draft { file: File; preview: string }

/**
 * Pinned to the bottom of the sheet. Enter sends, Shift+Enter adds a line (Thai IME composition is respected).
 * Images: the picture button, Ctrl+V of a screenshot, or drag & drop onto the box.
 */
export const CommentComposer = ({ me, onPost }: { me: OpsPerson | null; onPost: (body: string, images: File[]) => Promise<boolean> }) => {
    const [text, setText] = useState('');
    const [drafts, setDrafts] = useState<Draft[]>([]);
    const [error, setError] = useState('');
    const [sending, setSending] = useState(false);
    const [dragging, setDragging] = useState(false);
    const fileRef = useRef<HTMLInputElement>(null);
    const textRef = useRef<HTMLTextAreaElement>(null);
    const body = text.trim();
    const canSend = (Boolean(body) || drafts.length > 0) && !sending;

    // previews are object URLs — every one still alive is freed when the sheet closes
    const previewUrls = useRef(new Set<string>());
    useEffect(() => {
        const urls = previewUrls.current;
        return () => urls.forEach(u => URL.revokeObjectURL(u));
    }, []);
    const dropPreview = (url: string) => { URL.revokeObjectURL(url); previewUrls.current.delete(url); };

    const addImages = async (list: File[]) => {
        const images = list.filter(f => IMAGE_TYPES.includes(f.type));
        if (images.length === 0) {
            if (list.length) setError('แนบได้เฉพาะไฟล์รูปภาพ (PNG, JPEG, GIF, WebP)');
            return;
        }
        const room = MAX_IMAGES - drafts.length;
        const tooBig = images.filter(f => f.size > MAX_IMAGE_MB * 1024 * 1024);
        const picked = images.filter(f => f.size <= MAX_IMAGE_MB * 1024 * 1024).slice(0, Math.max(0, room));
        setError(
            tooBig.length ? `รูปเกิน ${MAX_IMAGE_MB} MB: ${tooBig.map(f => f.name).join(', ')}`
                : images.length > room ? `แนบรูปได้สูงสุด ${MAX_IMAGES} รูปต่อความคิดเห็น`
                    : list.length > images.length ? 'ข้ามไฟล์ที่ไม่ใช่รูปภาพ'
                        : '',
        );
        if (picked.length === 0) return;
        const added = (await Promise.all(picked.map(compressImage))).map(file => {
            const preview = URL.createObjectURL(file);
            previewUrls.current.add(preview);
            return { file, preview };
        });
        setDrafts(cur => [...cur, ...added].slice(0, MAX_IMAGES));
        textRef.current?.focus();
    };

    const removeDraft = (d: Draft) => {
        dropPreview(d.preview);
        setDrafts(cur => cur.filter(x => x !== d));
    };

    const send = async () => {
        if (!canSend) return;
        if (drafts.reduce((n, d) => n + d.file.size, 0) > MAX_TOTAL_BYTES) {
            setError('รูปรวมกันใหญ่เกินไป ลองลดจำนวนรูปหรือส่งทีละรูป');
            return;
        }
        setSending(true);
        if (await onPost(body, drafts.map(d => d.file))) {
            drafts.forEach(d => dropPreview(d.preview));
            setText('');
            setDrafts([]);
            setError('');
        }
        setSending(false);
    };

    return (
        <form
            onSubmit={(e) => { e.preventDefault(); send(); }}
            onDragOver={(e) => { if (e.dataTransfer.types.includes('Files')) { e.preventDefault(); setDragging(true); } }}
            onDragLeave={(e) => { if (!e.currentTarget.contains(e.relatedTarget as Node | null)) setDragging(false); }}
            onDrop={(e) => {
                if (!e.dataTransfer.files.length) return;
                e.preventDefault();
                setDragging(false);
                void addImages(Array.from(e.dataTransfer.files));
            }}
            className={cn(
                'rounded-[22px] bg-white shadow-card border pl-3 pr-2.5 py-2.5 transition-shadow focus-within:shadow-[0_0_0_4px_rgba(61,165,255,0.16),0_8px_24px_-10px_rgba(21,86,201,0.25)]',
                dragging ? 'border-brand-400 border-dashed bg-brand-50/60' : 'border-white',
            )}
        >
            {drafts.length > 0 && (
                <ul className="flex flex-wrap gap-2 pb-2 pl-10.5" aria-label="รูปที่จะแนบ">
                    {drafts.map(d => (
                        <li key={d.preview} className="relative">
                            {/* eslint-disable-next-line @next/next/no-img-element -- local preview */}
                            <img src={d.preview} alt={d.file.name} className="w-16 h-16 rounded-xl object-cover border border-border" />
                            <button
                                type="button"
                                onClick={() => removeDraft(d)}
                                aria-label={`เอา ${d.file.name} ออก`}
                                className="absolute -top-1.5 -right-1.5 w-5 h-5 rounded-full grid place-items-center bg-ink-900/80 text-white hover:bg-rose-600 cursor-pointer"
                            >
                                <X className="w-3 h-3" />
                            </button>
                        </li>
                    ))}
                </ul>
            )}
            <div className="flex items-end gap-1.5">
                {me && <PersonAvatar person={me} className="w-8 h-8 mb-1 mr-1" textClassName="text-[11px] font-semibold" />}
                <textarea
                    ref={textRef}
                    value={text}
                    onChange={(e) => setText(e.target.value)}
                    onKeyDown={(e) => {
                        if (e.key === 'Enter' && !e.shiftKey && !e.nativeEvent.isComposing) { e.preventDefault(); send(); }
                    }}
                    onPaste={(e) => {
                        const files = Array.from(e.clipboardData.files).filter(f => f.type.startsWith('image/'));
                        if (files.length === 0) return;
                        // a pure screenshot has no text — keep the browser from pasting anything else
                        if (!e.clipboardData.getData('text/plain')) e.preventDefault();
                        void addImages(files);
                    }}
                    rows={1}
                    maxLength={MAX_LENGTH}
                    placeholder={dragging ? 'วางรูปที่นี่...' : 'เขียนความคิดเห็น... (Ctrl+V วางรูปได้)'}
                    aria-label="เขียนความคิดเห็น"
                    className="flex-1 min-w-0 field-sizing-content min-h-10 max-h-32 resize-none bg-transparent py-2.5 text-sm text-ink-900 placeholder:text-ink-300 focus:outline-none"
                />
                <button
                    type="button"
                    onClick={() => fileRef.current?.click()}
                    disabled={drafts.length >= MAX_IMAGES || sending}
                    aria-label="แนบรูปภาพ"
                    title={`แนบรูปภาพ (สูงสุด ${MAX_IMAGES} รูป)`}
                    className="w-10 h-10 shrink-0 rounded-full grid place-items-center text-ink-500 hover:text-brand-700 hover:bg-brand-50 cursor-pointer transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                >
                    <ImagePlus className="w-5 h-5" />
                </button>
                <input
                    ref={fileRef}
                    type="file"
                    accept={IMAGE_TYPES.join(',')}
                    multiple
                    className="hidden"
                    onChange={(e) => { void addImages(Array.from(e.target.files ?? [])); e.target.value = ''; }}
                />
                <button
                    type="submit"
                    disabled={!canSend}
                    aria-label="ส่งความคิดเห็น"
                    className="w-10 h-10 shrink-0 rounded-full grid place-items-center text-white bg-linear-to-br from-[#2f9bff] to-brand-600 shadow-cta transition-all cursor-pointer hover:brightness-105 active:scale-95 disabled:from-brand-200 disabled:to-brand-200 disabled:shadow-none disabled:cursor-not-allowed"
                >
                    {sending
                        ? <span className="w-4 h-4 rounded-full border-2 border-white/40 border-t-white animate-spin" />
                        : <SendHorizontal className="w-4.5 h-4.5" />}
                </button>
            </div>
            {error && <p role="alert" className="pt-1.5 pl-10.5 text-[11px] text-rose-600">{error}</p>}
        </form>
    );
};
