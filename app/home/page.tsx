'use client';
import { Search, ArrowRight, FileText, Loader2, Sparkles, LayoutDashboard, ChevronDown, ExternalLink } from 'lucide-react';
import { NavbarHeader } from "@/components/navbar";
import { useEffect, useState, useCallback, useMemo, useRef, useId } from 'react';
import { useRouter } from 'next/navigation';
import { useSessionContext } from "@/app/context/SessionContext";
import { Input } from "@/components/ui/input";
import { Mascot } from "@/components/mascot";
import { cn } from "@/lib/utils";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from "@/components/ui/sheet";
import { canUseFinance } from "@/lib/finance/role";
import { MENU_GROUPS, QUICK_LINKS, isMenuItemReady, type MenuGroup, type MenuItem, type MenuTone } from "./menu-groups";

const TONE = {
    blue: { tile: 'v2-tile-blue', soft: 'bg-[#eaf4ff]', text: 'text-brand-700', ring: 'border-[#cfe4ff]' },
    sun: { tile: 'v2-tile-sun', soft: 'bg-[#fff1e0]', text: 'text-[#b24c06]', ring: 'border-[#ffd6a8]' },
    mint: { tile: 'v2-tile-mint', soft: 'bg-[#dcfaf0]', text: 'text-[#0b7a53]', ring: 'border-[#a8efd4]' },
    ink: { tile: 'v2-tile-ink', soft: 'bg-[#eef2f8]', text: 'text-ink-700', ring: 'border-[#d5deea]' },
} satisfies Record<MenuTone, Record<string, string>>;

const isExternal = (href?: string) => Boolean(href?.startsWith('http'));

/**
 * Home — desktop: "Assistant-first" (mascot + big search + group columns),
 * mobile: "App Launcher" (icon grid per group). Menus come from menu-groups.ts.
 */
export default function HomePage() {
    const router = useRouter();
    const { user, loading } = useSessionContext();
    const isClient = !loading;
    const firstName = isClient ? (user?.firstname ?? '') : '';

    const groups = useMemo(
        () => MENU_GROUPS
            .filter(g => !g.adminOnly || (isClient && user?.role === 'a'))
            .map(g => ({ ...g, items: g.items.filter(i => !i.financeOnly || (isClient && user?.is_finance)) }))
            // not open to this user yet: same items, but without a link → rendered as "เร็ว ๆ นี้"
            .map(g => (g.financeAccess && !(isClient && canUseFinance(user))
                ? { ...g, items: g.items.map(i => ({ ...i, href: undefined, children: undefined })) }
                : g)),
        [isClient, user]
    );

    const navigate = useCallback((href?: string) => {
        if (!href) return;
        if (isExternal(href)) window.open(href, '_blank', 'noopener,noreferrer');
        else router.push(href);
    }, [router]);

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
        <div className="h-dvh overflow-hidden">
            <DesktopHome firstName={firstName} groups={groups} onNavigate={navigate} />
            <MobileHome firstName={firstName} groups={groups} onNavigate={navigate} />
        </div>
    );
}

interface LayoutProps {
    firstName: string;
    groups: MenuGroup[];
    onNavigate: (href?: string) => void;
}

/* ───────────── Desktop · Assistant-first ───────────── */

// Home fits one screen: hero sizes follow the viewport height (clamp + vh), the columns take what is left.
function DesktopHome({ firstName, groups, onNavigate }: LayoutProps) {
    const serviceGroups = groups.filter(g => !g.adminOnly);
    const adminGroup = groups.find(g => g.adminOnly);

    return (
        <div className="hidden lg:flex h-full overflow-hidden v2-canvas flex-col">
            {/* Hero — no overflow-hidden here so the user menu and search results can drop over the columns */}
            <section className="relative v2-shell rounded-b-[48px] shrink-0 pb-[clamp(52px,8vh,104px)]">
                <div aria-hidden="true" className="absolute inset-0 overflow-hidden rounded-b-[48px] pointer-events-none">
                    <div className="v2-orb w-[420px] h-[420px] -left-[170px] -bottom-[260px] opacity-90" />
                    <div className="absolute w-[260px] h-[260px] rounded-full bg-white/10 -right-[60px] -top-[80px]" />
                </div>

                <NavbarHeader isHome className="z-40 sm:pt-[clamp(6px,1.6vh,24px)] pb-0" />

                <div className="relative flex flex-col items-center gap-[clamp(4px,1vh,10px)] px-6 text-center animate-fade-in-up motion-reduce:animate-none">
                    <Mascot size={150} className="-mt-[clamp(8px,3vh,28px)] [&>svg]:w-[clamp(64px,12vh,150px)] [&>svg]:h-[clamp(64px,12vh,150px)]" />
                    <h1 className="font-display text-[clamp(24px,4.3vh,44px)] font-bold text-white leading-tight">
                        สวัสดีค่ะ{' '}
                        <span className="bg-linear-to-r from-[#fff6b0] to-[#ffd166] bg-clip-text text-transparent drop-shadow-[0_2px_8px_rgba(15,39,72,0.18)]">
                            คุณ{firstName}
                        </span>{' '}
                        ให้น้องมีนาช่วยอะไรดี?
                    </h1>
                    <p className="text-white/90 text-[clamp(13px,1.9vh,17px)] [@media(max-height:700px)]:hidden">พิมพ์สิ่งที่ต้องการ หรือเลือกจากเมนูด้านล่าง</p>
                </div>

                <ServiceSearch
                    className="w-[820px] max-w-[calc(100%-3rem)] mx-auto mt-[clamp(10px,2.4vh,24px)]"
                    inputClassName="h-[clamp(46px,6.6vh,64px)] bg-white/95 border-0 shadow-soft"
                    placeholder="พิมพ์ปัญหาหรือบริการที่ต้องการ เช่น “ขอสิทธิ์ ATMS”"
                />

                <div className="relative flex flex-wrap justify-center gap-2.5 mt-[clamp(8px,2vh,20px)] px-6">
                    {QUICK_LINKS.map(({ label, image, href }) => (
                        <button
                            key={label}
                            type="button"
                            onClick={() => onNavigate(href)}
                            aria-disabled={!href}
                            title={href ? undefined : 'เร็ว ๆ นี้'}
                            className={cn(
                                'group flex items-center gap-2.5 pl-2 pr-5 py-[clamp(4px,0.8vh,8px)] rounded-full bg-white/18 border border-white/35 text-white text-[15px] font-medium transition-all',
                                href ? 'cursor-pointer hover:bg-white/28 hover:-translate-y-0.5' : 'cursor-not-allowed opacity-70'
                            )}
                        >
                            <img
                                src={image}
                                alt=""
                                width={30}
                                height={30}
                                className="w-[clamp(22px,3.3vh,30px)] h-[clamp(22px,3.3vh,30px)] drop-shadow-[0_4px_6px_rgba(15,39,72,0.25)] transition-transform duration-300 group-hover:scale-110 group-hover:-rotate-6"
                            />
                            {label}
                        </button>
                    ))}
                </div>
            </section>

            <main
                className="relative z-10 flex-1 min-h-0 -mt-[clamp(36px,6vh,64px)] px-[clamp(24px,5vw,72px)] pb-[clamp(10px,2vh,20px)] grid grid-cols-3 grid-rows-1 gap-[clamp(14px,1.8vw,24px)] items-start"
            >
                {serviceGroups.map((group, i) => (
                    <GroupColumn key={group.id} group={group} index={i} onNavigate={onNavigate} />
                ))}
            </main>

            {adminGroup && (
                <footer className="shrink-0 px-[clamp(24px,5vw,72px)] pb-[clamp(8px,1.6vh,16px)] flex items-center gap-2.5 text-ink-500 text-sm">
                    <LayoutDashboard className="w-4 h-4" />
                    {adminGroup.tagline}:
                    {adminGroup.items.map((item, i) => (
                        <span key={item.title} className="flex items-center gap-2.5">
                            {i > 0 && <span aria-hidden="true">·</span>}
                            <button type="button" onClick={() => onNavigate(item.href)} className="text-brand-600 hover:text-brand-700 font-medium cursor-pointer">
                                {item.title}
                            </button>
                        </span>
                    ))}
                </footer>
            )}
        </div>
    );
}

function GroupColumn({ group, index, onNavigate }: { group: MenuGroup; index: number; onNavigate: (href?: string) => void }) {
    const tone = TONE[group.tone];
    const GroupIcon = group.icon;
    return (
        <section
            className="max-h-full min-h-0 rounded-[28px] bg-white border border-border shadow-soft p-[clamp(14px,2.2vh,24px)] flex flex-col gap-[clamp(8px,1.2vh,12px)] v2-card-in"
            style={{ animationDelay: `${index * 80}ms` }}
        >
            <div className={cn('h-1.5 w-14 rounded-full shrink-0 [@media(max-height:760px)]:hidden', tone.tile)} />
            <div className="flex items-center gap-3 shrink-0">
                <span className={cn('w-11 h-11 rounded-[15px] grid place-items-center shrink-0', tone.tile)}>
                    <GroupIcon className="w-5 h-5" />
                </span>
                <div>
                    <h2 className="text-xl font-semibold text-ink-900 leading-tight">{group.label}</h2>
                    <p className="text-[13px] text-ink-500">{group.tagline}</p>
                </div>
            </div>

            {group.items.length === 0 ? (
                <div className={cn('flex items-center gap-2 p-3.5 rounded-2xl border-2 border-dashed text-sm font-medium', tone.ring, tone.text)}>
                    <Sparkles className="w-4 h-4" />
                    เมนู {group.label.replace('Service ', '')} กำลังจะมาเร็ว ๆ นี้
                </div>
            ) : (
                // The page never scrolls; a long group scrolls inside its own card
                <div data-scroll-area className="min-h-0 overflow-y-auto overscroll-contain -mx-1 px-1 pb-1 flex flex-col gap-[clamp(6px,1vh,12px)]">
                    {group.items.map(item => (
                        <MenuRow key={item.title} item={item} tone={group.tone} onNavigate={onNavigate} />
                    ))}
                </div>
            )}
        </section>
    );
}

function MenuRow({ item, tone, onNavigate }: { item: MenuItem; tone: MenuTone; onNavigate: (href?: string) => void }) {
    const [open, setOpen] = useState(false);
    const panelId = useId();
    const panelRef = useRef<HTMLDivElement>(null);
    const t = TONE[tone];
    const Icon = item.icon;
    const ready = isMenuItemReady(item);
    const children = item.children ?? [];
    const isGroup = children.length > 0;

    // After expanding, scroll only the card's own list (scrollIntoView would also move the fixed page)
    useEffect(() => {
        if (!open) return;
        const timer = setTimeout(() => {
            const panel = panelRef.current;
            const list = panel?.closest<HTMLElement>('[data-scroll-area]');
            if (!panel || !list) return;
            const overflow = panel.getBoundingClientRect().bottom - list.getBoundingClientRect().bottom;
            if (overflow > 0) list.scrollBy({ top: overflow + 8, behavior: 'smooth' });
        }, 320);
        return () => clearTimeout(timer);
    }, [open]);

    const row = (
        <button
            type="button"
            disabled={!ready}
            onClick={() => (isGroup ? setOpen(o => !o) : onNavigate(item.href))}
            aria-expanded={isGroup ? open : undefined}
            aria-controls={isGroup ? panelId : undefined}
            className={cn(
                'group w-full flex items-center gap-3 p-[clamp(8px,1.2vh,12px)] rounded-2xl bg-[#f7fbff] text-left transition-all',
                ready ? 'cursor-pointer hover:bg-brand-50 hover:shadow-[0_4px_14px_-8px_rgba(21,86,201,0.35)]' : 'cursor-not-allowed',
                open && 'bg-brand-50'
            )}
        >
            <span className={cn('w-9 h-9 rounded-xl grid place-items-center shrink-0', t.soft, t.text)}>
                <Icon className="w-[18px] h-[18px]" />
            </span>
            <span className="flex-1 min-w-0">
                <span className="block font-semibold text-[15px] text-ink-900">{item.title}</span>
                <span className="block text-[13px] text-ink-500 truncate [@media(max-height:760px)]:hidden">{item.description}</span>
            </span>
            {isGroup ? (
                <span className="flex items-center gap-1.5 shrink-0">
                    <span className={cn('text-[11px] font-semibold px-2 py-0.5 rounded-full', t.soft, t.text)}>{children.length} ระบบ</span>
                    <ChevronDown className={cn('w-[18px] h-[18px] text-ink-300 transition-transform duration-300', open && 'rotate-180 text-brand-600')} />
                </span>
            ) : ready ? (
                <ArrowRight className="w-[18px] h-[18px] text-ink-300 shrink-0 transition-all group-hover:text-brand-600 group-hover:translate-x-1" />
            ) : (
                <span className={cn('text-[11px] font-semibold px-2 py-0.5 rounded-full shrink-0', t.soft, t.text)}>เร็ว ๆ นี้</span>
            )}
        </button>
    );

    if (!isGroup) return row;

    return (
        <div>
            {row}
            {/* grid-rows 0fr → 1fr animates the height without measuring */}
            <div
                id={panelId}
                ref={panelRef}
                inert={!open}
                className={cn('grid transition-[grid-template-rows] duration-300 ease-out', open ? 'grid-rows-[1fr]' : 'grid-rows-[0fr]')}
            >
                <div className="overflow-hidden">
                    <div className="ml-[30px] mt-1.5 pl-3 border-l-2 border-dashed border-[#cfe4ff] flex flex-col gap-1">
                        {children.map(child => (
                            <SubMenuRow key={child.title} item={child} tone={tone} onNavigate={onNavigate} />
                        ))}
                    </div>
                </div>
            </div>
        </div>
    );
}

function SubMenuRow({ item, tone, onNavigate, size = 'sm' }: {
    item: MenuItem; tone: MenuTone; onNavigate: (href?: string) => void; size?: 'sm' | 'lg';
}) {
    const t = TONE[tone];
    const Icon = item.icon;
    const ready = Boolean(item.href);
    const lg = size === 'lg';
    return (
        <button
            type="button"
            disabled={!ready}
            onClick={() => onNavigate(item.href)}
            className={cn(
                'group w-full flex items-center text-left rounded-xl transition-colors',
                lg ? 'gap-3 p-3 bg-[#f7fbff]' : 'gap-2.5 px-2.5 py-2',
                ready ? 'cursor-pointer hover:bg-brand-50' : 'cursor-not-allowed'
            )}
        >
            <span className={cn('grid place-items-center shrink-0', lg ? 'w-10 h-10 rounded-xl' : 'w-7 h-7 rounded-lg', t.soft, t.text)}>
                <Icon className={lg ? 'w-5 h-5' : 'w-4 h-4'} />
            </span>
            <span className="flex-1 min-w-0">
                <span className={cn('block font-semibold text-ink-900', lg ? 'text-[15px]' : 'text-sm')}>{item.title}</span>
                <span className={cn('block text-ink-500 truncate', lg ? 'text-[13px]' : 'text-xs')}>{item.description}</span>
            </span>
            {!ready ? (
                <span className={cn('text-[11px] font-semibold px-2 py-0.5 rounded-full shrink-0', t.soft, t.text)}>เร็ว ๆ นี้</span>
            ) : isExternal(item.href) ? (
                <ExternalLink aria-label="เปิดในแท็บใหม่" className="w-4 h-4 text-ink-300 shrink-0 group-hover:text-brand-600" />
            ) : (
                <ArrowRight className="w-4 h-4 text-ink-300 shrink-0 transition-all group-hover:text-brand-600 group-hover:translate-x-0.5" />
            )}
        </button>
    );
}

/* ───────────── Mobile · App Launcher ───────────── */

function MobileHome({ firstName, groups, onNavigate }: LayoutProps) {
    const [activeId, setActiveId] = useState(groups[0]?.id);
    const current = groups.find(g => g.id === activeId) ?? groups[0];

    return (
        <div className="lg:hidden relative h-full overflow-hidden v2-shell flex flex-col">
            <div aria-hidden="true" className="absolute inset-0 overflow-hidden pointer-events-none">
                <div className="v2-orb w-[260px] h-[260px] -left-[120px] top-[120px] opacity-85" />
            </div>

            <NavbarHeader isHome className="z-40 pb-0" />

            <div className="relative shrink-0 flex items-center gap-2.5 px-5 pb-[clamp(12px,2.6vh,24px)]">
                <Mascot size={96} className="[&>svg]:w-[clamp(60px,11vh,96px)] [&>svg]:h-[clamp(60px,11vh,96px)]" />
                <div className="v2-bubble text-sm max-w-[220px]" style={{ borderRadius: '18px 18px 18px 4px' }}>
                    สวัสดีค่ะ <strong className="font-semibold text-brand-600">คุณ{firstName}</strong><br />เลือกแอปที่ต้องการได้เลย
                </div>
            </div>

            <main className="relative flex-1 min-h-0 rounded-t-[34px] v2-canvas px-4 pt-5 pb-[max(16px,env(safe-area-inset-bottom))] flex flex-col gap-3.5">
                <ServiceSearch inputClassName="h-[50px] bg-white border border-border shadow-[0_4px_14px_-8px_rgba(21,86,201,0.25)]" />

                <div
                    role="tablist"
                    aria-label="กลุ่มเมนู"
                    className="shrink-0 grid gap-1 p-1 rounded-full bg-white border border-border shadow-[0_4px_14px_-8px_rgba(21,86,201,0.25)]"
                    style={{ gridTemplateColumns: `repeat(${groups.length}, minmax(0, 1fr))` }}
                >
                    {groups.map(g => {
                        const active = g.id === current?.id;
                        return (
                            <button
                                key={g.id}
                                type="button"
                                role="tab"
                                aria-selected={active}
                                onClick={() => setActiveId(g.id)}
                                className={cn(
                                    'h-10 rounded-full text-sm truncate px-2 transition-all cursor-pointer',
                                    active ? 'bg-linear-to-br from-[#eaf4ff] to-[#dff9ef] text-brand-700 font-semibold' : 'text-ink-500 font-medium'
                                )}
                            >
                                {g.adminOnly ? 'จัดการ' : g.label.replace('Service ', '')}
                            </button>
                        );
                    })}
                </div>

                {current && <AppGroup key={current.id} group={current} onNavigate={onNavigate} />}
            </main>
        </div>
    );
}

function AppGroup({ group, onNavigate }: { group: MenuGroup; onNavigate: (href?: string) => void }) {
    const tone = TONE[group.tone];
    return (
        <section role="tabpanel" className="min-h-0 overflow-y-auto rounded-[28px] bg-white border border-border shadow-[0_4px_14px_-8px_rgba(21,86,201,0.25)] px-4 pt-4 pb-5 flex flex-col gap-4 v2-pop-in">
            <div className="flex items-center gap-2">
                <span className={cn('w-2 h-[22px] rounded-full', tone.tile)} />
                <h2 className="text-base font-semibold text-ink-900">{group.label}</h2>
                <span className="text-xs text-ink-500 truncate">· {group.tagline}</span>
            </div>
            <div className="grid grid-cols-4 gap-x-2 gap-y-3.5">
                {group.items.length === 0 ? (
                    <div className="flex flex-col items-center gap-2 text-ink-500">
                        <span className={cn('w-[62px] h-[62px] rounded-[22px] border-2 border-dashed grid place-items-center', tone.ring, tone.text)}>
                            <Sparkles className="w-6 h-6" />
                        </span>
                        <span className="text-[13px]">เร็ว ๆ นี้</span>
                    </div>
                ) : (
                    group.items.map(item => (
                        <AppTile key={item.title} item={item} tone={group.tone} onNavigate={onNavigate} />
                    ))
                )}
            </div>
        </section>
    );
}

function AppTile({ item, tone, onNavigate }: { item: MenuItem; tone: MenuTone; onNavigate: (href?: string) => void }) {
    const [sheetOpen, setSheetOpen] = useState(false);
    const t = TONE[tone];
    const Icon = item.icon;
    const ready = isMenuItemReady(item);
    const children = item.children ?? [];
    const isGroup = children.length > 0;

    return (
        <>
            <button
                type="button"
                disabled={!ready}
                onClick={() => (isGroup ? setSheetOpen(true) : onNavigate(item.href))}
                aria-haspopup={isGroup ? 'dialog' : undefined}
                className={cn('flex flex-col items-center gap-2 text-center', ready ? 'cursor-pointer active:scale-95 transition-transform' : 'cursor-not-allowed')}
            >
                <span className="relative">
                    <span className={cn('w-[62px] h-[62px] rounded-[22px] grid place-items-center', t.tile)}>
                        <Icon className="w-7 h-7" />
                    </span>
                    {isGroup ? (
                        <span className={cn('absolute -top-1 -right-1 min-w-5 h-5 px-1 grid place-items-center text-[11px] font-bold rounded-full bg-white ring-2 ring-white shadow', t.text)}>
                            {children.length}
                        </span>
                    ) : !ready && (
                        <span className="absolute -top-1 -right-1 text-[10px] font-bold px-1.5 py-px rounded-full bg-sun-700 text-white">ใหม่</span>
                    )}
                </span>
                <span className="text-[13px] font-medium leading-tight text-ink-900">{item.title}</span>
            </button>

            {isGroup && (
                <Sheet open={sheetOpen} onOpenChange={setSheetOpen}>
                    <SheetContent side="bottom" className="rounded-t-[28px] border-0 px-4 pt-3 pb-8 gap-3 max-h-[80vh] overflow-y-auto">
                        <div aria-hidden="true" className="mx-auto h-1.5 w-12 rounded-full bg-ink-300/50" />
                        <SheetHeader className="flex-row items-center gap-3 p-0 pr-8">
                            <span className={cn('w-11 h-11 rounded-[15px] grid place-items-center shrink-0', t.tile)}>
                                <Icon className="w-5 h-5" />
                            </span>
                            <div className="text-left">
                                <SheetTitle className="font-display text-lg text-ink-900">{item.title}</SheetTitle>
                                <SheetDescription className="text-ink-500">{item.description}</SheetDescription>
                            </div>
                        </SheetHeader>
                        <div className="flex flex-col gap-2">
                            {children.map(child => (
                                <SubMenuRow
                                    key={child.title}
                                    item={child}
                                    tone={tone}
                                    size="lg"
                                    onNavigate={(href) => { setSheetOpen(false); onNavigate(href); }}
                                />
                            ))}
                        </div>
                    </SheetContent>
                </Sheet>
            )}
        </>
    );
}

/* ───────────── Shared · service-form search ───────────── */

function ServiceSearch({ className, inputClassName, placeholder = 'ค้นหาแบบฟอร์มบริการ...' }: {
    className?: string; inputClassName?: string; placeholder?: string;
}) {
    const router = useRouter();
    const [query, setQuery] = useState('');
    const [open, setOpen] = useState(false);
    const [forms, setForms] = useState<{ id: string; form_code: string; form_name: string }[]>([]);
    const [isLoading, setIsLoading] = useState(false);
    const [fetched, setFetched] = useState(false);
    const ref = useRef<HTMLDivElement>(null);

    const fetchForms = useCallback(async () => {
        if (fetched || isLoading) return;
        setIsLoading(true);
        try {
            const res = await fetch('/api/form-masters?list=service');
            const data = await res.json();
            setForms(Array.isArray(data) ? data : []);
        } catch (error) {
            console.error('Error fetching service forms:', error);
        } finally {
            setIsLoading(false);
            setFetched(true);
        }
    }, [fetched, isLoading]);

    const filtered = useMemo(() => {
        if (!query.trim()) return forms;
        const q = query.toLowerCase();
        return forms.filter(f => f.form_name.toLowerCase().includes(q) || f.form_code.toLowerCase().includes(q));
    }, [query, forms]);

    useEffect(() => {
        const handleClickOutside = (e: MouseEvent) => {
            if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    const select = (code: string) => {
        setQuery('');
        setOpen(false);
        router.push(`/service/${code}`);
    };

    return (
        <div ref={ref} className={cn('relative z-30', className)}>
            <Search className="absolute left-5 top-1/2 -translate-y-1/2 h-5 w-5 text-ink-300 z-10 pointer-events-none" aria-hidden="true" />
            <Input
                placeholder={placeholder}
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                onFocus={() => { setOpen(true); fetchForms(); }}
                className={cn('w-full rounded-full pl-13 pr-5 text-base placeholder:text-ink-300 focus-visible:ring-4 focus-visible:ring-mint-400/50 transition-shadow', inputClassName)}
                aria-label={placeholder}
                role="combobox"
                aria-expanded={open}
            />

            {open && (
                <div className="absolute top-full left-0 right-0 mt-2 bg-white rounded-3xl shadow-lift border border-border overflow-hidden max-h-80 overflow-y-auto v2-pop-in" role="listbox">
                    <p className="text-xs font-semibold text-ink-500 px-5 pt-4 pb-1">แบบฟอร์มบริการ</p>
                    {isLoading ? (
                        <div className="flex items-center justify-center gap-2 py-6">
                            <Loader2 className="w-5 h-5 text-brand-600 animate-spin" />
                            <span className="text-base text-ink-500">กำลังโหลด...</span>
                        </div>
                    ) : filtered.length > 0 ? (
                        filtered.map(form => (
                            <button
                                key={form.id}
                                onClick={() => select(form.form_code)}
                                className="w-full flex items-center gap-3 px-5 py-3 hover:bg-brand-50 transition-colors cursor-pointer group/sr"
                                role="option"
                                aria-selected={false}
                            >
                                <span className="w-10 h-10 v2-tile-blue rounded-xl grid place-items-center shrink-0">
                                    <FileText className="w-5 h-5" />
                                </span>
                                <span className="flex-1 text-left min-w-0">
                                    <span className="block text-sm font-medium text-ink-900 group-hover/sr:text-brand-600 transition-colors truncate">{form.form_name}</span>
                                    <span className="block text-xs text-ink-500">{form.form_code}</span>
                                </span>
                                <ArrowRight className="w-4 h-4 text-ink-300 group-hover/sr:text-brand-600 group-hover/sr:translate-x-1 transition-all shrink-0" />
                            </button>
                        ))
                    ) : (
                        <div className="px-5 py-6 text-center text-base text-ink-500">ไม่พบแบบฟอร์มที่ค้นหา</div>
                    )}
                </div>
            )}
        </div>
    );
}
