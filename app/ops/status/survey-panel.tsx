'use client';

import { useEffect, useId, useState } from 'react';
import { formatDistanceToNowStrict } from 'date-fns';
import { th } from 'date-fns/locale';
import { Check, ChevronDown, ClipboardCheck, Copy, ExternalLink } from 'lucide-react';
import { cn } from '@/lib/utils';
import { getProjectSurveys } from '../api';
import type { OpsSurveyResponse, OpsSurveyResults, Project } from '../types';
import {
    SECTION_2_QUESTIONS, SECTION_2_TITLE, SECTION_3_QUESTIONS, SECTION_3_TITLE, surveyLink, type RatingQuestion,
} from '@/app/survey-ops/questions';
import { PersonAvatar } from './kanban';

const ago = (iso: string) => formatDistanceToNowStrict(new Date(iso), { addSuffix: true, locale: th });

/** ≥ 4 good, ≥ 3 fair, below that needs attention */
const tone = (score: number | null) =>
    score == null ? 'text-ink-300' : score >= 4 ? 'text-mint-700' : score >= 3 ? 'text-sun-700' : 'text-rose-600';
const barTone = (score: number | null) =>
    score == null ? 'bg-slate-200' : score >= 4 ? 'bg-mint-500' : score >= 3 ? 'bg-sun-500' : 'bg-rose-500';

const responseAverage = (r: OpsSurveyResponse) => {
    const all = [...Object.values(r.section2), ...Object.values(r.section3)];
    return all.length ? all.reduce((a, b) => a + b, 0) / all.length : null;
};

/** Two compact actions on the survey link: open it, or copy it to send on. */
const SurveyLinkActions = ({ projectId }: { projectId: string }) => {
    const [copied, setCopied] = useState(false);
    useEffect(() => {
        if (!copied) return;
        const t = setTimeout(() => setCopied(false), 1800);
        return () => clearTimeout(t);
    }, [copied]);
    const link = () => surveyLink(projectId, window.location.origin);
    const copy = async () => {
        try {
            await navigator.clipboard.writeText(link());
            setCopied(true);
        } catch {
            // clipboard blocked (e.g. not a secure context): let the viewer copy it by hand
            window.prompt('คัดลอกลิงก์แบบประเมิน', link());
        }
    };
    const pill = 'h-8 px-3 rounded-full inline-flex items-center gap-1.5 text-xs font-medium cursor-pointer transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-400/50';
    return (
        <div className="flex items-center gap-1.5 shrink-0">
            <a
                href={`/survey-ops/${encodeURIComponent(projectId)}`}
                target="_blank"
                rel="noopener noreferrer"
                title="เปิดแบบประเมินในแท็บใหม่"
                className={cn(pill, 'text-brand-700 bg-brand-50 hover:bg-brand-100')}
            >
                <ExternalLink className="w-3.5 h-3.5" /> เปิด
            </a>
            <button
                type="button"
                onClick={() => void copy()}
                title="คัดลอกลิงก์แบบประเมิน"
                className={cn(pill, copied ? 'bg-mint-300/30 text-mint-700' : 'text-brand-700 bg-brand-50 hover:bg-brand-100')}
            >
                {copied ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                {copied ? 'คัดลอกแล้ว' : 'คัดลอก'}
            </button>
        </div>
    );
};

const QuestionBars = ({ title, questions, averages }: { title: string; questions: RatingQuestion[]; averages: (number | null)[] }) => (
    <div>
        <p className="text-xs font-semibold text-ink-500 mb-2">{title}</p>
        <ul className="space-y-2">
            {questions.map((q, i) => {
                const avg = averages[i] ?? null;
                return (
                    <li key={q.id} className="grid grid-cols-[1fr_auto] items-center gap-x-3 gap-y-1">
                        <span className="text-[13px] text-ink-700 leading-snug">{q.question}</span>
                        <span className={cn('text-[13px] font-semibold tabular-nums', tone(avg))}>{avg == null ? '–' : avg.toFixed(1)}</span>
                        <span className="col-span-2 h-1.5 rounded-full bg-brand-50 overflow-hidden">
                            <span className={cn('block h-full rounded-full', barTone(avg))} style={{ width: `${((avg ?? 0) / 5) * 100}%` }} />
                        </span>
                    </li>
                );
            })}
        </ul>
    </div>
);

const Results = ({ data }: { data: OpsSurveyResults }) => {
    if (data.count === 0) {
        return <p className="text-sm text-ink-500">ยังไม่มีผู้ตอบแบบประเมิน — คัดลอกลิงก์ส่งให้ผู้ใช้งานได้เลย</p>;
    }
    const withComment = data.responses.filter(r => r.comment);
    return (
        <div className="space-y-4">
            <div className="flex items-end gap-3">
                <span className={cn('font-display text-4xl font-semibold leading-none tabular-nums', tone(data.average))}>
                    {data.average?.toFixed(1) ?? '–'}
                </span>
                <span className="pb-0.5 text-xs text-ink-500">คะแนนเฉลี่ยจาก 5 · ตอบแล้ว {data.count} คน</span>
                <span className="ml-auto flex -space-x-2 pb-0.5" title={data.responses.map(r => r.respondent.name).join(', ')}>
                    {data.responses.slice(0, 5).map(r => (
                        <span key={r.survey_id} className="rounded-full ring-2 ring-white">
                            <PersonAvatar person={r.respondent} className="w-7 h-7" textClassName="text-[11px] font-semibold" />
                        </span>
                    ))}
                </span>
            </div>
            <QuestionBars title={SECTION_2_TITLE} questions={SECTION_2_QUESTIONS} averages={data.section2_avg} />
            <QuestionBars title={SECTION_3_TITLE} questions={SECTION_3_QUESTIONS} averages={data.section3_avg} />
            {withComment.length > 0 && (
                <div>
                    <p className="text-xs font-semibold text-ink-500 mb-2">ความคิดเห็นเพิ่มเติม ({withComment.length})</p>
                    <ul className="space-y-2.5">
                        {withComment.map(r => {
                            const avg = responseAverage(r);
                            return (
                                <li key={r.survey_id} className="flex gap-2.5">
                                    <PersonAvatar person={r.respondent} className="w-8 h-8 shrink-0" textClassName="text-[11px] font-semibold" />
                                    <div className="min-w-0 flex-1 rounded-[14px] bg-brand-50/70 px-3 py-2">
                                        <div className="flex items-baseline gap-2">
                                            <span className="text-[13px] font-semibold text-ink-900 truncate">{r.respondent.name}</span>
                                            <span className="text-[11px] text-ink-500 shrink-0">{ago(r.updated_at)}</span>
                                            <span className={cn('ml-auto text-xs font-semibold tabular-nums', tone(avg))}>{avg?.toFixed(1)}</span>
                                        </div>
                                        <p className="mt-0.5 text-sm leading-relaxed text-ink-700 whitespace-pre-line wrap-break-word">{r.comment}</p>
                                    </div>
                                </li>
                            );
                        })}
                    </ul>
                </div>
            )}
        </div>
    );
};

/**
 * Review / Done projects: copy the survey link (anyone) and read the results (OPS team / admin).
 * Starts folded — the header keeps the average and the open / copy link buttons; clicking it opens the details.
 * Answers live in MongoDB ops.surveys — see POST /api/ops/surveys.
 */
export const SurveySection = ({ p, canViewResults }: { p: Project; canViewResults: boolean }) => {
    const [data, setData] = useState<OpsSurveyResults | null>(null);
    const [error, setError] = useState('');
    const [open, setOpen] = useState(false);
    const bodyId = useId();

    useEffect(() => {
        if (!canViewResults) return;
        let alive = true;
        getProjectSurveys(p.project_id)
            .then(d => { if (alive) setData(d); })
            .catch(err => { if (alive) setError(err instanceof Error ? err.message : 'โหลดผลประเมินไม่สำเร็จ'); });
        return () => { alive = false; };
    }, [p.project_id, canViewResults]);

    const summary = !canViewResults ? null
        : data ? (data.count ? `${data.average?.toFixed(1)} · ${data.count} คน` : 'ยังไม่มีผู้ตอบ')
            : error ? null : '…';

    return (
        <section aria-label="แบบประเมินความพึงพอใจ" className="rounded-[22px] bg-white shadow-soft">
            <div className="flex items-center gap-2 pr-3">
                <button
                    type="button"
                    onClick={() => setOpen(o => !o)}
                    aria-expanded={open}
                    aria-controls={bodyId}
                    className="min-w-0 flex-1 flex items-center gap-2 pl-4.5 sm:pl-5 pr-2 py-3.5 text-left cursor-pointer rounded-l-[22px] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-400/50"
                >
                    <span className="w-7 h-7 rounded-[10px] bg-mint-300/30 text-mint-700 grid place-items-center shrink-0">
                        <ClipboardCheck className="w-4 h-4" />
                    </span>
                    <span className="text-[13px] font-semibold text-ink-900 truncate">แบบประเมินความพึงพอใจ</span>
                    {summary && (
                        <span className={cn('text-xs font-semibold tabular-nums shrink-0', data?.count ? tone(data.average) : 'text-ink-500 font-normal')}>
                            {summary}
                        </span>
                    )}
                    <ChevronDown className={cn('ml-auto w-4 h-4 text-ink-500 shrink-0 transition-transform duration-300', open && 'rotate-180 text-brand-600')} />
                </button>
                <SurveyLinkActions projectId={p.project_id} />
            </div>
            <div id={bodyId} className={cn('grid transition-[grid-template-rows] duration-300 ease-out', open ? 'grid-rows-[1fr]' : 'grid-rows-[0fr]')}>
                <div className="overflow-hidden">
                    <div className={cn('px-4.5 sm:px-5 pb-5 pt-1 transition-opacity duration-300', open ? 'opacity-100' : 'opacity-0')} inert={!open}>
                        {!canViewResults ? (
                            <p className="text-xs text-ink-500">ผลประเมินดูได้เฉพาะทีม OPS / admin</p>
                        ) : error ? (
                            <p role="alert" className="text-xs text-rose-600">{error}</p>
                        ) : data ? (
                            <Results data={data} />
                        ) : (
                            <p className="text-xs text-ink-500 flex items-center gap-2">
                                <span className="w-3.5 h-3.5 rounded-full border-2 border-brand-200 border-t-brand-600 animate-spin" /> กำลังโหลดผลประเมิน…
                            </p>
                        )}
                    </div>
                </div>
            </div>
        </section>
    );
};
