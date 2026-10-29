'use client';

import { voucherInboxHref } from '@/lib/finance/historyLog';
import { useCallback, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { BellRing, X } from 'lucide-react';
import { useSessionContext } from '@/app/context/SessionContext';
import { freshItems, nextSeen, type VoucherInboxItem as Incoming } from '@/lib/finance/voucher-inbox';

const POLL_MS = 60_000;
const SEEN_KEY = 'menait.voucher-inbox.seen';
const MAX_TOASTS = 4;

function readSeen(): string[] {
  try {
    const raw = localStorage.getItem(SEEN_KEY);
    return raw ? (JSON.parse(raw) as string[]) : [];
  } catch {
    return [];
  }
}

function writeSeen(ids: string[]): void {
  try {
    localStorage.setItem(SEEN_KEY, JSON.stringify(ids));
  } catch {
    /* private window or storage full: the worst case is a toast shown twice */
  }
}

const baht = (n: number | null) =>
  n === null || n === undefined
    ? ''
    : `${n.toLocaleString('th-TH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} บาท`;

/**
 * Tells finance, on any page, that an Advance request finished its approvals and is
 * waiting to be vouchered. The first poll only records what is already there, so
 * opening the app never greets you with a wall of old requests.
 */
export default function VoucherInboxWatcher() {
  const { user, loading } = useSessionContext();
  const [toasts, setToasts] = useState<Incoming[]>([]);
  const primed = useRef(false);

  const dismiss = useCallback((formId: string) => {
    setToasts(prev => prev.filter(t => t.form_id !== formId));
  }, []);

  useEffect(() => {
    if (loading || !user?.is_finance) return;
    let stopped = false;

    const poll = async () => {
      try {
        const res = await fetch('/api/finance/voucher-inbox', { cache: 'no-store' });
        if (!res.ok || stopped) return;
        const data = await res.json();
        const items: Incoming[] = data?.items ?? [];
        const seen = readSeen();

        if (!primed.current) {
          primed.current = true;
          writeSeen(nextSeen(seen, items));
          return;
        }

        const fresh = freshItems(items, seen);
        if (fresh.length === 0) return;
        writeSeen(nextSeen(seen, fresh));
        setToasts(prev => [...fresh, ...prev].slice(0, MAX_TOASTS));
      } catch {
        /* offline or a blip: try again on the next tick */
      }
    };

    poll();
    const timer = setInterval(poll, POLL_MS);
    const onFocus = () => poll();
    window.addEventListener('focus', onFocus);
    return () => {
      stopped = true;
      clearInterval(timer);
      window.removeEventListener('focus', onFocus);
    };
  }, [loading, user?.is_finance]);

  if (toasts.length === 0) return null;

  return (
    <div className="fixed bottom-4 right-4 z-9999 flex w-80 max-w-[calc(100vw-2rem)] flex-col gap-2">
      {toasts.map(t => (
        <div
          key={t.form_id}
          role="status"
          className="rounded-xl border border-brand-200 bg-white p-3 shadow-lg ring-1 ring-black/5"
        >
          <div className="flex items-start gap-2">
            <BellRing size={16} className="mt-0.5 shrink-0 text-brand-600" />
            <div className="min-w-0 flex-1">
              <p className="text-sm font-semibold text-gray-800">มีใบคำขอเบิกใหม่รอตั้งเบิก</p>
              <p className="mt-0.5 truncate text-xs text-gray-600">
                {t.form_id}
                {t.requester_name ? ` · ${t.requester_name}` : ''}
              </p>
              {t.amount !== null && t.amount !== undefined && (
                <p className="text-xs text-gray-500">{baht(t.amount)}</p>
              )}
              <Link
                href={voucherInboxHref(t.form_id)}
                onClick={() => dismiss(t.form_id)}
                className="mt-2 inline-block rounded-lg bg-brand-600 px-2.5 py-1 text-xs font-medium text-white hover:bg-brand-700"
              >
                เปิดใบนี้
              </Link>
            </div>
            <button
              type="button"
              onClick={() => dismiss(t.form_id)}
              aria-label="ปิดการแจ้งเตือน"
              className="shrink-0 rounded p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-600"
            >
              <X size={14} />
            </button>
          </div>
        </div>
      ))}
    </div>
  );
}
