import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

export async function PUT(request: NextRequest) {
    const { form_id, new_status, employee_id }  = await request.json();
    const apiUrl = `${process.env.URL_API}/forms/${form_id}/status?new_status=${encodeURIComponent(new_status)}&employee_id=${encodeURIComponent(employee_id)}`;
    const res = await fetch(apiUrl, {
        method: "PUT",
        headers: {
            'Content-Type': 'application/json',
        },
    });
    if (!res.ok) {
        const errorData = await res.json();
        return NextResponse.json({ error: errorData?.detail || 'Unknown error' }, { status: res.status });
    }
    return NextResponse.json(await res.json());
}