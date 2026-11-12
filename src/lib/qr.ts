import QRCode from "qrcode";
import { getPublicAppBaseUrl } from "./app-url";

const qrDataCache = new Map<string, { shortUrl: string; qrDataUrl: string }>();

/**
 * Menghasilkan Data URL PNG QR Code untuk tautan pendek aset (/r/{kodeAset}).
 * Sesuai PRD Fase 1: QR dibuat otomatis dari kode aset dan membuka form untuk aset yang benar.
 * Basis URL mengikuti parameter `baseUrl` bila diberikan, atau `APP_BASE_URL` dari environment.
 * Production mewajibkan `APP_BASE_URL`; localhost hanya dipakai pada development/test.
 * Menggunakan memory-cache untuk performa render instan tanpa hitung ulang canvas.
 */
export async function generateAssetQrDataUrl(
  assetCode: string,
  baseUrl?: string
): Promise<{ shortUrl: string; qrDataUrl: string }> {
  const cleanBase = getPublicAppBaseUrl(baseUrl);
  const shortUrl = `${cleanBase}/r/${encodeURIComponent(assetCode)}`;
  const cacheKey = `${cleanBase}:${assetCode}`;

  const cached = qrDataCache.get(cacheKey);
  if (cached) {
    return cached;
  }

  const qrDataUrl = await QRCode.toDataURL(shortUrl, {
    width: 240,
    margin: 2,
    color: {
      dark: "#0f172a",
      light: "#ffffff",
    },
  });

  const result = { shortUrl, qrDataUrl };
  qrDataCache.set(cacheKey, result);
  return result;
}

