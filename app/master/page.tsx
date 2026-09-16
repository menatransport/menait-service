'use client'
import { useState, useEffect, useCallback } from "react";
import { Navbar } from "@/components/navbar"
import dynamic from 'next/dynamic';
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs"
import type { UserData, FormData } from "./mastertable"
import { WaveBackground } from "@/components/wave-background";
import { UserCreate } from "@/components/profile-form";
import Swal from "sweetalert2";

interface LookupOption {
    option_value: string;
    option_label: string;
}


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
    const [lookups, setLookups] = useState<{
        departments: LookupOption[];
        sites: LookupOption[];
        positions: LookupOption[];
    }>({ departments: [], sites: [], positions: [] });

    useEffect(() => {
        Promise.all([
            fetch('/api/organization/departments').then(r => r.json()),
            fetch('/api/organization/sites').then(r => r.json()),
            fetch('/api/organization/positions').then(r => r.json()),
        ]).then(([departments, sites, positions]) => {
            setLookups({
                departments: Array.isArray(departments) ? departments : [],
                sites: Array.isArray(sites) ? sites : [],
                positions: Array.isArray(positions) ? positions : [],
            });
        }).catch(console.error);
    }, []);


    const fetchUsers = useCallback(async () => {
        setIsLoading(true);
        setError(null);
        try {
            const res = await fetch("/api/organization/user", {
                method: "GET",
                headers: {
                    "Content-Type": "application/json",
                },
            });
            const data = await res.json();
            // console.log("Fetched user data:", data);
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
            // console.log("Fetched form data:", data);
            if (res.ok) {
                setForms(data);
            } else {
                setError(data?.error || "เกิดข้อผิดพลาดในการโหลดข้อมูล");
            }
        } catch (err) {
            console.error("Error fetching form data:", err);
            setError("ไม่สามารถเชื่อมต่อเซิร์ฟเวอร์ได้");
        } finally {
            setIsLoading(false);
        }
    }, []);

    const handleUpdate = useCallback(async (userData: UserData): Promise<boolean> => {
        try {
            const toId = (v: unknown) =>
                v === null || v === undefined || v === '' ? null : Number(v);

            const payload = {
                id: userData.id,
                username: userData.username,
                employee_id: userData.employee_id,
                department_id: toId(userData.department_id),
                site_id: toId(userData.site_id),
                position_id: toId(userData.position_id),
                email: userData.email,
                employee_status: userData.employee_status || '',
                firstname: userData.firstname,
                lastname: userData.lastname,
            };

            const res = await fetch('/api/organization/user', {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload),
            });
            const saved = await res.json().catch(() => null);
            if (!res.ok) {
                console.error('Update user failed:', saved);
                Swal.fire({
                    icon: 'error',
                    title: 'อัปเดตข้อมูลไม่สำเร็จ',
                    text: saved?.error || 'เซิร์ฟเวอร์ปฏิเสธคำขอ',
                });
                return false;
            }

            // HTTP 200 alone does not prove the write landed — compare what came back
            // with what we sent, so a silently-ignored field cannot report success.
            const notApplied = saved && typeof saved === 'object'
                ? (Object.keys(payload) as (keyof typeof payload)[]).filter(
                    k => k in saved && String((saved as Record<string, unknown>)[k] ?? '') !== String(payload[k] ?? '')
                )
                : [];
            if (notApplied.length > 0) {
                console.error('Update user: fields not applied by server:', notApplied, { sent: payload, saved });
                Swal.fire({
                    icon: 'error',
                    title: 'อัปเดตข้อมูลไม่สำเร็จ',
                    text: `เซิร์ฟเวอร์ไม่ได้บันทึก: ${notApplied.join(', ')}`,
                });
                await fetchUsers();
                return false;
            }

            // Refetch so joined labels (ฝ่าย/สถานที่/ตำแหน่ง/ระดับ) reflect the new ids
            await fetchUsers();
            Swal.fire({
                icon: 'success',
                title: 'อัปเดตข้อมูลสำเร็จ',
                showConfirmButton: false,
                timer: 1500
            });
            return true;
        } catch (err) {
            console.error('Update user error:', err);
            Swal.fire({
                icon: 'error',
                title: 'อัปเดตข้อมูลไม่สำเร็จ',
                text: 'ไม่สามารถเชื่อมต่อเซิร์ฟเวอร์ได้',
            });
            return false;
        }
    }, [fetchUsers]);

    const handleAdd = useCallback(async (userData: Omit<UserCreate, 'id'>): Promise<boolean> => {
        try {
            const payload = {
                ...userData,
                department_id: Number(userData.department_id),
                site_id: Number(userData.site_id),
                position_id: Number(userData.position_id),
                employee_status: 'Active',
                password: 'Mnt@' + userData.employee_id.slice(-4),
            };
            const res = await fetch('/api/organization/user', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload),
            });
            if (!res.ok) return false;
            await fetchUsers();
            return true;
        } catch {
            return false;
        }
    }, [fetchUsers]);


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
                    <Tabs value={activeTab} onValueChange={(value: string) => setActiveTab(value as 'user' | 'form')}>
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
                            <MasterTable data={users} isLoading={isLoading} error={error} onRetry={fetchUsers} onUpdate={handleUpdate} onAdd={handleAdd} lookups={lookups} />
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