import { NextResponse } from 'next/server';

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