import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

export async function GET(request: NextRequest) {
    const res = await fetch(`${process.env.URL_API}/users`, {
        method: "GET",
        headers: {
            "Content-Type": "application/json",
        },
    });
    const data = await res.json();
    data.map((item: any) => {
        return item.employee_status = "Active";
    });
   
    if (!res.ok) {
        return NextResponse.json({ error: data?.detail }, { status: res.status });
    }
    return NextResponse.json(data);
}

export async function PUT(request: NextRequest) {
    const body = await request.json();
    const { id, ...payload } = body;
    if (!id) {
        return NextResponse.json({ error: 'Missing user id' }, { status: 400 });
    }
    const res = await fetch(`${process.env.URL_API}/users/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
    });
    const data = await res.json();
    if (!res.ok) {
        return NextResponse.json({ error: data?.detail }, { status: res.status });
    }
    return NextResponse.json(data);
}