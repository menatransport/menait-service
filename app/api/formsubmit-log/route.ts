import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

export async function GET(request: NextRequest) {
    try {
        const { searchParams } = new URL(request.url);
        const path = searchParams.get('form_id');
        const res = await fetch(`${process.env.URL_API}/forms/${path}/logs`, {
            'method': 'GET',
        });
        const data = await res.json();
        return NextResponse.json(data);
    } catch (error) {
        return NextResponse.error();
    }
}