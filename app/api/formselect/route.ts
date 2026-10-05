import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { requireUser } from '@/lib/finance/server';
import { FORM_ID_PATTERN } from '@/lib/s3';

export async function GET(request: NextRequest) {
    const guard = await requireUser(request);
    if ('error' in guard) return guard.error;
    const path = new URL(request.url).searchParams.get('path');
    if (!path || !FORM_ID_PATTERN.test(path)) {
        return NextResponse.json({ error: 'รหัสฟอร์มไม่ถูกต้อง' }, { status: 400 });
    }
    const res = await fetch(`${process.env.URL_API}/forms?form_id=${encodeURIComponent(path)}`, {
        method: "GET",
    });
    const data = await res.json();
    if (!res.ok) {
        return NextResponse.json({ error: data?.detail }, { status: res.status });
    }

    return NextResponse.json(data);
}
