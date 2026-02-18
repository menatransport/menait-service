'use client'
import { useState, useEffect, useCallback } from "react";
import { Navbar } from "@/components/navbar"
import dynamic from 'next/dynamic';
import type { UserData } from "./mastertable"

// bundle-dynamic-imports: Lazy load heavy table component
const MasterTable = dynamic(
    () => import('./mastertable').then(mod => ({ default: mod.MasterTable })),
    { ssr: false }
);



export default function MasterPage() {
    const [users, setUsers] = useState<UserData[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

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

    useEffect(() => {
        fetchUsers();
    }, [fetchUsers]);


    return (
        <Navbar isHome={false} title="ระบบจัดการข้อมูล">
            <main className="flex-1 min-h-0 bg-[#f0fafa] rounded-t-[1.5rem] sm:rounded-t-[2rem] lg:rounded-t-[3rem] shadow-2xl overflow-y-auto">
                <div className="w-full max-w-screen-2xl mx-auto px-3 py-6 sm:px-6 lg:px-10 sm:py-8">
                    <MasterTable data={users} isLoading={isLoading} error={error} onRetry={fetchUsers} />
                </div>
            </main>
        </Navbar>
    )
}