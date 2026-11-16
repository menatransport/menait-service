'use client';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { ShieldCheck, CalendarClock } from 'lucide-react';
import { Dialog, DialogContent, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Mascot } from '@/components/mascot';
import { getMe } from '@/app/access-review/api';
import { formatThaiDate } from '@/app/access-review/components';
import type { MeResponse } from '@/app/access-review/types';

// "ไว้ทีหลัง" hides it for this browser session only — it comes back next login until submitted
const DISMISS_KEY = 'accessReviewReminderDismissed';

/** Needs a reminder: an open cycle, permissions to review, and not yet submitted (none / draft / rejected) */
export function needsAccessReview(me: MeResponse | null): boolean {
    if (!me?.cycle || me.cycle.is_open === false) return false;
    if (!me.systems.some(s => s.roles.length > 0)) return false;
    const status = me.review?.status;
    return !status || status === 'draft' || status === 'rejected';
}

/** Home pop-up for people who still have to ยืนยันสิทธิ์ in the current ทบทวนสิทธิ์ cycle */
export function AccessReviewReminder({ enabled }: { enabled: boolean }) {
    const router = useRouter();
    const [me, setMe] = useState<MeResponse | null>(null);
    const [open, setOpen] = useState(false);

    useEffect(() => {
        if (!enabled) return;
        try { if (sessionStorage.getItem(DISMISS_KEY) === '1') return; } catch { /* storage blocked */ }
        let cancelled = false;
        getMe()
            .then(data => {
                if (cancelled || !needsAccessReview(data)) return;
                setMe(data);
                setOpen(true);
            })
            .catch(() => undefined);
        return () => { cancelled = true; };
    }, [enabled]);

    const later = () => {
        try { sessionStorage.setItem(DISMISS_KEY, '1'); } catch { /* storage blocked */ }
        setOpen(false);
    };

    if (!me) return null;
    const rejected = me.review?.status === 'rejected';

    return (
        <Dialog open={open} onOpenChange={o => { if (!o) later(); }}>
            <DialogContent className="sm:max-w-[420px] rounded-[28px] p-0 overflow-hidden gap-0">
                <div className="v2-shell flex justify-center pt-5 pb-2">
                    <Mascot size={96} />
                </div>
                <div className="px-6 pt-5 pb-6 flex flex-col gap-4 text-center">
                    <div className="flex flex-col gap-1.5">
                        <DialogTitle className="font-display text-xl text-ink-900">
                            {rejected ? 'คำขอทบทวนสิทธิ์ถูกส่งกลับ' : 'ถึงเวลาทบทวนสิทธิ์แล้วค่ะ'}
                        </DialogTitle>
                        <DialogDescription className="text-sm text-ink-500">
                            {rejected
                                ? 'ผู้อนุมัติส่งคำขอกลับมา กรุณาแก้ไขและส่งใหม่อีกครั้ง'
                                : 'กรุณาตรวจสอบสิทธิ์ ATMS / Winspeed / Email Group ของคุณ แล้วกดยืนยัน'}
                        </DialogDescription>
                    </div>

                    <div className="flex items-center gap-3 rounded-2xl bg-[#f7fbff] border border-[#cfe4ff] px-4 py-3 text-left">
                        <span className="w-9 h-9 rounded-xl grid place-items-center shrink-0 bg-[#eaf4ff] text-brand-700">
                            <CalendarClock className="w-[18px] h-[18px]" />
                        </span>
                        <span className="min-w-0">
                            <span className="block text-sm font-semibold text-ink-900 truncate">{me.cycle!.name}</span>
                            <span className="block text-xs text-ink-500">ภายใน {formatThaiDate(me.cycle!.end_date)}</span>
                        </span>
                    </div>

                    <div className="flex flex-col gap-2">
                        <Button
                            className="h-11 rounded-full text-[15px] font-semibold cursor-pointer"
                            onClick={() => { setOpen(false); router.push('/access-review'); }}
                        >
                            <ShieldCheck className="w-4 h-4" />
                            {rejected ? 'แก้ไขและส่งใหม่' : 'ตรวจสอบและยืนยันสิทธิ์'}
                        </Button>
                        <Button variant="ghost" className="h-10 rounded-full text-ink-500 cursor-pointer" onClick={later}>
                            ไว้ทีหลัง
                        </Button>
                    </div>
                </div>
            </DialogContent>
        </Dialog>
    );
}
