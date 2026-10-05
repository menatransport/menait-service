import { NextResponse, type NextRequest } from 'next/server';
import { GetObjectCommand, ListObjectsV2Command, PutObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { BASE_PATH, BUCKET_NAME, s3 } from '@/lib/s3';
import { beUrl, requireUser } from '@/lib/finance/server';
import { PAYEE_FILE_MAX_BYTES, PAYEE_FILE_TYPES, sanitizePayeeFileName } from '@/lib/finance/payee';

type Ctx = { params: Promise<{ id: string }> };

/** Fetch the request from BE so ownership / status can be checked server-side. */
async function loadRequest(id: string): Promise<{ data?: any; error?: NextResponse }> {
  try {
    const res = await fetch(beUrl(`/finance/payee-requests/${id}`), { cache: 'no-store' });
    const data = await res.json().catch(() => null);
    if (!res.ok) return { error: NextResponse.json({ error: data?.detail ?? 'ไม่พบรายการ' }, { status: res.status }) };
    return { data };
  } catch (err) {
    console.error('payee request lookup error:', err);
    return { error: NextResponse.json({ error: 'ไม่สามารถเชื่อมต่อระบบได้' }, { status: 502 }) };
  }
}

/** Owner or Finance: list bookbank files with 1 h presigned URLs. */
export async function GET(req: NextRequest, { params }: Ctx) {
  const guard = await requireUser(req);
  if ('error' in guard) return guard.error;
  const { id } = await params;
  if (!/^\d+$/.test(id)) return NextResponse.json({ error: 'ไม่พบรายการ' }, { status: 404 });
  const found = await loadRequest(id);
  if (found.error) return found.error;
  if (!guard.user.is_finance && found.data?.employee_id !== guard.user.employee_id) {
    return NextResponse.json({ error: 'ไม่มีสิทธิ์ดูรายการนี้' }, { status: 403 });
  }
  const prefix = `${BASE_PATH}/payee-requests/${id}/`;
  try {
    const listed = await s3.send(new ListObjectsV2Command({ Bucket: BUCKET_NAME, Prefix: prefix }));
    const files = await Promise.all(
      (listed.Contents ?? []).filter((o) => o.Key).map(async (o) => ({
        key: o.Key!,
        fileName: o.Key!.slice(prefix.length),
        url: await getSignedUrl(s3, new GetObjectCommand({ Bucket: BUCKET_NAME, Key: o.Key! }), { expiresIn: 3600 }),
        size: o.Size,
        lastModified: o.LastModified,
      })),
    );
    return NextResponse.json({ files });
  } catch (err) {
    console.error('payee files list error:', err);
    return NextResponse.json({ error: 'ไม่สามารถดึงรายการไฟล์ได้' }, { status: 500 });
  }
}

/** Owner only, while the request is PENDING. */
export async function POST(req: NextRequest, { params }: Ctx) {
  const guard = await requireUser(req);
  if ('error' in guard) return guard.error;
  const { id } = await params;
  if (!/^\d+$/.test(id)) return NextResponse.json({ error: 'ไม่พบรายการ' }, { status: 404 });
  const found = await loadRequest(id);
  if (found.error) return found.error;
  if (found.data?.employee_id !== guard.user.employee_id) {
    return NextResponse.json({ error: 'ไม่มีสิทธิ์แนบไฟล์ในรายการนี้' }, { status: 403 });
  }
  if (found.data?.status !== 'PENDING') {
    return NextResponse.json({ error: 'คำขอนี้ไม่อยู่ในสถานะรอตรวจสอบ' }, { status: 409 });
  }
  const form = await req.formData().catch(() => null);
  const file = form?.get('file');
  if (!(file instanceof File)) return NextResponse.json({ error: 'ไม่มีไฟล์' }, { status: 400 });
  if (!(PAYEE_FILE_TYPES as readonly string[]).includes(file.type)) {
    return NextResponse.json({ error: 'รองรับเฉพาะไฟล์ JPG, PNG, WebP หรือ PDF' }, { status: 400 });
  }
  if (file.size > PAYEE_FILE_MAX_BYTES) {
    return NextResponse.json({ error: 'ไฟล์ต้องมีขนาดไม่เกิน 10 MB' }, { status: 400 });
  }
  const key = `${BASE_PATH}/payee-requests/${id}/${Date.now()}-${sanitizePayeeFileName(file.name)}`;
  try {
    await s3.send(new PutObjectCommand({
      Bucket: BUCKET_NAME,
      Key: key,
      Body: Buffer.from(await file.arrayBuffer()),
      ContentType: file.type,
    }));
    return NextResponse.json({ success: true, path: key });
  } catch (err) {
    console.error('payee file upload error:', err);
    return NextResponse.json({ error: 'อัปโหลดไฟล์ไม่สำเร็จ' }, { status: 500 });
  }
}
