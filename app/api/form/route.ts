import { query } from '@/lib/db';
import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

const ALLOWED_QUERY_PATTERNS = [
    /^SELECT\s+[\w\s,*]+\s+FROM\s+form_masters/i,
];

export async function GET(request: NextRequest) {
    try {
        const { searchParams } = new URL(request.url);
        const queryParam = searchParams.get('query');
        // console.log('Received query:', queryParam);
        if (!queryParam) {
            return NextResponse.json({ error: "ไม่มีคำสั่ง SQL" }, { status: 400 });
        }
        
        const isAllowed = ALLOWED_QUERY_PATTERNS.some(pattern => pattern.test(queryParam));
        if (!isAllowed) {
            return NextResponse.json({ error: "Query not allowed" }, { status: 403 });
        }
        
        const result = await query(queryParam);
        return NextResponse.json(result.rows);
    } catch (error) {
        console.error('GET /api/form error:', error);
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}
