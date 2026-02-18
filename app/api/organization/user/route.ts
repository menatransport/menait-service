import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

export async function GET(request: NextRequest) {
    const res = await fetch("https://api-ncac.onrender.com/users", {
        method: "GET",
        headers: {
            "Content-Type": "application/json",
        },
    });
    const data = await res.json();
    if (!res.ok) {
        return NextResponse.json({ error: data?.detail }, { status: res.status });
    }
    return NextResponse.json(data);
}