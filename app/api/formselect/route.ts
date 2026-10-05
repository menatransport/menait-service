import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { canViewAdv, requireUser } from '@/lib/finance/server';
import { isAdvTarget } from '@/lib/finance/formsubmit-guard';
import { isAdvanceItem } from '@/lib/finance/scope';
import { FORM_ID_PATTERN } from '@/lib/s3';

const forbidden = () => NextResponse.json({ error: 'ไม่มีสิทธิ์ดูรายการนี้' }, { status: 403 });

export async function GET(request: NextRequest) {
    const guard = await requireUser(request);
    if ('error' in guard) return guard.error;
    const path = new URL(request.url).searchParams.get('path');
    if (!path || !FORM_ID_PATTERN.test(path)) {
        return NextResponse.json({ error: 'รหัสฟอร์มไม่ถูกต้อง' }, { status: 400 });
    }
    // ADV values hold bank details: only Finance, the requester and its approvers (canViewAdv)
    const advId = isAdvTarget({ formId: path });
    if (advId && !(await canViewAdv(guard.user, path))) return forbidden();
    const res = await fetch(`${process.env.URL_API}/forms?form_id=${encodeURIComponent(path)}`, {
        method: "GET",
    });
    const data = await res.json();
    if (!res.ok) {
        return NextResponse.json({ error: data?.detail }, { status: res.status });
    }
    // belt and braces: an Advance-type submission whose id doesn't carry the ADV- prefix gets the same rule
    if (!advId && Array.isArray(data) && data.some(isAdvanceItem) && !(await canViewAdv(guard.user, path))) {
        return forbidden();
    }

    return NextResponse.json(data);
}
