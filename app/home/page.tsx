'use client';
import { TriangleAlert, ClipboardList, Search, ArrowRight, FileText, Loader2, CircleCheck } from 'lucide-react';
import { Navbar } from "@/components/navbar";
import { useEffect, useState, useCallback, useMemo, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { useSessionContext } from "@/app/context/SessionContext";
import { Input } from "@/components/ui/input";
import { Robot } from "@/components/robot";
import { WaveBackground } from "@/components/wave-background";

export default function HomePage() {
    const router = useRouter();
    const { user, loading } = useSessionContext();
    const isClient = !loading;

    // Search state
    const [searchQuery, setSearchQuery] = useState('');
    const [isSearchFocused, setIsSearchFocused] = useState(false);
    const [serviceForms, setServiceForms] = useState<{ id: string; form_code: string; form_name: string }[]>([]);
    const [isLoadingForms, setIsLoadingForms] = useState(false);
    const [formsFetched, setFormsFetched] = useState(false);
    const searchRef = useRef<HTMLDivElement>(null);

    const fetchForms = useCallback(async () => {
        if (formsFetched || isLoadingForms) return;
        setIsLoadingForms(true);
        try {
            const q = `SELECT id, form_code, form_name FROM form_masters WHERE form_type = 'Service' AND form_status = 'Active' AND is_latest = true ORDER BY created_at DESC`;
            const res = await fetch('/api/form/?query=' + encodeURIComponent(q));
            const data = await res.json();
            setServiceForms(Array.isArray(data) ? data : []);
        } catch (error) {
            console.error('Error fetching service forms:', error);
        } finally {
            setIsLoadingForms(false);
            setFormsFetched(true);
        }
    }, [formsFetched, isLoadingForms]);

    const filteredForms = useMemo(() => {
        if (!searchQuery.trim()) return serviceForms;
        const q = searchQuery.toLowerCase();
        return serviceForms.filter(
            f => f.form_name.toLowerCase().includes(q) || f.form_code.toLowerCase().includes(q)
        );
    }, [searchQuery, serviceForms]);

    useEffect(() => {
        const handleClickOutside = (e: MouseEvent) => {
            if (searchRef.current && !searchRef.current.contains(e.target as Node)) {
                setIsSearchFocused(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    const handleServiceSelect = useCallback((href: string) => {
        setSearchQuery('');
        setIsSearchFocused(false);
        router.push(href);
    }, [router]);

    const handleNavigate = useCallback((path: string) => {
        router.push(path);
    }, [router]);

    const greeting = useMemo(() => {
        const hour = new Date().getHours();
        if (hour < 12) return 'สวัสดีตอนเช้า';
        if (hour < 17) return 'สวัสดีตอนบ่าย';
        return 'สวัสดีตอนเย็น';
    }, []);

    useEffect(() => {
        const showWelcome = sessionStorage.getItem("showWelcome");
        if (showWelcome === "true") {
            import('sweetalert2').then(({ default: Swal }) => {
                Swal.fire({
                    icon: 'success',
                    title: 'ยินดีต้อนรับเข้าสู่ระบบ',
                    text: '',
                    draggable: true
                });
            });
            sessionStorage.removeItem("showWelcome");
        }
    }, []);

    return (
        <Navbar isHome={true} title={''}>
            <section className="relative z-50 px-4 sm:px-6 lg:px-8 py-6 sm:py-10 lg:py-14 animate-fade-in-up shrink-0 flex items-center justify-center min-h-[60vh] sm:min-h-0" aria-label="MenaIT Service">
                {/* Modern decorative background */}
                <div className="absolute inset-0 overflow-hidden pointer-events-none" aria-hidden="true">
                    {/* Mesh gradient blobs */}
                    <div className="absolute -top-32 -right-32 w-72 h-72 sm:w-md sm:h-112 bg-[#8ce4cb]/15 rounded-full blur-3xl animate-hero-glow" />
                    <div className="absolute -bottom-24 -left-24 w-60 h-60 sm:w-80 sm:h-80 bg-[#0ea5e9]/10 rounded-full blur-3xl animate-hero-glow" style={{ animationDelay: '2s' }} />
                    <div className="absolute top-1/4 right-1/3 w-40 h-40 sm:w-56 sm:h-56 bg-[#8b5cf6]/8 rounded-full blur-3xl animate-hero-glow" style={{ animationDelay: '4s' }} />
                    <div className="absolute bottom-1/3 left-1/4 w-32 h-32 sm:w-44 sm:h-44 bg-[#f59e0b]/6 rounded-full blur-3xl animate-hero-glow" style={{ animationDelay: '3s' }} />

                    {/* Radial gradient center glow */}
                    <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[80%] h-[60%] bg-[#8ce4cb]/5 rounded-full blur-3xl" />
                </div>

                <div className="w-full text-center flex flex-col items-center justify-center">
                    {/* System Title */}
                    <h1 className="font-[family-name:var(--font-prompt)] text-4xl sm:text-4xl md:text-5xl lg:text-6xl font-bold text-white mb-2 animate-slide-in-left motion-reduce:animate-none tracking-tight">
                        MenaIT Service
                    </h1>
                    {/* Greeting */}
                    <p className="text-white/90 text-lg sm:text-xl lg:text-2xl mb-2 font-medium">
                        {greeting}, คุณ{isClient ? user?.firstname : 'ผู้ใช้'}
                    </p>
                    <p className="text-white/60 text-sm sm:text-base lg:text-lg mb-10">
                        {isClient && user?.department ? `${user.department} • ${user.position}` : 'มีอะไรให้ช่วยไหม?'}
                    </p>

                    {/* Search Bar */}
                    <div ref={searchRef} className="relative w-full max-w-xl mx-auto mb-10 sm:mb-8 animate-scale-in motion-reduce:animate-none z-[9999]">
                        <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 sm:h-5 sm:w-5 text-gray-400 z-10" aria-hidden="true" />
                        <Input
                            placeholder="ค้นหาแบบฟอร์มบริการ..."
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            onFocus={() => { setIsSearchFocused(true); fetchForms(); }}
                            className="w-full h-12 sm:h-14 bg-white/95 backdrop-blur-sm border-0 shadow-xl hover:shadow-2xl rounded-2xl pl-12 sm:pl-12 pr-4 text-base sm:text-base placeholder:text-gray-400 focus-visible:ring-2 focus-visible:ring-[#8ce4cb] transition-all duration-200"
                            aria-label="ค้นหาแบบฟอร์มบริการ"
                            role="combobox"
                            aria-expanded={isSearchFocused}
                        />

                        {/* Search Results Dropdown */}
                        {isSearchFocused && (
                            <div className="absolute top-full left-0 right-0 mt-2 bg-white rounded-xl shadow-2xl border border-gray-100 overflow-hidden z-[9999] max-h-72 sm:max-h-80 overflow-y-auto" role="listbox">
                                <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider px-4 pt-3 pb-1">แบบฟอร์มบริการ</p>
                                {isLoadingForms ? (
                                    <div className="flex items-center justify-center gap-2 py-6">
                                        <Loader2 className="w-5 h-5 text-[#026a75] animate-spin" />
                                        <span className="text-base text-gray-400">กำลังโหลด...</span>
                                    </div>
                                ) : filteredForms.length > 0 ? (
                                    filteredForms.map((form) => (
                                        <button
                                            key={form.id}
                                            onClick={() => handleServiceSelect(`/service/${form.form_code}`)}
                                            className="w-full flex items-center gap-3 px-4 py-3 hover:bg-[#f0fafa] transition-colors duration-150 cursor-pointer group/sr"
                                            role="option"
                                        >
                                            <div className="w-10 h-10 sm:w-9 sm:h-9 bg-[#026a75]/10 rounded-lg flex items-center justify-center shrink-0">
                                                <FileText className="w-5 h-5 sm:w-4 sm:h-4 text-[#026a75]" />
                                            </div>
                                            <div className="flex-1 text-left min-w-0">
                                                <p className="text-sm sm:text-sm font-medium text-gray-800 group-hover/sr:text-[#026a75] transition-colors duration-150 truncate">{form.form_name}</p>
                                                <p className="text-xs sm:text-[11px] text-gray-400">{form.form_code}</p>
                                            </div>
                                            <ArrowRight className="w-5 h-5 sm:w-4 sm:h-4 text-gray-300 group-hover/sr:text-[#026a75] group-hover/sr:translate-x-1 transition-all duration-150 shrink-0" />
                                        </button>
                                    ))
                                ) : (
                                    <div className="px-4 py-6 text-center text-base text-gray-400">
                                        ไม่พบแบบฟอร์มที่ค้นหา
                                    </div>
                                )}
                            </div>
                        )}
                    </div>

                    <div className="flex flex-wrap justify-center gap-3 sm:gap-3 w-full">
                        {[
                            { label: 'แจ้งปัญหา', href: '/issue', icon: TriangleAlert },
                            { label: 'ขอบริการ', href: '/service', icon: ClipboardList },
                            { label: 'ติดตามคำขอ', href: '/mytickets/all', icon: CircleCheck },
                        ].map((item) => {
                            const Icon = item.icon;
                            return (
                                <button
                                    key={item.href}
                                    onClick={() => handleNavigate(item.href)}
                                    className="flex items-center gap-2 sm:gap-2 px-4 sm:px-4 py-2.5 sm:py-2.5 bg-white/10 hover:bg-white/20 backdrop-blur-sm rounded-full text-white text-sm sm:text-sm font-medium transition-all duration-200 hover:scale-105 active:scale-95 cursor-pointer"
                                >
                                    <Icon className="w-4 h-4 sm:w-3.5 sm:h-3.5" />
                                    {item.label}
                                </button>
                            );
                        })}
                    </div>

                    
                </div>
            </section>
                    
             {/* Robot Assistant Section */}
            <section className="flex justify-center z-40 animate-fade-in-up" aria-label="Robot Assistant">
                <Robot greeting={"สวัสดี"} />
            </section>
            <WaveBackground />
        </Navbar>
    );
}