'use client';

import { useEffect, useRef, useState } from 'react';
import { Copy, MessageSquareText } from 'lucide-react';
import { approvalLink, approvalMessage } from '@/lib/finance/shareLink';
import { fetchJson } from '../api';
import type { AdvanceDetail, SuggestedApprovers } from '../types';
import { Panel } from './FinanceShell';

export function ShareApprovalLink({ detail }: { detail: AdvanceDetail }) {
  const [data, setData] = useState<SuggestedApprovers | null>(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const [copied, setCopied] = useState<'link' | 'msg' | null>(null);
  const [origin, setOrigin] = useState('');
  const linkRef = useRef<HTMLInputElement>(null);
  const msgRef = useRef<HTMLTextAreaElement>(null);
  const formId = detail.form_id;

  useEffect(() => { setOrigin(window.location.origin); }, []);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    fetchJson<SuggestedApprovers>(`/api/finance/advances/${encodeURIComponent(formId)}/approvers`)
      .then(d => { if (!cancelled) { setData(d); setError(''); } })
      .catch(err => { if (!cancelled) setError(err.message); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [formId]);

  const link = origin ? approvalLink(origin, formId) : '';
  const message = link ? approvalMessage(detail, link) : '';

  const copy = async (kind: 'link' | 'msg') => {
    try {
      await navigator.clipboard.writeText(kind === 'link' ? link : message);
      setCopied(kind);
      setTimeout(() => setCopied(null), 2000);
    } catch {
      const el = kind === 'link' ? linkRef.current : msgRef.current;
      el?.focus();
      el?.select();
    }
  };

  return (
    <Panel title="ส่งลิงก์ขออนุมัติ">
      {loading ? (
        <p className="text-sm text-gray-400">กำลังโหลด...</p>
      ) : error ? (
        <p className="text-sm text-rose-600">{error}</p>
      ) : data && (
        <div className="space-y-4">
          <div>
            <p className="text-xs text-gray-500">ผู้อนุมัติที่แนะนำ</p>
            <p className="mb-2 text-sm text-gray-700">{`ข้อ ${data.clause} · ${data.approver_label} — ผู้อนุมัติระดับ ${data.required_level} ขึ้นไป`}</p>
            {data.approvers.length === 0 ? (
              <p className="text-sm text-amber-700">ไม่พบผู้อนุมัติที่เหมาะสม กรุณาติดต่อฝ่ายการเงิน</p>
            ) : (
              <ul className="space-y-1">
                {data.approvers.map(a => (
                  <li key={a.employee_id} className="rounded-xl border border-gray-100 bg-gray-50 px-3 py-2 text-sm text-gray-800">
                    {[a.name, a.position, a.department].map(v => v || '-').join(' · ')}
                  </li>
                ))}
              </ul>
            )}
          </div>
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
            <input
              ref={linkRef}
              readOnly
              value={link}
              onFocus={e => e.currentTarget.select()}
              className="min-w-0 flex-1 rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm text-gray-700"
            />
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => copy('link')}
                disabled={!link}
                className="inline-flex items-center gap-1.5 rounded-xl border border-[#026a75] bg-white px-4 py-2 text-sm font-medium text-[#026a75] transition-colors hover:bg-[#026a75]/5 disabled:opacity-50"
              >
                <Copy className="h-4 w-4" /> {copied === 'link' ? 'คัดลอกแล้ว' : 'คัดลอกลิงก์'}
              </button>
            </div>
          </div>
          <div className="space-y-2">
            <textarea
              ref={msgRef}
              readOnly
              rows={4}
              value={message}
              onFocus={e => e.currentTarget.select()}
              className="w-full rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm text-gray-700"
            />
            <button
              type="button"
              onClick={() => copy('msg')}
              disabled={!message}
              className="inline-flex items-center gap-1.5 rounded-xl bg-[#026a75] px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-[#055058] disabled:opacity-50"
            >
              <MessageSquareText className="h-4 w-4" /> {copied === 'msg' ? 'คัดลอกแล้ว' : 'คัดลอกข้อความ (ส่ง LINE)'}
            </button>
          </div>
        </div>
      )}
    </Panel>
  );
}
