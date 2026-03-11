import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

export async function GET(request: NextRequest) {
    const { searchParams } = new URL(request.url);
    const employeeId = searchParams.get('employee_id');
    const res = await fetch(`${process.env.URL_API}/users/${employeeId}`, { //
        method: "GET",
    });
    const data = await res.json();
    // console.log('data : ',data)
    if (!res.ok) {
        return NextResponse.json({ error: data?.detail }, { status: res.status });
    }
    
    return NextResponse.json(data);

}