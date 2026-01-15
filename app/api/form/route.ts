import { query } from '@/lib/db';
import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

export async function GET(request: NextRequest) {
    try {
        const { searchParams } = new URL(request.url);
        const queryParam = searchParams.get('query');
        if (!queryParam) return NextResponse.json({ error: "ไม่มีคำสั่ง SQL" }, { status: 400 });
        const result = await query(queryParam);
        return NextResponse.json(result.rows);
    } catch (error) {
        return NextResponse.json({ error }, { status: 500 });
    }
}
