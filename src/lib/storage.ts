import { mkdir, readFile, writeFile } from "fs/promises";
import path from "path";
import crypto from "crypto";
import { GetObjectCommand, PutObjectCommand, S3Client } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import {
  getPrivateS3StorageConfig,
  getS3StorageConfig,
  isSafeObjectKey,
  toPrivateStorageRef,
  type S3Credentials,
} from "./storage-config";

export type UploadFolder = "assets" | "reports" | "workorders" | "technicians";
export type PrivateUploadFolder = "spk" | "documents";

/** Lokasi fallback berkas private saat dev lokal (di luar `public/`, tidak tersaji statis). */
const LOCAL_PRIVATE_DIR = path.join(process.cwd(), ".private-uploads");
const PRIVATE_URL_TTL_SECONDS = 120;

let cachedS3Client: { key: string; client: S3Client } | null = null;

function getS3Client(config: S3Credentials): S3Client {
  const key = `${config.endpoint}|${config.region}|${config.accessKeyId}`;
  if (cachedS3Client?.key === key) return cachedS3Client.client;
  const client = new S3Client({
    endpoint: config.endpoint,
    region: config.region,
    forcePathStyle: true,
    credentials: {
      accessKeyId: config.accessKeyId,
      secretAccessKey: config.secretAccessKey,
    },
  });
  cachedS3Client = { key, client };
  return client;
}

/**
 * Menyimpan berkas ke object storage (S3-compatible) bila dikonfigurasi,
 * atau ke `public/uploads` saat pengembangan lokal. Mengembalikan URL publik.
 */
export async function persistUpload(
  folder: UploadFolder,
  fileName: string,
  buffer: Buffer,
  contentType: string
): Promise<string> {
  const config = getS3StorageConfig();
  if (config) {
    const key = `${folder}/${fileName}`;
    await getS3Client(config).send(
      new PutObjectCommand({
        Bucket: config.bucket,
        Key: key,
        Body: buffer,
        ContentType: contentType,
        CacheControl: "public, max-age=31536000, immutable",
      })
    );
    return `${config.publicBaseUrl}/${key}`;
  }

  if (process.env.VERCEL) {
    throw new Error(
      "Penyimpanan berkas belum dikonfigurasi (S3_ENDPOINT, S3_ACCESS_KEY_ID, S3_SECRET_ACCESS_KEY, S3_BUCKET)."
    );
  }

  const uploadDir = path.join(process.cwd(), "public", "uploads", folder);
  await mkdir(uploadDir, { recursive: true });
  await writeFile(path.join(uploadDir, fileName), buffer);
  return `/uploads/${folder}/${fileName}`;
}

function resolveLocalPrivatePath(key: string): string {
  if (!isSafeObjectKey(key)) throw new Error("Kunci berkas private tidak valid.");
  const resolved = path.resolve(LOCAL_PRIVATE_DIR, key);
  if (!resolved.startsWith(LOCAL_PRIVATE_DIR + path.sep)) {
    throw new Error("Kunci berkas private tidak valid.");
  }
  return resolved;
}

/**
 * Menyimpan berkas ke bucket private. Mengembalikan referensi `private://<key>`
 * (bukan URL) — berkas hanya bisa diunduh lewat route yang memeriksa otorisasi.
 */
export async function persistPrivateUpload(
  folder: PrivateUploadFolder,
  fileName: string,
  buffer: Buffer,
  contentType: string
): Promise<string> {
  const key = `${folder}/${fileName}`;
  const config = getPrivateS3StorageConfig();
  if (config) {
    await getS3Client(config).send(
      new PutObjectCommand({
        Bucket: config.bucket,
        Key: key,
        Body: buffer,
        ContentType: contentType,
      })
    );
    return toPrivateStorageRef(key);
  }

  if (process.env.VERCEL) {
    throw new Error(
      "Penyimpanan dokumen private belum dikonfigurasi (S3_PRIVATE_BUCKET)."
    );
  }

  const filePath = resolveLocalPrivatePath(key);
  await mkdir(path.dirname(filePath), { recursive: true });
  await writeFile(filePath, buffer);
  return toPrivateStorageRef(key);
}

export type PrivateDownload =
  | { kind: "redirect"; url: string }
  | { kind: "file"; body: Buffer };

export function buildContentDisposition(fileName: string): string {
  const fallback = fileName.replace(/[^A-Za-z0-9._ -]/g, "_") || "dokumen";
  return `attachment; filename="${fallback}"; filename*=UTF-8''${encodeURIComponent(fileName)}`;
}

/**
 * Menyiapkan unduhan berkas private. Panggil HANYA setelah otorisasi lolos.
 * Bucket S3: presigned URL berumur pendek. Dev lokal: isi berkas dari disk.
 */
export async function resolvePrivateDownload(
  key: string,
  fileName: string,
  contentType: string
): Promise<PrivateDownload> {
  const config = getPrivateS3StorageConfig();
  if (config) {
    if (!isSafeObjectKey(key)) throw new Error("Kunci berkas private tidak valid.");
    const url = await getSignedUrl(
      getS3Client(config),
      new GetObjectCommand({
        Bucket: config.bucket,
        Key: key,
        ResponseContentDisposition: buildContentDisposition(fileName),
        ResponseContentType: contentType,
      }),
      { expiresIn: PRIVATE_URL_TTL_SECONDS }
    );
    return { kind: "redirect", url };
  }

  if (process.env.VERCEL) {
    throw new Error("Penyimpanan dokumen private belum dikonfigurasi (S3_PRIVATE_BUCKET).");
  }
  return { kind: "file", body: await readFile(resolveLocalPrivatePath(key)) };
}

export interface UploadResult {
  url: string;
  fileName: string;
  sizeBytes: number;
  mimeType: string;
}

const ALLOWED_MIME_TYPES = [
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/gif",
];
const MAX_FILE_SIZE_BYTES = 5 * 1024 * 1024; // 5 MB

export function detectImageFormat(
  buffer: Buffer
): { mime: string; ext: "jpg" | "png" | "webp" | "gif" } | null {
  if (buffer.length < 4) return null;

  // JPEG: FF D8 FF
  if (buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff) {
    return { mime: "image/jpeg", ext: "jpg" };
  }
  // PNG: 89 50 4E 47 0D 0A 1A 0A
  if (
    buffer[0] === 0x89 &&
    buffer[1] === 0x50 &&
    buffer[2] === 0x4e &&
    buffer[3] === 0x47 &&
    buffer[4] === 0x0d &&
    buffer[5] === 0x0a &&
    buffer[6] === 0x1a &&
    buffer[7] === 0x0a
  ) {
    return { mime: "image/png", ext: "png" };
  }
  // GIF: GIF87a / GIF89a
  const header6 = buffer.subarray(0, 6).toString("ascii");
  if (header6 === "GIF87a" || header6 === "GIF89a") {
    return { mime: "image/gif", ext: "gif" };
  }
  // WEBP: RIFF....WEBP
  if (
    buffer.subarray(0, 4).toString("ascii") === "RIFF" &&
    buffer.subarray(8, 12).toString("ascii") === "WEBP"
  ) {
    return { mime: "image/webp", ext: "webp" };
  }
  return null;
}

function detectDocumentFormat(
  buffer: Buffer,
  fileName: string,
  mimeType: string
): { mime: string; ext: "pdf" | "doc" | "docx" | "jpg" | "png" } | null {
  if (buffer.length < 8) return null;

  // PDF: %PDF-
  if (buffer.subarray(0, 5).toString("ascii") === "%PDF-") {
    return { mime: "application/pdf", ext: "pdf" };
  }

  // Image scan (JPG/PNG)
  const img = detectImageFormat(buffer);
  if (img && (img.ext === "jpg" || img.ext === "png")) {
    return { mime: img.mime, ext: img.ext };
  }

  const lowerName = fileName.toLowerCase();

  // DOC (OLE2 Compound File): D0 CF 11 E0 A1 B1 1A E1
  if (
    buffer[0] === 0xd0 &&
    buffer[1] === 0xcf &&
    buffer[2] === 0x11 &&
    buffer[3] === 0xe0 &&
    buffer[4] === 0xa1 &&
    buffer[5] === 0xb1 &&
    buffer[6] === 0x1a &&
    buffer[7] === 0xe1 &&
    (mimeType === "application/msword" || lowerName.endsWith(".doc"))
  ) {
    return { mime: "application/msword", ext: "doc" };
  }

  // DOCX (ZIP PK\x03\x04)
  if (
    buffer[0] === 0x50 &&
    buffer[1] === 0x4b &&
    buffer[2] === 0x03 &&
    buffer[3] === 0x04 &&
    (mimeType ===
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document" ||
      lowerName.endsWith(".docx"))
  ) {
    return {
      mime: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      ext: "docx",
    };
  }

  return null;
}

/**
 * Layanan penyimpanan foto (Fase 0).
 * Object storage S3-compatible (Supabase Storage) bila dikonfigurasi,
 * fallback ke `public/uploads` saat pengembangan lokal.
 */
export async function saveUploadedPhoto(
  file: File,
  folder: "assets" | "reports" | "workorders" | "technicians" = "reports"
): Promise<UploadResult> {
  if (!ALLOWED_MIME_TYPES.includes(file.type)) {
    throw new Error(
      `Format file tidak didukung (${file.type}). Gunakan JPG, PNG, atau WebP.`
    );
  }

  if (file.size <= 0 || file.size > MAX_FILE_SIZE_BYTES) {
    throw new Error("Ukuran foto harus antara 1 byte hingga 5 MB.");
  }

  const arrayBuffer = await file.arrayBuffer();
  const buffer = Buffer.from(arrayBuffer);
  const detected = detectImageFormat(buffer);
  if (!detected) {
    throw new Error(
      "Isi berkas foto tidak valid atau tidak sesuai format JPG, PNG, WebP, atau GIF."
    );
  }

  const uniqueName = `${Date.now()}-${crypto.randomBytes(4).toString("hex")}.${detected.ext}`;
  const url = await persistUpload(folder, uniqueName, buffer, detected.mime);

  return {
    url,
    fileName: uniqueName,
    sizeBytes: buffer.byteLength,
    mimeType: detected.mime,
  };
}

const ALLOWED_DOCUMENT_MIME_TYPES = [
  "application/pdf",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "image/jpeg",
  "image/png",
];
const MAX_DOC_SIZE_BYTES = 10 * 1024 * 1024; // 10 MB sesuai PRD v0.2 Keputusan 14

/**
 * Layanan penyimpanan file dokumen resmi (Surat Perintah Kerja / SPK) ke bucket private.
 * Mendukung PDF, DOC, DOCX, dan scan image hingga 10 MB dengan validasi magic bytes.
 * `url` berisi referensi `private://...`, bukan URL publik.
 */
export async function saveUploadedDocument(
  file: File,
  folder: PrivateUploadFolder = "spk"
): Promise<UploadResult> {
  const lowerName = file.name.toLowerCase();
  const hasAllowedExtension =
    lowerName.endsWith(".pdf") ||
    lowerName.endsWith(".doc") ||
    lowerName.endsWith(".docx") ||
    lowerName.endsWith(".jpg") ||
    lowerName.endsWith(".jpeg") ||
    lowerName.endsWith(".png");

  const isAllowedMime =
    ALLOWED_DOCUMENT_MIME_TYPES.includes(file.type) ||
    (file.type === "" && hasAllowedExtension);

  if (!isAllowedMime) {
    throw new Error(
      `Format dokumen tidak didukung (${file.type || "kosong"}). Gunakan PDF, DOC, DOCX, atau scan JPG/PNG.`
    );
  }

  if (file.size <= 0 || file.size > MAX_DOC_SIZE_BYTES) {
    throw new Error("Ukuran dokumen SPK harus antara 1 byte hingga 10 MB.");
  }

  const arrayBuffer = await file.arrayBuffer();
  const buffer = Buffer.from(arrayBuffer);
  const detected = detectDocumentFormat(buffer, file.name, file.type);
  if (!detected) {
    throw new Error(
      "Isi berkas dokumen SPK tidak valid atau tidak sesuai format PDF, DOC, DOCX, JPG, atau PNG."
    );
  }

  const uniqueName = `SPK-${Date.now()}-${crypto.randomBytes(8).toString("hex")}.${detected.ext}`;
  const url = await persistPrivateUpload(folder, uniqueName, buffer, detected.mime);

  return {
    url,
    fileName: path.basename(file.name) || uniqueName,
    sizeBytes: buffer.byteLength,
    mimeType: detected.mime,
  };
}

