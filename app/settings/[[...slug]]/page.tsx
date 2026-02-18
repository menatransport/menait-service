'use client';

import { useEffect, useState, useCallback } from 'react';
import { Navbar } from '@/components/navbar';
import { useRouter, useParams } from 'next/navigation';
import { SettingComponent, UserData } from './settingcontent';
import { useSessionContext } from '@/app/context/SessionContext';

export default function SettingPage() {
    const router = useRouter();
    const params = useParams();
    const { user: sessionUser, loading: sessionLoading } = useSessionContext();
    const [formData, setFormData] = useState<UserData | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    const role = sessionUser?.role ?? null;

    useEffect(() => {
        if (sessionLoading) return;

        const loadUserData = async () => {
            if (!sessionUser) {
                router.push('/login');
                return;
            }

            try {
                const paramEmployeeId = params?.slug?.[0];

                if (!paramEmployeeId) {
                    setError('ไม่พบรหัสพนักงาน');
                    setIsLoading(false);
                    return;
                }

                const res = await fetch(`/api/setting-api?employee_id=${paramEmployeeId}`);
                if (res.ok) {
                    const data = await res.json();
                    setFormData(data);
                } else {
                    setError('ไม่สามารถโหลดข้อมูลได้ กรุณาลองใหม่อีกครั้ง');
                }
            } catch (err) {
                console.error('Failed to load user data:', err);
                setError('เกิดข้อผิดพลาดในการเชื่อมต่อ');
            } finally {
                setIsLoading(false);
            }
        };

        loadUserData();
    }, [router, sessionUser, sessionLoading, params]);

    const handleRetry = useCallback(() => {
        setIsLoading(true);
        setError(null);
        setFormData(null);
        window.location.reload();
    }, []);

    return (
        <Navbar isHome={false} title="ตั้งค่า">
            <SettingComponent
                formData={formData}
                role={role}
                isLoading={isLoading}
                error={error}
                onRetry={handleRetry}
            />
        </Navbar>
    );
}