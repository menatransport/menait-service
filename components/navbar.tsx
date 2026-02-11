'use client';

import { ArrowLeft, Bell, HomeIcon, Search, Shield, User, ChevronDown, LayoutDashboard, Building, Database, Settings, LogOut, TriangleAlert, ClipboardList, CircleCheck, MessageCircle, Phone } from "lucide-react";
import { Input } from "./ui/input";
import { Button } from "./ui/button";
import { useRouter } from 'next/navigation';
import { useEffect, useState, useMemo, useCallback } from "react";


interface NavbarProps {
    isHome?: boolean;
    title?: string;
    children?: React.ReactNode;
    pagelock?: boolean;
}

interface UserInfo {
    id: number;
    role: string;
    username: string;
    firstname: string;
    lastname: string;
    employee_id: string;
    site: string;
    department: string;
    position: string;
    position_level: string;
    position_level_id: number;
}


const COMPONENT_DEFAULT = [
    { title: 'หน้าหลัก', href: '/home', icon: HomeIcon },
    { title: 'แจ้งปัญหา', href: '/issue', icon: TriangleAlert },
    { title: 'ขอบริการ', href: '/service', icon: ClipboardList },
    { title: 'ติดตามคำขอ', href: '/mytickets', icon: CircleCheck },
    { title: 'ข่าวสารและประกาศ', href: '/inform', icon: MessageCircle },
    { title: 'ติดต่อเรา', href: '/contact', icon: Phone },
] as const;

const COMPONENT_ADMIN = [
    { title: 'แดชบอร์ด', href: '/dashboard', style: 'font-semibold text-[#026a75] bg-[#8ce4cb]/10', icon: LayoutDashboard },
    { title: 'ผู้สร้าง', href: '/builder', style: 'font-semibold text-[#026a75] bg-[#8ce4cb]/10', icon: Building },
    { title: 'ฐานข้อมูล', href: '/master', style: 'font-semibold text-[#026a75] bg-[#8ce4cb]/10', icon: Database },
] as const;


export const Navbar: React.FC<NavbarProps> = ({ children, isHome = false, title, pagelock = false }) => {
    const router = useRouter();
    const [user, setUserInfo] = useState<UserInfo | null>(null);
    const [isClient, setIsClient] = useState(false);

    useEffect(() => {
        setIsClient(true);
        const storedUserData = localStorage.getItem("user");
        if (storedUserData) {
            try {
                setUserInfo(JSON.parse(storedUserData));
            } catch {
                router.push('/login');
            }
        }
    }, []);


    const handleNavigate = useCallback((path: string) => {
        router.push(path);
    }, []);

    const handleGoHome = useCallback(() => {
        router.push('/home');
    }, [router]);

    return (
        <div className="h-screen flex flex-col overflow-hidden bg-linear-to-br from-[#026a75] via-[#037a86] to-[#025f68]">
            <div className="shrink-0">
                <header className={`relative z-20 px-4 sm:px-6 lg:px-8 ${isHome ? 'pt-2 sm:pt-6 pb-2 animate-fade-in-down' : 'pt-3 sm:pt-6 pb-3'}`}>
                    <div className={`${isHome ? 'max-w-full sm:mx-10' : 'w-full'} flex items-center ${pagelock ? 'justify-end' : 'justify-between'}`}>

                        {isHome ? (
                            <div className="flex items-center gap-2 sm:gap-3">
                                <div className="w-10 h-10 sm:w-12 sm:h-12 bg-white/20 backdrop-blur-sm rounded-xl flex items-center justify-center animate-pulse-glow">
                                    <Shield className="w-5 h-5 sm:w-6 sm:h-6 text-white" />
                                </div>
                                <span className="text-white font-bold text-base sm:text-xl">
                                    Mena IT Service
                                </span>
                            </div>
                        ) : (
                           pagelock ? null : 
                           <Button
                                onClick={handleGoHome}
                                variant="ghost"
                                className="text-white cursor-pointer hover:bg-white/20 rounded-xl h-10 w-auto px-3 sm:h-11 sm:px-4 transition-all duration-300 hover:scale-105 flex items-center gap-2"
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
                                <button className="relative p-2 sm:p-3 bg-white/10 backdrop-blur-sm rounded-xl hover:bg-white/20 transition-all duration-300 hover:scale-105">
                                    <Bell className="w-4 h-4 sm:w-5 sm:h-5 text-white" />
                                    <span className="absolute -top-1 -right-1 w-4 h-4 sm:w-5 sm:h-5 bg-rose-500 rounded-full text-[10px] sm:text-xs text-white flex items-center justify-center font-medium animate-pulse">
                                        5
                                    </span>
                                </button>
                            )}
                            {/* Hover NavigationMenu */}
                            <div className={`relative ${pagelock ? null : 'group'}`}>
                                <div className="flex items-center gap-2 sm:gap-3 p-1.5 sm:px-4 sm:py-2 bg-white/10 backdrop-blur-sm rounded-xl cursor-pointer hover:bg-white/20 transition-all duration-300 hover:scale-105">
                                    <div className="w-8 h-8 sm:w-10 sm:h-10 bg-[#8ce4cb] rounded-full flex items-center justify-center">
                                        <User className="w-4 h-4 sm:w-5 sm:h-5 text-[#026a75]" />
                                    </div>
                                    <div className="hidden sm:block">
                                        <p className="text-white font-semibold text-sm">
                                            {isClient ? user?.username : ''}
                                        </p>
                                        <p className="text-white/70 text-xs">
                                            {isClient ? user?.department : ''}
                                        </p>
                                    </div>
                                    <ChevronDown className="w-4 h-4 text-white/70 transition-transform duration-300 group-hover:rotate-180" />
                                </div>

                                {/* Dropdown Menu */}
                                <div className="absolute right-0 top-full mt-2 opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-300 transform translate-y-2 group-hover:translate-y-0 z-50">
                                    <div className="bg-white rounded-2xl shadow-2xl border border-gray-200 p-2 min-w-xl">

                                        <div className="flex gap-2 p-2">
                                            <div className="flex-1">
                                                <h3 className="text-xs font-semibold text-gray-500 mb-2 px-2">ทั่วไป</h3>
                                                <div className="grid grid-cols-3 gap-2">
                                                {COMPONENT_DEFAULT.map((item, index) => {
                                                        const IconComponent = item.icon;
                                                        return (
                                                            <button
                                                                key={index}
                                                                onClick={() => handleNavigate(item.href)}
                                                                className="flex flex-col cursor-pointer items-center gap-2 p-2 rounded-xl hover:bg-linear-to-br hover:from-[#026a75]/10 hover:to-[#8ce4cb]/10 transition-all duration-200 group/item"
                                                            >
                                                                <div className="w-10 h-10 bg-gray-100 rounded-xl flex items-center justify-center group-hover/item:bg-[#026a75] transition-colors duration-200">
                                                                    <IconComponent className="w-5 h-5 text-gray-600 group-hover/item:text-white transition-colors duration-200" />
                                                                </div>
                                                                <span className="text-[10px] text-gray-600 text-center font-medium group-hover/item:text-[#026a75] transition-colors duration-200">
                                                                    {item.title}
                                                                </span>
                                                            </button>
                                                        );
                                                    })}
                                                </div>
                                            </div>

                                            {/* Divider */}
                                            <div className="w-px bg-gray-200 my-2"></div>
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
                                                                    className={`flex cursor-pointer items-center gap-3 p-2 rounded-xl hover:bg-linear-to-br hover:from-[#026a75]/10 hover:to-[#8ce4cb]/10 transition-all duration-200 group/item ${item.style || ''}`}
                                                                >
                                                                    <div className="w-8 h-8 bg-[#8ce4cb]/20 rounded-lg flex items-center justify-center group-hover/item:bg-[#026a75] transition-colors duration-200">
                                                                        <IconComponent className="w-4 h-4 text-[#026a75] group-hover/item:text-white transition-colors duration-200" />
                                                                    </div>
                                                                    <span className="text-xs text-[#026a75] font-semibold group-hover/item:text-[#026a75] transition-colors duration-200">
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
                                            <div className="flex flex-row justify-between p-3 bg-linear-to-r from-[#026a75]/5 to-[#8ce4cb]/10 rounded-xl mb-3">
                                                <div className="flex items-center gap-3 mb-3">
                                                    <div className="w-10 h-10 bg-linear-to-br from-[#026a75] to-[#8ce4cb] rounded-full flex items-center justify-center shadow-md">
                                                        <span className="text-white p-2">
                                                            {isClient ? `${user?.firstname?.charAt(0) || ''}${user?.lastname?.charAt(0) || ''}` : ''}
                                                        </span>
                                                    </div>
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
                                                <div className="grid grid-cols-3 gap-2">
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
                                                    onClick={() => handleNavigate('/settings')}
                                                    className="group flex items-center cursor-pointer justify-center gap-2 py-3 px-4 bg-[#026a75] hover:bg-[#035f69] rounded-xl transition-all duration-300 hover:shadow-lg hover:scale-[1.02]"
                                                >
                                                    <Settings className="w-4 h-4 text-white transition-colors duration-300" />
                                                    <span className="text-sm font-medium text-white transition-colors duration-300">ตั้งค่า</span>
                                                </button>
                                                <button
                                                    onClick={() => handleNavigate('/login')}
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

                {isHome && (
                    <section className="relative z-10 px-4 sm:px-6 lg:px-8 py-4 sm:py-6 lg:py-8 animate-fade-in-up">
                        <div className="max-w-7xl mx-auto">
                            <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4 sm:gap-6">

                                <div className="animate-slide-in-left">
                                    <h1 className="text-xl sm:text-2xl md:text-3xl lg:text-4xl font-bold text-white mb-1 sm:mb-2">
                                        สวัสดี, {isClient ? user?.firstname : ''} 👋
                                    </h1>
                                    <p className="text-white/80 text-sm sm:text-base lg:text-lg">
                                        วันนี้คุณต้องการความช่วยเหลืออะไร?
                                    </p>
                                </div>

                                <div className="relative w-full lg:w-96 animate-fade-in-up">
                                    <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 sm:h-5 sm:w-5 text-gray-400 z-10" />
                                    <Input
                                        placeholder="ค้นหาบริการ..."
                                        className="w-full h-11 sm:h-12 lg:h-14 bg-white/95 backdrop-blur-sm border-0 shadow-xl hover:shadow-2xl rounded-xl sm:rounded-2xl pl-10 sm:pl-12 pr-4 text-sm sm:text-base placeholder:text-gray-400 focus-visible:ring-2 focus-visible:ring-[#8ce4cb] transition-all duration-300"
                                    />
                                </div>

                            </div>
                        </div>
                    </section>
                )}

            </div>
            {children}
        </div>
    );
}