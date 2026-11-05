import { BadgeCheck, Building, Calculator, ChartNoAxesCombined, CircleAlert, CircleCheck, ClipboardCheck, ClipboardList, Database, FolderKanban, HandCoins, Landmark, Laptop, LayoutDashboard, Mail, Monitor, Receipt, Route, Settings2, ShieldCheck, TriangleAlert, Truck, UserCheck, Wallet, type LucideIcon } from 'lucide-react';

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
    /** คำหลังตัวเลขบนป้ายจำนวนเมนูย่อย เช่น "3 ระบบ" (ไม่ใส่ = "เมนู") */
    countLabel?: string;
    /** Only shown to finance staff (user.is_finance) */
    financeOnly?: boolean;
    /** หัวข้อย่อยในกลุ่ม — รายการติดกันที่มี section เดียวกันจะอยู่ใต้หัวข้อเดียวกัน (เช่น Advance / เงินสดย่อย) */
    section?: string;
}

/** หัวข้อย่อยที่ต้องพิมพ์ก่อนรายการที่ index นี้ — มีเมื่อ section ต่างจากรายการก่อนหน้า */
export function sectionHeadingAt(items: readonly MenuItem[], index: number): string | null {
    const section = items[index]?.section;
    if (!section) return null;
    return items[index - 1]?.section === section ? null : section;
}

/**
 * Link filter for /home?group=<id> (e.g. /home?group=finance shows only Finance Service).
 * Picks from the groups this user can already see, so a link can't open a hidden group.
 * No param or an unknown id → null = show every group.
 */
export function focusGroup(groups: readonly MenuGroup[], id: string | null | undefined): MenuGroup | null {
    const key = id?.trim().toLowerCase();
    if (!key) return null;
    return groups.find(g => g.id === key) ?? null;
}

/** An item with a link or with sub-items can be opened; anything else is "เร็ว ๆ นี้". */
export const isMenuItemReady = (item: MenuItem) => Boolean(item.href || item.children?.length);

/**
 * ตัดรายการที่คนนี้ไม่มีสิทธิ์เห็น (financeOnly) ทั้งชั้นบนและในเมนูย่อย
 * กลุ่มที่เมนูย่อยถูกตัดจนหมดจะหายไปทั้งกลุ่ม — คนทั่วไปเห็นเงินสดย่อย 4 เมนู บัญชี/การเงินเห็น 7
 */
export function visibleItems(items: readonly MenuItem[], canSeeFinance: boolean): MenuItem[] {
    const out: MenuItem[] = [];
    for (const item of items) {
        if (item.financeOnly && !canSeeFinance) continue;
        if (!item.children) { out.push(item); continue; }
        const children = visibleItems(item.children, canSeeFinance);
        if (children.length) out.push({ ...item, children });
    }
    return out;
}

export interface MenuGroup {
    id: string;
    label: string;
    caption: string;
    /** Short line under the group title on the desktop column cards */
    tagline: string;
    icon: LucideIcon;
    tone: MenuTone;
    items: MenuItem[];
    /** User manual for the group — shown as a book icon at the top right of the group card (http… opens in a new tab) */
    guide?: { label: string; href: string };
    /** Only shown to admins (user.role === 'a') */
    adminOnly?: boolean;
}

const ADVANCE = 'เงินทดรองจ่าย (Advance)';
const PETTY = 'เงินสดย่อย (Petty Cash)';

/**
 * Landing-page menu. Add a group or an item here — the Home page renders it
 * automatically (desktop columns + mobile launcher).
 */
export const MENU_GROUPS: MenuGroup[] = [
    {
        id: 'it',
        label: 'IT Service',
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
                countLabel: 'ระบบ',
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
    label: 'OPS Service',
    caption: 'คำขอและโปรเจกต์สำหรับสนับสนุนการปฏิบัติการ',
    tagline: 'Operation Support',
    icon: Truck,
    tone: 'sun',
    guide: { label: 'คู่มือ OPS Service', href: 'https://youtu.be/gQj8sJK5nlg' },
    items: [
    {
        title: 'Project Request',
        description: 'ยื่นคำขอโปรเจกต์ใหม่ หรือคำร้องทั่วไป/พัฒนาเพิ่มบนโปรเจกต์เดิม',
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
        label: 'Finance Service',
        caption: 'บริการด้านการเงินและบัญชี',
        tagline: 'การเงินและบัญชี',
        icon: Wallet,
        tone: 'mint',
        // 2 กลุ่มย่อยพับไว้ก่อน (autohide) กดชื่อกลุ่มค่อยกาง เปิดได้ทีละกลุ่ม (ผู้ใช้สั่ง 5/11/2026) — เดิมเป็นรายการยาว 11 แถวคั่นด้วยหัวข้อ
        items: [
            {
                title: ADVANCE, description: 'เบิก ติดตาม อนุมัติ และงานการเงินของเงินทดรองจ่าย', icon: HandCoins,
                children: [
                    { title: 'เบิกเงิน Advance', description: 'ขอเบิกเงินทดรองจ่ายล่วงหน้า', icon: HandCoins, href: '/finance/advance/new' },
                    { title: 'ติดตามคำขอ Advance', description: 'ดูสถานะ จ่ายเงิน และเคลียร์เงินทดรอง', icon: ClipboardCheck, href: '/finance/advance' },
                    { title: 'อนุมัติเบิกเงิน Advance', description: 'คำขอเบิกเงินที่รอคุณอนุมัติ', icon: BadgeCheck, href: '/finance/approvals' },
                    { title: 'งานเบิกเงิน Advance', description: 'ตั้งเบิก จ่ายเงิน และตรวจเคลียร์ (ฝ่ายการเงิน)', icon: Landmark, href: '/finance', financeOnly: true },
                ],
            },
            {
                title: PETTY, description: 'เปิดใบ อนุมัติ รวมรอบ ตรวจ และตั้งค่าเงินสดย่อย', icon: Receipt,
                children: [
                    { title: 'เบิกเงินสดย่อย', description: 'เปิดใบเบิกแทน พจส. ตามประเภทค่าใช้จ่าย', icon: Receipt, href: '/finance/petty/new' },
                    { title: 'ติดตามใบเบิกเงินสดย่อย', description: 'ดูสถานะใบที่คุณเปิด และแก้ใบที่ถูกตีกลับ', icon: ClipboardCheck, href: '/finance/petty' },
                    { title: 'อนุมัติเบิกเงินสดย่อย', description: 'อนุมัติจ่าย แล้วส่งเคลียร์เป็นรอบพร้อมใบปะหน้า (เจ้าของเงินสด)', icon: BadgeCheck, href: '/finance/petty/approvals' },
                    { title: 'หัวหน้าอนุมัติเงินสดย่อย', description: 'ใบเบิกของลูกทีมก่อนโอน และรอบเคลียร์ที่เจ้าของเงินสดส่งมา', icon: UserCheck, href: '/finance/petty/clear' },
                    { title: 'งานเงินสดย่อย', description: 'ตรวจใบ ตั้งเบิก และจ่ายเงินคืนเจ้าของเงินสด (บัญชี การเงิน)', icon: Landmark, href: '/finance/petty/accounting', financeOnly: true },
                    { title: 'ยอดกองทุนเงินสดย่อย', description: 'ทุกกองทุน: Advance คงเหลือ ใบที่ยังไม่คืนยอด พร้อมอนุมัติ', icon: Wallet, href: '/finance/petty/funds', financeOnly: true },
                    { title: 'ตั้งค่าเงินสดย่อย', description: 'กองทุน ผู้ถือเงิน วงเงิน และประเภทการเบิก', icon: Settings2, href: '/finance/petty/master', financeOnly: true },
                ],
            },
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
            { title: 'จัดการทบทวนสิทธิ์ (IT)', description: 'รอบทบทวน กลุ่มสิทธิ์ และผู้ใช้ ATMS / Winspeed / Email', icon: ShieldCheck, href: '/access-review/admin' },
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
