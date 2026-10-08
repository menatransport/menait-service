'use client';

import { memo, useCallback, useRef, useState } from 'react';
import {
    AlertCircle, Calendar as CalendarIcon, FileSpreadsheet, FileText, ImageIcon, Paperclip,
    Upload, X, User, Building2, Briefcase, Inbox, ListTodo, Timer, Eye, CircleCheck, CircleX,
    ChevronDown, ChevronUp, ChevronsUp, Equal, type LucideIcon,
} from 'lucide-react';
import { format } from 'date-fns';
import { th } from 'date-fns/locale';
import { Card, CardContent } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { WaveBackground } from '@/components/wave-background';
import type { UserInfo } from '@/app/context/SessionContext';
import { cn } from '@/lib/utils';
import { ImageViewer } from './image-viewer';
import { OPS_PRIORITIES, type OpsAttachment, type OpsPerson, type OpsPriority, type OpsStatus } from './types';

// ───────────────────────────── meta / helpers ─────────────────────────────

/**
 * State colours from the app theme (ink / aqua / sun / violet / mint). Open is a deliberate neutral;
 * To-Do is vivid aqua (#06c3f7 = aqua-500), validated against Open's grey (normal-vision ΔE 19.9).
 * Never colour-alone — every use pairs the colour with the status icon + label,
 * and Reject bars additionally carry a hatch texture (REJECT_HATCH).
 */
export const STATUS_META: Record<OpsStatus, {
    label: string; hint: string; icon: LucideIcon;
    badge: string; dot: string; soft: string; bar: string; track: string; topBorder: string;
}> = {
    'Open':        { label: 'Open',        hint: 'ส่งแล้ว รอพิจารณา',       icon: Inbox,       badge: 'bg-slate-50 text-ink-700 border-slate-200',        dot: 'bg-ink-500',   soft: 'bg-ink-300/25 text-ink-700',     bar: 'bg-ink-500',   track: 'bg-slate-200',   topBorder: 'border-t-ink-500' },
    'To-Do':       { label: 'To-Do',       hint: 'รับเรื่องแล้ว รอเริ่มงาน',  icon: ListTodo,    badge: 'bg-aqua-50 text-aqua-700 border-aqua-200',         dot: 'bg-aqua-500',  soft: 'bg-aqua-100 text-aqua-700',      bar: 'bg-aqua-500',  track: 'bg-aqua-200',    topBorder: 'border-t-aqua-500' },
    'In Progress': { label: 'In Progress', hint: 'กำลังดำเนินการ',          icon: Timer,       badge: 'bg-orange-50 text-sun-700 border-orange-200',      dot: 'bg-sun-500',   soft: 'bg-sun-300/30 text-sun-700',     bar: 'bg-sun-500',   track: 'bg-orange-200',  topBorder: 'border-t-sun-500' },
    'Review':      { label: 'Review',      hint: 'ส่งงานแล้ว รอตรวจรับ',     icon: Eye,         badge: 'bg-violet-50 text-violet-700 border-violet-200',   dot: 'bg-violet-500', soft: 'bg-violet-100 text-violet-700', bar: 'bg-violet-500', track: 'bg-violet-200', topBorder: 'border-t-violet-500' },
    'Done':        { label: 'Done',        hint: 'เสร็จสิ้น',               icon: CircleCheck, badge: 'bg-emerald-50 text-mint-700 border-emerald-200',   dot: 'bg-mint-600',  soft: 'bg-mint-300/30 text-mint-700',   bar: 'bg-mint-600',  track: 'bg-emerald-200', topBorder: 'border-t-mint-600' },
    'Reject':      { label: 'Reject',      hint: 'ไม่อนุมัติ',              icon: CircleX,     badge: 'bg-rose-50 text-rose-700 border-rose-200',         dot: 'bg-rose-500',  soft: 'bg-rose-100 text-rose-700',      bar: 'bg-rose-500',  track: 'bg-rose-200',    topBorder: 'border-t-rose-500' },
};

export const REJECT_HATCH: React.CSSProperties = {
    backgroundImage: 'repeating-linear-gradient(45deg, rgba(225,29,72,.35) 0 2px, transparent 2px 7px)',
};

export const PRIORITY_META: Record<OpsPriority, { label: string; hint: string; icon: LucideIcon; chip: string; active: string }> = {
    Low:      { label: 'Low',      hint: 'ไอเดีย/ปรับปรุง รอเข้าคิวได้',            icon: ChevronDown, chip: 'bg-slate-50 text-slate-600 border-slate-200',    active: 'border-slate-500 bg-slate-50 ring-slate-500/20' },
    Medium:   { label: 'Medium',   hint: 'ช่วยให้งานดีขึ้น แต่มีวิธีทดแทนอยู่',          icon: Equal,       chip: 'bg-amber-50 text-amber-700 border-amber-200',    active: 'border-amber-500 bg-amber-50 ring-amber-500/20' },
    High:     { label: 'High',     hint: 'กระทบงานหลายคน ควรเริ่มโปรเจกต์เร็ว',     icon: ChevronUp,   chip: 'bg-orange-50 text-orange-700 border-orange-200', active: 'border-orange-500 bg-orange-50 ring-orange-500/20' },
    Critical: { label: 'Critical', hint: 'งานหลักติดขัด หรือกระทบลูกค้า/คนนอก',   icon: ChevronsUp,  chip: 'bg-rose-50 text-rose-700 border-rose-200',       active: 'border-rose-500 bg-rose-50 ring-rose-500/20' },
};

export const toPerson = (user: UserInfo): OpsPerson => ({
    employee_id: user.employee_id,
    name: `${user.firstname} ${user.lastname}`.trim(),
    username: user.username?.toLowerCase() ?? null,
    image_url: user.image_url ?? null,
    department: user.department,
    position: user.position,
});

export const formatThaiDate = (iso?: string | null, withTime = false) =>
    iso ? format(new Date(iso), withTime ? 'd MMM yyyy HH:mm' : 'd MMM yyyy', { locale: th }) : '-';

export const formatShortDate = (iso?: string | null) => (iso ? format(new Date(iso), 'd MMM', { locale: th }) : '-');

/** Done / Reject: dates and assignees are frozen. */
export const isClosedStatus = (s: OpsStatus) => s === 'Done' || s === 'Reject';

/** Planned end has passed and the project isn't finished. */
export const isOverdue = (p: { status: OpsStatus; planned_end?: string | null }) => {
    if (!p.planned_end || p.status === 'Done' || p.status === 'Reject') return false;
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    return new Date(p.planned_end) < today;
};

/** First letter of up to two words; Thai leading vowels (เ แ โ ใ ไ) are skipped. */
export const initials = (name: string) =>
    name.trim().split(/\s+/).map(w => w.replace(/^[เแโใไ]/, '')[0] ?? '').slice(0, 2).join('');

export const formatSize = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
};

const fileIcon = (mime: string): LucideIcon =>
    mime.startsWith('image/') ? ImageIcon
        : /sheet|excel|csv/.test(mime) ? FileSpreadsheet
            : FileText;

export const INPUT_CLASS = 'w-full h-11 px-4 bg-white border rounded-xl text-sm transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-brand-600/20 focus:border-brand-600 hover:border-brand-600/40';
export const TEXTAREA_CLASS = 'w-full px-4 py-3 bg-white border rounded-xl text-sm resize-y min-h-28 transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-brand-600/20 focus:border-brand-600 hover:border-brand-600/40 placeholder:text-gray-400';
export const fieldBorder = (hasError?: boolean) => (hasError ? 'border-rose-300 bg-rose-50/50' : 'border-gray-200');

// ───────────────────────────── badges ─────────────────────────────

export const StatusBadge = ({ status, className }: { status: OpsStatus; className?: string }) => {
    const m = STATUS_META[status];
    return (
        <span className={cn('inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs font-medium whitespace-nowrap', m.badge, className)}>
            <m.icon className="size-3" />
            {m.label}
        </span>
    );
};

export const PriorityBadge = ({ priority }: { priority: OpsPriority }) => (
    <span className={cn('inline-flex items-center rounded-md border px-2 py-0.5 text-[11px] font-semibold', PRIORITY_META[priority].chip)}>
        {priority}
    </span>
);

// ───────────────────────────── form building blocks ─────────────────────────────

export const FieldLabel = memo(({ no, label, htmlFor, required, optional, hint }: {
    no: number; label: string; htmlFor?: string; required?: boolean; optional?: boolean; hint?: string;
}) => (
    <div className="mb-1.5">
        <div className="flex items-center gap-2">
            <Label htmlFor={htmlFor} className="text-sm font-medium text-gray-700 flex items-center gap-1">
                {label}
                {required && <span className="text-rose-400 text-xs">*</span>}
                {optional && <span className="text-gray-400 font-normal">(ถ้ามี)</span>}
            </Label>
        </div>
        {hint && <p className="text-xs text-gray-500 mt-1 ml-7">{hint}</p>}
    </div>
));
FieldLabel.displayName = 'FieldLabel';

export const FieldError = ({ message }: { message?: string }) =>
    message ? (
        <p className="text-rose-500 text-xs flex items-center gap-1 mt-1">
            <AlertCircle className="w-3 h-3 shrink-0" />
            {message}
        </p>
    ) : null;

/** Four priority cards (radio group); `compact` drops the hint line for narrow spaces like the detail sheet. */
export const PriorityPicker = ({ value, onChange, compact }: {
    value: OpsPriority | ''; onChange: (p: OpsPriority) => void; compact?: boolean;
}) => (
    <div role="radiogroup" aria-label="ระดับความสำคัญ" className="grid grid-cols-2 sm:grid-cols-4 gap-2">
        {OPS_PRIORITIES.map(p => {
            const m = PRIORITY_META[p];
            const active = value === p;
            return (
                <button
                    key={p}
                    type="button"
                    role="radio"
                    aria-checked={active}
                    onClick={() => onChange(p)}
                    className={cn(
                        'text-left rounded-xl border-2 transition-all cursor-pointer',
                        compact ? 'p-2' : 'p-3',
                        active ? cn(m.active, 'ring-4') : 'border-gray-200 bg-white hover:border-gray-300',
                    )}
                >
                    <span className="flex items-center gap-2">
                        <span className={cn('grid size-7 shrink-0 place-items-center rounded-lg border', m.chip)}>
                            <m.icon className="size-4" strokeWidth={2.5} />
                        </span>
                        <span className="text-sm font-semibold text-gray-800">{m.label}</span>
                    </span>
                    {!compact && <span className="block mt-2 text-[11px] leading-snug text-gray-500">{m.hint}</span>}
                </button>
            );
        })}
    </div>
);

export const SectionTitle = ({ step, title, caption }: { step: number; title: string; caption?: string }) => (
    <div className="flex items-start gap-3 pt-2">
        <span className="mt-0.5 flex h-6 min-w-6 items-center justify-center rounded-full bg-sun-400 px-1.5 text-xs font-bold text-white">
            {step}
        </span>
        <div>
            <h3 className="font-semibold text-brand-800">{title}</h3>
            {caption && <p className="text-xs text-gray-500">{caption}</p>}
        </div>
    </div>
);

/** Page body for OPS forms: blue canvas + wave + white card with a header. */
export const OpsFormShell = ({ icon: Icon, title, subtitle, children }: {
    icon: LucideIcon; title: string; subtitle: string; children: React.ReactNode;
}) => (
    <main className="flex-1 min-h-0 bg-brand-600 rounded-t-[1.5rem] sm:rounded-t-[2rem] lg:rounded-t-[3rem] shadow-2xl overflow-y-auto relative">
        <WaveBackground />
        <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-8 relative z-10">
            <Card className="border-0 shadow-xl rounded-2xl sm:rounded-3xl overflow-hidden">
                <CardContent className="p-4 sm:p-6 lg:p-8">
                    <div className="mb-6 pb-4 border-b border-gray-200 flex items-center gap-3">
                        <div className="w-10 h-10 bg-linear-to-br from-sun-400 to-sun-500 rounded-xl flex items-center justify-center shadow-md shrink-0">
                            <Icon className="w-5 h-5 text-white" />
                        </div>
                        <div>
                            <h2 className="text-xl font-semibold text-brand-800">{title}</h2>
                            <p className="text-xs text-gray-500">{subtitle}</p>
                        </div>
                    </div>
                    {children}
                </CardContent>
            </Card>
        </div>
    </main>
);

export const RequesterCard = ({ user, label = 'ผู้ยื่นคำขอ' }: { user: UserInfo | null; label?: string }) => (
    <div className="rounded-xl bg-gray-50 p-3 sm:p-4">
        <p className="text-[11px] font-medium uppercase tracking-wide text-gray-400 mb-2">{label}</p>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 text-sm">
            <span className="flex items-center gap-2 text-gray-800 font-medium min-w-0">
                <User className="w-3.5 h-3.5 text-brand-600 shrink-0" />
                <span className="truncate">{user ? `${user.firstname} ${user.lastname}` : '-'}</span>
            </span>
            <span className="flex items-center gap-2 text-gray-600 min-w-0">
                <Building2 className="w-3.5 h-3.5 text-brand-600 shrink-0" />
                <span className="truncate">{user?.department || '-'}</span>
            </span>
            <span className="flex items-center gap-2 text-gray-600 min-w-0">
                <Briefcase className="w-3.5 h-3.5 text-brand-600 shrink-0" />
                <span className="truncate">{user?.position || '-'}</span>
            </span>
        </div>
    </div>
);

export const FormActions = ({ submitting, submitLabel, onReset }: {
    submitting: boolean; submitLabel: string; onReset: () => void;
}) => (
    <div className="pt-4 flex flex-col-reverse sm:flex-row gap-3">
        <Button
            type="button"
            variant="ghost"
            onClick={onReset}
            disabled={submitting}
            className="h-12 sm:h-14 px-6 sm:px-8 text-brand-600 font-medium rounded-xl sm:rounded-2xl hover:bg-brand-600/10 hover:text-brand-700"
        >
            ล้างฟอร์ม
        </Button>
        <Button
            type="submit"
            disabled={submitting}
            className="flex-1 h-12 sm:h-14 bg-linear-to-r from-brand-600 to-brand-500 hover:from-brand-700 hover:to-brand-600 text-white font-semibold rounded-xl sm:rounded-2xl shadow-lg hover:shadow-xl transition-all duration-300 disabled:opacity-60"
        >
            {submitting ? (
                <span className="flex items-center gap-2">
                    <span className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    กำลังส่ง...
                </span>
            ) : submitLabel}
        </Button>
    </div>
);

/** YYYY-MM-DD date picker (empty = no date). */
export const DateField = ({ id, value, onChange, fromToday = true }: {
    id?: string; value: string; onChange: (v: string) => void; fromToday?: boolean;
}) => {
    const [open, setOpen] = useState(false);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    return (
        <div className="flex gap-2">
            <Popover open={open} onOpenChange={setOpen}>
                <PopoverTrigger asChild>
                    <Button
                        id={id}
                        type="button"
                        variant="outline"
                        className={cn('flex-1 h-11 justify-start text-left font-normal bg-white border border-gray-200 rounded-xl hover:border-brand-600/40', !value && 'text-gray-400')}
                    >
                        <CalendarIcon className="mr-2 h-4 w-4 shrink-0" />
                        {value ? format(new Date(value), 'd MMMM yyyy', { locale: th }) : 'เลือกวันที่'}
                    </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                    <Calendar
                        mode="single"
                        selected={value ? new Date(value) : undefined}
                        disabled={fromToday ? { before: today } : undefined}
                        onSelect={(date) => {
                            if (!date) return;
                            onChange(format(date, 'yyyy-MM-dd'));
                            setOpen(false);
                        }}
                    />
                </PopoverContent>
            </Popover>
            {value && (
                <Button type="button" variant="ghost" onClick={() => onChange('')} className="h-11 px-3 rounded-xl text-gray-500" aria-label="ล้างวันที่">
                    <X className="w-4 h-4" />
                </Button>
            )}
        </div>
    );
};

// ───────────────────────────── attachments ─────────────────────────────

const RemoveButton = ({ a, onRemove, busy, className }: { a: OpsAttachment; onRemove: (a: OpsAttachment) => void; busy: boolean; className?: string }) => (
    <button
        type="button"
        onClick={() => onRemove(a)}
        disabled={busy}
        aria-label={`ลบ ${a.file_name}`}
        className={cn('w-7 h-7 shrink-0 rounded-full flex items-center justify-center text-rose-400 hover:bg-rose-50 hover:text-rose-500 cursor-pointer disabled:cursor-wait', className)}
    >
        {busy ? <span className="w-3.5 h-3.5 border-2 border-rose-200 border-t-rose-500 rounded-full animate-spin" /> : <X className="w-4 h-4" />}
    </button>
);

/** Multi-file picker (drag & drop or click). Files are uploaded after the record is created. */
export const AttachmentPicker = ({
    files, onChange, accept, acceptLabel, maxFiles = 5, maxSizeMB = 10,
}: {
    files: File[];
    onChange: (files: File[]) => void;
    accept: string;
    acceptLabel: string;
    maxFiles?: number;
    maxSizeMB?: number;
}) => {
    const inputRef = useRef<HTMLInputElement>(null);
    const [dragging, setDragging] = useState(false);
    const [error, setError] = useState('');

    const addFiles = useCallback((list: FileList | null) => {
        if (!list) return;
        const incoming = Array.from(list);
        const tooBig = incoming.filter(f => f.size > maxSizeMB * 1024 * 1024);
        const ok = incoming.filter(f => f.size <= maxSizeMB * 1024 * 1024);
        const merged = [...files, ...ok].slice(0, maxFiles);
        setError(
            tooBig.length ? `${tooBig.map(f => f.name).join(', ')} มีขนาดเกิน ${maxSizeMB} MB`
                : files.length + ok.length > maxFiles ? `แนบได้สูงสุด ${maxFiles} ไฟล์`
                    : '',
        );
        onChange(merged);
    }, [files, maxFiles, maxSizeMB, onChange]);

    const full = files.length >= maxFiles;

    return (
        <div className="space-y-2">
            <button
                type="button"
                disabled={full}
                onClick={() => inputRef.current?.click()}
                onDragOver={(e) => { e.preventDefault(); if (!full) setDragging(true); }}
                onDragLeave={() => setDragging(false)}
                onDrop={(e) => { e.preventDefault(); setDragging(false); if (!full) addFiles(e.dataTransfer.files); }}
                className={cn(
                    'w-full flex flex-col items-center justify-center gap-2 border-2 border-dashed rounded-xl p-5 transition-all',
                    full ? 'border-gray-200 bg-gray-50 opacity-60 cursor-not-allowed'
                        : dragging ? 'border-brand-600 bg-brand-600/5 cursor-pointer'
                            : 'border-gray-300 bg-white hover:border-brand-600/40 cursor-pointer',
                )}
            >
                <span className={cn('w-10 h-10 rounded-full flex items-center justify-center', dragging ? 'bg-brand-600/10' : 'bg-gray-100')}>
                    <Upload className={cn('w-5 h-5', dragging ? 'text-brand-600' : 'text-gray-400')} />
                </span>
                <span className="text-sm font-medium text-gray-600">
                    ลากไฟล์มาวาง หรือ <span className="text-brand-600 underline underline-offset-2">เลือกไฟล์</span>
                </span>
                <span className="text-xs text-gray-400">{acceptLabel} · ไม่เกิน {maxSizeMB} MB/ไฟล์ · สูงสุด {maxFiles} ไฟล์</span>
            </button>
            <input
                ref={inputRef}
                type="file"
                multiple
                accept={accept}
                className="hidden"
                onChange={(e) => { addFiles(e.target.files); e.target.value = ''; }}
            />
            <FieldError message={error} />
            {files.length > 0 && (
                <ul className="space-y-1.5">
                    {files.map((f, i) => {
                        const Icon = fileIcon(f.type);
                        return (
                            <li key={`${f.name}-${i}`} className="flex items-center gap-2 rounded-lg border border-gray-100 bg-gray-50 px-3 py-2">
                                <Icon className="w-4 h-4 text-brand-600 shrink-0" />
                                <span className="text-xs text-gray-700 truncate flex-1">{f.name}</span>
                                <span className="text-[10px] text-gray-400 shrink-0">{formatSize(f.size)}</span>
                                <button
                                    type="button"
                                    onClick={() => onChange(files.filter((_, j) => j !== i))}
                                    className="w-6 h-6 rounded-full flex items-center justify-center text-rose-400 hover:bg-rose-50 hover:text-rose-500 cursor-pointer"
                                    aria-label={`ลบ ${f.name}`}
                                >
                                    <X className="w-4 h-4" />
                                </button>
                            </li>
                        );
                    })}
                </ul>
            )}
        </div>
    );
};

/** Images show as thumbnails (click → zoomable viewer); other files stay as links. `onRemove` adds an × to each. */
export const AttachmentList = ({ items, onRemove, removing }: {
    items: OpsAttachment[];
    onRemove?: (a: OpsAttachment) => void;
    /** attachment_id being removed — its × spins */
    removing?: string | null;
}) => {
    const [viewing, setViewing] = useState<number | null>(null);
    if (items.length === 0) return <p className="text-sm text-gray-400">ไม่มีไฟล์แนบ</p>;
    const images = items.filter(a => a.mime_type.startsWith('image/'));
    const files = items.filter(a => !a.mime_type.startsWith('image/'));

    return (
        <div className="space-y-2">
            {images.length > 0 && (
                <ul className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                    {images.map((a, i) => (
                        <li key={a.attachment_id} className="relative">
                            <button
                                type="button"
                                onClick={() => setViewing(i)}
                                title={a.file_name}
                                className="group relative block w-full aspect-[4/3] overflow-hidden rounded-lg border border-gray-100 bg-gray-50 hover:border-brand-600/40 cursor-zoom-in"
                            >
                                {/* eslint-disable-next-line @next/next/no-img-element -- S3 URL, shown as-is */}
                                <img src={a.url} alt={a.file_name} loading="lazy" className="w-full h-full object-cover transition-transform duration-200 group-hover:scale-105" />
                                <span className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/60 to-transparent px-2 pb-1 pt-4 text-left text-[10px] text-white truncate">
                                    {a.file_name}
                                </span>
                            </button>
                            {onRemove && <RemoveButton a={a} onRemove={onRemove} busy={removing === a.attachment_id} className="absolute top-1.5 right-1.5 bg-white/90 shadow-sm" />}
                        </li>
                    ))}
                </ul>
            )}
            {files.length > 0 && (
                <ul className="space-y-1.5">
                    {files.map(a => {
                        const Icon = fileIcon(a.mime_type);
                        return (
                            <li key={a.attachment_id} className="flex items-center gap-1.5">
                                <a href={a.url} target="_blank" rel="noreferrer" className="flex-1 min-w-0 flex items-center gap-2 rounded-lg border border-gray-100 bg-gray-50 px-3 py-2 hover:border-brand-600/30">
                                    <Icon className="w-4 h-4 text-brand-600 shrink-0" />
                                    <span className="text-xs text-gray-700 truncate flex-1">{a.file_name}</span>
                                    <span className="text-[10px] text-gray-400">{formatSize(a.size)}</span>
                                    <Paperclip className="w-3.5 h-3.5 text-gray-400" />
                                </a>
                                {onRemove && <RemoveButton a={a} onRemove={onRemove} busy={removing === a.attachment_id} />}
                            </li>
                        );
                    })}
                </ul>
            )}
            <ImageViewer images={images} index={viewing} onIndexChange={setViewing} onClose={() => setViewing(null)} />
        </div>
    );
};
