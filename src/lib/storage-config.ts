/**
 * Konfigurasi object storage (S3-compatible, mis. Supabase Storage).
 * Sengaja tanpa dependensi SDK agar aman diimpor dari modul validasi URL.
 */

export interface S3Credentials {
  endpoint: string;
  region: string;
  accessKeyId: string;
  secretAccessKey: string;
}

export interface S3StorageConfig extends S3Credentials {
  bucket: string;
  publicBaseUrl: string;
}

export interface PrivateS3StorageConfig extends S3Credentials {
  bucket: string;
}

/** Skema referensi objek di bucket private (bukan URL; diunduh lewat route berotorisasi). */
export const PRIVATE_STORAGE_SCHEME = "private://";

const SAFE_OBJECT_KEY_RE = /^[a-zA-Z0-9._-]+(?:\/[a-zA-Z0-9._-]+)*$/;

const SUPABASE_S3_ENDPOINT_RE =
  /^https:\/\/([a-z0-9-]+)\.storage\.supabase\.co\/storage\/v1\/s3\/?$/i;

function trimTrailingSlash(value: string): string {
  return value.replace(/\/+$/, "");
}

export function isSafeObjectKey(key: string): boolean {
  return !key.includes("..") && SAFE_OBJECT_KEY_RE.test(key);
}

export function toPrivateStorageRef(key: string): string {
  return `${PRIVATE_STORAGE_SCHEME}${key}`;
}

/** Mengembalikan object key dari referensi `private://...`, atau null bila tidak valid. */
export function parsePrivateStorageRef(ref: string | null | undefined): string | null {
  const trimmed = ref?.trim();
  if (!trimmed || !trimmed.startsWith(PRIVATE_STORAGE_SCHEME)) return null;
  const key = trimmed.slice(PRIVATE_STORAGE_SCHEME.length);
  return isSafeObjectKey(key) ? key : null;
}

/**
 * URL publik dasar objek di bucket. Pakai `S3_PUBLIC_BASE_URL` bila diisi;
 * jika kosong dan endpoint adalah Supabase, diturunkan otomatis.
 */
export function getStoragePublicBaseUrl(): string | null {
  const explicit = process.env.S3_PUBLIC_BASE_URL?.trim();
  if (explicit) return trimTrailingSlash(explicit);

  const endpoint = process.env.S3_ENDPOINT?.trim();
  const bucket = process.env.S3_BUCKET?.trim();
  if (!endpoint || !bucket) return null;

  const match = endpoint.match(SUPABASE_S3_ENDPOINT_RE);
  if (!match) return null;
  return `https://${match[1]}.supabase.co/storage/v1/object/public/${encodeURIComponent(bucket)}`;
}

function getS3Credentials(): S3Credentials | null {
  const endpoint = process.env.S3_ENDPOINT?.trim();
  const accessKeyId = process.env.S3_ACCESS_KEY_ID?.trim();
  const secretAccessKey = process.env.S3_SECRET_ACCESS_KEY?.trim();
  if (!endpoint || !accessKeyId || !secretAccessKey) return null;

  return {
    endpoint: trimTrailingSlash(endpoint),
    region: process.env.S3_REGION?.trim() || "ap-southeast-1",
    accessKeyId,
    secretAccessKey,
  };
}

/** Bucket publik (foto). Null bila object storage belum dikonfigurasi. */
export function getS3StorageConfig(): S3StorageConfig | null {
  const credentials = getS3Credentials();
  const bucket = process.env.S3_BUCKET?.trim();
  const publicBaseUrl = getStoragePublicBaseUrl();
  if (!credentials || !bucket || !publicBaseUrl) return null;
  return { ...credentials, bucket, publicBaseUrl };
}

/** Bucket private (dokumen SPK). Null bila belum dikonfigurasi. */
export function getPrivateS3StorageConfig(): PrivateS3StorageConfig | null {
  const credentials = getS3Credentials();
  const bucket = process.env.S3_PRIVATE_BUCKET?.trim();
  if (!credentials || !bucket) return null;
  return { ...credentials, bucket };
}
