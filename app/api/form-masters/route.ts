import { NextResponse, type NextRequest } from 'next/server';
import { query } from '@/lib/db';
import { requireUser } from '@/lib/finance/server';

// Fixed, parameter-free form_masters lists. Replaces the old /api/form?query=<SQL> route, which ran
// browser-supplied SQL (a prefix-only regex let a UNION read any table, e.g. fin_payee_accounts).
const LISTS = {
    // active service forms (home search, /service picker)
    service: `SELECT id, form_code, form_name FROM form_masters WHERE form_type = 'Service' AND form_status = 'Active' AND is_latest = true ORDER BY form_code DESC`,
    // every latest form version (/master)
    all: `SELECT id, form_type, form_code, form_name, form_status, created_at FROM form_masters WHERE is_latest = true ORDER BY id DESC`,
} as const;

export async function GET(request: NextRequest) {
    const guard = await requireUser(request);
    if ('error' in guard) return guard.error;
    const list = request.nextUrl.searchParams.get('list');
    if (list !== 'service' && list !== 'all') {
        return NextResponse.json({ error: 'list ไม่ถูกต้อง' }, { status: 400 });
    }
    try {
        const result = await query(LISTS[list]);
        return NextResponse.json(result.rows);
    } catch (error) {
        console.error('GET /api/form-masters error:', error);
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}
