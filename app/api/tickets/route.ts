import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

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
    return NextResponse.json(data);
}

export async function POST(request: NextRequest) {
    const { form_id, employee_id, action, remark } = await request.json();

    const res = await fetch(`${process.env.URL_API}/forms/${form_id}/${action}?employee_id=${employee_id}&remark=${remark || ''}`, {
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
