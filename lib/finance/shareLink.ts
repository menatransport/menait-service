import { formatBaht } from './status';

export function approvalLink(origin: string, formId: string): string {
  return `${origin.replace(/\/+$/, '')}/finance/approvals?doc=${encodeURIComponent(formId)}`;
}

export function approvalMessage(
  detail: { form_id: string; request: { amount: number | null; purpose: string | null } },
  link: string,
): string {
  const purpose = (detail.request.purpose ?? '').trim() || '-';
  return `ขออนุมัติเบิกเงิน Advance ${detail.form_id}\nจำนวน ${formatBaht(detail.request.amount)} บาท\nเพื่อ ${purpose}\n${link}`;
}

export function lineShareUrl(message: string): string {
  return `https://line.me/R/msg/text/?${encodeURIComponent(message)}`;
}

/** Only same-site absolute paths may be used as a post-login destination (blocks open redirects). */
export function safeNextPath(next: string | null | undefined): string | null {
  if (!next || !next.startsWith('/') || next.startsWith('//') || next.startsWith('/\\')) return null;
  if (next === '/login' || next.startsWith('/login?') || next.startsWith('/login/')) return null;
  return next;
}
