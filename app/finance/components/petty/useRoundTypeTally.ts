'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import type { PettyClaim, PettyRound } from '@/app/finance/types-petty';
import { roundsMissingTally, tallyRoundTypes, type RoundTypeTally } from '@/lib/finance/petty-type-filter';
import { getRound } from '../../petty-api';

const NONE: PettyRound[] = [];
const PARALLEL = 4;

/** รอบชุดเดิมไหม — ใบเข้า/ออกรอบเมื่อสถานะหรือจำนวนใบเปลี่ยน (ไม่ผูกกับตัวแปร array ที่สร้างใหม่ทุกครั้ง) */
const signature = (rounds: readonly PettyRound[]) => rounds.map(r => `${r.id}:${r.status}:${r.claim_count ?? ''}`).join(',');

/**
 * นับประเภทของใบในแต่ละรอบ — รายการรอบจาก BE ไม่มีใบติดมา จึงนับจากใบที่หน้านั้นโหลดไว้ (batch_id)
 * รอบไหนยังรู้ใบไม่ครบและ enabled (มีการกรองประเภท) ค่อยขอรายละเอียดรอบ (พร้อมกันไม่เกิน 4) รวมไม่เกิน maxFetch รอบ
 * รอบเปลี่ยน (หัวหน้าไม่อนุมัติ ใบหลุดรอบ ฯลฯ) = ทิ้งรายละเอียดเก่าแล้วขอใหม่
 */
export function useRoundTypeTally(
  claims: readonly PettyClaim[], rounds: readonly PettyRound[], enabled: boolean, maxFetch = 60,
): { tally: RoundTypeTally; loading: boolean } {
  const sig = signature(rounds);
  const [cache, setCache] = useState<{ sig: string; details: PettyRound[] }>({ sig, details: NONE });
  const details = cache.sig === sig ? cache.details : NONE;
  const tally = useMemo(() => tallyRoundTypes(claims, [...rounds, ...details]), [claims, rounds, details]);
  const [inFlight, setInFlight] = useState(0);
  const tried = useRef<{ sig: string; ids: Set<number> }>({ sig, ids: new Set() });
  const latestSig = useRef(sig);

  const missingKey = enabled ? roundsMissingTally(rounds, tally).join(',') : '';

  useEffect(() => {
    latestSig.current = sig;
    if (tried.current.sig !== sig) tried.current = { sig, ids: new Set() };
    const done = tried.current.ids;
    const ids = (missingKey ? missingKey.split(',').map(Number) : []).filter(id => !done.has(id));
    const batch = ids.slice(0, Math.max(0, maxFetch - done.size));
    if (batch.length === 0) return;
    batch.forEach(id => done.add(id));
    setInFlight(n => n + 1);
    void (async () => {
      const queue = [...batch];
      const got: PettyRound[] = [];
      await Promise.all(Array.from({ length: Math.min(PARALLEL, queue.length) }, async () => {
        for (let id = queue.shift(); id !== undefined; id = queue.shift()) {
          // ไม่มีสิทธิ์ดู/รอบหายไปแล้ว = ปล่อยเป็น "ยังไม่รู้" รอบนั้นจะยังโชว์อยู่ (ไม่ซ่อนงาน)
          try { got.push(await getRound(id)); } catch { /* ข้าม */ }
        }
      }));
      if (latestSig.current === sig) {
        setCache(c => ({ sig, details: [...(c.sig === sig ? c.details : NONE), ...got] }));
      }
      setInFlight(n => n - 1);
    })();
  }, [missingKey, sig, maxFetch]);

  return { tally, loading: enabled && inFlight > 0 };
}
