import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

export async function GET(request: NextRequest) {
    const param = request.nextUrl.searchParams.get('employee_id');
    const res = await fetch(`https://api-ncac.onrender.com/forms/pending-approvals?employee_id=${param}`, {
        method: "GET",
    });
    const data = await res.json();
    console.log('data : ',data)
    if (!res.ok) {
        return NextResponse.json({ error: data?.detail }, { status: res.status });
    }
    return NextResponse.json(data);
}
    