/**
 * Cloudflare R2 storage for public store images (products, galleries, variants, categories, banners).
 * Server-side only: credentials come from environment variables and never reach the browser.
 *
 * Required environment variables (server):
 *   R2_ACCOUNT_ID, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY, R2_BUCKET_NAME,
 *   R2_PUBLIC_BASE_URL   e.g. https://images.vkvastram.in  (custom domain bound to the bucket)
 *   STORAGE_PROVIDER     "supabase" (default) or "r2". Switch only after migration is approved.
 */
import { S3Client, PutObjectCommand, DeleteObjectCommand, HeadObjectCommand } from '@aws-sdk/client-s3';

export type StorageProvider = 'supabase' | 'r2';

export const getStorageProvider = (): StorageProvider =>
  (process.env.STORAGE_PROVIDER || 'supabase').trim().toLowerCase() === 'r2' ? 'r2' : 'supabase';

const readConfig = () => ({
  accountId: (process.env.R2_ACCOUNT_ID || '').trim(),
  accessKeyId: (process.env.R2_ACCESS_KEY_ID || '').trim(),
  secretAccessKey: (process.env.R2_SECRET_ACCESS_KEY || '').trim(),
  bucket: (process.env.R2_BUCKET_NAME || '').trim(),
  publicBase: (process.env.R2_PUBLIC_BASE_URL || '').trim().replace(/\/+$/, ''),
});

export const isR2Configured = (): boolean => {
  const c = readConfig();
  return Boolean(c.accountId && c.accessKeyId && c.secretAccessKey && c.bucket && c.publicBase);
};

/** Object keys are plain relative paths such as "products/1700000000-saree.webp". */
export const isSafeObjectKey = (key: string): boolean =>
  /^[A-Za-z0-9][A-Za-z0-9/_.-]{0,400}$/.test(key) && !key.includes('..') && !key.includes('//');

let client: S3Client | null = null;
const getClient = (): S3Client => {
  if (!client) {
    const c = readConfig();
    client = new S3Client({
      region: 'auto',
      endpoint: `https://${c.accountId}.r2.cloudflarestorage.com`,
      credentials: { accessKeyId: c.accessKeyId, secretAccessKey: c.secretAccessKey },
    });
  }
  return client;
};

/** Public URL for an object key, encoding each path segment. */
export const r2PublicUrl = (key: string): string =>
  `${readConfig().publicBase}/${key.split('/').map(encodeURIComponent).join('/')}`;

/** Returns the object key for a URL served from our R2 public domain, or null for anything else. */
export const keyFromR2Url = (url: string): string | null => {
  const base = readConfig().publicBase;
  if (!base || !url.startsWith(`${base}/`)) return null;
  const rawKey = url.slice(base.length + 1).split(/[?#]/)[0];
  let key: string;
  try {
    key = decodeURIComponent(rawKey);
  } catch {
    return null;
  }
  return isSafeObjectKey(key) ? key : null;
};

export const uploadToR2 = async (
  key: string,
  body: Buffer,
  contentType: string,
  metadata?: Record<string, string>
): Promise<string> => {
  if (!isSafeObjectKey(key)) throw new Error('Unsafe object key');
  await getClient().send(new PutObjectCommand({
    Bucket: readConfig().bucket,
    Key: key,
    Body: body,
    ContentType: contentType,
    // Keys are unique per upload (timestamp in the name), so browsers and Cloudflare can cache them for a year.
    CacheControl: 'public, max-age=31536000, immutable',
    Metadata: metadata,
  }));
  return r2PublicUrl(key);
};

export const deleteFromR2 = async (key: string): Promise<void> => {
  if (!isSafeObjectKey(key)) throw new Error('Unsafe object key');
  await getClient().send(new DeleteObjectCommand({ Bucket: readConfig().bucket, Key: key }));
};

/** Returns object details, or null if the object does not exist. */
export const headR2 = async (key: string): Promise<{ size: number; contentType: string; metadata: Record<string, string> } | null> => {
  try {
    const out = await getClient().send(new HeadObjectCommand({ Bucket: readConfig().bucket, Key: key }));
    return {
      size: Number(out.ContentLength || 0),
      contentType: String(out.ContentType || ''),
      metadata: (out.Metadata as Record<string, string>) || {},
    };
  } catch (err: any) {
    if (err?.$metadata?.httpStatusCode === 404 || err?.name === 'NotFound') return null;
    throw err;
  }
};

export const r2Client = getClient;
export const r2BucketName = (): string => readConfig().bucket;
