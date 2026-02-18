import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

const formCache = new Map<string, { data: any; timestamp: number }>();
const CACHE_TTL = 5 * 60 * 1000; 

export async function GET(request: NextRequest) {
    const { searchParams } = new URL(request.url);
    const path = searchParams.get('path');

    if (!path) {
        return NextResponse.json({ error: 'Missing path parameter' }, { status: 400 });
    }

    const cached = formCache.get(path);
    if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
        return NextResponse.json(cached.data);
    }
    const version = searchParams.get('version');
    const versionQuery = version ? `?version=${version}` : '';
   
    try {
        const res = await fetch(`https://api-ncac.onrender.com/forms/${path}${versionQuery}`, {
            method: "GET",
            next: { revalidate: 300 }
        });

        const data = await res.json();
        console.log('data:', data);

        if (!res.ok) {
            console.error('Error response from API:', data);
            return NextResponse.json({ error: data?.detail }, { status: res.status });
        }

        formCache.set(path, { data, timestamp: Date.now() });

        return NextResponse.json(data);
    } catch (error) {
        console.error('GET /api/formsubmit error:', error);
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}

export async function POST(request: NextRequest) {
    try {
        const reqBody = await request.json();

        const res = await fetch("https://api-ncac.onrender.com/forms/submit", {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
            },
            body: JSON.stringify(reqBody),
        });

        const data = await res.json();
        console.log('data:', data);

        if (!res.ok) {
            return NextResponse.json({ error: data?.detail }, { status: res.status });
        }

        return NextResponse.json(data);
    } catch (error) {
        console.error('POST /api/formsubmit error:', error);
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}

export async function PUT(request: NextRequest) {
    try {
        const reqBody = await request.json();
        const { searchParams } = new URL(request.url);
        const path = searchParams.get('form_id');
        const res = await fetch(`https://api-ncac.onrender.com/forms/${path}`, {
            method: "PUT",
            headers: {
                "Content-Type": "application/json",
            },
            body: JSON.stringify(reqBody),
        });
        const data = await res.json();
        if (!res.ok) {
            console.error('Error response from API:', data);
            return NextResponse.json({ error: data?.detail }, { status: res.status });
        }
        return NextResponse.json(data);
    } catch (error) {
        console.error('PUT /api/formsubmit error:', error);
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}