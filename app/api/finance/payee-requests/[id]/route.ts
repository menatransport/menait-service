import { NextResponse, type NextRequest } from 'next/server';
import { loadPayeeRequestFor, requireUser } from '@/lib/finance/server';

type Ctx = { params: Promise<{ id: string }> };

/** Owner or Finance only. */
export async function GET(req: NextRequest, { params }: Ctx) {
  const guard = await requireUser(req);
  if ('error' in guard) return guard.error;
  const { id } = await params;
  const found = await loadPayeeRequestFor(id, guard.user);
  if ('error' in found) return found.error;
  return NextResponse.json(found.data);
}
