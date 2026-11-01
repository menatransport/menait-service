import { NextResponse, type NextRequest } from 'next/server';
import { beUrl, requireUser } from '@/lib/finance/server';

/**
 * Forwards /api/access-review/* to the ncacdb backend (/access-review/*) — see app/access-review/types.ts
 * for the contract. The backend owns every rule (who can see/decide what); this only checks the login
 * and passes on who is calling via X-Employee-Id, same pattern as /api/ops/[...path]/route.ts.
 */

type Ctx = { params: Promise<{ path: string[] }> };

// ids and route words only — never "." / ".." that would let the URL climb out of /access-review
const SEGMENT = /^[A-Za-z0-9_-]+$/;

async function forward(req: NextRequest, { params }: Ctx) {
    const guard = await requireUser(req);
    if ('error' in guard) return guard.error;

    const { path } = await params;
    if (!path.length || !path.every(s => SEGMENT.test(s))) {
        return NextResponse.json({ error: 'ไม่พบ endpoint' }, { status: 404 });
    }

    const url = `${beUrl(`/access-review/${path.join('/')}`)}${req.nextUrl.search}`;
    const headers: Record<string, string> = { 'X-Employee-Id': guard.user.employee_id };
    let body: ArrayBuffer | undefined;
    if (req.method !== 'GET' && req.method !== 'DELETE') {
        // raw bytes keep the multipart boundary of the import upload intact
        body = await req.arrayBuffer();
        const type = req.headers.get('content-type');
        if (type) headers['Content-Type'] = type;
    }

    try {
        const res = await fetch(url, { method: req.method, headers, body, cache: 'no-store' });
        if (res.status === 204) return new NextResponse(null, { status: 204 });
        const text = await res.text();
        let data: unknown = null;
        try { data = text ? JSON.parse(text) : null; } catch { data = { detail: text }; }
        return NextResponse.json(data, { status: res.status });
    } catch (err) {
        console.error('access-review proxy error:', err);
        return NextResponse.json({ error: 'ไม่สามารถเชื่อมต่อระบบได้' }, { status: 502 });
    }
}

export { forward as GET, forward as POST, forward as PUT, forward as PATCH, forward as DELETE };
