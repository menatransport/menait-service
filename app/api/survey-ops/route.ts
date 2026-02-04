import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

export async function POST(request: NextRequest) {
    const reqBody = await request.json();
    if (process.env.NEXT_PUBLIC_SYSTEM_SCRIPT === undefined) {
        return NextResponse.json({ error: 'System script URL is not defined' }, { status: 500 });
    }
    const res = await fetch(process.env.NEXT_PUBLIC_SYSTEM_SCRIPT, {
        method: "POST",
        headers: {
            'Content-Type': 'application/json',
        },
        body: JSON.stringify(reqBody),
    });
    if (!res.ok) {
        const errorData = await res.json();
        return NextResponse.json({ error: errorData?.detail || 'Unknown error' }, { status: res.status });
    }
    return NextResponse.json(await res.json());
}