'use client';

import { useEffect, useState } from 'react';
import { Mail } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { MascotLoader } from '@/components/loading';
import { getMailPreview } from '../api';
import type { MailPreview } from '../types';

/** "ดูอีเมล" — the HTML ncacdb would send/sent, rendered in a sandboxed iframe (srcDoc, no scripts). */
export function MailPreviewDialog({ reviewId, open, onOpenChange }: { reviewId: number | null; open: boolean; onOpenChange: (v: boolean) => void }) {
    // Keyed on reviewId instead of nulling state synchronously when the dialog opens.
    const [result, setResult] = useState<{ reviewId: number; data: MailPreview | null; error: string | null } | null>(null);

    useEffect(() => {
        if (!open || reviewId == null) return;
        let alive = true;
        getMailPreview(reviewId)
            .then(res => { if (alive) setResult({ reviewId, data: res, error: null }); })
            .catch(() => { if (alive) setResult({ reviewId, data: null, error: 'โหลดตัวอย่างอีเมลไม่สำเร็จ' }); });
        return () => { alive = false; };
    }, [open, reviewId]);

    const data = result && reviewId != null && result.reviewId === reviewId ? result.data : null;
    const error = result && reviewId != null && result.reviewId === reviewId ? result.error : null;

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-3xl">
                <DialogHeader>
                    <DialogTitle className="flex items-center gap-2"><Mail className="size-4 text-brand-600" /> ตัวอย่างอีเมล</DialogTitle>
                </DialogHeader>
                {error ? (
                    <p className="py-8 text-center text-sm text-gray-500">{error}</p>
                ) : !data ? (
                    <div className="flex justify-center py-10"><MascotLoader text="กำลังโหลด" size={64} /></div>
                ) : (
                    <div className="space-y-2">
                        <p className="text-xs text-gray-500">ถึง: <span className="text-gray-700">{data.to.join(', ')}</span></p>
                        {data.cc?.length ? <p className="text-xs text-gray-500">สำเนา (CC): <span className="text-gray-700">{data.cc.join(', ')}</span></p> : null}
                        <p className="text-sm font-medium text-gray-800">{data.subject}</p>
                        <iframe
                            title="mail-preview"
                            sandbox=""
                            srcDoc={data.html}
                            className="w-full h-[60vh] rounded-xl border border-gray-200 bg-white"
                        />
                    </div>
                )}
            </DialogContent>
        </Dialog>
    );
}
