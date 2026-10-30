/**
 * ตัวช่วยช่องค้นรถแบบ autocomplete (ผู้ใช้สั่ง 30/10/2026)
 * พิมพ์ส่วนไหนของเบอร์รถหรือทะเบียนก็ได้ ไม่สนตัวคั่น — ตรงกับ search_pattern ฝั่ง BE (petty_master.py)
 * ทะเบียนจริงหน้าตา "สบ.71-1325" คนพิมพ์ "711325" ก็ต้องเจอและเห็นว่าตรงตรงไหน
 */

const SEPARATOR = /[\s.\-]/;

export type HighlightPart = { text: string; hit: boolean };

/** แบ่งข้อความเป็นส่วนที่ตรงกับคำค้น (hit) และส่วนที่เหลือ · ตัวคั่นในข้อความที่อยู่กลางช่วงที่ตรงนับเป็นส่วนที่ตรงด้วย */
export function highlightParts(text: string, query: string): HighlightPart[] {
  const q = [...(query ?? '')].filter(ch => !SEPARATOR.test(ch)).join('').toUpperCase();
  if (!q) return [{ text, hit: false }];
  const chars = [...text];
  const kept: { ch: string; at: number }[] = [];
  chars.forEach((ch, at) => { if (!SEPARATOR.test(ch)) kept.push({ ch: ch.toUpperCase(), at }); });
  const start = kept.map(k => k.ch).join('').indexOf(q);
  if (start < 0) return [{ text, hit: false }];
  const from = kept[start].at;
  const to = kept[start + [...q].length - 1].at + 1;
  return [
    { text: chars.slice(0, from).join(''), hit: false },
    { text: chars.slice(from, to).join(''), hit: true },
    { text: chars.slice(to).join(''), hit: false },
  ].filter(part => part.text !== '');
}

/** ลูกศรขึ้น/ลงในรายการ วนรอบหัวท้าย · ยังไม่เลือก (-1) แล้วกดลง = แถวแรก กดขึ้น = แถวสุดท้าย */
export function stepIndex(current: number, delta: 1 | -1, length: number): number {
  if (length <= 0) return -1;
  if (current < 0) return delta > 0 ? 0 : length - 1;
  return (current + delta + length) % length;
}
