import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

// Cache for form data to avoid repeated fetches (server-cache-lru pattern)
const formCache = new Map<string, { data: any; timestamp: number }>();
const CACHE_TTL = 5 * 60 * 1000; // 5 minutes

export async function GET(request: NextRequest) {
    const { searchParams } = new URL(request.url);
    const path = searchParams.get('path');
    
    if (!path) {
        return NextResponse.json({ error: 'Missing path parameter' }, { status: 400 });
    }

    // Check cache first (server-cache-lru)
    const cached = formCache.get(path);
    if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
        return NextResponse.json(cached.data);
    }

    try {
        const res = await fetch(`https://api-ncac.onrender.com/forms/${path}`, {
            method: "GET",
            // Add cache headers for better performance
            next: { revalidate: 300 } // Cache for 5 minutes
        });
        
        const data = await res.json();
        console.log('data:', data);
        
        if (!res.ok) {
            return NextResponse.json({ error: data?.detail }, { status: res.status });
        }
        
        // Store in cache
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