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
  return `${u.pathname}${u.search}${u.hash}`;
}
