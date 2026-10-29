import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

// สร้างแผนกใหม่ใต้ฝ่าย (ncacdb requires both names + division_id)
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const res = await fetch(`https://api-ncac.onrender.com/departments/`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        department_name_th: body.department_name_th,
        department_name_en: body.department_name_en,
        division_id: body.division_id,
      }),
    });
    const data = await res.json();
    if (!res.ok) {
      return NextResponse.json({ error: data?.detail || 'Failed to create department' }, { status: res.status });
    }
    return NextResponse.json({
      department_id: data.department_id,
      department_name_th: data.department_name_th || '',
      department_name_en: data.department_name_en || '',
      division_id: data.division_id ?? null,
    });
  } catch (error) {
    console.error('Create department API error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function GET() {
  try {
    const res = await fetch(`https://api-ncac.onrender.com/departments`, {
      method: 'GET',
      headers: { 'Content-Type': 'application/json' },
    });
    const data = await res.json();
    const options = (Array.isArray(data) ? data : [])
      .map((d: any) => ({ option_value: String(d.department_id), option_label: d.department_name_th || '' }))
      .sort((a: any, b: any) => a.option_label.localeCompare(b.option_label, 'th'));
    return NextResponse.json(options);
  } catch (error) {
    console.error('Departments API error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}