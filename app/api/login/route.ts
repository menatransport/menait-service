import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { signToken, COOKIE_NAME, EXPIRES_IN } from '@/lib/jwt';

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

    if (data.user) {
        data.user.role = [21].includes(data.user.department_id)
            ? 'a'
            : ["680043", "670108"].includes(data.user.employee_id)
                ? 'a'
                : 'u';
        const token = await signToken(data.user);
        const response = NextResponse.json(data);
        response.cookies.set(COOKIE_NAME, token, {
            httpOnly: true,
            secure: process.env.NODE_ENV === 'production',
            sameSite: 'lax',
            path: '/',
            maxAge: EXPIRES_IN,
        });
        return response;
    }

    return NextResponse.json(data);
}

