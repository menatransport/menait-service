import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

export async function POST(request: NextRequest) {
    const reqBody = await request.json();
    const isGoogleLogin = 'id_token' in reqBody;
    const endpoint = isGoogleLogin 
        ? "https://api-ncac.onrender.com/auth/login/google"
        : "https://api-ncac.onrender.com/auth/login";
    
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

