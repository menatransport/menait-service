'use client';

import { useEffect, useState, useCallback } from 'react';
import { Navbar } from '@/components/navbar';
import { useSessionContext } from '@/app/context/SessionContext';
import { WaveBackground } from '@/components/wave-background';
import { DashboardFilter, currentYM, rangeToDateRange, labelYM } from './dashboard_filter';
import { DashboardContent } from './dashboard_content';
import { TrendingUp } from 'lucide-react';

export type Ticket = {
    form_id: string;
    form_code: string;
    form_name: string;
    status: string;
    created_at: string;
    point?: number;
    department_name_th?: string;
    firstname?: string;
    lastname?: string;
    email?: string;
};

export type Survey = {
    form_id?: string;
    point: number;
    comment?: string;
    survey_at?: string;
};

export default function DashboardPage() {
    const { user } = useSessionContext();
    const employeeId = user?.employee_id ?? null;
    const role = user?.role ?? null;

    const [{ start, end }, setRange] = useState<{ start: string; end: string }>(() => {
        const cm = currentYM();
        return { start: cm, end: cm };
    });
    const [tickets, setTickets] = useState<Ticket[]>([]);
    const [surveys, setSurveys] = useState<Survey[]>([]);
    const [isLoading, setIsLoading] = useState<boolean>(true);

    const fetchData = useCallback(async () => {
        if (!employeeId) return;
        setIsLoading(true);
        const { start_date, end_date } = rangeToDateRange(start, end);
        try {
            const [ticketsRes, surveysRes] = await Promise.all([
                fetch(`/api/tickets?employee_id=${employeeId}&tab=my&role=${role ?? ''}&start_date=${start_date}&end_date=${end_date}`),
                fetch(`/api/survey-it?employee_id=${employeeId}&role=${role ?? ''}`),
            ]);
            const [ticketsData, surveysData] = await Promise.all([ticketsRes.json(), surveysRes.json()]);

            const ticketsArr: Ticket[] = Array.isArray(ticketsData) ? ticketsData : [];
            const surveysArr: Survey[] = Array.isArray(surveysData) ? surveysData : [];

            // /api/survey-it returns all surveys; filter by selected range here
            const startTs = new Date(start_date).getTime();
            const endTs = new Date(end_date + 'T23:59:59').getTime();
            const filteredSurveys = surveysArr.filter((s) => {
                if (!s.survey_at) return false;
                const t = new Date(s.survey_at).getTime();
                return t >= startTs && t <= endTs;
            });

            setTickets(ticketsArr);
            setSurveys(filteredSurveys);
        } catch (err) {
            console.error('Error fetching dashboard data:', err);
            setTickets([]);
            setSurveys([]);
        } finally {
            setIsLoading(false);
        }
    }, [employeeId, role, start, end]);

    useEffect(() => {
        fetchData();
    }, [fetchData]);

    return (
        <Navbar isHome={false} title="แดชบอร์ดสรุปผลรวม">
            <main className="flex-1 min-h-0 bg-[#026a75] rounded-t-[1.5rem] sm:rounded-t-[2rem] lg:rounded-t-[3rem] shadow-2xl overflow-y-auto relative">
                <WaveBackground />
                <div className="w-full max-w-screen-2xl mx-auto px-3 py-6 sm:px-6 lg:px-10 sm:py-8 relative z-10">
                    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-6">
                        <div className="flex items-center gap-3">
                            <div className="hidden sm:flex w-11 h-11 rounded-2xl bg-white/15 backdrop-blur-sm ring-1 ring-white/25 items-center justify-center shadow-lg">
                               <TrendingUp className="w-5 h-5 text-white" />
                            </div>
                            <div>
                                <h2 className="text-white text-lg sm:text-xl font-bold tracking-tight drop-shadow-sm">IT Service Management Dashboard</h2>
                                <p className="text-white/75 text-xs sm:text-sm mt-0.5 flex items-center gap-1.5">
                                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-300 animate-pulse" />
                                    ภาพรวม {start === end ? `ประจำเดือน ${labelYM(start)}` : `${labelYM(start)} – ${labelYM(end)}`}
                                </p>
                            </div>
                        </div>
                        <DashboardFilter
                            start={start}
                            end={end}
                            onChange={(s, e) => setRange({ start: s, end: e })}
                        />
                    </div>

                    <DashboardContent tickets={tickets} surveys={surveys} loading={isLoading} start={start} end={end} />
                </div>
            </main>
        </Navbar>
    );
}
