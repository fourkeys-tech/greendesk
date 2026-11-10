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

  if (file.size > MAX_FILE_SIZE_BYTES) {
    throw new Error("Ukuran foto melebihi batas maksimum 5 MB.");
  }

  const ext = file.name.split(".").pop()?.toLowerCase() || "jpg";
  const safeExt = ["jpg", "jpeg", "png", "webp", "gif"].includes(ext)
    ? ext
    : "jpg";
  const uniqueName = `${Date.now()}-${crypto.randomBytes(4).toString("hex")}.${safeExt}`;

  const uploadDir = path.join(process.cwd(), "public", "uploads", folder);
  await mkdir(uploadDir, { recursive: true });

  const filePath = path.join(uploadDir, uniqueName);
  const arrayBuffer = await file.arrayBuffer();
  const buffer = Buffer.from(arrayBuffer);

  await writeFile(filePath, buffer);

  return {
    url: `/uploads/${folder}/${uniqueName}`,
    fileName: uniqueName,
    sizeBytes: file.size,
    mimeType: file.type,
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
 * Mendukung PDF, DOC, DOCX, dan scan image hingga 10 MB.
 */
export async function saveUploadedDocument(
  file: File,
  folder: "spk" | "documents" = "spk"
): Promise<UploadResult> {
  const isAllowedMime =
    ALLOWED_DOCUMENT_MIME_TYPES.includes(file.type) ||
    file.name.toLowerCase().endsWith(".pdf") ||
    file.name.toLowerCase().endsWith(".doc") ||
    file.name.toLowerCase().endsWith(".docx");

  if (!isAllowedMime) {
    throw new Error(
      `Format dokumen tidak didukung (${file.type}). Gunakan PDF, DOC, DOCX, atau scan JPG/PNG.`
    );
  }

  if (file.size > MAX_DOC_SIZE_BYTES) {
    throw new Error("Ukuran dokumen SPK melebihi batas maksimum 10 MB.");
  }

  const ext = file.name.split(".").pop()?.toLowerCase() || "pdf";
  const cleanExt = ["pdf", "doc", "docx", "jpg", "jpeg", "png"].includes(ext)
    ? ext
    : "pdf";
  const uniqueName = `SPK-${Date.now()}-${crypto.randomBytes(4).toString("hex")}.${cleanExt}`;

  const uploadDir = path.join(process.cwd(), "public", "uploads", folder);
  await mkdir(uploadDir, { recursive: true });

  const filePath = path.join(uploadDir, uniqueName);
  const arrayBuffer = await file.arrayBuffer();
  const buffer = Buffer.from(arrayBuffer);

  await writeFile(filePath, buffer);

  return {
    url: `/uploads/${folder}/${uniqueName}`,
    fileName: file.name || uniqueName,
    sizeBytes: file.size,
    mimeType: file.type || "application/pdf",
  };
}

