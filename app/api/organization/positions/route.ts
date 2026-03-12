import { NextResponse } from 'next/server';

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