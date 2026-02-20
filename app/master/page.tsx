'use client'
import { useState, useEffect, useCallback } from "react";
import { Navbar } from "@/components/navbar"
import dynamic from 'next/dynamic';
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs"
import type { UserData, FormData } from "./mastertable"
import { WaveBackground } from "@/components/wave-background";

const MasterTable = dynamic(
    () => import('./mastertable').then(mod => ({ default: mod.MasterTable })),
    { ssr: false }
);

const TableForm = dynamic(
    () => import('./mastertable').then(mod => ({ default: mod.TableForm })),
    { ssr: false }
);


export default function MasterPage() {
    const [users, setUsers] = useState<UserData[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [forms, setForms] = useState<FormData[]>([]);
    const [activeTab, setActiveTab] = useState('user' as 'user' | 'form');

    const fetchUsers = useCallback(async () => {
        setIsLoading(true);
        setError(null);
        try {
            const res = await fetch("/api/organization/user");
            const data = await res.json();
            if (res.ok) {
                setUsers(Array.isArray(data) ? data : [data]);
            } else {
                setError(data?.error || "เกิดข้อผิดพลาดในการโหลดข้อมูล");
            }
        } catch (err) {
            console.error("Error fetching user data:", err);
            setError("ไม่สามารถเชื่อมต่อเซิร์ฟเวอร์ได้");
        } finally {
            setIsLoading(false);
        }
    }, []);

    const fetchForms = useCallback(async () => {
        setIsLoading(true);
        setError(null);
        try {
            const q = `SELECT id, form_type, form_code, form_name, form_status, created_at FROM form_masters WHERE is_latest = true ORDER BY id DESC`;
            const res = await fetch('/api/form/?query=' + encodeURIComponent(q));
            const data = await res.json();
            console.log("Fetched form data:", data);
            if (res.ok) {
                setForms(data);
            }
        } catch (err) {
            console.error("Error fetching form data:", err);
            setError("ไม่สามารถเชื่อมต่อเซิร์ฟเวอร์ได้");
        } finally {
            setIsLoading(false);
        }
    }, []);


    useEffect(() => {
        if (activeTab === 'user') {
            fetchUsers();
        } else if (activeTab === 'form') {
            fetchForms();
        }
    }, [activeTab, fetchUsers, fetchForms]);


    return (
        <Navbar isHome={false} title="ระบบจัดการข้อมูล">
            <main className="flex-1 min-h-0 bg-[#026a75] rounded-t-[1.5rem] sm:rounded-t-[2rem] lg:rounded-t-[3rem] shadow-2xl overflow-y-auto relative">
                <WaveBackground />
                <div className="w-full max-w-screen-2xl mx-auto px-3 py-6 sm:px-6 lg:px-10 sm:py-8 relative z-10">
                    <Tabs value={activeTab} onValueChange={(value) => setActiveTab(value as 'user' | 'form')}>
                        <TabsList className="mb-6 bg-gray-800/50 backdrop-blur-sm p-1 rounded-full">
                            <TabsTrigger
                                value="user"
                                className="px-5 py-2 rounded-full text-white/70 font-medium transition-all data-[state=active]:bg-white data-[state=active]:text-teal-700 data-[state=active]:shadow-md hover:text-white"
                            >
                                ผู้ใช้งาน
                            </TabsTrigger>
                            <TabsTrigger
                                value="form"
                                className="px-5 py-2 rounded-full text-white/70 font-medium transition-all data-[state=active]:bg-white data-[state=active]:text-teal-700 data-[state=active]:shadow-md hover:text-white"
                            >
                                แบบฟอร์ม
                            </TabsTrigger>
                        </TabsList>
                        <TabsContent value="user">
                            <MasterTable data={users} isLoading={isLoading} error={error} onRetry={fetchUsers} />
                        </TabsContent>
                        <TabsContent value="form">
                            <TableForm data={forms} isLoading={isLoading} error={error} onRetry={fetchForms} />
                        </TabsContent>
                    </Tabs>
                </div>
            </main>
        </Navbar>
    )
}