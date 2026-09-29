import { ListObjectsV2Command, S3Client } from '@aws-sdk/client-s3';

export const s3 = new S3Client({
  region: process.env.region,
  endpoint: process.env.endpoint,
  forcePathStyle: true,
  credentials: {
    accessKeyId: process.env.accessKeyId!,
    secretAccessKey: process.env.secretAccessKey!,
  },
});

export const BUCKET_NAME = 'mn-bucket';
export const BASE_PATH = 'menait-service';
export const FORM_ID_PATTERN = /^[A-Za-z0-9_-]+-\d{4}-\d{4,}$/;

/** True when at least one object exists under `prefix`. */
export async function hasFiles(prefix: string): Promise<boolean> {
  const res = await s3.send(new ListObjectsV2Command({ Bucket: BUCKET_NAME, Prefix: prefix, MaxKeys: 1 }));
  return (res.KeyCount ?? res.Contents?.length ?? 0) > 0;
}
