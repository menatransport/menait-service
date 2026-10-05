import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { requireUser } from '@/lib/finance/server';
import { isAdvTarget } from '@/lib/finance/formsubmit-guard';
import { FORM_ID_PATTERN } from '@/lib/s3';

export async function PUT(request: NextRequest) {
    const guard = await requireUser(request);
    if ('error' in guard) return guard.error;
    const body = await request.json().catch(() => null);
    const form_id = body?.form_id;
    const new_status = body?.new_status;
    if (typeof form_id !== 'string' || !FORM_ID_PATTERN.test(form_id)) {
        return NextResponse.json({ error: 'หมายเลขเอกสารไม่ถูกต้อง' }, { status: 400 });
    }
    // an ADV's ticket status (e.g. Done) would lock the requester's edit — Finance owns ADV state
    if (isAdvTarget({ formId: form_id })) {
        return NextResponse.json({ error: 'สถานะเบิกเงิน Advance จัดการผ่านระบบการเงินเท่านั้น' }, { status: 403 });
    }
    if (typeof new_status !== 'string' || !new_status) {
        return NextResponse.json({ error: 'สถานะไม่ถูกต้อง' }, { status: 400 });
    }
    // the actor is the session user, never the browser's employee_id
    const qs = new URLSearchParams({ new_status, employee_id: guard.user.employee_id });
    const apiUrl = `${process.env.URL_API}/forms/${form_id}/status?${qs.toString()}`;
    const res = await fetch(apiUrl, {
        method: "PUT",
        headers: {
            'Content-Type': 'application/json',
        },
    });
    if (!res.ok) {
        const errorData = await res.json().catch(() => null);
        return NextResponse.json({ error: errorData?.detail || 'Unknown error' }, { status: res.status });
    }
    return NextResponse.json(await res.json());
}
