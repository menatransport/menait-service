'use client';

import Link from 'next/link';
import { ArrowRight, Lock, Unlock } from 'lucide-react';
import { Dialog, DialogContent, DialogDescription, DialogTitle } from '@/components/ui/dialog';
import { Mascot } from '@/components/mascot';
import type { AccessChange, SessionDiff } from '@/lib/session-user';

export type SessionNotice =
  | { kind: 'updated'; diff: SessionDiff }
  | { kind: 'ended'; reason: 'inactive' | 'not_found' };

const MAX_ROWS = 6;

const ACCESS_TEXT: Record<AccessChange['key'], { granted: string; removed: string }> = {
  is_finance: { granted: 'คุณเข้าใช้เมนู "การเงิน" ได้แล้ว', removed: 'เมนู "การเงิน" ถูกปิดสำหรับบัญชีของคุณ' },
  role: { granted: 'คุณได้รับสิทธิ์ผู้ดูแลระบบ', removed: 'สิทธิ์ผู้ดูแลระบบของคุณถูกยกเลิก' },
};

const ENDED_TEXT = {
  inactive: 'บัญชีของคุณถูกปิดใช้งาน กรุณาติดต่อฝ่ายบุคคลหรือไอที',
  not_found: 'ไม่พบบัญชีของคุณในระบบ (อาจมีการเปลี่ยนรหัสพนักงาน) กรุณาเข้าสู่ระบบใหม่ หรือติดต่อไอที',
};

/**
 * น้องมีนาบอกว่าข้อมูลของผู้ใช้เปลี่ยน — ขึ้นครั้งเดียวต่อการเปลี่ยน (cookie ถูกเซ็นใหม่แล้ว รอบหน้าไม่มี diff)
 * มือถือเป็น bottom sheet · Esc / คลิกนอก = รับทราบ (ยกเว้นบัญชีถูกปิด ต้องกดปุ่ม)
 */
export function ProfileUpdateDialog({ notice, onClose }: { notice: SessionNotice | null; onClose: () => void }) {
  const ended = notice?.kind === 'ended';
  const diff = notice?.kind === 'updated' ? notice.diff : null;
  const rows = diff?.changes.slice(0, MAX_ROWS) ?? [];
  const hidden = (diff?.changes.length ?? 0) - rows.length;

  const title = ended ? 'ออกจากระบบแล้ว' : diff?.firstTime ? 'น้องมีนามีอัปเดตข้อมูล' : 'ข้อมูลของคุณมีการอัปเดต';
  const subtitle = ended
    ? ENDED_TEXT[notice.reason]
    : diff?.firstTime
      ? 'ตอนนี้ระบบปรับข้อมูลฝ่ายและแผนกของคุณแล้ว ไม่ต้องเข้าสู่ระบบใหม่'
      : 'ระบบแสดงข้อมูลล่าสุดให้แล้ว ไม่ต้องเข้าสู่ระบบใหม่';

  return (
    <Dialog open={!!notice} onOpenChange={open => { if (!open && !ended) onClose(); }}>
      <DialogContent
        showCloseButton={false}
        onEscapeKeyDown={e => { if (ended) e.preventDefault(); }}
        onInteractOutside={e => { if (ended) e.preventDefault(); }}
        className="gap-0 border-0 p-0 overflow-hidden sm:max-w-md md:w-full max-sm:top-auto max-sm:bottom-0 max-sm:translate-y-0 max-sm:max-w-full max-sm:rounded-b-none rounded-3xl"
      >
        <div className="relative flex justify-center bg-linear-to-b from-brand-50 to-white pt-8 pb-2">
          <Mascot
            size={96}
            motion={ended ? 'none' : 'bob'}
            bubble={ended ? undefined : <span className="font-semibold">{diff?.firstTime ? 'อัปเดต' : 'อัปเดตใหม่!'} ✨</span>}
            bubbleSide="right"
          />
        </div>

        <div className="px-6 pb-6 pt-2 text-center">
          <DialogTitle className="text-xl font-bold text-brand-700">{title}</DialogTitle>
          <DialogDescription className="mt-1 text-sm text-gray-500">{subtitle}</DialogDescription>

          {rows.length > 0 && (
            <ul className="mt-5 space-y-2 text-left" aria-label="รายการที่เปลี่ยน">
              {rows.map(c => (
                <li key={c.key} className="rounded-2xl bg-gray-50 px-4 py-3">
                  <p className="text-xs font-medium text-gray-500">{c.label}</p>
                  <p className="mt-0.5 flex flex-wrap items-center gap-x-2 text-sm">
                    {c.before !== null || !diff?.firstTime ? (
                      <>
                        <span className="text-gray-400 line-through">{c.before ?? '—'}</span>
                        <ArrowRight className="size-3.5 shrink-0 text-gray-400" aria-label="เปลี่ยนเป็น" />
                      </>
                    ) : null}
                    <span className="font-semibold text-brand-700">{c.after ?? '—'}</span>
                  </p>
                </li>
              ))}
            </ul>
          )}
          {hidden > 0 && <p className="mt-2 text-xs text-gray-500">และอีก {hidden} รายการ ดูได้ที่โปรไฟล์</p>}

          {diff?.access.map(a => (
            <p
              key={a.key}
              className={`mt-3 flex items-center justify-center gap-2 rounded-2xl px-4 py-2.5 text-sm font-medium ${
                a.granted ? 'bg-mint-300/30 text-emerald-800' : 'bg-amber-50 text-amber-800'
              }`}
            >
              {a.granted ? <Unlock className="size-4" /> : <Lock className="size-4" />}
              {a.granted ? ACCESS_TEXT[a.key].granted : ACCESS_TEXT[a.key].removed}
            </p>
          ))}

          <div className="mt-6 flex gap-3">
            {!ended && (
              <Link
                href="/settings"
                onClick={onClose}
                className="flex h-12 flex-1 items-center justify-center rounded-2xl border border-brand-200 text-sm font-semibold text-brand-700 transition hover:bg-brand-50"
              >
                ดูโปรไฟล์
              </Link>
            )}
            <button
              type="button"
              autoFocus
              onClick={onClose}
              className="h-12 flex-1 rounded-2xl bg-linear-to-r from-brand-600 to-brand-500 text-sm font-semibold text-white shadow-lg transition hover:from-brand-700 hover:to-brand-600"
            >
              {ended ? 'ตกลง' : 'รับทราบ'}
            </button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
