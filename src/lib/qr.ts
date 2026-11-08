import QRCode from "qrcode";

/**
 * Menghasilkan SVG QR Code untuk tautan pendek aset (/r/{kodeAset}).
 * Sesuai PRD Fase 1: QR dibuat otomatis dari kode aset dan membuka form untuk aset yang benar.
 */
export async function generateAssetQrDataUrl(
  assetCode: string,
  baseUrl = "http://localhost:3000"
): Promise<{ shortUrl: string; qrDataUrl: string }> {
  const cleanBase = baseUrl.replace(/\/$/, "");
  const shortUrl = `${cleanBase}/r/${encodeURIComponent(assetCode)}`;

  const qrDataUrl = await QRCode.toDataURL(shortUrl, {
    width: 240,
    margin: 2,
    color: {
      dark: "#0f172a",
      light: "#ffffff",
    },
  });

  return { shortUrl, qrDataUrl };
}

