import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

export async function POST(request: NextRequest) {
    const reqBody = await request.json();
    const isGoogleLogin = 'id_token' in reqBody;
    const endpoint = isGoogleLogin 
        ? `${process.env.URL_API}/auth/login/google`
        : `${process.env.URL_API}/auth/login`;
    
    const res = await fetch(endpoint, {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
        },
        body: JSON.stringify(reqBody),
    });
    const data = await res.json();
    if (!res.ok) {
        return NextResponse.json({ error: data?.detail }, { status: res.status });
    }
    return NextResponse.json(data);
}

