'use client';

import { useEffect, useState } from 'react';
import { FolderCog, History, Settings2, Upload } from 'lucide-react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { MascotLoader } from '@/components/loading';
import { getMe, AccessReviewError } from '../api';
import { AccessReviewCanvas, NoAccess, PageHeading } from '../components';
import { OverviewTab } from './overview-tab';
import { CyclesTab } from './cycles-tab';
import { RolesTab } from './roles-tab';
import { ImportTab } from './import-tab';

/** IT-only control panel. Gated on /access-review/me.is_admin — everyone else sees NoAccess. */
export default function AccessReviewAdminPage() {
    const [state, setState] = useState<'loading' | 'ok' | 'forbidden' | 'error'>('loading');
    const [errorText, setErrorText] = useState<string | null>(null);

    useEffect(() => {
        getMe()
            .then(me => setState(me.is_admin ? 'ok' : 'forbidden'))
            .catch(err => {
                if (err instanceof AccessReviewError && err.status === 403) setState('forbidden');
                else { setState('error'); setErrorText(err instanceof Error ? err.message : 'โหลดข้อมูลไม่สำเร็จ'); }
            });
    }, []);

    if (state === 'loading') {
        return (
            <AccessReviewCanvas title="จัดการทบทวนสิทธิ์ (IT)" width="max-w-7xl">
                <div className="flex justify-center py-20"><MascotLoader text="กำลังตรวจสอบสิทธิ์" /></div>
            </AccessReviewCanvas>
        );
    }

    if (state !== 'ok') {
        return (
            <AccessReviewCanvas title="จัดการทบทวนสิทธิ์ (IT)" width="max-w-7xl">
                <NoAccess text={errorText ?? 'หน้านี้สำหรับทีม IT เท่านั้น'} />
            </AccessReviewCanvas>
        );
    }

    return (
        <AccessReviewCanvas title="จัดการทบทวนสิทธิ์ (IT)" width="max-w-7xl">
            <PageHeading icon={Settings2} title="จัดการทบทวนสิทธิ์" caption="รอบทบทวน กลุ่มสิทธิ์และผู้ใช้ และนำเข้าข้อมูล" />

            <div className="rounded-2xl sm:rounded-3xl bg-white p-4 sm:p-6 shadow-xl">
                <Tabs defaultValue="overview">
                    <TabsList className="bg-gray-100 flex-wrap h-auto">
                        <TabsTrigger value="overview" className="gap-1.5"><History className="size-3.5" /> ภาพรวม</TabsTrigger>
                        <TabsTrigger value="cycles" className="gap-1.5"><Settings2 className="size-3.5" /> รอบทบทวน</TabsTrigger>
                        <TabsTrigger value="roles" className="gap-1.5"><FolderCog className="size-3.5" /> กลุ่มสิทธิ์</TabsTrigger>
                        <TabsTrigger value="import" className="gap-1.5"><Upload className="size-3.5" /> นำเข้าข้อมูล</TabsTrigger>
                    </TabsList>

                    <TabsContent value="overview" className="mt-4"><OverviewTab /></TabsContent>
                    <TabsContent value="cycles" className="mt-4"><CyclesTab /></TabsContent>
                    <TabsContent value="roles" className="mt-4"><RolesTab /></TabsContent>
                    <TabsContent value="import" className="mt-4"><ImportTab /></TabsContent>
                </Tabs>
            </div>
        </AccessReviewCanvas>
    );
}
