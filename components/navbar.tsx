'use client';

import { ArrowLeft, Bell, HomeIcon, Shield, User, ChevronDown, LayoutDashboard, Building, Database, Settings, LogOut, TriangleAlert, ClipboardList, CircleCheck, Wallet, Landmark, ClipboardCheck, BadgeCheck } from "lucide-react";
import { Button } from "./ui/button";
import { UserAvatar } from "./ui/user-avatar";
import { useRouter } from 'next/navigation';
import { useCallback, memo, useState, useRef, useEffect } from "react";
import { signOut } from "next-auth/react";
import { useSessionContext } from "@/app/context/SessionContext";
import { cn } from "@/lib/utils";


interface NavbarProps {
    isHome?: boolean;
    title?: string;
    children?: React.ReactNode;
    pagelock?: boolean;
}


const COMPONENT_DEFAULT = [
    { title: 'หน้าหลัก', href: '/home', icon: HomeIcon },
    { title: 'แจ้งปัญหา IT', href: '/issue', icon: TriangleAlert },
    { title: 'ขอบริการ IT', href: '/service', icon: ClipboardList },
    { title: 'ติดตามคำร้อง IT', href: '/mytickets/all', icon: CircleCheck },
    { title: 'เบิกเงิน Advance', href: '/finance/advance/new', icon: Wallet },
    { title: 'ติดตามคำขอ Advance', href: '/finance/advance', icon: ClipboardCheck },
    { title: 'อนุมัติเบิกเงิน Advance', href: '/finance/approvals', icon: BadgeCheck },
    // { title: 'ข่าวสารและประกาศ', href: '/inform', icon: MessageCircle },
    // { title: 'ติดต่อเรา', href: '/contact', icon: Phone },
] as const;

const COMPONENT_ADMIN = [
    { title: 'แดชบอร์ด', href: '/dashboard', style: 'font-semibold text-brand-600 bg-mint-400/10', icon: LayoutDashboard },
    { title: 'ผู้สร้าง', href: '/builder', style: 'font-semibold text-brand-600 bg-mint-400/10', icon: Building },
    { title: 'ฐานข้อมูล', href: '/master', style: 'font-semibold text-brand-600 bg-mint-400/10', icon: Database },
] as const;

const COMPONENT_FINANCE = [
    { title: 'งานเบิกเงิน Advance', href: '/finance', icon: Landmark },
] as const;

type NavbarHeaderProps = Omit<NavbarProps, 'children'> & { className?: string };

/** Top bar (logo / back button, title, user menu). Rendered by <Navbar>, or on its own inside a custom hero. */
export const NavbarHeader = memo(({ isHome = false, title, pagelock = false, className = '' }: NavbarHeaderProps) => {
    const router = useRouter();
    const { user, loading, setUser } = useSessionContext();
    const isClient = !loading;
    const [menuOpen, setMenuOpen] = useState(false);
    const menuRef = useRef<HTMLDivElement>(null);

    // Close menu when clicking outside
    useEffect(() => {
        const handleClickOutside = (e: MouseEvent | TouchEvent) => {
            if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
                setMenuOpen(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        document.addEventListener('touchstart', handleClickOutside);
        return () => {
            document.removeEventListener('mousedown', handleClickOutside);
            document.removeEventListener('touchstart', handleClickOutside);
        };
    }, []);

    const handleNavigate = useCallback((path: string) => {
        setMenuOpen(false);
        router.push(path);
    }, [router]);

    const handleGoHome = useCallback(() => {
        router.push('/home');
    }, [router]);

    const handleLogout = useCallback(async () => {
        try {
            setMenuOpen(false);
            setUser(null); // Clear JWT cookie via API
            sessionStorage.clear();
            if ('caches' in window) {
                const cacheNames = await caches.keys();
                await Promise.all(cacheNames.map(name => caches.delete(name)));
            }
            await signOut({ redirect: false });
            router.push('/login');
        } catch (error) {
            console.error('Logout error:', error);
            router.push('/login');
        }
    }, [router, setUser]);

    return (
                <header className={cn('relative z-20 px-4 sm:px-6 lg:px-8', isHome ? 'pt-2 sm:pt-6 pb-2 animate-fade-in-down' : 'pt-3 sm:pt-6 pb-3', className)}>
                    <div className={`${isHome ? 'max-w-full sm:mx-10' : 'w-full'} flex items-center ${pagelock ? 'justify-end' : 'justify-between'}`}>

                        {isHome ? (
                            <div className="flex items-center gap-3 my-3">
                                <div className="w-14 h-12 rounded-2xl flex items-center justify-center bg-white/90 shadow-soft">
                                    <img alt="MENA" className="w-16 h-8 drop-shadow-sm" src="/mena.png" />
                                </div>
                                <div className="hidden sm:flex items-center gap-2.5 font-display font-semibold tracking-wide text-white">
                                    <span className="grid grid-cols-2 gap-1" aria-hidden="true">
                                        <i className="w-2.5 h-2.5 rounded-[4px] bg-white/95" />
                                        <i className="w-2.5 h-2.5 rounded-[4px] bg-white/95" />
                                        <i className="w-2.5 h-2.5 rounded-[4px] bg-white/95" />
                                        <i className="w-2.5 h-2.5 rounded-[4px] bg-mint-400" />
                                    </span>
                                    menaIT
                                </div>
                            </div>
                        ) : (
                            pagelock ? null :
                                <Button
                                    onClick={handleGoHome}
                                    variant="ghost"
                                    className="text-white hover:text-white cursor-pointer hover:bg-white/20 rounded-xl h-10 w-auto px-3 sm:h-11 sm:px-4 transition-all duration-300 hover:scale-105 flex items-center gap-2"
                                >
                                    <ArrowLeft className="w-5 h-5" />
                                    <span className="text-sm font-medium">ย้อนกลับ</span>
                                </Button>
                        )}

                        {!isHome && title && (
                            <div className="absolute left-1/2 -translate-x-2/5 sm:-translate-x-1/2 flex items-center gap-2 sm:gap-3">
                                <span className="text-white font-bold text-xs sm:text-lg text-center block">{title}</span>
                            </div>
                        )}

                        <div className="flex items-center gap-2 sm:gap-4">

                            {isHome && (
                                <button className="hidden relative p-2 sm:p-3 bg-white/10 backdrop-blur-sm rounded-xl hover:bg-white/20 transition-all duration-300 hover:scale-105">
                                    <Bell className="w-4 h-4 sm:w-5 sm:h-5 text-white" />
                                    <span className="absolute -top-1 -right-1 w-4 h-4 sm:w-5 sm:h-5 bg-rose-500 rounded-full text-[10px] sm:text-xs text-white flex items-center justify-center font-medium animate-pulse">
                                        5
                                    </span>
                                </button>
                            )}
                            {/* NavigationMenu - click on mobile, hover on desktop */}
                            <div ref={menuRef} className={`relative ${pagelock ? '' : 'group'}`}>
                                <div
                                    onClick={() => !pagelock && setMenuOpen(prev => !prev)}
                                    className="flex items-center gap-2 sm:gap-3 p-1.5 sm:px-4 sm:py-2 bg-white/10 backdrop-blur-sm rounded-xl cursor-pointer hover:bg-white/20 transition-all duration-300 hover:scale-105"
                                >
                                    {isClient && user ? (
                                        <UserAvatar
                                            imageUrl={user.image_url}
                                            name={`${user.firstname ?? ''} ${user.lastname ?? ''}`}
                                            email={user.username}
                                            className="w-8 h-8 sm:w-10 sm:h-10 ring-2 ring-white/30"
                                            fallbackClassName="bg-mint-400 text-brand-600"
                                            textClassName="text-xs sm:text-sm font-bold"
                                        />
                                    ) : (
                                        <div className="w-8 h-8 sm:w-10 sm:h-10 bg-mint-400 rounded-full flex items-center justify-center">
                                            <User className="w-4 h-4 sm:w-5 sm:h-5 text-brand-600" />
                                        </div>
                                    )}
                                    <div className="hidden sm:block">
                                        <p className="text-white font-semibold text-sm">
                                            {isClient ? user?.username : ''}
                                        </p>
                                        <p className="text-white/70 text-xs">
                                            {isClient ? user?.department : ''}
                                        </p>
                                    </div>
                                    <ChevronDown className={`w-4 h-4 text-white/70 transition-transform duration-300 sm:group-hover:rotate-180 ${menuOpen ? 'rotate-180' : ''}`} />
                                </div>

                                {/* Dropdown Menu */}
                                <div className={`absolute right-0 top-full pt-2 transition-all duration-300 transform z-50 ${menuOpen ? 'opacity-100 visible translate-y-0' : 'opacity-0 invisible translate-y-2'} ${!menuOpen ? 'sm:group-hover:opacity-100 sm:group-hover:visible sm:group-hover:translate-y-0' : ''}`}>
                                    <div className="bg-white rounded-2xl shadow-2xl border border-gray-200 p-2 w-[calc(100vw-2rem)] sm:min-w-xl sm:w-auto max-h-[80vh] overflow-y-auto">

                                        <div className="flex flex-col sm:flex-row gap-2 p-2">
                                            <div className="flex-1">
                                                <h3 className="text-xs font-semibold text-gray-500 mb-2 px-2">ทั่วไป</h3>
                                                <div className="grid grid-cols-3 gap-2">
                                                    {COMPONENT_DEFAULT.map((item, index) => {
                                                        const IconComponent = item.icon;
                                                        return (
                                                            <button
                                                                key={index}
                                                                onClick={() => handleNavigate(item.href)}
                                                                className="flex flex-col cursor-pointer items-center gap-2 p-2 rounded-xl hover:bg-linear-to-br hover:from-brand-600/10 hover:to-mint-400/10 transition-all duration-200 group/item"
                                                            >
                                                                <div className="w-10 h-10 bg-gray-100 rounded-xl flex items-center justify-center group-hover/item:bg-brand-600 transition-colors duration-200">
                                                                    <IconComponent className="w-5 h-5 text-gray-600 group-hover/item:text-white transition-colors duration-200" />
                                                                </div>
                                                                <span className="text-[10px] text-gray-600 text-center font-medium group-hover/item:text-brand-600 transition-colors duration-200">
                                                                    {item.title}
                                                                </span>
                                                            </button>
                                                        );
                                                    })}
                                                </div>
                                            </div>

                                            {/* Divider */}
                                            <div className="h-px sm:h-auto sm:w-px bg-gray-200 mx-2 sm:mx-0 sm:my-2"></div>
                                            {isClient && user?.role === 'a' && (
                                                <div className="flex-1">
                                                    <h3 className="text-xs font-semibold text-gray-500 mb-2 px-2">ระบบจัดการ</h3>
                                                    <div className="grid grid-cols-1 gap-2">
                                                        {COMPONENT_ADMIN.map((item, index) => {
                                                            const IconComponent = item.icon;
                                                            return (
                                                                <button
                                                                    key={index}
                                                                    onClick={() => handleNavigate(item.href)}
                                                                    className={`flex cursor-pointer items-center gap-3 p-2 rounded-xl hover:bg-linear-to-br hover:from-brand-600/10 hover:to-mint-400/10 transition-all duration-200 group/item ${item.style || ''}`}
                                                                >
                                                                    <div className="w-8 h-8 bg-mint-400/20 rounded-lg flex items-center justify-center group-hover/item:bg-brand-600 transition-colors duration-200">
                                                                        <IconComponent className="w-4 h-4 text-brand-600 group-hover/item:text-white transition-colors duration-200" />
                                                                    </div>
                                                                    <span className="text-xs text-brand-600 font-semibold group-hover/item:text-brand-600 transition-colors duration-200">
                                                                        {item.title}
                                                                    </span>
                                                                </button>
                                                            );
                                                        })}
                                                    </div>
                                                </div>
                                            )}
                                            {isClient && user?.is_finance && (
                                                <div className="flex-1">
                                                    <h3 className="text-xs font-semibold text-gray-500 mb-2 px-2">ฝ่ายการเงิน</h3>
                                                    <div className="grid grid-cols-1 gap-2">
                                                        {COMPONENT_FINANCE.map((item) => {
                                                            const IconComponent = item.icon;
                                                            return (
                                                                <button
                                                                    key={item.href}
                                                                    onClick={() => handleNavigate(item.href)}
                                                                    className="flex cursor-pointer items-center gap-3 p-2 rounded-xl font-semibold bg-mint-400/10 hover:bg-linear-to-br hover:from-mint-500/15 hover:to-brand-600/10 transition-all duration-200 group/item"
                                                                >
                                                                    <div className="w-8 h-8 bg-mint-400/25 rounded-lg flex items-center justify-center group-hover/item:bg-mint-600 transition-colors duration-200">
                                                                        <IconComponent className="w-4 h-4 text-mint-700 group-hover/item:text-white transition-colors duration-200" />
                                                                    </div>
                                                                    <span className="text-xs text-mint-700 font-semibold">
                                                                        {item.title}
                                                                    </span>
                                                                </button>
                                                            );
                                                        })}
                                                    </div>
                                                </div>
                                            )}
                                        </div>

                                        {/* Bottom Dropdown Menu */}
                                        <div className="p-2 border-t border-gray-200/80">
                                            <div className="flex flex-row justify-between p-3 bg-linear-to-r from-brand-600/5 to-mint-400/10 rounded-xl mb-3">
                                                <div className="flex items-center gap-3 mb-3">
                                                    <UserAvatar
                                                        imageUrl={isClient ? user?.image_url : null}
                                                        name={isClient ? `${user?.firstname ?? ''} ${user?.lastname ?? ''}` : ''}
                                                        email={isClient ? user?.username : ''}
                                                        className="w-10 h-10 shadow-md"
                                                        fallbackClassName="bg-linear-to-br from-brand-600 to-mint-400 text-white"
                                                        textClassName="text-sm font-semibold"
                                                    />
                                                    <div className="flex-1">
                                                        <p className="text-md font-bold text-gray-800">
                                                            ID: {isClient ? user?.employee_id : ''}
                                                        </p>
                                                        <p className="text-xs text-gray-500">
                                                            {isClient ? `${user?.firstname || ''} ${user?.lastname || ''}` : ''}
                                                        </p>
                                                        <p className="text-xs text-gray-500">
                                                            {isClient ? user?.department : ''}
                                                        </p>
                                                    </div>
                                                </div>

                                                {/* Request Status Cards */}
                                                <div className="hidden grid grid-cols-3 gap-2">
                                                    <div className="flex flex-col justify-center items-center cursor-pointer group">
                                                        <span className="text-lg text-amber-400 font-bold">5</span>
                                                        <span className="text-[10px] text-gray-600 text-center leading-tight">รออนุมัติ</span>
                                                    </div>

                                                    <div className="flex flex-col justify-center items-center cursor-pointer group">
                                                        <span className="text-lg text-blue-400 font-bold">3</span>
                                                        <span className="text-[10px] text-gray-600 text-center leading-tight">รอดำเนินการ</span>
                                                    </div>

                                                    <div className="flex flex-col justify-center items-center cursor-pointer group">
                                                        <span className="text-lg text-emerald-400 font-bold">12</span>
                                                        <span className="text-[10px] text-gray-600 text-center leading-tight">เสร็จสิ้น</span>
                                                    </div>
                                                </div>
                                            </div>

                                            {/* Action Buttons */}
                                            <div className="grid grid-cols-2 gap-2">
                                                <button
                                                    onClick={() => handleNavigate('/settings/' + (isClient ? user?.employee_id : ''))}
                                                    className="group flex items-center cursor-pointer justify-center gap-2 py-3 px-4 bg-brand-600 hover:bg-brand-700 rounded-xl transition-all duration-300 hover:shadow-lg hover:scale-[1.02]"
                                                >
                                                    <Settings className="w-4 h-4 text-white transition-colors duration-300" />
                                                    <span className="text-sm font-medium text-white transition-colors duration-300">ตั้งค่า</span>
                                                </button>
                                                <button
                                                    onClick={handleLogout}
                                                    className="group flex items-center cursor-pointer justify-center gap-2 py-3 px-4 bg-rose-500 hover:bg-rose-600 rounded-xl transition-all duration-300 hover:shadow-lg hover:scale-[1.02]"
                                                >
                                                    <LogOut className="w-4 h-4 text-white transition-colors duration-300" />
                                                    <span className="text-sm font-medium text-white transition-colors duration-300">ออกจากระบบ</span>
                                                </button>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                </header>
    );
});
NavbarHeader.displayName = 'NavbarHeader';

// rerender-memo: Memoize Navbar to avoid unnecessary re-renders
export const Navbar: React.FC<NavbarProps> = memo(({ children, isHome = false, title, pagelock = false }) => (
    <div className="relative h-screen flex flex-col overflow-hidden v2-shell">
        <div aria-hidden="true" className="v2-orb w-72 h-72 sm:w-96 sm:h-96 -right-32 -top-36 sm:-right-40 sm:-top-44 opacity-90" />
        <div aria-hidden="true" className="absolute w-64 h-64 rounded-full bg-white/10 -left-24 top-40 pointer-events-none" />
        <div className="relative shrink-0 z-20">
            <NavbarHeader isHome={isHome} title={title} pagelock={pagelock} />
        </div>
        <div className="relative z-10 flex-1 min-h-0 flex flex-col">
            {children}
        </div>
    </div>
));
Navbar.displayName = 'Navbar';