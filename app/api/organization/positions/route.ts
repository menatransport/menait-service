import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

export async function GET() {
  try {
    const res = await fetch(`https://api-ncac.onrender.com/positions`, {
      method: 'GET',
      headers: { 'Content-Type': 'application/json' },
    });
    const data = await res.json();
    const options = (Array.isArray(data) ? data : [])
      .map((p: any) => ({ option_value: String(p.position_id), option_label: p.position_name_th || '' }))
      .sort((a: any, b: any) => a.option_label.localeCompare(b.option_label, 'th'));
    return NextResponse.json(options);
  } catch (error) {
    console.error('Positions API error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const res = await fetch(`https://api-ncac.onrender.com/positions/`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        position_name_th: body.position_name_th,
        position_name_en: body.position_name_en,
        position_level_id: body.position_level_id ?? null,
      }),
    });
    const data = await res.json();
    if (!res.ok) {
      return NextResponse.json({ error: data?.detail || 'Failed to create position' }, { status: res.status });
    }
    return NextResponse.json({
      option_value: String(data.position_id),
      option_label: data.position_name_th || '',
    });
  } catch (error) {
    console.error('Create position API error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}