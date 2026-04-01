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
    const filteredData = data.filter((user: any) => user.employee_status === "Active");
    if (!res.ok) {
        return NextResponse.json({ error: data?.detail || 'Failed to fetch users' }, { status: res.status });
    }
    return NextResponse.json(filteredData);
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