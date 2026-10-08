'use client';

import { Suspense, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Check, FolderKanban, ListPlus, type LucideIcon } from 'lucide-react';
import { Navbar } from '@/components/navbar';
import { SubmitSuccess } from '@/components/ui/submit-success';
import { useSessionContext } from '@/app/context/SessionContext';
import { cn } from '@/lib/utils';
import { OpsFormShell } from '../components';
import { ProjectRequestForm } from './project-request-form';
import { TaskRequestForm } from './task-request-form';

type RequestType = 'project' | 'task';

const TYPES: Record<RequestType, { icon: LucideIcon; title: string; caption: string; example: string; shell: string; subtitle: string }> = {
    project: {
        icon: FolderKanban,
        title: 'โปรเจกต์ใหม่',
        caption: 'ระบบหรืองานใหม่ที่ยังไม่เคยมี',
        example: 'เช่น ระบบจองคิวรถ, แอปเช็กอินหน้างาน',
        shell: 'ยื่นคำขอโปรเจกต์ใหม่',
        subtitle: 'กรอกให้ครบเท่าที่ทราบ ทีมจะติดต่อกลับหากต้องการข้อมูลเพิ่ม',
    },
    task: {
        icon: ListPlus,
        title: 'พัฒนาเพิ่มบนโปรเจกต์เดิม',
        caption: 'เพิ่มหรือปรับฟังก์ชันในโปรเจกต์ที่มีอยู่แล้ว',
        example: 'เช่น เพิ่มปุ่ม Export, เพิ่มช่องข้อมูล, ปรับหน้ารายงาน',
        shell: 'ขอพัฒนาเพิ่มในโปรเจกต์เดิม',
        subtitle: 'คำขอจะเข้าเป็น Task ของโปรเจกต์นั้น ทีม OPS จะรับงานและอัปเดตสถานะให้',
    },
};

/** No / unknown ?type → โปรเจกต์ใหม่ */
const typeFrom = (v: string | null): RequestType => (v === 'task' ? 'task' : 'project');

/**
 * Keeps the choice (and the picked project) in the URL without a Next navigation,
 * so /ops/request?type=task&project=OPS-… can be shared and opens ready to fill.
 */
const syncUrl = (type: RequestType, projectId: string) => {
    const params = new URLSearchParams();
    params.set('type', type);
    if (type === 'task' && projectId) params.set('project', projectId);
    const qs = params.toString();
    window.history.replaceState(null, '', `/ops/request${qs ? `?${qs}` : ''}`);
};

/** Two radio cards — the first thing on the page. */
const RequestTypePicker = ({ value, onChange }: { value: RequestType; onChange: (t: RequestType) => void }) => (
    <div role="radiogroup" aria-label="ประเภทคำขอ" className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {(Object.keys(TYPES) as RequestType[]).map(t => {
            const m = TYPES[t];
            const active = value === t;
            return (
                <button
                    key={t}
                    type="button"
                    role="radio"
                    aria-checked={active}
                    onClick={() => onChange(t)}
                    className={cn(
                        'relative text-left rounded-2xl border-2 p-4 transition-all cursor-pointer focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-brand-600/20',
                        active ? 'border-brand-600 bg-brand-50 ring-4 ring-brand-600/10' : 'border-gray-200 bg-white hover:border-brand-600/40',
                        !active && 'opacity-70 hover:opacity-100',
                    )}
                >
                    {active && (
                        <span className="absolute top-3 right-3 grid size-5 place-items-center rounded-full bg-brand-600 text-white">
                            <Check className="size-3.5" strokeWidth={3} />
                        </span>
                    )}
                    <span className="flex items-center gap-3">
                        <span className={cn(
                            'grid size-10 shrink-0 place-items-center rounded-xl transition-colors',
                            active ? 'bg-linear-to-br from-sun-400 to-sun-500 text-white shadow-md' : 'bg-gray-100 text-brand-600',
                        )}>
                            <m.icon className="size-5" />
                        </span>
                        <span className="min-w-0 pr-5">
                            <span className="block font-semibold text-brand-800">{m.title}</span>
                            <span className="block text-xs text-gray-500">{m.caption}</span>
                        </span>
                    </span>
                    <span className="block mt-2.5 text-[11px] leading-snug text-gray-400">{m.example}</span>
                </button>
            );
        })}
    </div>
);

function RequestContent() {
    const router = useRouter();
    const searchParams = useSearchParams();
    const { user } = useSessionContext();
    const [type, setType] = useState<RequestType>(typeFrom(searchParams.get('type')));
    const [projectId, setProjectId] = useState(searchParams.get('project') ?? '');
    const [created, setCreated] = useState<{ type: RequestType; id: string } | null>(null);

    const pickType = (t: RequestType) => { setType(t); syncUrl(t, projectId); };
    const pickProject = (id: string) => { setProjectId(id); syncUrl(type, id); };

    if (created) {
        const isTask = created.type === 'task';
        return (
            <SubmitSuccess
                title={isTask ? 'ส่งคำขอพัฒนาเพิ่มสำเร็จ!' : 'ส่งคำขอโปรเจกต์สำเร็จ!'}
                description={isTask
                    ? `เลขที่ ${created.id} · เข้าเป็น Task ของ ${projectId} สถานะ Open (รอทีม OPS รับงาน)`
                    : `เลขที่คำขอ ${created.id} · สถานะ Open (รอพิจารณา) — ติดตามความคืบหน้าได้ที่หน้า Project Status`}
                buttonText={isTask ? 'ดู Task นี้' : 'ไปที่ Project Status'}
                onButtonClick={() => router.push(isTask ? `/ops/status/${encodeURIComponent(created.id)}` : '/ops/status')}
            />
        );
    }

    const shell = TYPES[type];
    return (
        <OpsFormShell icon={shell.icon} title={shell.shell} subtitle={shell.subtitle}>
            {/* gap, not space-y: the hidden form must not leave a margin behind */}
            <div className="flex flex-col gap-6">
                <div>
                    <p className="mb-2 text-sm font-medium text-gray-700">ต้องการยื่นคำขอแบบไหน?</p>
                    <RequestTypePicker value={type} onChange={pickType} />
                </div>

                {/* both stay mounted, so switching back and forth keeps what was typed */}
                <div hidden={type !== 'project'}>
                    <ProjectRequestForm user={user} onCreated={(id) => setCreated({ type: 'project', id })} />
                </div>
                <div hidden={type !== 'task'}>
                    <TaskRequestForm
                        user={user}
                        projectId={projectId}
                        onProjectChange={pickProject}
                        onCreated={(id) => setCreated({ type: 'task', id })}
                    />
                </div>
            </div>
        </OpsFormShell>
    );
}

export default function ProjectRequestPage() {
    return (
        <Navbar isHome={false} title="Project Request">
            <Suspense>
                <RequestContent />
            </Suspense>
        </Navbar>
    );
}
