/**
 * Pembaca QR untuk halaman /scan (client-only untuk decoder, parser murni & bisa dites).
 *
 * Isi QR aset adalah URL `${APP_BASE_URL}/r/{kodeAset}` (lihat lib/qr.ts). Isi QR dianggap
 * input tidak tepercaya: yang diambil hanya kode asetnya, lalu navigasi selalu ke `/r/{kode}`
 * di origin aplikasi ini. URL hasil scan TIDAK pernah dibuka langsung, sehingga stiker QR
 * palsu yang mengarah ke domain lain tidak bisa membawa pengguna keluar aplikasi.
 * Host URL sengaja tidak dicek: APP_BASE_URL bisa beda antara QR cetakan dan origin saat ini
 * (dev/staging/prod), dan pengecekan host tidak menambah keamanan karena navigasi tetap lokal.
 */

const MAX_ASSET_CODE_LENGTH = 64;
// Teks polos (bukan URL) wajib berbentuk kode aset bersegmen, mis. GPR-BGN-TMU-LMP-001,
// agar teks acak dari QR lain tidak dianggap kode aset.
const RAW_ASSET_CODE_RE = /^[A-Z0-9]+(?:-[A-Z0-9]+)+$/;
// Segmen path /r/{kode} sedikit lebih longgar (kode manual dari admin bisa tanpa tanda hubung).
const PATH_ASSET_CODE_RE = /^[A-Z0-9][A-Z0-9._-]*$/;
const SHORTLINK_PATH_RE = /^\/r\/([^/]+)\/?$/;

/** Ambil kode aset dari isi QR; `null` bila QR bukan QR aset GreenDesk. */
export function parseScannedAssetCode(raw: string): string | null {
  const text = raw.trim();
  if (!text || text.length > 2048) return null;

  const upper = text.toUpperCase();
  if (upper.length <= MAX_ASSET_CODE_LENGTH && RAW_ASSET_CODE_RE.test(upper)) {
    return upper;
  }

  let url: URL;
  try {
    url = new URL(text);
  } catch {
    return null;
  }
  if (url.protocol !== "https:" && url.protocol !== "http:") return null;

  const match = SHORTLINK_PATH_RE.exec(url.pathname);
  if (!match) return null;

  let code: string;
  try {
    code = decodeURIComponent(match[1]).trim().toUpperCase();
  } catch {
    return null;
  }
  if (!code || code.length > MAX_ASSET_CODE_LENGTH || !PATH_ASSET_CODE_RE.test(code)) {
    return null;
  }
  return code;
}

export type QrFrameDecoder = {
  kind: "native" | "jsqr";
  /** Baca satu frame video; mengembalikan isi QR mentah atau `null` bila tidak ada QR. */
  decode(video: HTMLVideoElement): Promise<string | null>;
};

type NativeBarcodeDetector = {
  detect(source: CanvasImageSource): Promise<Array<{ rawValue: string }>>;
};
type NativeBarcodeDetectorCtor = {
  new (options?: { formats: string[] }): NativeBarcodeDetector;
  getSupportedFormats?: () => Promise<string[]>;
};

// Sisi maksimum crop persegi yang diproses jsQR; makin besar makin akurat tapi makin berat.
const JSQR_MAX_SIDE = 512;

/**
 * BarcodeDetector bawaan browser (Chrome Android/macOS, dsb.) bila mendukung QR;
 * selain itu fallback ke jsQR yang dimuat dinamis agar tidak membebani bundle halaman lain.
 * `allowNative: false` memaksa jsQR (dipakai bila detector bawaan ternyata error saat jalan).
 */
export async function createQrFrameDecoder(
  { allowNative = true }: { allowNative?: boolean } = {}
): Promise<QrFrameDecoder> {
  const native = allowNative ? await createNativeDecoder() : null;
  return native ?? createJsQrDecoder();
}

async function createNativeDecoder(): Promise<QrFrameDecoder | null> {
  const Ctor = (globalThis as { BarcodeDetector?: NativeBarcodeDetectorCtor }).BarcodeDetector;
  if (!Ctor) return null;
  try {
    const formats = (await Ctor.getSupportedFormats?.()) ?? [];
    if (!formats.includes("qr_code")) return null;
    const detector = new Ctor({ formats: ["qr_code"] });
    return {
      kind: "native",
      async decode(video) {
        const results = await detector.detect(video);
        return results.find((r) => r.rawValue)?.rawValue ?? null;
      },
    };
  } catch {
    return null;
  }
}

async function createJsQrDecoder(): Promise<QrFrameDecoder> {
  const { default: jsQR } = await import("jsqr");
  const canvas = document.createElement("canvas");
  const ctx = canvas.getContext("2d", { willReadFrequently: true });
  if (!ctx) throw new Error("Canvas 2D tidak tersedia.");

  return {
    kind: "jsqr",
    async decode(video) {
      const vw = video.videoWidth;
      const vh = video.videoHeight;
      if (!vw || !vh) return null;

      // Hanya crop persegi di tengah (area bingkai scan), diperkecil agar ringan di HP murah.
      const side = Math.min(vw, vh);
      const size = Math.min(side, JSQR_MAX_SIDE);
      if (canvas.width !== size || canvas.height !== size) {
        canvas.width = size;
        canvas.height = size;
      }
      ctx.drawImage(video, (vw - side) / 2, (vh - side) / 2, side, side, 0, 0, size, size);
      const { data } = ctx.getImageData(0, 0, size, size);
      // Stiker dicetak gelap di atas terang; lewati percobaan warna terbalik (2x lebih cepat).
      return jsQR(data, size, size, { inversionAttempts: "dontInvert" })?.data ?? null;
    },
  };
}
