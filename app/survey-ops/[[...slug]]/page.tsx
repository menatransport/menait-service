'use client';

import { Navbar } from "@/components/navbar";
import { SurveyOPSForm } from "@/components/survey/survey-ops-form";
import { useEffect, useState, useMemo, useCallback } from "react";
import { useParams } from "next/navigation";
import Loading from "@/components/loading";

// API URL constant
const SYSTEMS_API_URL = process.env.NEXT_PUBLIC_SYSTEM_SCRIPT || '';
const CACHE_KEY = 'survey_ops_systems';
const CACHE_DURATION = 5 * 60 * 1000; // 5 minutes

interface SystemData {
    system_id: string;
    system: string;
}

interface CachedData {
    data: SystemData[];
    timestamp: number;
}

export default function SurveyOPSPage() {
    const [allSystems, setAllSystems] = useState<SystemData[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const params = useParams();
    const systemId = useMemo(() => params?.slug?.[0] as string | undefined, [params?.slug]);
    const systems = useMemo(() => {
        if (!systemId) return allSystems;
        return allSystems.filter(sys => sys.system_id === systemId);
    }, [allSystems, systemId]);


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
                <SurveyOPSForm systems={systems} />
            </Navbar>
            {isLoading && (
                <div className="fixed inset-0 z-9999 flex items-center justify-center bg-gray-500/60">
                    <Loading />
                </div>
            )}
        </>
    );
}

