import { requireUser } from '@/lib/finance/server';
import { FORM_ID_PATTERN } from '@/lib/s3';
import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { filterByScope } from '@/lib/finance/scope';

export async function GET(request: NextRequest) {
    const sp = request.nextUrl.searchParams;
    const param = sp.get('employee_id');
    const tab = sp.get('tab') || 'pending';
    const view = sp.get('view') || '';
    const role = sp.get('role') || '';
    const status = sp.get('status') || '';
    const start_date = sp.get('start_date') || '';
    const end_date = sp.get('end_date') || '';
    const form_id = sp.get('form_id') || '';
    const scope = sp.get('scope') === 'advance' ? 'advance' : 'it';

    // Build query string from a record, skipping empty values
    const buildQS = (params: Record<string, string>) => {
        const usp = new URLSearchParams();
        Object.entries(params).forEach(([k, v]) => {
            if (v !== undefined && v !== null && v !== '') usp.set(k, v);
        });
        const s = usp.toString();
        return s ? `?${s}` : '';
    };

    const baseParams: Record<string, string> = {
        start_date,
        end_date,
        form_id,
    };

    let endpoint: string;
    if (tab === 'my') {
        endpoint = `${process.env.URL_API}/forms${buildQS({
            ...baseParams,
            ...(role === 'a' ? {} : { employee_id: param ?? '' }),
            status,
        })}`;
    } else if (status === 'Done') {
        endpoint = `${process.env.URL_API}/forms${buildQS({
            ...baseParams,
            ...(role === 'a' ? { status: 'Done' } : { employee_id: param ?? '', status: 'Done' }),
        })}`;
    } else if (view === 'history') {
        endpoint = `${process.env.URL_API}/forms/approval-history${buildQS({
            ...baseParams,
            employee_id: param ?? '',
        })}`;
    } else {
        endpoint = `${process.env.URL_API}/forms/pending-approvals${buildQS({
            ...baseParams,
            employee_id: param ?? '',
            status,
        })}`;
    }

    const res = await fetch(endpoint, { method: 'GET' });
    const data = await res.json();
    // console.log('data : ', data);
    if (!res.ok) {
        return NextResponse.json({ error: data?.detail }, { status: res.status });
    }
    // /forms, /forms/pending-approvals and /forms/approval-history all return a plain array;
    // filterByScope keeps this safe (unchanged) if the BE ever wraps the list in an object instead.
    return NextResponse.json(Array.isArray(data) ? filterByScope(data, scope) : data);
}

export async function POST(request: NextRequest) {
    // approve/reject act as the logged-in user: employee_id comes from the session, never the browser
    const guard = await requireUser(request);
    if ('error' in guard) return guard.error;
    const { form_id, action, remark } = await request.json();
    if (typeof form_id !== 'string' || !FORM_ID_PATTERN.test(form_id)) {
        return NextResponse.json({ error: 'หมายเลขเอกสารไม่ถูกต้อง' }, { status: 400 });
    }
    if (action !== 'approve' && action !== 'reject') {
        return NextResponse.json({ error: 'action ไม่ถูกต้อง' }, { status: 400 });
    }
    const qs = new URLSearchParams({ employee_id: guard.user.employee_id, remark: typeof remark === 'string' ? remark : '' });

    const res = await fetch(`${process.env.URL_API}/forms/${form_id}/${action}?${qs.toString()}`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
        }
    });
    if (!res.ok) {
        const data = await res.json();
        return NextResponse.json({ error: data?.detail }, { status: res.status });
    }
    return NextResponse.json({ message: 'Action completed successfully' });
}
