'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { formatDistanceToNowStrict } from 'date-fns';
import { th } from 'date-fns/locale';
import { Heart, MessageCircle, MoreHorizontal, Pencil, SendHorizontal, Trash2 } from 'lucide-react';
import {
    DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
    AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription,
    AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { useSessionContext } from '@/app/context/SessionContext';
import { cn } from '@/lib/utils';
import { createComment, deleteComment, listComments, setCommentLike, updateComment } from '../api';
import type { OpsComment, OpsCommentRef, OpsPerson } from '../types';
import { formatThaiDate, toPerson } from '../components';
import { OPS_TEAM_USERNAMES, resolvePerson } from '../team';
import { PersonAvatar } from './kanban';

const MAX_LENGTH = 2000;

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
        listComments(ref, refId, { me: toPerson(user) })
            .then(list => { if (alive) setComments(list); })
            .catch(err => console.error('Error fetching comments:', err))
            .finally(() => { if (alive) setLoading(false); });
        return () => { alive = false; };
    }, [ref, refId, user]);

    const post = useCallback(async (body: string) => {
        if (!user) return false;
        try {
            const c = await createComment(ref, refId, body, { me: toPerson(user) });
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
            const res = await setCommentLike(c.comment_id, like, { me: toPerson(user) });
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
            patch(await updateComment(c.comment_id, body, { me: toPerson(user) }));
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
            await Promise.all([deleteComment(c.comment_id, { me: toPerson(user) }), new Promise(r => setTimeout(r, 220))]);
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
const EditBox = ({ initial, onSave, onCancel }: { initial: string; onSave: (body: string) => Promise<boolean>; onCancel: () => void }) => {
    const [text, setText] = useState(initial);
    const [saving, setSaving] = useState(false);
    const body = text.trim();
    const save = async () => {
        if (!body || saving) return;
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
                    disabled={!body || saving}
                    className="h-8 px-4 rounded-full text-xs font-semibold text-white bg-brand-600 hover:bg-brand-700 disabled:bg-brand-200 cursor-pointer disabled:cursor-not-allowed transition-colors"
                >
                    {saving ? 'กำลังบันทึก…' : 'บันทึก'}
                </button>
            </div>
        </div>
    );
};

const CommentItem = ({ c, team, mine, fresh, removing, freshRef, thread }: {
    c: OpsComment; team: OpsPerson[]; mine: boolean; fresh: boolean; removing: boolean;
    freshRef: React.RefObject<HTMLLIElement | null>; thread: CommentThread;
}) => {
    const [editing, setEditing] = useState(false);
    const [confirmDelete, setConfirmDelete] = useState(false);
    const author = resolvePerson(c.author, team);
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
                    ? <EditBox initial={c.body} onSave={(body) => thread.edit(c, body)} onCancel={() => setEditing(false)} />
                    : <p className="mt-0.5 text-sm leading-relaxed text-ink-700 whitespace-pre-line wrap-break-word">{c.body}</p>}
            </div>
            {!editing && <HeartButton liked={c.liked_by_me} count={c.like_count} onToggle={() => thread.toggleLike(c)} />}

            <AlertDialog open={confirmDelete} onOpenChange={setConfirmDelete}>
                <AlertDialogContent className="swal-on-sheet rounded-[28px] sm:max-w-sm">
                    <AlertDialogHeader>
                        <AlertDialogTitle className="font-display text-ink-900">ลบความคิดเห็นนี้?</AlertDialogTitle>
                        <AlertDialogDescription className="line-clamp-3 text-ink-500">“{c.body}”</AlertDialogDescription>
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

/** Pinned to the bottom of the sheet. Enter sends, Shift+Enter adds a line (Thai IME composition is respected). */
export const CommentComposer = ({ me, onPost }: { me: OpsPerson | null; onPost: (body: string) => Promise<boolean> }) => {
    const [text, setText] = useState('');
    const [sending, setSending] = useState(false);
    const body = text.trim();

    const send = async () => {
        if (!body || sending) return;
        setSending(true);
        if (await onPost(body)) setText('');
        setSending(false);
    };

    return (
        <form
            onSubmit={(e) => { e.preventDefault(); send(); }}
            className="flex items-end gap-2.5 rounded-[22px] bg-white shadow-card border border-white pl-3 pr-2.5 py-2.5 transition-shadow focus-within:shadow-[0_0_0_4px_rgba(61,165,255,0.16),0_8px_24px_-10px_rgba(21,86,201,0.25)]"
        >
            {me && <PersonAvatar person={me} className="w-8 h-8 mb-1" textClassName="text-[11px] font-semibold" />}
            <textarea
                value={text}
                onChange={(e) => setText(e.target.value)}
                onKeyDown={(e) => {
                    if (e.key === 'Enter' && !e.shiftKey && !e.nativeEvent.isComposing) { e.preventDefault(); send(); }
                }}
                rows={1}
                maxLength={MAX_LENGTH}
                placeholder="เขียนความคิดเห็น..."
                aria-label="เขียนความคิดเห็น"
                className="flex-1 field-sizing-content min-h-10 max-h-32 resize-none bg-transparent py-2.5 text-sm text-ink-900 placeholder:text-ink-300 focus:outline-none"
            />
            <button
                type="submit"
                disabled={!body || sending}
                aria-label="ส่งความคิดเห็น"
                className="w-10 h-10 shrink-0 rounded-full grid place-items-center text-white bg-linear-to-br from-[#2f9bff] to-brand-600 shadow-cta transition-all cursor-pointer hover:brightness-105 active:scale-95 disabled:from-brand-200 disabled:to-brand-200 disabled:shadow-none disabled:cursor-not-allowed"
            >
                {sending
                    ? <span className="w-4 h-4 rounded-full border-2 border-white/40 border-t-white animate-spin" />
                    : <SendHorizontal className="w-4.5 h-4.5" />}
            </button>
        </form>
    );
};
