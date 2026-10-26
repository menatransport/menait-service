'use client';
import React, { memo, useCallback, useEffect, useMemo, useState } from 'react';
import { Users, Building2, Layers, ChevronDown, ChevronRight, MapPin, Briefcase } from 'lucide-react';
import { Navbar } from '@/components/navbar';
import { WaveBackground } from '@/components/wave-background';
import { TableSkeleton } from '@/components/ui/loading';
import { UserAvatar } from '@/components/ui/user-avatar';
import { useSessionContext } from '@/app/context/SessionContext';
import { parseLevelNum } from '@/app/master/constants';
import { TableWrapper, TableHeader, TableHead, UserEmptyState, ErrorState, ManagerTag } from '@/app/master/shared-components';
import { groupWithManagers, managersByDivision, type ManagedDivision } from '@/app/master/division-managers';
import type { UserData, LookupOption, ColumnConfig } from '@/app/master/types';
import { listPaths } from './directory';

const COLUMNS: ColumnConfig[] = [
    { key: 'employee_id', label: 'รหัสพนักงาน' },
    { key: 'name', label: 'ชื่อ-นามสกุล' },
    { key: 'department', label: 'แผนก' },
    { key: 'position', label: 'ตำแหน่ง' },
    { key: 'position_level', label: 'ระดับ' },
    { key: 'site', label: 'สาขา' },
];

const fullName = (u: UserData) => `${u.firstname ?? ''} ${u.lastname ?? ''}`.trim();

export default function OrganizationPage() {
    return (
        <Navbar isHome={false} title="ข้อมูลพนักงาน">
            <main className="flex-1 min-h-0 bg-brand-600 rounded-t-[1.5rem] sm:rounded-t-[2rem] lg:rounded-t-[3rem] shadow-2xl overflow-y-auto relative">
                <WaveBackground />
                <div className="w-full max-w-screen-2xl mx-auto px-3 py-6 sm:px-6 lg:px-10 sm:py-8 relative z-10">
                    <Directory />
                </div>
            </main>
        </Navbar>
    );
}

/** Read-only staff directory: /master's ฝ่าย → แผนก view; each ฝ่าย lists its ผู้จัดการฝ่าย first */
function Directory() {
    const { user: me } = useSessionContext();
    const [users, setUsers] = useState<UserData[]>([]);
    const [deptOptions, setDeptOptions] = useState<LookupOption[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [search, setSearch] = useState('');
    const [pathId, setPathId] = useState<number | null>(null);
    const [collapsed, setCollapsed] = useState<Set<string>>(new Set());

    const load = useCallback(async () => {
        setLoading(true);
        setError(null);
        try {
            const [uRes, dRes] = await Promise.all([
                fetch('/api/organization/user'),
                fetch('/api/organization/departments'),
            ]);
            const u = await uRes.json();
            if (!uRes.ok) throw new Error(u?.error || 'users failed');
            const d = dRes.ok ? await dRes.json() : [];
            setUsers(Array.isArray(u) ? u : []);
            setDeptOptions(Array.isArray(d) ? d : []);
        } catch (err) {
            console.error('Organization directory load error:', err);
            setError('ไม่สามารถโหลดข้อมูลพนักงานได้');
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => { load(); }, [load]);

    // แผนก names in Thai come from the lookup — the user row only carries the English name
    const deptLabels = useMemo(() => new Map(deptOptions.map(d => [d.option_value, d.option_label])), [deptOptions]);
    const deptName = useCallback(
        (u: UserData) => deptLabels.get(u.department_id == null ? '' : String(u.department_id)) || u.department || '-',
        [deptLabels]
    );
    const paths = useMemo(() => listPaths(users), [users]);
    const managers = useMemo(() => managersByDivision(users, deptLabels), [users, deptLabels]);
    const inPath = useMemo(() => (pathId == null ? users : users.filter(u => u.path?.path_id === pathId)), [users, pathId]);
    const { groups: divisions, totalFiltered, departmentCount } = useMemo(
        () => groupWithManagers(inPath, search, deptLabels, managers),
        [inPath, search, deptLabels, managers]
    );

    // While searching, show every match instead of hiding hits inside collapsed groups
    const searching = search.trim() !== '';
    const isOpen = useCallback((key: string) => searching || !collapsed.has(key), [searching, collapsed]);
    const toggle = useCallback((key: string) => {
        setCollapsed(prev => {
            const next = new Set(prev);
            if (next.has(key)) next.delete(key);
            else next.add(key);
            return next;
        });
    }, []);

    if (error) return <ErrorState message={error} onRetry={load} />;

    return (
        <TableWrapper>
            <TableHeader
                icon={<Users className="w-5 h-5" />}
                title="ข้อมูลพนักงาน"
                subtitle={`${divisions.length} ฝ่าย · ${departmentCount} แผนก · ${totalFiltered.toLocaleString()} คน`}
                actions={paths.length > 0 ? (
                    <select
                        value={pathId ?? ''}
                        onChange={e => setPathId(e.target.value ? Number(e.target.value) : null)}
                        aria-label="สายงาน"
                        className="h-9 pl-3 pr-8 rounded-xl bg-white/15 border border-white/30 text-sm text-white outline-none cursor-pointer focus:bg-white/25 [&>option]:text-gray-800"
                    >
                        <option value="">ทุกสายงาน</option>
                        {paths.map(p => <option key={p.path_id} value={p.path_id}>{p.path_th} ({p.count})</option>)}
                    </select>
                ) : undefined}
                searchValue={search}
                onSearchChange={e => setSearch(e.target.value)}
                onSearchClear={() => setSearch('')}
                searchPlaceholder="ค้นหาชื่อ, รหัส, ตำแหน่ง, ฝ่าย, แผนก, สาขา..."
            />

            {!loading && divisions.length > 0 && (
                <div className="px-4 sm:px-6 py-2.5 border-b border-gray-100 flex items-center justify-between bg-gray-50/50">
                    <p className="text-[11px] text-gray-400">
                        จัดกลุ่มตามฝ่าย → แผนก · ผู้จัดการฝ่ายอยู่ลำดับแรกของแต่ละฝ่าย
                    </p>
                    <div className="flex items-center gap-1.5">
                        <button onClick={() => setCollapsed(new Set())} className="text-[11px] text-brand-600 hover:underline cursor-pointer px-1.5 py-0.5">
                            ขยายทั้งหมด
                        </button>
                        <span className="text-gray-300">|</span>
                        <button onClick={() => setCollapsed(new Set(divisions.map(d => d.key)))} className="text-[11px] text-brand-600 hover:underline cursor-pointer px-1.5 py-0.5">
                            ย่อทั้งหมด
                        </button>
                    </div>
                </div>
            )}

            {loading ? (
                <div className="p-4"><TableSkeleton rows={8} /></div>
            ) : divisions.length === 0 ? (
                <UserEmptyState />
            ) : (
                <>
                    {/* Desktop table */}
                    <div className="hidden lg:block overflow-x-auto">
                        <table className="w-full">
                            <TableHead columns={COLUMNS} />
                            <tbody>
                                {divisions.map(division => {
                                    const open = isOpen(division.key);
                                    return (
                                        <React.Fragment key={division.key}>
                                            <DivisionHeaderRow division={division} open={open} onToggle={() => toggle(division.key)} />
                                            {open && division.managers.map(u => (
                                                <PersonRow key={u.id} person={u} dept={deptName(u)} manager me={u.id === me?.id} />
                                            ))}
                                            {open && division.departments.map(dept => {
                                                const deptOpen = isOpen(dept.key);
                                                return (
                                                    <React.Fragment key={dept.key}>
                                                        <DepartmentHeaderRow name={dept.department} nameEn={dept.departmentEn} count={dept.users.length} open={deptOpen} onToggle={() => toggle(dept.key)} />
                                                        {deptOpen && dept.users.map(u => (
                                                            <PersonRow key={u.id} person={u} dept={dept.department} nested me={u.id === me?.id} />
                                                        ))}
                                                    </React.Fragment>
                                                );
                                            })}
                                        </React.Fragment>
                                    );
                                })}
                            </tbody>
                        </table>
                    </div>

                    {/* Mobile cards */}
                    <div className="lg:hidden p-3 space-y-2.5">
                        {divisions.map(division => (
                            <MobileDivision
                                key={division.key}
                                division={division}
                                isOpen={isOpen}
                                onToggle={toggle}
                                deptName={deptName}
                                meId={me?.id ?? null}
                            />
                        ))}
                    </div>
                </>
            )}
        </TableWrapper>
    );
}

/* ───────────── rows (same look as /master) ───────────── */

const Chevron = ({ open, className = '' }: { open: boolean; className?: string }) => open
    ? <ChevronDown className={`w-4 h-4 shrink-0 ${className}`} />
    : <ChevronRight className={`w-4 h-4 shrink-0 ${className}`} />;

const CountChip = ({ children, strong }: { children: React.ReactNode; strong?: boolean }) => (
    <span className={`text-[11px] font-medium px-2 py-0.5 rounded-full shrink-0 ${strong ? 'bg-brand-600 text-white' : 'bg-brand-600/10 text-brand-600'}`}>
        {children}
    </span>
);

const MeTag = () => (
    <span className="text-[10px] font-medium px-1.5 py-px rounded bg-gray-100 text-gray-500 shrink-0">คุณ</span>
);

const divisionCount = (d: ManagedDivision) =>
    d.departments.length > 1 ? `${d.departments.length} แผนก · ${d.total} คน` : `${d.total} คน`;

const DivisionHeaderRow = memo(({ division, open, onToggle }: { division: ManagedDivision; open: boolean; onToggle: () => void }) => (
    <tr className="bg-brand-600/10 border-t border-brand-600/15 cursor-pointer hover:bg-brand-600/15 transition-colors select-none" onClick={onToggle}>
        <td colSpan={COLUMNS.length} className="px-4 py-3">
            <div className="flex items-center gap-2.5">
                <Chevron open={open} className="text-brand-700" />
                <span className="w-7 h-7 rounded-lg bg-brand-600 text-white flex items-center justify-center shrink-0">
                    <Building2 className="w-4 h-4" />
                </span>
                <span className="text-sm font-bold text-brand-800">{division.division}</span>
                {division.code && (
                    <span className="font-mono text-[10px] font-bold text-brand-700 border border-brand-600/30 px-1.5 py-0.5 rounded">{division.code}</span>
                )}
                {division.divisionEn && division.divisionEn !== division.division && (
                    <span className="text-xs text-brand-700/50 truncate">{division.divisionEn}</span>
                )}
                {/* ผู้จัดการฝ่าย stays visible when the ฝ่าย is collapsed */}
                {!open && division.managers.length > 0 && (
                    <span className="text-xs text-gray-500 truncate">
                        · ผู้จัดการฝ่าย: <span className="text-gray-700 font-medium">{division.managers.map(fullName).join(', ')}</span>
                    </span>
                )}
                <span className="ml-auto"><CountChip strong>{divisionCount(division)}</CountChip></span>
            </div>
        </td>
    </tr>
));
DivisionHeaderRow.displayName = 'DivisionHeaderRow';

const DepartmentHeaderRow = memo(({ name, nameEn, count, open, onToggle }: { name: string; nameEn: string; count: number; open: boolean; onToggle: () => void }) => (
    <tr className="bg-brand-600/[0.03] border-t border-gray-100 cursor-pointer hover:bg-brand-600/[0.07] transition-colors select-none" onClick={onToggle}>
        <td colSpan={COLUMNS.length} className="py-2 pl-11 pr-4">
            <div className="flex items-center gap-2 border-l-2 border-brand-600/30 pl-3">
                <Chevron open={open} className="text-brand-600/70" />
                <Layers className="w-3.5 h-3.5 text-brand-600/70 shrink-0" />
                <span className="text-sm font-semibold text-gray-700">{name}</span>
                {nameEn && nameEn !== name && <span className="text-[11px] text-gray-400 truncate">{nameEn}</span>}
                <CountChip>{count} คน</CountChip>
            </div>
        </td>
    </tr>
));
DepartmentHeaderRow.displayName = 'DepartmentHeaderRow';

const LevelBadge = ({ level }: { level: string }) => level ? (
    <span className="inline-flex items-center gap-1.5 h-6 px-2 text-xs font-medium rounded-md bg-brand-600/10 text-brand-600">
        <span className="font-bold">Lv.{parseLevelNum(level)}</span>
        <span className="text-brand-600/60">{level}</span>
    </span>
) : <span className="text-sm text-gray-400">-</span>;

const PersonRow = memo(({ person, dept, manager, nested, me }: { person: UserData; dept: string; manager?: boolean; nested?: boolean; me?: boolean }) => (
    <tr className={`transition-colors hover:bg-gray-50/80 ${manager ? 'bg-brand-600/[0.04]' : 'even:bg-gray-50/40'}`}>
        <td className={`whitespace-nowrap px-4 py-2.5 ${nested ? 'pl-[4.5rem]' : 'pl-11'}`}>
            <span className="font-mono text-xs font-semibold text-brand-600">{person.employee_id}</span>
        </td>
        <td className="whitespace-nowrap px-4 py-2.5">
            <div className="flex items-center gap-2.5">
                <UserAvatar
                    imageUrl={person.image_url}
                    name={fullName(person)}
                    email={person.email}
                    className="w-7 h-7"
                    rounded="rounded-lg"
                    fallbackClassName="bg-brand-600/10 text-brand-600"
                    textClassName="text-[10px] font-bold"
                />
                <div className="min-w-0">
                    <p className="flex items-center gap-1.5 text-sm font-medium text-gray-800">
                        <span className="truncate">{fullName(person)}</span>
                        {manager && <ManagerTag />}
                        {me && <MeTag />}
                    </p>
                    <p className="text-[11px] text-gray-400 truncate">{person.email}</p>
                </div>
            </div>
        </td>
        <td className="max-w-48 px-4 py-2.5 text-sm text-gray-600 truncate" title={dept}>{dept}</td>
        <td className="max-w-56 px-4 py-2.5 text-sm text-gray-600 truncate" title={person.position ?? undefined}>{person.position || '-'}</td>
        <td className="whitespace-nowrap px-4 py-2.5"><LevelBadge level={person.position_level} /></td>
        <td className="whitespace-nowrap px-4 py-2.5 text-sm text-gray-600">{person.site || '-'}</td>
    </tr>
));
PersonRow.displayName = 'PersonRow';

/* ───────────── mobile ───────────── */

const PersonCard = memo(({ person, dept, manager, me }: { person: UserData; dept?: string; manager?: boolean; me?: boolean }) => (
    <div className={`bg-white border rounded-xl p-3.5 space-y-2 ${manager ? 'border-brand-600/30' : 'border-gray-100'}`}>
        <div className="flex items-center gap-2.5">
            <UserAvatar
                imageUrl={person.image_url}
                name={fullName(person)}
                email={person.email}
                className="w-8 h-8"
                rounded="rounded-lg"
                fallbackClassName="bg-brand-600/10 text-brand-600"
                textClassName="text-[10px] font-bold"
            />
            <div className="flex-1 min-w-0">
                <p className="flex items-center gap-1.5 text-sm font-semibold text-gray-800">
                    <span className="truncate">{fullName(person)}</span>
                    {me && <MeTag />}
                </p>
                <p className="text-[11px] text-gray-400 font-mono">{person.employee_id}</p>
            </div>
            {manager && <ManagerTag />}
        </div>
        <div className="grid grid-cols-2 gap-1.5 text-xs text-gray-500">
            <div className="flex items-center gap-1.5 col-span-2">
                <Briefcase className="w-3 h-3 text-gray-400 shrink-0" />
                <span className="truncate">{person.position || '-'}</span>
            </div>
            <div className="flex items-center gap-1.5">
                <MapPin className="w-3 h-3 text-gray-400 shrink-0" />
                <span className="truncate">{person.site || '-'}</span>
            </div>
            {dept && (
                <div className="flex items-center gap-1.5">
                    <Layers className="w-3 h-3 text-gray-400 shrink-0" />
                    <span className="truncate">{dept}</span>
                </div>
            )}
        </div>
    </div>
));
PersonCard.displayName = 'PersonCard';

const MobileDivision = memo(({ division, isOpen, onToggle, deptName, meId }: {
    division: ManagedDivision;
    isOpen: (key: string) => boolean;
    onToggle: (key: string) => void;
    deptName: (u: UserData) => string;
    meId: number | null;
}) => {
    const open = isOpen(division.key);
    return (
        <div className="border border-brand-600/15 rounded-xl overflow-hidden">
            <button onClick={() => onToggle(division.key)} className="w-full flex items-center gap-2.5 px-3.5 py-3 bg-brand-600/10 hover:bg-brand-600/15 transition-colors">
                <Chevron open={open} className="text-brand-700" />
                <span className="w-7 h-7 rounded-lg bg-brand-600 text-white flex items-center justify-center shrink-0">
                    <Building2 className="w-4 h-4" />
                </span>
                <span className="flex-1 min-w-0 text-left">
                    <span className="block text-sm font-bold text-brand-800 truncate">{division.division}</span>
                    {!open && division.managers.length > 0 ? (
                        <span className="block text-[11px] text-gray-500 truncate">ผู้จัดการฝ่าย: {division.managers.map(fullName).join(', ')}</span>
                    ) : division.code ? (
                        <span className="block font-mono text-[10px] text-brand-700/60">{division.code}</span>
                    ) : null}
                </span>
                <CountChip strong>{divisionCount(division)}</CountChip>
            </button>
            {open && (
                <div className="bg-gray-50/50">
                    {division.managers.length > 0 && (
                        <div className="p-2.5 space-y-2">
                            {division.managers.map(u => <PersonCard key={u.id} person={u} dept={deptName(u)} manager me={u.id === meId} />)}
                        </div>
                    )}
                    <div className="divide-y divide-gray-100">
                        {division.departments.map(dept => {
                            const deptOpen = isOpen(dept.key);
                            return (
                                <div key={dept.key}>
                                    <button onClick={() => onToggle(dept.key)} className="w-full flex items-center gap-2 pl-5 pr-3.5 py-2.5 hover:bg-brand-600/5 transition-colors">
                                        <Chevron open={deptOpen} className="text-brand-600/70" />
                                        <Layers className="w-3.5 h-3.5 text-brand-600/70 shrink-0" />
                                        <span className="text-sm font-semibold text-gray-700 flex-1 text-left truncate">{dept.department}</span>
                                        <CountChip>{dept.users.length} คน</CountChip>
                                    </button>
                                    {deptOpen && (
                                        <div className="pl-5 pr-2.5 pb-2.5 space-y-2">
                                            {dept.users.map(u => <PersonCard key={u.id} person={u} me={u.id === meId} />)}
                                        </div>
                                    )}
                                </div>
                            );
                        })}
                    </div>
                </div>
            )}
        </div>
    );
});
MobileDivision.displayName = 'MobileDivision';
