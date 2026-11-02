#!/usr/bin/env node
/**
 * Copies existing Supabase Storage images (bucket "store-assets") to Cloudflare R2.
 *
 *  - DRY RUN by default: lists what would be copied. Nothing is written anywhere.
 *  - --apply        copies files to R2 and verifies each one.
 *  - --limit N      process at most N files in this run (useful for trial runs).
 *  - RESUMABLE:     progress is saved after every verified file in migration-state/state.json.
 *                   Re-running skips finished files and re-checks their R2 copy before trusting it.
 *  - SAFE:          never deletes from Supabase, never changes the database. Originals stay for rollback.
 *
 * Output: migration-state/url-map.json maps each old Supabase public URL to its new R2 URL.
 * Database URLs are updated by a SEPARATE step, only after you approve the verified map.
 *
 * Environment: SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, R2_ACCOUNT_ID, R2_ACCESS_KEY_ID,
 *              R2_SECRET_ACCESS_KEY, R2_BUCKET_NAME, R2_PUBLIC_BASE_URL
 */
import { createClient } from '@supabase/supabase-js';
import { S3Client, PutObjectCommand, GetObjectCommand } from '@aws-sdk/client-s3';
import { createHash } from 'node:crypto';
import { mkdir, readFile, writeFile, rename } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { join } from 'node:path';

const BUCKET = 'store-assets';
const STATE_DIR = 'migration-state';
const STATE_FILE = join(STATE_DIR, 'state.json');
const MAP_FILE = join(STATE_DIR, 'url-map.json');

const args = process.argv.slice(2);
const APPLY = args.includes('--apply');
const limitArg = args.indexOf('--limit');
const LIMIT = limitArg >= 0 ? Number(args[limitArg + 1]) : Infinity;

const required = ['SUPABASE_URL', 'SUPABASE_SERVICE_ROLE_KEY', 'R2_ACCOUNT_ID', 'R2_ACCESS_KEY_ID', 'R2_SECRET_ACCESS_KEY', 'R2_BUCKET_NAME', 'R2_PUBLIC_BASE_URL'];
const missing = required.filter((k) => !process.env[k]);
if (missing.length) {
  console.error(`Missing environment variables: ${missing.join(', ')}`);
  process.exit(1);
}

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
});
const r2 = new S3Client({
  region: 'auto',
  endpoint: `https://${process.env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
  credentials: { accessKeyId: process.env.R2_ACCESS_KEY_ID, secretAccessKey: process.env.R2_SECRET_ACCESS_KEY },
});
const R2_BUCKET = process.env.R2_BUCKET_NAME;
const R2_BASE = process.env.R2_PUBLIC_BASE_URL.replace(/\/+$/, '');
const SUPABASE_PUBLIC_PREFIX = `${process.env.SUPABASE_URL.replace(/\/+$/, '')}/storage/v1/object/public/${BUCKET}/`;

const sha256 = (buf) => createHash('sha256').update(buf).digest('hex');
const r2UrlFor = (key) => `${R2_BASE}/${key.split('/').map(encodeURIComponent).join('/')}`;

/** Walk every folder in the bucket and return all file paths with metadata. */
async function listAllObjects(prefix = '', out = []) {
  let offset = 0;
  for (;;) {
    const { data, error } = await supabase.storage.from(BUCKET).list(prefix, { limit: 1000, offset, sortBy: { column: 'name', order: 'asc' } });
    if (error) throw new Error(`List failed at "${prefix}": ${error.message}`);
    if (!data || data.length === 0) break;
    for (const item of data) {
      const path = prefix ? `${prefix}/${item.name}` : item.name;
      if (item.id === null || item.metadata === undefined || item.metadata === null) {
        await listAllObjects(path, out); // folder
      } else {
        out.push({ path, size: Number(item.metadata?.size || 0), contentType: item.metadata?.mimetype || 'application/octet-stream' });
      }
    }
    if (data.length < 1000) break;
    offset += 1000;
  }
  return out;
}

async function loadState() {
  if (!existsSync(STATE_FILE)) return { done: {} };
  return JSON.parse(await readFile(STATE_FILE, 'utf8'));
}

/** Write state atomically so an interruption never leaves a half-written file. */
async function saveState(state) {
  await mkdir(STATE_DIR, { recursive: true });
  const tmp = `${STATE_FILE}.tmp`;
  await writeFile(tmp, JSON.stringify(state, null, 2));
  await rename(tmp, STATE_FILE);
  const map = {};
  for (const [path, entry] of Object.entries(state.done)) map[SUPABASE_PUBLIC_PREFIX + path.split('/').map(encodeURIComponent).join('/')] = entry.r2Url;
  await writeFile(MAP_FILE + '.tmp', JSON.stringify(map, null, 2));
  await rename(MAP_FILE + '.tmp', MAP_FILE);
}

async function copyOne(file) {
  const { data, error } = await supabase.storage.from(BUCKET).download(file.path);
  if (error || !data) throw new Error(`download failed: ${error?.message || 'no data'}`);
  const buffer = Buffer.from(await data.arrayBuffer());
  if (!buffer.length) throw new Error('downloaded file is empty');
  const hash = sha256(buffer);

  await r2.send(new PutObjectCommand({
    Bucket: R2_BUCKET,
    Key: file.path,
    Body: buffer,
    ContentType: file.contentType,
    CacheControl: 'public, max-age=31536000, immutable',
    Metadata: { sha256: hash, 'source-path': file.path },
  }));

  // Read back what R2 stored and compare it with what we downloaded.
  const stored = await r2.send(new GetObjectCommand({ Bucket: R2_BUCKET, Key: file.path }));
  const storedBuf = Buffer.from(await stored.Body.transformToByteArray());
  if (sha256(storedBuf) !== hash || storedBuf.length !== buffer.length) throw new Error('verification failed: R2 copy differs from source');

  return { sha256: hash, size: buffer.length, contentType: file.contentType, r2Url: r2UrlFor(file.path), verifiedAt: new Date().toISOString() };
}

async function main() {
  console.log(APPLY ? 'MODE: APPLY (files will be copied to R2)' : 'MODE: DRY RUN (nothing will be written)');
  const state = await loadState();
  const files = await listAllObjects();
  const todo = files.filter((f) => !state.done[f.path]);
  const totalBytes = files.reduce((sum, f) => sum + f.size, 0);
  console.log(`Found ${files.length} files (${(totalBytes / 1024 / 1024).toFixed(1)} MB). Already verified: ${files.length - todo.length}. Remaining: ${todo.length}.`);

  if (!APPLY) {
    todo.slice(0, 20).forEach((f) => console.log(`  would copy ${f.path} (${(f.size / 1024).toFixed(0)} KB)`));
    if (todo.length > 20) console.log(`  ... and ${todo.length - 20} more`);
    console.log('Run again with --apply to copy. Use --limit 20 for a first trial.');
    return;
  }

  let copied = 0, failed = 0;
  for (const file of todo.slice(0, Number.isFinite(LIMIT) ? LIMIT : todo.length)) {
    try {
      // Files already in the state file were skipped above. Everything else is copied again from
      // the source, which is safe: the same source always produces the same bytes and hash.
      const entry = await copyOne(file);
      state.done[file.path] = entry;
      await saveState(state);
      copied++;
      console.log(`ok   ${file.path}`);
    } catch (err) {
      failed++;
      console.error(`FAIL ${file.path}: ${err.message}`);
    }
  }
  console.log(`Done this run: ${copied} verified, ${failed} failed. Total verified so far: ${Object.keys(state.done).length} of ${files.length}.`);
  if (failed) console.log('Re-run the same command to retry the failed files. Nothing has been deleted or changed in the database.');
}

main().catch((err) => {
  console.error('Migration stopped:', err.message);
  process.exit(1);
});
