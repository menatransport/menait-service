import { NextResponse } from 'next/server';

export async function GET() {
  try {
    const res = await fetch(`https://api-ncac.onrender.com/position-levels/`, {
      method: 'GET',
      headers: { 'Content-Type': 'application/json' },
    });
    const data = await res.json();
    const options = (Array.isArray(data) ? data : [])
      .map((l: any) => ({ option_value: String(l.position_level_id), option_label: l.level_name || '' }))
      .sort((a: any, b: any) => a.option_label.localeCompare(b.option_label, 'th'));
    return NextResponse.json(options);
  } catch (error) {
    console.error('Position levels API error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
