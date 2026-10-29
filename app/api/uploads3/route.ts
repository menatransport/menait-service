import { NextRequest, NextResponse } from 'next/server';
import { DeleteObjectCommand, PutObjectCommand, ListObjectsV2Command, GetObjectCommand } from '@aws-sdk/client-s3';
import { BASE_PATH, BUCKET_NAME, FORM_ID_PATTERN, isSafeUploadName, s3 } from '@/lib/s3';
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { denyUnlessAdvViewer, isAdvOwner, loadPettyClaimFor, requireUser } from '@/lib/finance/server';
import { isAdvTarget } from '@/lib/finance/formsubmit-guard';
import { advUploadRole, isAdvUploadFolder } from '@/lib/finance/adv-access';
import { canSeeClaim, isPettyFormId } from '@/lib/finance/petty-access';
import { canUploadPettyFile, folderIsFull, isPettyFolder, pettyFileProblem, pettyKeyBelongsTo } from '@/lib/finance/petty-upload';

export async function POST(req: NextRequest) {
  const guard = await requireUser(req);
  if ('error' in guard) return guard.error;
  const formData = await req.formData();
  const file = formData.get('file') as File | null;
  const form_id = formData.get('form_id') as string;
  const folder = ((formData.get('folder') as string | null) ?? '').trim();
  // ใบเงินสดย่อยมีหมวดไฟล์ของตัวเองตาม spec ของประเภทการเบิก (lib/finance/petty-upload.ts)
  const pettyTarget = isPettyFormId(form_id);
  const folderOk = pettyTarget ? folder === '' || isPettyFolder(folder) : isAdvUploadFolder(folder);
  if (!folderOk) {
    return NextResponse.json({ error: 'โฟลเดอร์ไม่ถูกต้อง' }, { status: 400 });
  }

  if (!file) {
    return NextResponse.json({ error: 'ไม่มีไฟล์' }, { status: 400 });
  }

  if (!isSafeUploadName(file.name)) {
    return NextResponse.json({ error: 'ชื่อไฟล์ไม่ถูกต้อง' }, { status: 400 });
  }

  if (!form_id) {
    return NextResponse.json({ error: 'ไม่มีหมายเลขเอกสาร' }, { status: 400 });
  }

  if (!FORM_ID_PATTERN.test(form_id)) {
    return NextResponse.json({ error: 'หมายเลขเอกสารไม่ถูกต้อง' }, { status: 400 });
  }

  // petty: แนบได้เฉพาะเจ้าหน้าที่ผู้เปิดใบ ผู้ถือกองทุนของใบนั้น และแอดมิน — ไม่ใช่ทุกคนที่ล็อกอิน
  if (pettyTarget) {
    const loaded = await loadPettyClaimFor(form_id);
    if (!canUploadPettyFile({ user: guard.user, claim: loaded.claim, fund: loaded.fund })) {
      return NextResponse.json({ error: 'ไม่มีสิทธิ์แนบไฟล์ในรายการนี้' }, { status: 403 });
    }
    // หลักฐานมีแค่รูปกับ PDF และไม่เกิน 10 MB — บอกเหตุผลเป็นภาษาคน
    const problem = pettyFileProblem(file.name, file.size);
    if (problem) return NextResponse.json({ error: problem }, { status: 400 });
    // หมวดที่ spec ตั้ง max ไว้ รับเพิ่มไม่ได้เมื่อเต็ม (หน้าจอซ่อนปุ่มอยู่แล้ว แต่ยิงตรงก็ต้องเจอกำแพงเดียวกัน)
    if (folder) {
      const existing = await s3.send(new ListObjectsV2Command({
        Bucket: BUCKET_NAME, Prefix: `${BASE_PATH}/${form_id}/${folder}/`,
      }));
      if (folderIsFull(loaded.spec, folder, existing.KeyCount ?? existing.Contents?.length ?? 0)) {
        return NextResponse.json({ error: 'หมวดนี้แนบครบจำนวนสูงสุดแล้ว ลบไฟล์เดิมก่อนถ้าจะแนบใหม่' }, { status: 409 });
      }
    }
  }

  // ADV: pay/check are Finance's evidence; request (no folder), clear and related belong to the requester
  if (isAdvTarget({ formId: form_id })) {
    const allowed = advUploadRole(folder) === 'finance'
      ? guard.user.is_finance === true
      : await isAdvOwner(guard.user, form_id);
    if (!allowed) {
      return NextResponse.json({ error: 'ไม่มีสิทธิ์แนบไฟล์ในรายการนี้' }, { status: 403 });
    }
  }

  const arrayBuffer = await file.arrayBuffer();
  const buffer = Buffer.from(arrayBuffer);
  const fileName = folder
    ? `${BASE_PATH}/${form_id}/${folder}/${file.name}`
    : `${BASE_PATH}/${form_id}/${file.name}`;

  const uploadParams = {
    Bucket: BUCKET_NAME,
    Key: fileName,
    Body: buffer,
    ContentType: file.type,
  };

  try {
    await s3.send(new PutObjectCommand(uploadParams));
    // console.log(`✅ Uploaded: ${fileName}`);
    return NextResponse.json({
      success: true,
      path: fileName,
      message: 'อัปโหลดรูปภาพสำเร็จ'
    });
  } catch (err) {
    console.error('S3 Upload Error:', err);
    return NextResponse.json({ error: `Upload failed: ${file.name}` }, { status: 500 });
  }
}

// GET: ดึงรายการไฟล์ของเอกสาร
export async function GET(req: NextRequest) {
  const guard = await requireUser(req);
  if ('error' in guard) return guard.error;
  const { searchParams } = new URL(req.url);
  const form_id = searchParams.get('form_id');

  if (!form_id) {
    return NextResponse.json({ error: 'ไม่มีหมายเลขเอกสาร' }, { status: 400 });
  }

  if (!FORM_ID_PATTERN.test(form_id)) {
    return NextResponse.json({ error: 'หมายเลขเอกสารไม่ถูกต้อง' }, { status: 400 });
  }

  if (isPettyFormId(form_id)) {
    // ไฟล์แนบของใบเงินสดย่อยเห็นได้เท่าที่เห็นตัวใบ — ไม่ใช่ทุกคนที่ล็อกอิน
    const loaded = await loadPettyClaimFor(form_id);
    const allowed = !!loaded.claim && canSeeClaim(
      guard.user,
      loaded.claim as { created_by: string; fund_id: number; status: never },
      loaded.fund ? [loaded.fund] : [],
    );
    if (!allowed) return NextResponse.json({ error: 'ไม่มีสิทธิ์ดูรายการนี้' }, { status: 403 });
  } else {
    const denied = await denyUnlessAdvViewer(guard.user, form_id);
    if (denied) return denied;
  }

  const folderPath = `${BASE_PATH}/${form_id}/`;

  try {
    const listCommand = new ListObjectsV2Command({
      Bucket: BUCKET_NAME,
      Prefix: folderPath,
    });

    const response = await s3.send(listCommand);

    const filesWithUrls = await Promise.all(
      (response.Contents || []).map(async (obj) => {
        if (!obj.Key) return null;

        const getObjectCommand = new GetObjectCommand({
          Bucket: BUCKET_NAME,
          Key: obj.Key,
        });

        const signedUrl = await getSignedUrl(s3, getObjectCommand, { expiresIn: 3600 });

        const relative = obj.Key.slice(folderPath.length);
        return {
          key: obj.Key,
          fileName: obj.Key.split('/').pop(),
          url: signedUrl,
          size: obj.Size,
          lastModified: obj.LastModified,
          folder: relative.includes('/') ? relative.split('/')[0] : 'request',
        };
      })
    );

    const files = filesWithUrls.filter(file => file !== null);

    return NextResponse.json({ files });
  } catch (err) {
    console.error('S3 List Error:', err);
    return NextResponse.json({ error: 'ไม่สามารถดึงรายการไฟล์ได้' }, { status: 500 });
  }
}

// DELETE: ลบไฟล์แนบของใบเงินสดย่อย (แนบผิดใบ/ผิดหมวด) — คนที่แนบได้คือคนที่ลบได้ และเฉพาะขณะใบยังไม่ปิดรอบ
// ใบ Advance ไม่มีลบ (หลักฐานการเงินแตะไม่ได้) — คงไว้ตามเดิม
export async function DELETE(req: NextRequest) {
  const guard = await requireUser(req);
  if ('error' in guard) return guard.error;
  const body = await req.json().catch(() => null) as { form_id?: unknown; key?: unknown } | null;
  const form_id = typeof body?.form_id === 'string' ? body.form_id : '';
  const key = typeof body?.key === 'string' ? body.key : '';
  if (!isPettyFormId(form_id)) {
    return NextResponse.json({ error: 'ลบได้เฉพาะไฟล์ของใบเงินสดย่อย' }, { status: 400 });
  }
  if (!pettyKeyBelongsTo(key, form_id, BASE_PATH)) {
    return NextResponse.json({ error: 'ไฟล์ไม่ได้อยู่ในใบนี้' }, { status: 400 });
  }
  const loaded = await loadPettyClaimFor(form_id);
  if (!canUploadPettyFile({ user: guard.user, claim: loaded.claim, fund: loaded.fund })) {
    return NextResponse.json({ error: 'ไม่มีสิทธิ์ลบไฟล์ในรายการนี้' }, { status: 403 });
  }
  try {
    await s3.send(new DeleteObjectCommand({ Bucket: BUCKET_NAME, Key: key }));
    return NextResponse.json({ success: true });
  } catch (err) {
    console.error('S3 Delete Error:', err);
    return NextResponse.json({ error: 'ลบไฟล์ไม่สำเร็จ' }, { status: 500 });
  }
}
