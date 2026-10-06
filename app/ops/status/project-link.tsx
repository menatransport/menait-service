'use client';

import { useState } from 'react';
import { Check, Copy, ExternalLink, Globe, Link2, Pencil } from 'lucide-react';
import { cn } from '@/lib/utils';

/** http(s) with a host — the same rule the backend applies */
const isHttpUrl = (v: string) => {
    try {
        const u = new URL(v);
        return (u.protocol === 'http:' || u.protocol === 'https:') && Boolean(u.host);
    } catch {
        return false;
    }
};

const hostOf = (url: string) => {
    try { return new URL(url).host; } catch { return url; }
};

/**
 * Where the finished system lives (project.link_url), on a Done project's sheet.
 * Everyone sees it once set; with `onSave` (OPS team / admin) it can be added, changed or removed.
 */
export const ProjectLink = ({ url, onSave }: {
    url?: string | null;
    /** Resolves true on success; null removes the link */
    onSave?: (url: string | null) => Promise<boolean>;
}) => {
    const [draft, setDraft] = useState<string | null>(null);
    const [error, setError] = useState<string | null>(null);
    const [saving, setSaving] = useState(false);
    const [copied, setCopied] = useState(false);

    if (!url && !onSave) return null;

    const save = async (next: string | null) => {
        if (next !== null && !isHttpUrl(next)) {
            setError('ลิงก์ต้องขึ้นต้นด้วย http:// หรือ https://');
            return;
        }
        setSaving(true);
        const ok = await onSave!(next);
        setSaving(false);
        if (ok) { setDraft(null); setError(null); }
    };

    const copy = async () => {
        if (!url) return;
        await navigator.clipboard.writeText(url).catch(() => undefined);
        setCopied(true);
        setTimeout(() => setCopied(false), 1500);
    };

    if (draft !== null) {
        return (
            <section className="rounded-[18px] border-2 border-mint-300/70 bg-white px-4.5 py-3.5 space-y-2.5" data-local-escape>
                <label htmlFor="project-link" className="flex items-center gap-2 text-[13px] font-semibold text-ink-900">
                    <Link2 className="w-4 h-4 text-mint-600" /> ลิงก์ใช้งานระบบ
                </label>
                <input
                    id="project-link"
                    type="url"
                    inputMode="url"
                    autoFocus
                    maxLength={2000}
                    value={draft}
                    placeholder="https://"
                    aria-invalid={Boolean(error)}
                    onChange={(e) => { setDraft(e.target.value); setError(null); }}
                    onKeyDown={(e) => {
                        if (e.key === 'Enter') { e.preventDefault(); void save(draft.trim() || null); }
                        if (e.key === 'Escape') { setDraft(null); setError(null); }
                    }}
                    className={cn(
                        'w-full h-10 px-3.5 rounded-xl border bg-white text-sm font-mono focus:outline-none focus:ring-2 focus:ring-mint-500/25 focus:border-mint-500',
                        error ? 'border-rose-300 bg-rose-50/50' : 'border-border',
                    )}
                />
                {error && <p className="text-xs text-rose-500">{error}</p>}
                <div className="flex items-center gap-1.5">
                    {url && (
                        <button type="button" disabled={saving} onClick={() => void save(null)} className="h-8 px-3 rounded-full text-xs font-medium text-ink-500 hover:bg-rose-50 hover:text-rose-600 cursor-pointer transition-colors disabled:opacity-50">
                            ลบลิงก์
                        </button>
                    )}
                    <button type="button" disabled={saving} onClick={() => { setDraft(null); setError(null); }} className="ml-auto h-8 px-3.5 rounded-full text-xs font-medium text-ink-700 hover:bg-brand-50 cursor-pointer transition-colors disabled:opacity-50">
                        ยกเลิก
                    </button>
                    <button
                        type="button"
                        disabled={saving || !draft.trim()}
                        onClick={() => void save(draft.trim())}
                        className="h-8 px-4 rounded-full bg-mint-600 text-xs font-semibold text-white hover:bg-mint-700 cursor-pointer transition-colors disabled:opacity-50 disabled:pointer-events-none"
                    >
                        {saving ? 'กำลังบันทึก...' : 'บันทึก'}
                    </button>
                </div>
            </section>
        );
    }

    if (!url) {
        return (
            <button
                type="button"
                onClick={() => setDraft('')}
                className="w-full flex items-center gap-2.5 rounded-[18px] border-2 border-dashed border-mint-300/70 bg-white/70 px-4.5 py-3.5 text-left cursor-pointer hover:border-mint-400 hover:bg-white transition-colors"
            >
                <span className="w-8 h-8 shrink-0 rounded-full bg-mint-300/20 text-mint-600 grid place-items-center"><Link2 className="w-4 h-4" /></span>
                <span className="min-w-0">
                    <span className="block text-[13px] font-semibold text-ink-900">เพิ่มลิงก์ใช้งานระบบ</span>
                    <span className="block text-xs text-ink-500">ถ้ามี — ให้ทุกคนเปิดระบบที่ส่งมอบแล้วได้จากตรงนี้</span>
                </span>
            </button>
        );
    }

    return (
        <section className="flex items-center gap-3 rounded-[18px] border border-mint-300/70 bg-mint-300/15 px-4.5 py-3">
            <span className="w-9 h-9 shrink-0 rounded-full bg-white text-mint-600 grid place-items-center shadow-soft"><Globe className="w-4.5 h-4.5" /></span>
            <a href={url} target="_blank" rel="noopener noreferrer" className="group min-w-0 flex-1" title={url}>
                <span className="block text-[11px] font-semibold tracking-wide text-mint-700">ลิงก์ใช้งานระบบ</span>
                <span className="block text-sm font-semibold text-ink-900 truncate group-hover:text-brand-700 group-hover:underline">{hostOf(url)}</span>
                <span className="block text-[11px] font-mono text-ink-500 truncate">{url}</span>
            </a>
            <span className="flex items-center gap-0.5 shrink-0">
                <button type="button" onClick={copy} aria-label="คัดลอกลิงก์" title={copied ? 'คัดลอกแล้ว' : 'คัดลอกลิงก์'} className="w-8 h-8 rounded-full grid place-items-center text-ink-500 hover:bg-white hover:text-brand-700 cursor-pointer transition-colors">
                    {copied ? <Check className="w-4 h-4 text-mint-600" /> : <Copy className="w-4 h-4" />}
                </button>
                {onSave && (
                    <button type="button" onClick={() => setDraft(url)} aria-label="แก้ไขลิงก์" title="แก้ไขลิงก์" className="w-8 h-8 rounded-full grid place-items-center text-ink-500 hover:bg-white hover:text-brand-700 cursor-pointer transition-colors">
                        <Pencil className="w-3.5 h-3.5" />
                    </button>
                )}
                <a href={url} target="_blank" rel="noopener noreferrer" aria-label="เปิดลิงก์" title="เปิดในแท็บใหม่" className="h-8 px-3 rounded-full inline-flex items-center gap-1.5 bg-mint-600 text-xs font-semibold text-white hover:bg-mint-700 transition-colors">
                    เปิด <ExternalLink className="w-3.5 h-3.5" />
                </a>
            </span>
        </section>
    );
};
