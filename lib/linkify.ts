/** http(s) with a host — the same rule the backend applies */
export const isHttpUrl = (v: string) => {
    try {
        const u = new URL(v);
        return (u.protocol === 'http:' || u.protocol === 'https:') && Boolean(u.host);
    } catch {
        return false;
    }
};

export type TextPart = { text: string; href?: string };

// stops at whitespace, quotes, angle brackets and Thai letters ("ดูที่https://x.comครับ")
const URL_RE = /https?:\/\/[^\s<>"'\u0E00-\u0E7F]+/gi;
const TRAILING = /[.,;:!?]+$/;

/** Drops sentence punctuation and an unmatched closing bracket from the end of a match. */
function trimUrl(raw: string): string {
    let url = raw;
    for (;;) {
        const before = url;
        url = url.replace(TRAILING, '');
        for (const [open, close] of [['(', ')'], ['[', ']']]) {
            if (url.endsWith(close) && url.split(close).length > url.split(open).length) url = url.slice(0, -1);
        }
        if (url === before) return url;
    }
}

/** Splits plain text into text and http(s) link parts, in order; joining every `text` gives the input back. */
export function linkifyText(text: string): TextPart[] {
    const parts: TextPart[] = [];
    let last = 0;
    for (const m of text.matchAll(URL_RE)) {
        const url = trimUrl(m[0]);
        if (!isHttpUrl(url)) continue;
        const start = m.index!;
        if (start > last) parts.push({ text: text.slice(last, start) });
        parts.push({ text: url, href: url });
        last = start + url.length;
    }
    if (last < text.length) parts.push({ text: text.slice(last) });
    return parts;
}
