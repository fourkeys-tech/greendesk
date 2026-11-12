import { mkdir, writeFile } from "fs/promises";
import path from "path";
import crypto from "crypto";

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
 * Menggunakan penyimpanan lokal `public/uploads` di mode pengembangan,
 * dan siap dialihkan ke S3 / Cloudflare R2 lewat adapter yang sama.
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

  const uploadDir = path.join(process.cwd(), "public", "uploads", folder);
  await mkdir(uploadDir, { recursive: true });

  const filePath = path.join(uploadDir, uniqueName);
  await writeFile(filePath, buffer);

  return {
    url: `/uploads/${folder}/${uniqueName}`,
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
 * Layanan penyimpanan file dokumen resmi (Surat Perintah Kerja / SPK).
 * Mendukung PDF, DOC, DOCX, dan scan image hingga 10 MB dengan validasi magic bytes.
 */
export async function saveUploadedDocument(
  file: File,
  folder: "spk" | "documents" = "spk"
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

  const uniqueName = `SPK-${Date.now()}-${crypto.randomBytes(4).toString("hex")}.${detected.ext}`;

  const uploadDir = path.join(process.cwd(), "public", "uploads", folder);
  await mkdir(uploadDir, { recursive: true });

  const filePath = path.join(uploadDir, uniqueName);
  await writeFile(filePath, buffer);

  return {
    url: `/uploads/${folder}/${uniqueName}`,
    fileName: path.basename(file.name) || uniqueName,
    sizeBytes: buffer.byteLength,
    mimeType: detected.mime,
  };
}

