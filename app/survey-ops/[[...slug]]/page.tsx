'use client';

import { Navbar } from "@/components/navbar";
import { SurveyOPSForm } from "@/app/survey-ops/[[...slug]]/survey-ops-form";
import { Suspense, useEffect, useState, useMemo, useCallback } from "react";
import { useParams, useSearchParams } from "next/navigation";
import Loading from "@/components/loading";
import { useSessionContext } from "@/app/context/SessionContext";
import { listProjects } from "@/app/ops/api";

const SYSTEMS_API_URL = process.env.NEXT_PUBLIC_SYSTEM_SCRIPT || '';
const CACHE_KEY = 'survey_ops_systems';
const CACHE_DURATION = 5 * 60 * 1000; 

interface SystemData {
    system_id: string;
    system: string;
}

interface CachedData {
    data: SystemData[];
    timestamp: number;
}

function SurveyOPSContent() {
    const [allSystems, setAllSystems] = useState<SystemData[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const { user, loading: sessionLoading } = useSessionContext();
    // OPS projects that were delivered (Review / Done) — null until loaded
    const [opsSystems, setOpsSystems] = useState<SystemData[] | null>(null);
    const params = useParams();
    const searchParams = useSearchParams();
    const systemId = useMemo(() => params?.slug?.[0] as string | undefined, [params?.slug]);

    useEffect(() => {
        if (!user) return;
        let alive = true;
        listProjects('all')
            .then(list => {
                if (!alive) return;
                setOpsSystems(list
                    .filter(p => p.status === 'Review' || p.status === 'Done')
                    .map(p => ({ system_id: p.project_id, system: p.title })));
            })
            .catch(err => { console.error('Error fetching OPS projects:', err); if (alive) setOpsSystems([]); });
        return () => { alive = false; };
    }, [user]);

    // OPS projects first; systems from the external script stay so older e-mailed links keep working
    const merged = useMemo(() => {
        const ops = opsSystems ?? [];
        return [...ops, ...allSystems.filter(s => !ops.some(o => o.system_id === s.system_id))];
    }, [opsSystems, allSystems]);

    const systems = useMemo(() => {
        if (!systemId) return merged;
        return merged.filter(sys => sys.system_id === systemId);
    }, [merged, systemId]);

    /** Opened right after "ผ่านรีวิว": the system is fixed to the reviewed project */
    const fromReview = searchParams.get('from') === 'review';
    const opsLoading = sessionLoading || (Boolean(user) && opsSystems === null);


    const getCachedSystems = useCallback((): SystemData[] | null => {
        try {
            const cached = sessionStorage.getItem(CACHE_KEY);
            if (!cached) return null;
            
            const { data, timestamp }: CachedData = JSON.parse(cached);
            const isValid = Date.now() - timestamp < CACHE_DURATION;
            
            return isValid ? data : null;
        } catch {
            return null;
        }
    }, []);


    const setCachedSystems = useCallback((data: SystemData[]) => {
        try {
            const cacheData: CachedData = { data, timestamp: Date.now() };
            sessionStorage.setItem(CACHE_KEY, JSON.stringify(cacheData));
        } catch {
            // Ignore storage errors
        }
    }, []);

    useEffect(() => {
        const controller = new AbortController();

        async function fetchSystems() {
            const cached = getCachedSystems();
            if (cached) {
                setAllSystems(cached);
                setIsLoading(false);
                return;
            }

            setIsLoading(true);
            try {
                const response = await fetch(SYSTEMS_API_URL, {
                    signal: controller.signal,
                    cache: 'force-cache',
                });
                
                if (!response.ok) throw new Error('Failed to fetch systems');
                
                const data: SystemData[] = await response.json();
                setAllSystems(data);
                setCachedSystems(data);
            } catch (error) {
                if (error instanceof Error && error.name !== 'AbortError') {
                    console.error('Error fetching systems:', error);
                }
            } finally {
                setIsLoading(false);
            }
        }

        fetchSystems();

        return () => controller.abort();
    }, [getCachedSystems, setCachedSystems]);

    return (
        <>
            <Navbar isHome={false} title="แบบประเมินการใช้งานระบบของฝ่าย OPS">
                <SurveyOPSForm
                    systems={systems}
                    locked={fromReview && systems.length === 1}
                    doneHref={fromReview ? '/ops/status' : undefined}
                />
            </Navbar>
            {(isLoading || opsLoading) && (
                <div className="fixed inset-0 z-9999 flex items-center justify-center v2-loader-overlay">
                    <Loading />
                </div>
            )}
        </>
    );
}

export default function SurveyOPSPage() {
    return (
        <Suspense>
            <SurveyOPSContent />
        </Suspense>
    );
}
