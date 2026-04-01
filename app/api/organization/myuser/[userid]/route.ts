import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

export async function GET(
    request: NextRequest,
    { params }: { params: Promise<{ userid: string }> }
) {
    const { userid } = await params;
    const res = await fetch(`${process.env.URL_API}/users/${userid}`, {
        method: "GET",
        headers: {
            "Content-Type": "application/json",
        },
    });
    const data = await res.json();
    if (!res.ok) {
        return NextResponse.json({ error: data?.detail }, { status: res.status });
    }
    const filteredData = Array.isArray(data)
        ? data.filter((user: any) => user.employee_status === "Active")
        : data;
    return NextResponse.json(filteredData);
}
