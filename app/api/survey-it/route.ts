import { query } from '@/lib/db';
import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

export async function POST(request: NextRequest) {
    const reqBody = await request.json();

    const { employee_id, form_id, point, comment } = reqBody;

    if (!employee_id || !form_id || point === undefined) {
        return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    try {
        const result = await query(
            'INSERT INTO survey_it (employee_id, form_id, point, comment) VALUES ($1, $2, $3, $4)',
            [employee_id, form_id, point, comment]
        );
        return NextResponse.json({ message: 'Survey submitted successfully', result });
    } catch (error) {
        console.error('Error inserting survey:', error);
        return NextResponse.json({ error: 'Failed to submit survey' }, { status: 500 });
    }
}

export async function GET(request: NextRequest) {
    const { searchParams } = new URL(request.url);
    const employee_id = searchParams.get('employee_id');
    const role = searchParams.get('role');
    if (!employee_id || !role) {
        return NextResponse.json({ error: 'Missing required query parameters' }, { status: 400 });
    }
    try {
        let surveys;
        if (role === 'a') {
            surveys = await query(
                `SELECT s.id, s.employee_id, s.form_id, s.point, s.comment, s.survey_at,
                        u.firstname, u.email, u.lastname, u.department_id, u.image_url,
                        d.department_name_th, 
                        m.form_name, m.form_code
                 FROM survey_it s
                 LEFT JOIN users u ON s.employee_id = u.employee_id
                 LEFT JOIN departments d ON u.department_id = d.department_id
                 LEFT JOIN form_submissions f ON s.form_id = f.form_id
                 LEFT JOIN form_masters m ON f.form_master_id = m.id
                 ORDER BY s.survey_at DESC`
            );
        } else {
            surveys = await query(
                `SELECT s.id, s.employee_id, s.form_id, s.point, s.comment, s.survey_at,
                        u.firstname, u.email, u.lastname, u.department_id, u.image_url,
                        d.department_name_th, 
                        m.form_name, m.form_code
                 FROM survey_it s
                 LEFT JOIN users u ON s.employee_id = u.employee_id
                 LEFT JOIN departments d ON u.department_id = d.department_id
                 LEFT JOIN form_submissions f ON s.form_id = f.form_id
                 LEFT JOIN form_masters m ON f.form_master_id = m.id
                 WHERE s.employee_id = $1
                 ORDER BY s.survey_at DESC`,
                [employee_id]
            );
        }
        return NextResponse.json(surveys.rows);
    } catch (error) {
        console.error('Error fetching surveys:', error);
        return NextResponse.json({ error: 'Failed to fetch surveys' }, { status: 500 });
    }
}
