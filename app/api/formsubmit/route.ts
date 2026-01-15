import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

export async function GET(request: NextRequest) {
    const { searchParams } = new URL(request.url);
    const path = searchParams.get('path');
    const res = await fetch("https://api-ncac.onrender.com/forms/" + path, {
        method: "GET",
    });
    const data = await res.json();
    console.log('data : ',data)
    if (!res.ok) {
        return NextResponse.json({ error: data?.detail }, { status: res.status });
    }
    
    return NextResponse.json(data);

}