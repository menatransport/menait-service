import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

export async function GET(request: NextRequest) {
    const param = request.nextUrl.searchParams.get('employee_id');
    const tab = request.nextUrl.searchParams.get('tab') || 'pending'; // 'my' or 'pending'
    const role = request.nextUrl.searchParams.get('role') || '';
    
    const endpoint = tab === 'my' 
        ? `${process.env.URL_API}/forms${role === 'a' ? '' : `?employee_id=${param}`}`
        : `${process.env.URL_API}/forms/pending-approvals?employee_id=${param}`;
    
    const res = await fetch(endpoint, {
        method: "GET",
    });
    const data = await res.json();
    // console.log('data : ', data);
    if (!res.ok) {
        return NextResponse.json({ error: data?.detail }, { status: res.status });
    }
    return NextResponse.json(data);
}

export async function POST (request: NextRequest) {
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
    