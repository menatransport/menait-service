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
        const resForm = await fetch(`https://api-ncac.onrender.com/forms/${formCode}`, {
            method: "GET",
            headers: {
                "Content-Type": "application/json",
            },
        });
        
        const resRule = await fetch(`https://api-ncac.onrender.com/forms/${formCode}/rules`, {
            method: "GET",
            headers: {
                "Content-Type": "application/json",
            },
        });

        if (!resForm.ok || !resRule.ok) {
            const errorForm = await resForm.json();
            const errorRule = await resRule.json();
            return NextResponse.json({ 
                error: errorForm?.detail || errorRule?.detail 
            }, { status: resForm.status || resRule.status });
        }
        
        const dataForm = await resForm.json();
        const dataRule = await resRule.json();

    return NextResponse.json({
        form: dataForm,
        rule: dataRule,
    });

    } catch (error) {
        return NextResponse.json({ error: "เกิดข้อผิดพลาดในการดึงข้อมูล" }, { status: 500 });
    }
}


