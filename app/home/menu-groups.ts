import {
    TriangleAlert, ClipboardList, CircleCheck, FolderKanban, Wallet,
    LayoutDashboard, Building, Database, Monitor, Truck, ShieldCheck, Route,
    Calculator, Mail, Laptop,ChartNoAxesCombined,CircleAlert, HandCoins, ClipboardCheck, BadgeCheck, Landmark, type LucideIcon,
} from 'lucide-react';

export type MenuTone = 'blue' | 'sun' | 'mint' | 'ink';

export interface MenuItem {
    title: string;
    description: string;
    icon: LucideIcon;
    /**
     * Internal route or external URL (http… opens in a new tab).
     * Omit it, and give no children, to render the item as "เร็ว ๆ นี้".
     */
    href?: string;
    /** Sub-items — the item becomes a group (accordion on desktop, bottom sheet on mobile) */
    children?: MenuItem[];
    /** Only shown to finance staff (user.is_finance) */
    financeOnly?: boolean;
}

/** An item with a link or with sub-items can be opened; anything else is "เร็ว ๆ นี้". */
export const isMenuItemReady = (item: MenuItem) => Boolean(item.href || item.children?.length);

export interface MenuGroup {
    id: string;
    label: string;
    caption: string;
    /** Short line under the group title on the desktop column cards */
    tagline: string;
    icon: LucideIcon;
    tone: MenuTone;
    items: MenuItem[];
    /** Only shown to admins (user.role === 'a') */
    adminOnly?: boolean;
    /** Usable only by admins and finance staff (canUseFinance); everyone else sees every item as "เร็ว ๆ นี้" */
    financeAccess?: boolean;
}

/**
 * Landing-page menu. Add a group or an item here — the Home page renders it
 * automatically (desktop columns + mobile launcher).
 */
export const MENU_GROUPS: MenuGroup[] = [
    {
        id: 'it',
        label: 'Service IT',
        caption: 'แจ้งปัญหา ขอบริการ และติดตามคำร้องด้าน IT',
        tagline: 'บริการด้าน IT',
        icon: Monitor,
        tone: 'blue',
        items: [
            { title: 'แจ้งปัญหา', description: 'อุปกรณ์ ระบบ หรือเครือข่ายมีปัญหา', icon: TriangleAlert, href: '/issue' },
            { title: 'ขอบริการ', description: 'ขอสิทธิ์ ขออุปกรณ์ หรือบริการ IT', icon: ClipboardList, href: '/service' },
            { title: 'ติดตามคำร้อง', description: 'ดูสถานะคำร้องทั้งหมดของคุณ', icon: CircleCheck, href: '/mytickets/all' },
            {
                title: 'ทบทวนสิทธิ์',
                description: 'ตรวจสอบและยืนยันสิทธิ์การใช้งานระบบ',
                icon: ShieldCheck,
                children: [
                    { title: 'ทบทวนสิทธิ์ ATMS', description: 'สิทธิ์บัญชีผู้ใช้งานระบบ ATMS', icon: Route },
                    { title: 'ทบทวนสิทธิ์ Winspeed', description: 'สิทธิ์ผู้ใช้งานระบบบัญชี Winspeed', icon: Calculator },
                    { title: 'ทบทวนสิทธิ์ Group Mail', description: 'สมาชิกและสิทธิ์ของ Group Mail', icon: Mail },
                ],
            },
            { title: 'ทรัพย์สินของฉัน', description: 'ดูอุปกรณ์ IT ที่คุณถือครองอยู่', icon: Laptop },
        ],
    },
   {
    id: 'ops',
    label: 'Service OPS',
    caption: 'คำขอและโปรเจกต์สำหรับสนับสนุนการปฏิบัติการ',
    tagline: 'Operation Support',
    icon: Truck,
    tone: 'sun',
    items: [
    {
        title: 'Project Request',
        description: 'ยื่นคำขอสำหรับโปรเจกต์ใหม่',
        icon: FolderKanban,
        href: '/ops/request'
    },
    {
        title: 'Project Issue',
        description: 'แจ้งปัญหาโปรเจกต์',
        icon: CircleAlert,
        href: '/ops/issue'
    },
    {
        title: 'Project Status',
        description: 'ติดตามสถานะและความคืบหน้าของโปรเจกต์',
        icon: ChartNoAxesCombined,
        href: '/ops/status'
    },
    ],
    },
    {
        id: 'finance',
        label: 'Service Finance',
        caption: 'บริการด้านการเงินและบัญชี',
        tagline: 'การเงินและบัญชี',
        icon: Wallet,
        tone: 'mint',
        financeAccess: true,
        items: [
            { title: 'เบิกเงิน Advance', description: 'ขอเบิกเงินทดรองจ่ายล่วงหน้า', icon: HandCoins, href: '/finance/advance/new' },
            { title: 'ติดตามคำขอ Advance', description: 'ดูสถานะ จ่ายเงิน และเคลียร์เงินทดรอง', icon: ClipboardCheck, href: '/finance/advance' },
            { title: 'อนุมัติเบิกเงิน Advance', description: 'คำขอเบิกเงินที่รอคุณอนุมัติ', icon: BadgeCheck, href: '/finance/approvals' },
            { title: 'งานเบิกเงิน Advance', description: 'ตั้งเบิก จ่ายเงิน และตรวจเคลียร์ (ฝ่ายการเงิน)', icon: Landmark, href: '/finance', financeOnly: true },
        ],
    },
    {
        id: 'admin',
        label: 'ระบบจัดการ',
        caption: 'สำหรับผู้ดูแลระบบ',
        tagline: 'ผู้ดูแลระบบ',
        icon: LayoutDashboard,
        tone: 'ink',
        adminOnly: true,
        items: [
            { title: 'แดชบอร์ด', description: 'ภาพรวมคำร้องและสถิติ', icon: LayoutDashboard, href: '/dashboard' },
            { title: 'ผู้สร้างฟอร์ม', description: 'สร้างและแก้ไขแบบฟอร์ม', icon: Building, href: '/builder' },
            { title: 'ฐานข้อมูล', description: 'ผู้ใช้ ฝ่าย ตำแหน่ง และสถานที่', icon: Database, href: '/master' },
        ],
    },
];

/**
 * Quick-action chips under the Home search (desktop). Omit href = not available yet.
 * Images: Microsoft Fluent Emoji 3D (MIT), stored in /public/icons3d.
 */
export const QUICK_LINKS: { label: string; image: string; href?: string }[] = [
    { label: 'แจ้งปัญหา', image: '/icons3d/report-issue.png', href: '/issue' },
    { label: 'ขอบริการ', image: '/icons3d/request-service.png', href: '/service' },
    { label: 'ติดตามคำร้องล่าสุด', image: '/icons3d/track-ticket.png', href: '/mytickets/all' },
    { label: 'เปิดโปรเจกต์ OPS', image: '/icons3d/ops-project.png', href: '/ops/request' },
];
