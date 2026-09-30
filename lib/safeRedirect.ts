const BASE = 'https://same-origin.invalid';

/**
 * Only same-site absolute paths may be used as a post-login destination.
 * Parsing (instead of prefix checks) matters: WHATWG URL strips tab/LF/CR, so "/\t/evil.com" would become "//evil.com".
 */
export function safeNextPath(next: string | null | undefined): string | null {
  if (!next || next[0] !== '/' || /[\u0000-\u001f\\]/.test(next)) return null;
  let u: URL;
  try { u = new URL(next, BASE); } catch { return null; }
  if (u.origin !== BASE) return null;
  if (u.pathname === '/login' || u.pathname.startsWith('/login/')) return null;
  const out = `${u.pathname}${u.search}${u.hash}`;
  // Dot segments collapse ("/..//evil.com" -> "//evil.com"), so re-check the normalized result.
  if (!out.startsWith('/') || out.startsWith('//') || out.startsWith('/\\')) return null;
  try { if (new URL(out, BASE).origin !== BASE) return null; } catch { return null; }
  return out;
}
