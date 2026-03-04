import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

export async function GET(request: NextRequest) {

    const res = await fetch(`${process.env.URL_API}/position-levels/`, {
        method: "GET",
    });
    const data = await res.json();
    console.log('data : ',data)
    if (!res.ok) {
        return NextResponse.json({ error: data?.detail }, { status: res.status });
    }
    
    return NextResponse.json(data);

}