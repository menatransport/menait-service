'use client';

import { ChartColumnBig } from 'lucide-react';
import { useSessionContext } from '@/app/context/SessionContext';

/** This project's Vercel Analytics page, e.g. https://vercel.com/<team>/<project>/analytics */
const ANALYTICS_URL = process.env.NEXT_PUBLIC_ANALYTICS_URL;

/**
 * Small corner shortcut to the usage stats collected by <Analytics /> (app/layout.tsx).
 * Vercel has no API to read Web Analytics back on the free plan, so this opens the dashboard
 * instead. Admins only; hidden until NEXT_PUBLIC_ANALYTICS_URL is set.
 */
export function AnalyticsButton() {
    const { user, loading } = useSessionContext();
    if (!ANALYTICS_URL || loading || user?.role !== 'a') return null;

    return (
        <a
            href={ANALYTICS_URL}
            target="_blank"
            rel="noopener noreferrer"
            aria-label="ดูสถิติการใช้งานระบบ (Vercel Analytics)"
            title="สถิติการใช้งาน (Vercel Analytics)"
            className="group fixed bottom-4 right-4 z-40 flex items-center gap-1.5 h-10 rounded-full bg-white/90 pl-2.5 pr-2.5 text-brand-700 shadow-card ring-1 ring-brand-100 backdrop-blur transition-all duration-200 hover:pr-3.5 hover:bg-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-400/60"
        >
            <ChartColumnBig className="w-5 h-5 shrink-0" />
            {/* label slides out on hover / keyboard focus, so the resting button stays a small icon */}
            <span className="max-w-0 overflow-hidden whitespace-nowrap text-xs font-semibold opacity-0 transition-all duration-200 group-hover:max-w-32 group-hover:opacity-100 group-focus-visible:max-w-32 group-focus-visible:opacity-100">
                สถิติการใช้งาน
            </span>
        </a>
    );
}
