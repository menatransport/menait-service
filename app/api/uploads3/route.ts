import { NextRequest, NextResponse } from 'next/server';
import { S3Client, PutObjectCommand, ListObjectsV2Command, GetObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";

const s3 = new S3Client({
  region: process.env.region,
  endpoint: process.env.endpoint,
  credentials: {
    accessKeyId: process.env.accessKeyId!,
    secretAccessKey: process.env.secretAccessKey!,
  },
});

const BUCKET_NAME = 'mn-bucket';
const BASE_PATH = 'menait-service';

export async function POST(req: NextRequest) {
  const formData = await req.formData();
  const file = formData.get('file') as File | null;
  const form_id = formData.get('form_id') as string;

  if (!file) {
    return NextResponse.json({ error: 'ไม่มีไฟล์' }, { status: 400 });
  }

  if (!form_id) {
    return NextResponse.json({ error: 'ไม่มีหมายเลขเอกสาร' }, { status: 400 });
  }

  const arrayBuffer = await file.arrayBuffer();
  const buffer = Buffer.from(arrayBuffer);
  const fileName = `${BASE_PATH}/${form_id}/${file.name}`;

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
  const { searchParams } = new URL(req.url);
  const form_id = searchParams.get('form_id');

  if (!form_id) {
    return NextResponse.json({ error: 'ไม่มีหมายเลขเอกสาร' }, { status: 400 });
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

        return {
          key: obj.Key,
          fileName: obj.Key.split('/').pop(),
          url: signedUrl,
          size: obj.Size,
          lastModified: obj.LastModified
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