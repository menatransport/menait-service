'use client';

import { memo, useMemo } from 'react';
import {
    User, Mail, Building, MapPin, Briefcase, Shield, IdCard,
    Hash, type LucideIcon
} from 'lucide-react';
import type { UserData } from '@/components/profile-form';
import { UserAvatar } from '@/components/ui/user-avatar';

// ── Detail item ──
const DetailItem = memo(({ label, value, icon: Icon }: { label: string; value: string; icon: LucideIcon }) => (
    <div className="group flex items-center gap-3 py-2.5 px-3.5 rounded-xl bg-gray-50 hover:bg-gray-100 border border-gray-100 hover:border-gray-200 transition-all duration-200">
        <div className="w-8 h-8 shrink-0 rounded-lg bg-linear-to-br from-[#026a75] to-[#03969a] flex items-center justify-center shadow-sm">
            <Icon className="w-4 h-4 text-white" />
        </div>
        <div className="min-w-0 flex-1">
            <p className="text-[10px] uppercase tracking-wider text-gray-400 font-semibold leading-none mb-0.5">{label}</p>
            <p className="text-sm text-gray-900 font-semibold truncate leading-snug">{value || '—'}</p>
        </div>
    </div>
));
DetailItem.displayName = 'DetailItem';

// ── Section ──
const Section = memo(({ title, icon: Icon, children }: { title: string; icon: LucideIcon; children: React.ReactNode }) => (
    <div className="flex-1 min-w-0 space-y-2">
        <div className="flex items-center gap-2 px-0.5">
            <div className="w-6 h-6 rounded-md bg-linear-to-br from-[#026a75] to-[#03969a] flex items-center justify-center">
                <Icon className="w-3 h-3 text-white" />
            </div>
            <h3 className="text-xs font-bold text-white/80 uppercase tracking-wider">{title}</h3>
        </div>
        <div className="bg-white rounded-2xl border border-gray-200 p-3 shadow-sm">
            {children}
        </div>
    </div>
));
Section.displayName = 'Section';

// ── Main component ──
export const UserContent = memo(({ user }: { user: UserData | null }) => {

    const fullName = useMemo(() => {
        if (!user) return '';
        return `${user.firstname ?? ''} ${user.lastname ?? ''}`.trim();
    }, [user]);

    const isActive = useMemo(() => user?.employee_status?.toLowerCase() === 'active', [user]);

    if (!user) return null;

    return (
        <div className="flex flex-col h-full justify-center">
            <div className="max-w-3xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-4 sm:py-6 space-y-4 sm:space-y-5">

                {/* ═══════════ HERO CARD ═══════════ */}
                <div className="relative">
                    <div className="absolute -inset-3 bg-[#8ce4cb]/8 rounded-[2rem] blur-2xl" />
                    <div className="relative rounded-2xl overflow-hidden bg-white/[0.07] backdrop-blur-xl border border-white/15 shadow-2xl shadow-black/10">
                        {/* Banner */}
                        <div className="relative h-20 sm:h-24 overflow-hidden">
                            <div className="absolute inset-0 bg-linear-to-br from-[#026a75] via-[#03969a] to-[#8ce4cb]" />
                            <div className="absolute inset-0 opacity-[0.07]"
                                style={{ backgroundImage: 'radial-gradient(circle at 1px 1px, white 1px, transparent 0)', backgroundSize: '20px 20px' }}
                            />
                            <div className="absolute -top-12 -right-12 w-36 h-36 rounded-full bg-white/10 blur-xl" />
                            <div className="absolute -bottom-8 -left-8 w-28 h-28 rounded-full bg-[#8ce4cb]/20 blur-xl" />
                            <div className="absolute bottom-2 right-3 text-white/10 text-[10px] font-bold tracking-[0.3em] uppercase select-none">MenaIT</div>
                        </div>

                        {/* Avatar + Identity */}
                        <div className="relative flex flex-col items-center -mt-10 sm:-mt-12 pb-5 px-5">
                            <div className="relative group">
                                <div className="absolute -inset-0.5 rounded-full bg-linear-to-br from-[#8ce4cb] to-[#026a75] opacity-50 blur-sm" />
                                <div className="relative w-20 h-20 sm:w-24 sm:h-24 rounded-full p-0.75 bg-linear-to-br from-[#8ce4cb] via-[#03969a] to-[#026a75] shadow-lg">
                                    <UserAvatar
                                        imageUrl={user.image_url}
                                        name={fullName}
                                        email={user.email}
                                        className="w-full h-full ring-3 ring-white/80"
                                        fallbackClassName="bg-[#f0fdfb] text-[#026a75]"
                                        textClassName="text-xl sm:text-2xl font-black"
                                    />
                                </div>
                                <span className={`absolute bottom-0.5 right-0.5 w-4 h-4 rounded-full border-2 border-white shadow-sm ${isActive ? 'bg-emerald-400' : 'bg-gray-400'}`}>
                                    {isActive && <span className="absolute inset-0 rounded-full bg-emerald-400 animate-ping opacity-40" />}
                                </span>
                            </div>

                            <h1 className="mt-3 text-xl sm:text-2xl font-extrabold text-white text-center leading-tight">{fullName}</h1>
                            <p className="mt-0.5 text-xs sm:text-sm text-white/50 font-medium">{user.position || '—'}</p>

                            <div className="mt-2.5 flex flex-wrap items-center justify-center gap-1.5">
                                {user.employee_status && (
                                    <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold border backdrop-blur-sm ${
                                        isActive
                                            ? 'bg-emerald-500/15 text-emerald-300 border-emerald-500/20'
                                            : 'bg-white/10 text-white/60 border-white/15'
                                    }`}>
                                        <span className={`w-1.5 h-1.5 rounded-full ${isActive ? 'bg-emerald-400' : 'bg-gray-400'}`} />
                                        {user.employee_status}
                                    </span>
                                )}
                                {user.department && (
                                    <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-white/10 text-white/70 border border-white/15 backdrop-blur-sm">
                                        <Building className="w-3 h-3" />
                                        {user.department}
                                    </span>
                                )}
                            </div>
                        </div>
                    </div>
                </div>

                {/* ═══════════ QUICK STATS ═══════════ */}
                <div className="grid grid-cols-3 gap-2">
                    {[
                        { icon: IdCard, label: 'รหัส', value: String(user.employee_id ?? '') },
                        { icon: MapPin, label: 'สถานที่', value: String(user.site ?? '') },
                        { icon: Shield, label: 'ระดับ', value: String(user.position_level ?? '') },
                    ].map(s => (
                        <div key={s.label} className="flex items-center gap-2 px-3 py-2 rounded-xl bg-white border border-gray-200 shadow-sm">
                            <s.icon className="w-3.5 h-3.5 text-[#026a75] shrink-0" />
                            <div className="min-w-0">
                                <p className="text-[9px] text-gray-400 font-semibold uppercase tracking-wider">{s.label}</p>
                                <p className="text-xs text-gray-900 font-semibold truncate">{s.value || '—'}</p>
                            </div>
                        </div>
                    ))}
                </div>

                {/* ═══════════ DETAILS — 2 columns on desktop ═══════════ */}
                <div className="flex flex-col sm:flex-row gap-4">
                    <Section title="ข้อมูลส่วนตัว" icon={User}>
                        <div className="grid grid-cols-1 gap-2">
                            <DetailItem label="ชื่อ" value={String(user.firstname ?? '')} icon={User} />
                            <DetailItem label="นามสกุล" value={String(user.lastname ?? '')} icon={User} />
                            <DetailItem label="อีเมล" value={String(user.email ?? '')} icon={Mail} />
                            <DetailItem label="ชื่อผู้ใช้งาน" value={String(user.username ?? '')} icon={Hash} />
                        </div>
                    </Section>

                    <Section title="ข้อมูลการทำงาน" icon={Briefcase}>
                        <div className="grid grid-cols-1 gap-2">
                            <DetailItem label="แผนก" value={String(user.department ?? '')} icon={Building} />
                            <DetailItem label="สถานที่" value={String(user.site ?? '')} icon={MapPin} />
                            <DetailItem label="ตำแหน่ง" value={String(user.position ?? '')} icon={Briefcase} />
                            <DetailItem label="ระดับตำแหน่ง" value={String(user.position_level ?? '')} icon={Shield} />
                        </div>
                    </Section>
                </div>
            </div>
        </div>
    );
});
UserContent.displayName = 'UserContent';