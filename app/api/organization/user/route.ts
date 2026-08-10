import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

// เรียงจาก updated_at ล่าสุด → เก่าสุด (fallback: created_at, id)
const toTime = (value: unknown) => {
    const t = value ? Date.parse(String(value)) : NaN;
    return Number.isNaN(t) ? null : t;
};

const sortByRecent = (users: any[]) =>
    [...users].sort((a, b) => {
        const at = toTime(a?.updated_at) ?? toTime(a?.created_at);
        const bt = toTime(b?.updated_at) ?? toTime(b?.created_at);
        if (at !== null && bt !== null && at !== bt) return bt - at;
        if (at !== null && bt === null) return -1;
        if (at === null && bt !== null) return 1;
        return (b?.id ?? 0) - (a?.id ?? 0);
    });

export async function GET(request: NextRequest) {
    const res = await fetch(`${process.env.URL_API}/users`, {
        method: "GET",
        headers: {
            "Content-Type": "application/json",
        },
    });
    const data = await res.json();
    if (!res.ok) {
        return NextResponse.json({ error: data?.detail || 'Failed to fetch users' }, { status: res.status });
    }
    const users = Array.isArray(data) ? data : [];
    // ?status=Inactive / ?status=all — defaults to Active
    const status = request.nextUrl.searchParams.get('status') || 'Active';
    if (status.toLowerCase() === 'all') {
        return NextResponse.json(sortByRecent(users));
    }
    const filteredData = users.filter(
        (user: any) => (user.employee_status || '').toLowerCase() === status.toLowerCase()
    );
    return NextResponse.json(sortByRecent(filteredData));
}

export async function PUT(request: NextRequest) {
    const body = await request.json();
    const { employee_id, ...payload } = body;
    const res = await fetch(`${process.env.URL_API}/users/${employee_id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
    });
    const data = await res.json();
    if (!res.ok) {
        return NextResponse.json({ error: data?.detail || 'Update failed' }, { status: res.status });
    }
    return NextResponse.json(data);
}

export async function POST(request: NextRequest) {
    const body = await request.json();
    const res = await fetch(`${process.env.URL_API}/auth/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
    });
    const data = await res.json();
    if (!res.ok) {
        return NextResponse.json({ error: data?.detail || 'Registration failed' }, { status: res.status });
    }
    return NextResponse.json(data);
}