import { NextResponse } from 'next/server';

const API = process.env.URL_API || 'https://api-ncac.onrender.com';

// ฝ่าย + แผนก in one call for the master user form (สายงาน names come from the user rows)
export async function GET() {
  try {
    const [divRes, depRes] = await Promise.all([
      fetch(`${API}/divisions/`, { headers: { 'Content-Type': 'application/json' }, cache: 'no-store' }),
      fetch(`${API}/departments/`, { headers: { 'Content-Type': 'application/json' }, cache: 'no-store' }),
    ]);
    if (!divRes.ok || !depRes.ok) {
      return NextResponse.json({ error: 'Failed to load organization structure' }, { status: 502 });
    }
    const [divisions, departments] = await Promise.all([divRes.json(), depRes.json()]);
    return NextResponse.json({
      divisions: (Array.isArray(divisions) ? divisions : []).map((d: any) => ({
        division_id: d.division_id,
        division_th: d.division_th ?? null,
        division_eng: d.division_eng ?? null,
        division_code: d.division_code ?? null,
        path_id: d.path_id ?? null,
      })),
      departments: (Array.isArray(departments) ? departments : []).map((d: any) => ({
        department_id: d.department_id,
        department_name_th: d.department_name_th || '',
        department_name_en: d.department_name_en || '',
        division_id: d.division_id ?? null,
      })),
    });
  } catch (error) {
    console.error('Organization structure API error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
