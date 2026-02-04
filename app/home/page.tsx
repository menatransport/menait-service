'use client';
import { TriangleAlert, CheckCircle, ClipboardList, Headphones } from 'lucide-react';
import { Button } from "@/components/ui/button";
import { Navbar } from "@/components/navbar";
import { ServicesMenu, InformationMenu } from "@/components/homecontent";
import { useEffect } from 'react';

// Hoist static data outside component (rendering-hoist-jsx)
const MENU_ITEMS = [
    {
        title: "แจ้งปัญหาการใช้งาน",
        description: "แจ้งปัญหาการใช้งานระบบ อุปกรณ์ หรือโปรแกรม",
        icon: TriangleAlert,
        href: "/issue",
        color: "bg-gradient-to-br from-blue-500 to-blue-600",
        shadowColor: "shadow-blue-200",
    },
    {
        title: "คำร้องขอบริการ",
        description: "ส่งคำร้องขอบริการใหม่",
        icon: ClipboardList,
        href: "/service",
        color: "bg-gradient-to-br from-amber-500 to-amber-600",
        shadowColor: "shadow-amber-200",
    },
    {
        title: "ติดตามคำร้องและอนุมัติ",
        description: "ตรวจสอบคำร้อง และการอนุมัติ",
        icon: CheckCircle,
        href: "/mytickets",
        color: "bg-gradient-to-br from-emerald-500 to-emerald-600",
        shadowColor: "shadow-emerald-200",
    },
];

const NEWS_ITEMS = [
    {
        id: 1,
        image: "https://images.unsplash.com/photo-1550751827-4bd374c3f58b?w=400&h=200&fit=crop",
        title: "อัปเดตระบบความปลอดภัย IT ใหม่",
        excerpt: "ระบบรักษาความปลอดภัยใหม่พร้อมใช้งานแล้ว เพิ่มการป้องกันภัยคุกคามทางไซเบอร์",
        author: "IT Security Team",
        date: "7 ม.ค. 2569"
    },
    {
        id: 2,
        image: "https://images.unsplash.com/photo-1516321318423-f06f85e504b3?w=400&h=200&fit=crop",
        title: "การฝึกอบรม Microsoft 365",
        excerpt: "เปิดรับสมัครการฝึกอบรมการใช้งาน Microsoft 365 สำหรับพนักงานใหม่",
        author: "HR Department",
        date: "5 ม.ค. 2569"
    },
    {
        id: 3,
        image: "https://images.unsplash.com/photo-1563986768609-322da13575f3?w=400&h=200&fit=crop",
        title: "แจ้งปิดปรับปรุงระบบ VPN",
        excerpt: "ระบบ VPN จะปิดปรับปรุงในวันเสาร์ที่ 10 ม.ค. เวลา 22:00 - 06:00 น.",
        author: "Network Team",
        date: "3 ม.ค. 2569"
    },
    {
        id: 4,
        image: "https://images.unsplash.com/photo-1451187580459-43490279c0fa?w=400&h=200&fit=crop",
        title: "เปิดตัวแอปพลิเคชัน IT Support",
        excerpt: "แอปใหม่สำหรับแจ้งปัญหา IT ผ่านมือถือได้สะดวกยิ่งขึ้น",
        author: "IT Development",
        date: "1 ม.ค. 2569"
    }
];

export default function HomePage() {
    // Move Swal to dynamic import and only load when needed
    useEffect(() => {
        const showWelcome = sessionStorage.getItem("showWelcome");
        if (showWelcome === "true") {
            // Dynamically import Swal only when needed (bundle-conditional)
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

    // const adminItems = [
    //     {
    //         title: "Home",
    //         icon: House,
    //         href: "/home"
    //     },
    //     {
    //         title: "Tickets",
    //         icon: Ticket,
    //         href: "/tickets"
    //     },
    //     {
    //         title: "Builder",
    //         icon: Bot,
    //         href: "/builder"
    //     }
    // ]

    return (
        <Navbar isHome={true} title={''}>
            <div className="flex-1 min-h-0 bg-[#f0fafa] rounded-t-[3rem] shadow-2xl overflow-hidden">
                <main className="h-full overflow-y-auto">
                    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-8">

                        <ServicesMenu menuItems={MENU_ITEMS} />

                            <InformationMenu newsItems={NEWS_ITEMS} />


                            {/* Help Banner */}
                            <div className="mt-6 sm:mt-8 lg:mt-12 relative overflow-hidden rounded-xl sm:rounded-2xl lg:rounded-3xl bg-linear-to-r from-[#026a75] to-[#037a86] p-4 sm:p-6 lg:p-8 animate-fade-in-up stagger-8">
                                <div className="absolute inset-0 bg-[url('data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNjAiIGhlaWdodD0iNjAiIHZpZXdCb3g9IjAgMCA2MCA2MCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48ZyBmaWxsPSJub25lIiBmaWxsLXJ1bGU9ImV2ZW5vZGQiPjxnIGZpbGw9IiNmZmZmZmYiIGZpbGwtb3BhY2l0eT0iMC4wNSI+PGNpcmNsZSBjeD0iMzAiIGN5PSIzMCIgcj0iMzAiLz48L2c+PC9nPjwvc3ZnPg==')] opacity-30"></div>

                                <div className="relative flex flex-col sm:flex-row items-center gap-4 sm:gap-6">
                                    <div className="hidden sm:flex w-14 h-14 lg:w-16 lg:h-16 bg-white/20 rounded-2xl items-center justify-center animate-float">
                                        <Headphones className="w-7 h-7 lg:w-8 lg:h-8 text-white" />
                                    </div>

                                    <div className="flex-1 text-center sm:text-left">
                                        <h3 className="text-base sm:text-lg lg:text-xl font-bold text-white mb-1">
                                            ต้องการความช่วยเหลือ?
                                        </h3>
                                        <p className="text-white/80 text-xs sm:text-sm">
                                            เวลาทำการ 09:00 - 17:30 น. จันทร์ - ศุกร์
                                        </p>
                                    </div>

                                    <Button className="bg-white cursor-pointer text-[#026a75] hover:text-white font-semibold px-4 sm:px-6 py-2 sm:py-2.5 rounded-lg sm:rounded-xl text-xs sm:text-sm transition-all duration-300 hover:scale-105 shadow-lg">
                                        <Headphones className="w-3 h-3 sm:w-4 sm:h-4 mr-1 sm:mr-2" />
                                        ติดต่อ Support
                                    </Button>
                                </div>
                            </div>
                        </div>
                    </main>
                </div>
            </Navbar>
    );
}