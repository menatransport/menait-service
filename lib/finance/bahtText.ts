const DIGITS = ['', 'หนึ่ง', 'สอง', 'สาม', 'สี่', 'ห้า', 'หก', 'เจ็ด', 'แปด', 'เก้า'];
const PLACES = ['', 'สิบ', 'ร้อย', 'พัน', 'หมื่น', 'แสน'];

/** One group of up to 6 digits. `hasHigher` = a larger ล้าน group precedes it. */
function group(n: number, hasHigher: boolean): string {
  const s = String(n).padStart(6, '0').replace(/^0+(?=\d)/, '');
  let out = '';
  for (let i = 0; i < s.length; i++) {
    const d = Number(s[i]);
    const place = s.length - 1 - i;
    if (d === 0) continue;
    if (place === 1) {
      out += (d === 1 ? '' : d === 2 ? 'ยี่' : DIGITS[d]) + 'สิบ';
    } else if (place === 0) {
      out += d === 1 && (s.length > 1 || hasHigher) ? 'เอ็ด' : DIGITS[d];
    } else {
      out += DIGITS[d] + PLACES[place];
    }
  }
  return out;
}

function integerWords(n: number): string {
  if (n === 0) return 'ศูนย์';
  const parts: number[] = [];
  let rest = n;
  while (rest > 0) { parts.unshift(rest % 1_000_000); rest = Math.floor(rest / 1_000_000); }
  let out = '';
  parts.forEach((p, i) => {
    const isLast = i === parts.length - 1;
    if (p === 0) { if (!isLast) return; return; }
    out += group(p, i > 0) + (isLast ? '' : 'ล้าน');
  });
  return out;
}

/** Excel BAHTTEXT-style Thai baht words. */
export function bahtText(amount: number): string {
  const total = Math.round(Math.abs(amount) * 100);
  const baht = Math.floor(total / 100);
  const satang = total % 100;
  if (baht === 0 && satang === 0) return 'ศูนย์บาทถ้วน';
  if (baht === 0) return `${integerWords(satang)}สตางค์`;
  if (satang === 0) return `${integerWords(baht)}บาทถ้วน`;
  return `${integerWords(baht)}บาท${integerWords(satang)}สตางค์`;
}
