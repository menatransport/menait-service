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
