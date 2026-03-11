import { query } from '@/lib/db';
import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

export async function PUT(request: NextRequest) {
    const reqBody = await request.json();
    
    const { form_id, admin_comment } = reqBody;
    console.log('Received data:', { form_id, admin_comment });
    if (!form_id || admin_comment === undefined) {
        return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }
    try {
        const result = await query(
            'UPDATE form_submissions SET admin_comment = $1 WHERE form_id = $2 RETURNING *',
            [admin_comment, form_id]
        );
        return NextResponse.json({ message: 'Admin comment updated successfully', result });
    } catch (error) {
        console.error('Error updating admin comment:', error);
        return NextResponse.json({ error: 'Failed to update admin comment' }, { status: 500 });
    }
}