import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

export async function PATCH(request: NextRequest) {
    const body = await request.json();
    const { formCode, newStatus } = body;
    if (!formCode || !newStatus) {
        return NextResponse.json({ error: "กรุณาระบุรหัสฟอร์มและสถานะใหม่" }, { status: 400 });
    }
    const res = await fetch(`${process.env.URL_API}/forms/${formCode}/status?status=${newStatus}`, {
        method: "PATCH",
        headers: {
            "Content-Type": "application/json",
        }
    });
    const data = await res.json();
    if (!res.ok) {
        return NextResponse.json({ error: data?.detail }, { status: res.status });
    }
    return NextResponse.json({ message: "อัปเดตสถานะฟอร์มเรียบร้อย", data });
}