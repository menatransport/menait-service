/**
 * กรองหน้างานเงินสดย่อยตามประเภทการเบิก (ผู้ใช้สั่ง 30/10/2026) — ใช้ทั้ง 4 หน้า: ผู้ขอเบิก เจ้าของเงินสด หัวหน้า บัญชี/การเงิน
 * ตัวช่วยล้วน (ไม่มี React ไม่มี fetch จริง) เทสต์ได้ตรง ๆ
 *
 * ใบ = กรองตรง ๆ ด้วย expense_type · รอบ = รอบหนึ่งมีหลายประเภท จึงโชว์รอบที่มีใบประเภทนั้นอย่างน้อยหนึ่งใบ
 * ใบในรอบยังอยู่ครบ (กดอะไรก็มีผลทั้งรอบ) ยอดรอบไม่เปลี่ยน · BE ยังไม่มีพารามิเตอร์ประเภท หน้าเว็บนับเองจากใบที่โหลดมา
 */
import type { PettyClaim, PettyExpenseType, PettyRound } from '@/app/finance/types-petty';
import { formatBaht } from './status';
import type { WorklistColumn } from './petty-worklist';

/** ?type=GENERAL — แชร์ลิงก์ได้ กดย้อนกลับได้ */
export const TYPE_PARAM = 'type';
export const ALL_TYPES_LABEL = 'ทุกประเภท';

export type TypeOption = { code: string; label: string };

/** ตัวเลือกในช่อง: เฉพาะประเภทที่เปิดใช้ เรียงตาม sort_order */
export function typeOptions(types: readonly PettyExpenseType[]): TypeOption[] {
  return types
    .filter(t => t.is_active !== false)
    .sort((a, b) => a.sort_order - b.sort_order || a.code.localeCompare(b.code))
    .map(t => ({ code: t.code, label: t.name_th }));
}

/** ค่าจาก ?type= → รหัสประเภทที่อยู่ในช่องให้เลือก · ไม่มี/ไม่รู้จัก/ยังโหลดประเภทไม่เสร็จ = '' (ทุกประเภท) */
export function resolveTypeParam(raw: string | null | undefined, types: readonly PettyExpenseType[]): string {
  const want = (raw ?? '').trim().toUpperCase();
  if (!want) return '';
  return typeOptions(types).find(o => o.code.toUpperCase() === want)?.code ?? '';
}

/** query string ใหม่ที่ตั้ง/ลบ type แล้ว พารามิเตอร์อื่น (tab, doc) อยู่ที่เดิม · ไม่มี ? นำหน้า */
export function withTypeParam(search: string, code: string): string {
  const qs = new URLSearchParams(search.startsWith('?') ? search.slice(1) : search);
  if (code) qs.set(TYPE_PARAM, code);
  else qs.delete(TYPE_PARAM);
  return qs.toString();
}

export function matchesType(claim: Pick<PettyClaim, 'expense_type'>, code: string): boolean {
  return !code || claim.expense_type === code;
}

export function filterByType<T extends Pick<PettyClaim, 'expense_type'>>(claims: readonly T[], code: string): T[] {
  return code ? claims.filter(c => c.expense_type === code) : [...claims];
}

// ---------------------------------------------------------------- รอบ

type Seen = { type: string; amount: number };
/** รอบ → ใบที่รู้ (กันนับซ้ำด้วย id ใบ) */
export type RoundTypeTally = Map<number, Map<number, Seen>>;

/** นับใบในแต่ละรอบจากใบที่มี batch_id และจากรายละเอียดรอบ (round.claims) ที่โหลดมาแล้ว */
export function tallyRoundTypes(claims: readonly PettyClaim[], rounds: readonly PettyRound[] = []): RoundTypeTally {
  const out: RoundTypeTally = new Map();
  const add = (roundId: number, c: PettyClaim) => {
    let seen = out.get(roundId);
    if (!seen) out.set(roundId, (seen = new Map()));
    seen.set(c.id, { type: c.expense_type, amount: c.amount });
  };
  for (const c of claims) if (c.batch_id !== null && c.batch_id !== undefined) add(c.batch_id, c);
  for (const r of rounds) for (const c of r.claims ?? []) add(r.id, c);
  return out;
}

const roundSize = (round: PettyRound, known: number) => round.claim_count ?? round.claims?.length ?? known;

/** ใบประเภทนี้ในรอบ · complete = รู้ครบทุกใบของรอบแล้ว (ไม่ครบ แปลว่า count อาจน้อยกว่าจริง) */
export function roundTypeCount(round: PettyRound, code: string, tally: RoundTypeTally): { count: number; amount: number; complete: boolean } {
  const seen = [...(tally.get(round.id)?.values() ?? [])];
  const mine = seen.filter(s => s.type === code);
  return {
    count: mine.length,
    amount: Math.round(mine.reduce((s, x) => s + x.amount, 0) * 100) / 100,
    complete: seen.length >= roundSize(round, seen.length),
  };
}

/** รอบที่ยังตัดสินไม่ได้ (รู้ใบไม่ครบ) — หน้าเว็บใช้เลือกว่าจะโหลดรายละเอียดรอบไหนเพิ่ม */
export function roundsMissingTally(rounds: readonly PettyRound[], tally: RoundTypeTally): number[] {
  return rounds.filter(r => !roundTypeCount(r, '', tally).complete).map(r => r.id);
}

/** มีใบประเภทนี้อย่างน้อยหนึ่งใบ · ยังไม่รู้ = เก็บไว้ก่อน ไม่ซ่อนงาน · รอบที่ไม่มีใบเหลือ (ไม่อนุมัติเคลียร์) = ไม่ผ่าน */
export function roundMatchesType(round: PettyRound, code: string, tally: RoundTypeTally): boolean {
  if (!code) return true;
  const { count, complete } = roundTypeCount(round, code, tally);
  return count > 0 || !complete;
}

export function filterRoundsByType<T extends PettyRound>(rounds: readonly T[], code: string, tally: RoundTypeTally): T[] {
  return code ? rounds.filter(r => roundMatchesType(r, code, tally)) : [...rounds];
}

/** ป้ายเล็กบนการ์ด/แถวรอบ ให้เห็นว่ารอบนี้มีใบประเภทที่กรองกี่ใบ · ไม่มีอะไรจะบอก = null */
export function roundTypeHint(round: PettyRound, code: string, tally: RoundTypeTally, typeName: (code: string) => string): string | null {
  if (!code) return null;
  const { count, complete } = roundTypeCount(round, code, tally);
  if (count === 0) return null;
  const name = typeName(code);
  if (!complete) return `มี${name}อย่างน้อย ${count} ใบ`;
  const total = roundSize(round, count);
  return count >= total ? `${name}ทั้งรอบ ${total} ใบ` : `มี${name} ${count} จาก ${total} ใบ`;
}

/** คอลัมน์ต่อท้าย Excel ของรอบ เมื่อกรองประเภท — ยอดรอบเดิมยังอยู่ เพิ่มยอดเฉพาะประเภทนี้ให้ดูคู่กัน */
export function typeRoundColumns(code: string, typeName: (code: string) => string, tally: RoundTypeTally): WorklistColumn<PettyRound>[] {
  if (!code) return [];
  const name = typeName(code);
  return [
    {
      label: `จำนวนใบ${name}`,
      text: r => String(roundTypeCount(r, code, tally).count),
      value: r => roundTypeCount(r, code, tally).count,
    },
    {
      label: `ยอด${name}`, money: true,
      text: r => formatBaht(roundTypeCount(r, code, tally).amount),
      value: r => roundTypeCount(r, code, tally).amount,
    },
  ];
}

// ---------------------------------------------------------------- โหลดใบทุกหน้า

export type ClaimPageLike = { total: number; items: PettyClaim[] };

/**
 * ดึงใบทุกหน้าแบบ offset (BE ให้ทีละไม่เกิน 200) — แบบ fetchAllAdvances ของ /finance
 * รายการเปลี่ยนระหว่างดึงอาจได้แถวซ้ำ จึงกันด้วย id · มีเพดานหน้า complete=false เมื่อชนเพดานหรือหน้าว่างก่อนครบ
 */
export async function fetchAllClaimPages(
  getPage: (offset: number, limit: number) => Promise<ClaimPageLike>,
  pageSize = 200,
  maxPages = 10,
): Promise<{ items: PettyClaim[]; total: number; complete: boolean }> {
  const byId = new Map<number, PettyClaim>();
  let offset = 0;
  let total = 0;
  let pages = 0;
  let complete = false;
  while (pages < maxPages) {
    const res = await getPage(offset, pageSize);
    pages += 1;
    total = res.total;
    for (const c of res.items) if (!byId.has(c.id)) byId.set(c.id, c);
    offset += pageSize;
    if (res.items.length === 0) { complete = byId.size >= res.total; break; }
    if (offset >= res.total) { complete = true; break; }
  }
  return { items: [...byId.values()], total, complete };
}
