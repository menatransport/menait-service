import { NextResponse, type NextRequest } from 'next/server';
import { GetObjectCommand, ListObjectsV2Command, PutObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { BASE_PATH, BUCKET_NAME, s3 } from '@/lib/s3';
import { loadPayeeRequestFor, requireUser } from '@/lib/finance/server';
import { PAYEE_FILE_MAX_BYTES, PAYEE_FILE_TYPES, PAYEE_MAX_FILES, sanitizePayeeFileName, sniffPayeeFileType } from '@/lib/finance/payee';

type Ctx = { params: Promise<{ id: string }> };

/** Owner or Finance: list bookbank files with 1 h presigned URLs. */
export async function GET(req: NextRequest, { params }: Ctx) {
  const guard = await requireUser(req);
  if ('error' in guard) return guard.error;
  const { id } = await params;
  const found = await loadPayeeRequestFor(id, guard.user);
  if ('error' in found) return found.error;
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
  const found = await loadPayeeRequestFor(id, guard.user, { ownerOnly: true });
  if ('error' in found) return found.error;
  if (found.data?.status !== 'PENDING') {
    return NextResponse.json({ error: 'คำขอนี้ไม่อยู่ในสถานะรอตรวจสอบ' }, { status: 409 });
  }
  const declared = Number(req.headers.get('content-length') ?? 0);
  if (declared > PAYEE_FILE_MAX_BYTES + 256 * 1024) {
    return NextResponse.json({ error: 'ไฟล์ต้องมีขนาดไม่เกิน 4 MB' }, { status: 413 });
  }
  const prefix = `${BASE_PATH}/payee-requests/${id}/`;
  try {
    const listed = await s3.send(new ListObjectsV2Command({ Bucket: BUCKET_NAME, Prefix: prefix, MaxKeys: PAYEE_MAX_FILES + 1 }));
    if ((listed.KeyCount ?? listed.Contents?.length ?? 0) >= PAYEE_MAX_FILES) {
      return NextResponse.json({ error: 'แนบไฟล์ได้ไม่เกิน 10 ไฟล์ต่อคำขอ' }, { status: 400 });
    }
  } catch (err) {
    console.error('payee files count error:', err);
    return NextResponse.json({ error: 'ตรวจสอบไฟล์แนบไม่สำเร็จ กรุณาลองใหม่' }, { status: 502 });
  }
  const form = await req.formData().catch(() => null);
  const file = form?.get('file');
  if (!(file instanceof File)) return NextResponse.json({ error: 'ไม่มีไฟล์' }, { status: 400 });
  if (!(PAYEE_FILE_TYPES as readonly string[]).includes(file.type)) {
    return NextResponse.json({ error: 'รองรับเฉพาะไฟล์ JPG, PNG, WebP หรือ PDF' }, { status: 400 });
  }
  if (file.size > PAYEE_FILE_MAX_BYTES) {
    return NextResponse.json({ error: 'ไฟล์ต้องมีขนาดไม่เกิน 4 MB' }, { status: 400 });
  }
  const bytes = new Uint8Array(await file.arrayBuffer());
  if (sniffPayeeFileType(bytes) !== file.type) {
    return NextResponse.json({ error: 'ชนิดไฟล์ไม่ถูกต้อง' }, { status: 400 });
  }
  const key = `${prefix}${Date.now()}-${sanitizePayeeFileName(file.name)}`;
  try {
    await s3.send(new PutObjectCommand({
      Bucket: BUCKET_NAME,
      Key: key,
      Body: Buffer.from(bytes),
      ContentType: file.type,
    }));
    return NextResponse.json({ success: true, path: key });
  } catch (err) {
    console.error('payee file upload error:', err);
    return NextResponse.json({ error: 'อัปโหลดไฟล์ไม่สำเร็จ' }, { status: 500 });
  }
}
