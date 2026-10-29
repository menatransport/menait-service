/**
 * รหัสตำแหน่งยาง ชุดเดียวกับผังล้อของ WMS (components/tire/fleet-page.tsx) — ต้องตรงกับ TIRE_POSITIONS ใน BE
 * ใบยางหนึ่งแถวมีได้หลายเส้น จึงเก็บเป็นรหัสคั่นด้วย , เช่น "RA1,RA2"
 */
export const TIRE_AXLES: { label: string; left: string[]; right: string[] }[] = [
  { label: 'หน้า 1', left: ['F1'], right: ['F2'] },
  { label: 'หน้า 2', left: ['F3'], right: ['F4'] },
  { label: 'หลัง 1', left: ['RA1', 'RA2'], right: ['RA3', 'RA4'] },
  { label: 'หลัง 2', left: ['RA5', 'RA6'], right: ['RA7', 'RA8'] },
  { label: 'หาง 1', left: ['RB1', 'RB2'], right: ['RB3', 'RB4'] },
  { label: 'หาง 2', left: ['RB5', 'RB6'], right: ['RB7', 'RB8'] },
  { label: 'หาง 3', left: ['RB9', 'RB10'], right: ['RB11', 'RB12'] },
];
export const SPARE_TIRES = ['RB13'];
export const TIRE_CODES: string[] = [...TIRE_AXLES.flatMap(a => [...a.left, ...a.right]), ...SPARE_TIRES];

/** "ra2, F1, zz9" → ['F1','RA2'] · ทิ้งรหัสที่ไม่รู้จักและตัวซ้ำ เรียงตามผังล้อหน้า→ท้าย */
export function parsePositions(raw: string | null | undefined): string[] {
  const picked = new Set(String(raw ?? '').split(',').map(c => c.trim().toUpperCase()).filter(Boolean));
  return TIRE_CODES.filter(c => picked.has(c));
}

export function formatPositions(codes: readonly string[]): string {
  return parsePositions(codes.join(',')).join(',');
}

export function togglePosition(raw: string | null | undefined, code: string): string {
  const now = parsePositions(raw);
  return formatPositions(now.includes(code) ? now.filter(c => c !== code) : [...now, code]);
}

/** เตือน (ไม่บล็อก) เมื่อจำนวนตำแหน่งที่เลือกไม่เท่าจำนวนเส้น — ยังไม่เลือกเลยให้ด่านช่องบังคับบอกเอง */
export function positionCountHint(raw: string | null | undefined, qty: number | string | null | undefined): string | null {
  const count = parsePositions(raw).length;
  const want = Number(qty ?? 0);
  if (count === 0 || !Number.isFinite(want) || want <= 0 || count === want) return null;
  return `เลือก ${count} ตำแหน่ง แต่จำนวน ${want} เส้น`;
}
