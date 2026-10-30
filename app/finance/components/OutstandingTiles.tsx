'use client';

import { TriangleAlert } from 'lucide-react';
import { formatBaht } from '@/lib/finance/status';
import type { OutstandingCard } from '@/lib/finance/outstandingCards';

/** ยอดค้างเคลียร์ + ยอดของแต่ละสถานะในยอดนั้น (การ์ดแถวเดียว มือถือเลื่อนซ้ายขวา) */
export function OutstandingTiles({ cards }: { cards: OutstandingCard[] }) {
  return (
    <dl className="-mx-3 flex gap-3 overflow-x-auto px-3 pb-1 sm:mx-0 sm:grid sm:grid-cols-3 sm:px-0 sm:pb-0 xl:grid-cols-6">
      {cards.map(c => {
        const hot = c.tone === 'alert' && c.amount > 0;
        return (
          <div key={c.key} className={`v2-glass min-w-40 shrink-0 rounded-2xl px-4 py-3 sm:min-w-0 ${c.tone === 'total' ? 'ring-2 ring-white/70' : ''}`}>
            <dt className="flex items-center gap-1.5 text-xs text-ink-500">
              {c.color && <span className="size-2.5 shrink-0 rounded-full" style={{ background: c.color }} aria-hidden />}
              {c.tone === 'alert' && <TriangleAlert className={`size-3.5 shrink-0 ${hot ? 'text-rose-600' : ''}`} aria-hidden />}
              {c.label}
            </dt>
            <dd className={`mt-0.5 font-display text-2xl font-semibold tabular-nums leading-tight ${hot ? 'text-rose-600' : 'text-ink-900'}`}>
              {formatBaht(c.amount)}
            </dd>
            <p className="text-[11px] text-ink-500">{c.hint}</p>
          </div>
        );
      })}
    </dl>
  );
}
