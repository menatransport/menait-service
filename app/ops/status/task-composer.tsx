'use client';

import { useState } from 'react';
import { format, startOfDay } from 'date-fns';
import { th } from 'date-fns/locale';
import { CalendarDays, Check, ChevronDown, FolderKanban, Loader2, Plus, Search, X } from 'lucide-react';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { cn } from '@/lib/utils';
import { StatusBadge } from '../components';
import type { OpsPerson, Project, ProjectTaskInput } from '../types';
import { NO_PROJECT_LABEL, PersonAvatar, projectDot } from './kanban';

const fieldClass = 'w-full rounded-[10px] border border-border bg-white text-[13px] text-ink-900 placeholder:text-ink-300 focus:outline-none focus:border-brand-400 focus:ring-2 focus:ring-brand-400/25 transition-colors';

/**
 * Pinned on top of the task board's Open column: a dashed "สร้าง Task" button that opens an inline form.
 * `projects` = the active projects the viewer is assigned to (or คำร้อง — no project); the viewer becomes the task owner.
 */
export const TaskComposer = ({ projects, me, onCreate }: {
    projects: Project[];
    me: OpsPerson;
    /** Resolves true when saved, so the form can reset */
    onCreate: (input: ProjectTaskInput) => Promise<boolean>;
}) => {
    const [open, setOpen] = useState(false);
    const [title, setTitle] = useState('');
    /** '' = not picked yet (falls back to the first project), null = คำร้อง */
    const [projectId, setProjectId] = useState<string | null>('');
    const [due, setDue] = useState<string | null>(null);
    const [dateOpen, setDateOpen] = useState(false);
    const [saving, setSaving] = useState(false);
    const today = startOfDay(new Date());
    // keep the last pick between tasks, unless that project dropped off the list
    const selected = projectId === null ? null : projects.find(p => p.project_id === projectId) ?? projects[0] ?? null;

    const close = () => { setOpen(false); setTitle(''); setDue(null); };

    const submit = async () => {
        if (!title.trim() || saving) return;
        setSaving(true);
        const ok = await onCreate({ project_id: selected?.project_id ?? null, title: title.trim(), due_date: due });
        setSaving(false);
        if (ok) { setTitle(''); setDue(null); }
    };

    if (!open) {
        return (
            <button
                type="button"
                onClick={() => setOpen(true)}
                className="w-full h-10 rounded-[14px] border-[1.5px] border-dashed border-brand-300 bg-white/70 text-[13px] font-medium text-brand-600 flex items-center justify-center gap-1.5 cursor-pointer transition-colors hover:border-brand-600 hover:bg-brand-50 hover:text-brand-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-400/50"
            >
                <Plus className="w-3.5 h-3.5" strokeWidth={2.4} /> สร้าง Task
            </button>
        );
    }

    return (
        <form
            onSubmit={(e) => { e.preventDefault(); submit(); }}
            onKeyDown={(e) => { if (e.key === 'Escape') close(); }}
            className="rounded-2xl border border-brand-200 bg-white p-3 space-y-2.5 shadow-[0_0_0_4px_rgba(61,165,255,0.14),0_8px_24px_-10px_rgba(21,86,201,0.25)]"
        >
            <label className="block text-[11px] font-medium text-ink-700">
                ชื่อ Task
                <textarea
                    autoFocus
                    rows={2}
                    maxLength={200}
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    // Enter saves, Shift+Enter breaks the line
                    onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); submit(); } }}
                    placeholder="เช่น ทำหน้า Login"
                    className={cn(fieldClass, 'mt-1 block resize-none px-2.5 py-2 leading-snug')}
                />
            </label>

            <div className="text-[11px] font-medium text-ink-700">
                อยู่ในโปรเจกต์
                <ProjectPicker projects={projects} value={selected} onChange={setProjectId} allowNone />
            </div>

            <div className="text-[11px] font-medium text-ink-700">
                กำหนดเสร็จ
                <Popover open={dateOpen} onOpenChange={setDateOpen}>
                    <span className="mt-1 flex items-center gap-1">
                        <PopoverTrigger asChild>
                            <button
                                type="button"
                                className={cn(fieldClass, 'h-9 px-2.5 flex items-center gap-1.5 text-left text-xs cursor-pointer', !due && 'text-ink-500')}
                            >
                                <CalendarDays className="w-3.5 h-3.5 text-brand-600 shrink-0" />
                                {due ? format(new Date(due), 'd MMM yyyy', { locale: th }) : 'ไม่กำหนด'}
                            </button>
                        </PopoverTrigger>
                        {due && (
                            <button type="button" onClick={() => setDue(null)} aria-label="ล้างวันที่" className="w-7 h-7 shrink-0 rounded-full grid place-items-center text-ink-500 hover:bg-rose-50 hover:text-rose-600 cursor-pointer">
                                <X className="w-3.5 h-3.5" />
                            </button>
                        )}
                    </span>
                    <PopoverContent align="start" sideOffset={6} className="w-auto p-0 rounded-2xl border-border shadow-card overflow-hidden">
                        <Calendar
                            mode="single"
                            locale={th}
                            selected={due ? startOfDay(new Date(due)) : undefined}
                            defaultMonth={due ? new Date(due) : today}
                            disabled={{ before: today }}
                            onSelect={(d) => { if (d) { setDue(format(d, 'yyyy-MM-dd')); setDateOpen(false); } }}
                        />
                    </PopoverContent>
                </Popover>
            </div>

            <div className="flex items-center gap-1.5 text-[11px] text-ink-500">
                <PersonAvatar person={me} className="w-5 h-5" textClassName="text-[9px] font-semibold" />
                คุณเป็นผู้รับผิดชอบ Task นี้
            </div>

            <div className="flex gap-1.5">
                <button type="button" onClick={close} className="flex-1 h-9 rounded-full border border-border bg-white text-xs font-medium text-ink-700 hover:bg-slate-50 cursor-pointer transition-colors">
                    ยกเลิก
                </button>
                <button
                    type="submit"
                    disabled={!title.trim() || saving}
                    className="v2-btn flex-1 h-9 px-0 py-0 text-xs cursor-pointer disabled:opacity-50 disabled:pointer-events-none"
                >
                    {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : 'สร้าง'}
                </button>
            </div>
        </form>
    );
};

/** Lists every project the viewer may add a task to; search shows up once the list gets long. */
export const ProjectPicker = ({ projects, value, onChange, allowNone, children }: {
    projects: Project[];
    /** null = คำร้อง (only meaningful with allowNone); undefined = nothing picked */
    value: Pick<Project, 'project_id' | 'title'> | null | undefined;
    /** null = คำร้อง (ไม่มีในโปรเจกต์เดิม) */
    onChange: (projectId: string | null) => void;
    /** Offer "คำร้อง (ไม่มีในโปรเจกต์เดิม)" on top of the list */
    allowNone?: boolean;
    /** Custom trigger; defaults to a form field showing the current pick */
    children?: React.ReactElement;
}) => {
    const [open, setOpen] = useState(false);
    const [q, setQ] = useState('');
    const needle = q.trim().toLowerCase();
    const shown = needle
        ? projects.filter(p => p.title.toLowerCase().includes(needle) || p.project_id.toLowerCase().includes(needle))
        : projects;

    return (
        // modal: the list must scroll with the wheel inside the Task sheet too (see user-group-picker.tsx)
        <Popover open={open} onOpenChange={(o) => { setOpen(o); if (!o) setQ(''); }} modal>
            <PopoverTrigger asChild>
                {children ?? <button
                    type="button"
                    className={cn(fieldClass, 'mt-1 h-9 px-2.5 flex items-center gap-2 text-left text-xs cursor-pointer')}
                >
                    <span className={cn('w-1.75 h-1.75 shrink-0 rounded-full', value ? projectDot(value.project_id) : value === null && allowNone && 'border border-dashed border-ink-500')} aria-hidden />
                    {value ? (
                        <span className="min-w-0 flex-1 truncate">
                            <span className="font-mono text-ink-500">{value.project_id.slice(-3)}</span> · {value.title}
                        </span>
                    ) : value === null && allowNone
                        ? <span className="min-w-0 flex-1 truncate">{NO_PROJECT_LABEL}</span>
                        : <span className="flex-1 text-ink-500">เลือกโปรเจกต์</span>}
                    <ChevronDown className={cn('w-3.5 h-3.5 shrink-0 text-ink-300 transition-transform', open && 'rotate-180')} />
                </button>}
            </PopoverTrigger>
            <PopoverContent
                align="start"
                sideOffset={6}
                // React events bubble through the portal: Esc here should close only the list, not the whole form
                onKeyDown={(e) => { if (e.key === 'Escape') e.stopPropagation(); }}
                className="w-(--radix-popover-trigger-width) min-w-72 p-1.5 rounded-2xl border-border shadow-card"
            >
                <div className="flex items-center gap-2 px-2 pt-1 pb-1.5">
                    <FolderKanban className="w-3.5 h-3.5 text-brand-600" />
                    <p className="text-xs font-semibold text-ink-900">เลือกโปรเจกต์</p>
                    <span className="ml-auto text-[11px] text-ink-500">{projects.length} โปรเจกต์</span>
                </div>
                {projects.length > 6 && (
                    <label className="relative mb-1 block">
                        <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-ink-300 pointer-events-none" />
                        <input
                            autoFocus
                            value={q}
                            onChange={(e) => setQ(e.target.value)}
                            placeholder="ค้นหาชื่อหรือรหัส"
                            className={cn(fieldClass, 'h-8 pl-8 pr-2.5 text-xs')}
                        />
                    </label>
                )}
                <ul role="listbox" className="max-h-64 overflow-y-auto space-y-0.5">
                    {allowNone && !needle && (
                        <li>
                            <button
                                type="button"
                                role="option"
                                aria-selected={value === null}
                                onClick={() => { onChange(null); setOpen(false); setQ(''); }}
                                className={cn('w-full flex items-center gap-2.5 rounded-xl px-2.5 py-2 text-left cursor-pointer transition-colors', value === null ? 'bg-brand-50' : 'hover:bg-slate-50')}
                            >
                                <span className="w-2 h-2 shrink-0 rounded-full border border-dashed border-ink-500" aria-hidden />
                                <span className="min-w-0 flex-1">
                                    <span className="block text-[13px] font-medium text-ink-900 truncate">{NO_PROJECT_LABEL}</span>
                                    <span className="block text-[11px] text-ink-500">งานเดี่ยว ไม่ผูกกับโปรเจกต์</span>
                                </span>
                                <Check className={cn('w-3.5 h-3.5 shrink-0', value === null ? 'text-brand-600' : 'text-transparent')} strokeWidth={3} />
                            </button>
                        </li>
                    )}
                    {shown.map(p => {
                        const on = p.project_id === value?.project_id;
                        return (
                            <li key={p.project_id}>
                                <button
                                    type="button"
                                    role="option"
                                    aria-selected={on}
                                    onClick={() => { onChange(p.project_id); setOpen(false); setQ(''); }}
                                    className={cn('w-full flex items-center gap-2.5 rounded-xl px-2.5 py-2 text-left cursor-pointer transition-colors', on ? 'bg-brand-50' : 'hover:bg-slate-50')}
                                >
                                    <span className={cn('w-2 h-2 shrink-0 rounded-full', projectDot(p.project_id))} aria-hidden />
                                    <span className="min-w-0 flex-1">
                                        <span className="block text-[13px] font-medium text-ink-900 truncate">{p.title}</span>
                                        <span className="block text-[11px] font-mono text-ink-500">{p.project_id}</span>
                                    </span>
                                    <StatusBadge status={p.status} className="text-[10px] px-1.5" />
                                    <Check className={cn('w-3.5 h-3.5 shrink-0', on ? 'text-brand-600' : 'text-transparent')} strokeWidth={3} />
                                </button>
                            </li>
                        );
                    })}
                    {shown.length === 0 && <li className="px-2.5 py-3 text-center text-xs text-ink-500">ไม่พบโปรเจกต์</li>}
                </ul>
            </PopoverContent>
        </Popover>
    );
};
