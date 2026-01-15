import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

export async function POST(request: NextRequest) {
    const body = await request.json();
    const { formData, formRule } = body;
    const resData = await fetch("https://api-ncac.onrender.com/forms/master", {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
        },
        body: JSON.stringify(formData),
    });
    const dataForm = await resData.json();

    if (!resData.ok) {
        return NextResponse.json({ error: dataForm?.detail }, { status: resData.status });
    }
    // console.log('Submitting formRule:', JSON.stringify(formRule[0]));
    const resRule = await fetch("https://api-ncac.onrender.com/forms/rules", {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
        },
        body: JSON.stringify(formRule[0]),
    });
    const dataRule = await resRule.json();
    if (!resRule.ok) {
        return NextResponse.json({ error: dataRule?.detail }, { status: resRule.status });
    }

    return NextResponse.json({
        message: "บันทึกฟอร์มและกฎเรียบร้อย",
        data: {
            form: dataForm,
            rule: dataRule,
        },
    });
}

export async function GET(request: NextRequest) {
    const { searchParams } = new URL(request.url);
    const formCode = searchParams.get('form_code');
    
    if (!formCode) {
        return NextResponse.json({ error: "กรุณาระบุรหัสฟอร์ม" }, { status: 400 });
    }
    
    try {
        const res = await fetch(`https://api-ncac.onrender.com/forms/${formCode}`, {
            method: "GET",
            headers: {
                "Content-Type": "application/json",
            },
        });
        
        const data = await res.json();
        
        if (!res.ok) {
            return NextResponse.json({ error: data?.detail || "ไม่พบข้อมูลฟอร์ม" }, { status: res.status });
        }
        
        return NextResponse.json(data);
    } catch (error) {
        return NextResponse.json({ error: "เกิดข้อผิดพลาดในการดึงข้อมูล" }, { status: 500 });
    }
}


