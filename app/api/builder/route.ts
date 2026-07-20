import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

export async function POST(request: NextRequest) {
    const body = await request.json();
    const { formData, formRule } = body;
    const resData = await fetch(`${process.env.URL_API}/forms/master`, {
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
    for (const rule of formRule) {
        const resRule = await fetch(`${process.env.URL_API}/forms/rules`, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
            },
            body: JSON.stringify(rule),
        });
        const dataRule = await resRule.json();

        if (!resRule.ok) {
            return NextResponse.json({ error: dataRule?.detail }, { status: resRule.status });
        }

    }
    return NextResponse.json({
        message: "บันทึกฟอร์มและกฎเรียบร้อย",
        data: {
            form: dataForm,
            rule: formRule,
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
        const resForm = await fetch(`${process.env.URL_API}/forms/${formCode}`, {
            method: "GET",
            headers: {
                "Content-Type": "application/json",
            },
        });

        const resRule = await fetch(`${process.env.URL_API}/forms/${formCode}/rules`, {
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

export async function PATCH(request: NextRequest) {
    const body = await request.json();
    const { formData, newRules, updatedRules } = body;
    const resData = await fetch(`${process.env.URL_API}/forms/master/${formData.form_code}`, {
        method: "PATCH",
        headers: {
            "Content-Type": "application/json",
        },
        body: JSON.stringify(formData),
    });
    const dataForm = await resData.json();
    if (!resData.ok) {
        console.error('Error updating form:', dataForm);
        return NextResponse.json({ error: dataForm?.detail }, { status: resData.status });
    }

    // POST new rules
    if (newRules?.length) {
        for (const rule of newRules) {
            const res = await fetch(`${process.env.URL_API}/forms/rules`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(rule),
            });
            if (!res.ok) {
                const data = await res.json();
                return NextResponse.json({ error: data?.detail || "ไม่สามารถเพิ่มกฎใหม่ได้" }, { status: res.status });
            }
        }
    }

    // PUT updated rules
    if (updatedRules?.length) {
        for (const rule of updatedRules) {
            const res = await fetch(`${process.env.URL_API}/forms/rules/${rule.id}`, {
                method: "PUT",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(rule),
            });
            if (!res.ok) {
                const data = await res.json();
                return NextResponse.json({ error: data?.detail || "ไม่สามารถอัปเดตกฎได้" }, { status: res.status });
            }
        }
    }

    return NextResponse.json({
        message: "อัปเดตฟอร์มและกฎเรียบร้อย",
    });

}

export async function DELETE(request: NextRequest) {
    const body = await request.json();
    const { id } = body;
    const resData = await fetch(`${process.env.URL_API}/forms/rules/${id}`, {
        method: "DELETE",
        headers: {
            "Content-Type": "application/json",
        },
    });
    const dataForm = await resData.json();
    if (!resData.ok) {
        console.error('Error deleting rule:', dataForm);
        return NextResponse.json({ error: dataForm?.detail }, { status: resData.status });
    }

    return NextResponse.json({
        message: "ลบกฎเรียบร้อย",
    });
}

