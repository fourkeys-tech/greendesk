"use client";

import { useState, useEffect, useRef } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ChevronLeft, Zap, ZapOff, QrCode, AlertCircle, X, ArrowRight, CameraOff } from "lucide-react";
import { MobileContainer } from "@/components/MobileContainer";
import { createQrFrameDecoder, parseScannedAssetCode, type QrFrameDecoder } from "@/lib/qr-scan";

// ~5 frame/detik: cukup responsif tanpa menguras baterai/CPU HP.
const SCAN_INTERVAL_MS = 200;
// Pesan "QR bukan aset" hilang bila QR tersebut tidak terlihat lagi selama ini.
const INVALID_HINT_TTL_MS = 2000;

export default function QRScannerPage() {
  const router = useRouter();
  // Dua elemen <video> (layout mobile & desktop) berbagi satu stream kamera.
  const videoRef = useRef<HTMLVideoElement>(null);
  const desktopVideoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);

  const [flashlightOn, setFlashlightOn] = useState(false);
  const [showManualModal, setShowManualModal] = useState(false);
  const [manualCode, setManualCode] = useState("");
  const [cameraActive, setCameraActive] = useState(false);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [scanHint, setScanHint] = useState<string | null>(null);
  const [scanFound, setScanFound] = useState(false);

  useEffect(() => {
    let isMounted = true;

    async function initCamera() {
      try {
        if (typeof navigator !== "undefined" && navigator.mediaDevices && navigator.mediaDevices.getUserMedia) {
          const stream = await navigator.mediaDevices.getUserMedia({
            video: {
              facingMode: { ideal: "environment" },
              width: { ideal: 1280 },
              height: { ideal: 720 },
            },
            audio: false,
          });

          if (!isMounted) {
            stream.getTracks().forEach((track) => track.stop());
            return;
          }

          streamRef.current = stream;
          for (const video of [videoRef.current, desktopVideoRef.current]) {
            if (!video) continue;
            video.srcObject = stream;
            video.setAttribute("playsinline", "true");
            await video.play().catch(() => {});
          }
          setCameraActive(true);
          setCameraError(null);
        } else {
          setCameraError("Perangkat tidak mendukung akses kamera web.");
        }
      } catch (err) {
        if (isMounted) {
          setCameraActive(false);
          setCameraError("Izin kamera ditolak atau kamera tidak terdeteksi.");
        }
      }
    }

    initCamera();

    return () => {
      isMounted = false;
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((track) => track.stop());
        streamRef.current = null;
      }
    };
  }, []);

  // Loop pembacaan QR dari frame kamera. Isi QR divalidasi lewat parseScannedAssetCode;
  // navigasi selalu ke /r/{kode} lokal, URL dari QR tidak pernah dibuka langsung.
  useEffect(() => {
    if (!cameraActive) return;

    let stopped = false;
    let timer: ReturnType<typeof setTimeout> | undefined;
    let decoder: QrFrameDecoder | null = null;
    let lastInvalidAt = 0;

    const tick = async () => {
      if (stopped || !decoder) return;
      try {
        // Decode dari <video> yang sedang tampil (layout mobile atau desktop).
        const video = [videoRef.current, desktopVideoRef.current].find(
          (v): v is HTMLVideoElement =>
            !!v && v.getClientRects().length > 0 && v.readyState >= HTMLMediaElement.HAVE_CURRENT_DATA
        );
        if (video && !document.hidden) {
          let raw: string | null = null;
          try {
            raw = await decoder.decode(video);
          } catch (err) {
            // BarcodeDetector bawaan bisa gagal saat jalan di sebagian perangkat; pindah ke jsQR.
            if (decoder.kind !== "native") throw err;
            decoder = await createQrFrameDecoder({ allowNative: false });
          }
          if (stopped) return;

          if (raw) {
            const code = parseScannedAssetCode(raw);
            if (code) {
              stopped = true; // cegah navigasi ganda dari frame berikutnya
              setScanFound(true);
              router.push(`/r/${encodeURIComponent(code)}`);
              return;
            }
            lastInvalidAt = Date.now();
            setScanHint("QR Code ini bukan QR aset GreenDesk.");
          } else if (Date.now() - lastInvalidAt > INVALID_HINT_TTL_MS) {
            setScanHint(null);
          }
        }
      } catch {
        // Frame gagal dibaca: abaikan, coba frame berikutnya.
      }
      if (!stopped) timer = setTimeout(tick, SCAN_INTERVAL_MS);
    };

    createQrFrameDecoder()
      .then((d) => {
        if (stopped) return;
        decoder = d;
        void tick();
      })
      .catch(() => {
        if (!stopped) setScanHint("Pemindai QR tidak tersedia. Gunakan input ID aset manual.");
      });

    return () => {
      stopped = true;
      clearTimeout(timer);
    };
  }, [cameraActive, router]);

  const scanStatusText = scanFound
    ? "QR terdeteksi, membuka halaman aset..."
    : scanHint ?? "Arahkan kamera ke QR Code pada aset Taman";
  const scanStatusTone = scanFound ? "text-emerald-300" : scanHint ? "text-amber-300" : "text-slate-200";

  const toggleFlashlight = async () => {
    const nextState = !flashlightOn;
    setFlashlightOn(nextState);

    if (streamRef.current) {
      const track = streamRef.current.getVideoTracks()[0];
      if (track) {
        const capabilities = (track.getCapabilities && track.getCapabilities()) as { torch?: boolean };
        if (capabilities && capabilities.torch) {
          await track.applyConstraints({
            advanced: [{ torch: nextState } as MediaTrackConstraintSet],
          }).catch(() => {});
        }
      }
    }
  };

  const handleManualSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (manualCode.trim()) {
      router.push(`/r/${encodeURIComponent(manualCode.trim().toUpperCase())}`);
    }
  };

  return (
    <>
    {/* ===== MOBILE (unchanged) ===== */}
    <MobileContainer className="bg-slate-950 text-white pb-6 justify-between overflow-hidden">
      <div className="absolute inset-0 z-0 bg-slate-900">
        <video
          ref={videoRef}
          autoPlay
          playsInline
          muted
          className={`w-full h-full object-cover transition-opacity duration-500 ${cameraActive ? "opacity-100" : "opacity-0"}`}
        />
        {!cameraActive && (
          <div className="w-full h-full flex flex-col items-center justify-center p-6 text-center text-slate-400">
            <CameraOff className="w-12 h-12 mb-3 stroke-[1.5] text-slate-500" />
            <p className="text-xs max-w-xs">{cameraError || "Menghubungkan ke kamera..."}</p>
          </div>
        )}
      </div>

      <div className="absolute inset-0 bg-gradient-to-b from-black/80 via-transparent to-black/90 pointer-events-none z-10" />

      <header className="relative z-20 flex items-center justify-between p-4 bg-slate-950/40 backdrop-blur-md border-b border-white/10">
        <Link
          href="/beranda"
          className="w-10 h-10 rounded-full bg-white/10 flex items-center justify-center text-white hover:bg-white/20 transition-colors"
        >
          <ChevronLeft className="w-6 h-6" />
        </Link>
        <h1 className="text-base font-bold tracking-tight">Scan QR Code</h1>
        <button
          type="button"
          onClick={toggleFlashlight}
          className={`w-10 h-10 rounded-full flex items-center justify-center transition-colors ${
            flashlightOn ? "bg-amber-400 text-slate-900" : "bg-white/10 text-white hover:bg-white/20"
          }`}
          aria-label="Toggle Flashlight"
        >
          {flashlightOn ? <Zap className="w-5 h-5 fill-current" /> : <ZapOff className="w-5 h-5" />}
        </button>
      </header>

      <div className="relative z-20 flex-1 flex flex-col items-center justify-center px-6 my-auto">
        <div className="relative w-64 h-64 sm:w-72 sm:h-72">
          <div className="absolute inset-0 border border-white/20 rounded-3xl" />

          <div className="absolute top-0 left-0 w-10 h-10 border-t-4 border-l-4 border-[#283330] rounded-tl-3xl shadow-[0_0_10px_#283330]" />
          <div className="absolute top-0 right-0 w-10 h-10 border-t-4 border-r-4 border-[#283330] rounded-tr-3xl shadow-[0_0_10px_#283330]" />
          <div className="absolute bottom-0 left-0 w-10 h-10 border-b-4 border-l-4 border-[#283330] rounded-bl-3xl shadow-[0_0_10px_#283330]" />
          <div className="absolute bottom-0 right-0 w-10 h-10 border-b-4 border-r-4 border-[#283330] rounded-br-3xl shadow-[0_0_10px_#283330]" />

          <div className="absolute inset-x-4 top-1/2 -translate-y-1/2 h-0.5 bg-gradient-to-r from-transparent via-[#283330] to-transparent shadow-[0_0_12px_#283330] animate-pulse" />

          {!cameraActive && (
            <div className="w-full h-full flex flex-col items-center justify-center opacity-30">
              <QrCode className="w-20 h-20 text-white stroke-[1]" />
            </div>
          )}
        </div>

        <p aria-live="polite" className={`mt-6 text-xs font-medium text-center tracking-wide max-w-xs drop-shadow-md ${scanStatusTone}`}>
          {scanStatusText}
        </p>
      </div>

      <div className="relative z-20 p-4">
        <div className="bg-white text-slate-900 rounded-2xl p-4 shadow-2xl border border-slate-100 flex flex-col gap-2.5">
          <div className="flex items-start gap-3">
            <div className="w-9 h-9 rounded-xl bg-[#283330]/10 text-[#283330] flex items-center justify-center shrink-0 border border-[#283330]/20">
              <AlertCircle className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-sm font-bold text-slate-900">
                QR Code tidak bisa dipakai?
              </h2>
              <p className="text-xs text-slate-500 leading-snug">
                Jika stiker QR tergores atau rusak, Anda dapat memasukkan kode fisik aset.
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={() => setShowManualModal(true)}
            className="btn btn-outline w-full py-2.5 text-xs font-bold text-[#283330] border-[#283330] hover:bg-[#283330]/10 rounded-xl mt-1"
          >
            Masukkan ID Aset Manual
          </button>
        </div>
      </div>

      {showManualModal && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-in fade-in">
          <div className="bg-white text-slate-900 rounded-3xl w-full max-w-sm p-5 shadow-2xl border border-slate-100">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 mb-4">
              <h3 className="text-base font-bold text-slate-900">
                Input ID Aset Manual
              </h3>
              <button
                type="button"
                onClick={() => setShowManualModal(false)}
                className="w-8 h-8 rounded-full bg-slate-100 flex items-center justify-center text-slate-500 hover:bg-slate-200"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleManualSubmit} className="space-y-4">
              <div className="form-control">
                <label className="label">
                  <span className="label-text">Kode / ID Aset</span>
                </label>
                <input
                  type="text"
                  value={manualCode}
                  onChange={(e) => setManualCode(e.target.value)}
                  placeholder="Contoh: AST-BGV-001"
                  className="input input-bordered w-full font-mono font-semibold uppercase text-[#283330] text-center tracking-wider"
                  required
                />
                <span className="text-[11px] text-slate-400 mt-1">
                  ID tercetak di bagian bawah stiker plat aset taman.
                </span>
              </div>

              <div className="flex gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowManualModal(false)}
                  className="btn flex-1 bg-slate-100 hover:bg-slate-200 text-slate-700 border-0 rounded-xl text-xs font-semibold"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  className="btn flex-1 bg-[#283330] hover:bg-[#1e2725] text-white rounded-xl text-xs font-bold flex items-center justify-center gap-1.5"
                >
                  <span>Lanjutkan</span>
                  <ArrowRight className="w-4 h-4" />
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </MobileContainer>

    {/* ===== DESKTOP / TABLET ===== */}
    <div className="hidden md:flex min-h-screen bg-slate-950 text-white relative overflow-hidden justify-center items-center">
      <video
        ref={desktopVideoRef}
        autoPlay
        playsInline
        muted
        className={`absolute inset-0 w-full h-full object-cover transition-opacity duration-500 ${cameraActive ? "opacity-100" : "opacity-0"}`}
      />
      {!cameraActive && (
        <div className="absolute inset-0 flex flex-col items-center justify-center p-6 text-center text-slate-400">
          <CameraOff className="w-16 h-16 mb-4 stroke-[1.5] text-slate-600" />
          <p className="text-sm max-w-md">{cameraError || "Menghubungkan ke kamera..."}</p>
        </div>
      )}
      <div className="absolute inset-0 bg-gradient-to-b from-black/80 via-transparent to-black/90 pointer-events-none z-10" />

      <div className="relative z-20 flex flex-col items-center w-full max-w-2xl px-6">
        <header className="w-full flex items-center justify-between mb-8">
          <Link href="/beranda" className="w-12 h-12 rounded-full bg-white/10 flex items-center justify-center text-white hover:bg-white/20 transition-colors">
            <ChevronLeft className="w-6 h-6" />
          </Link>
          <h1 className="text-xl font-bold tracking-tight">Scan QR Code</h1>
          <button type="button" onClick={toggleFlashlight} className={`w-12 h-12 rounded-full flex items-center justify-center transition-colors ${flashlightOn ? "bg-amber-400 text-slate-900" : "bg-white/10 text-white hover:bg-white/20"}`} aria-label="Toggle Flashlight">
            {flashlightOn ? <Zap className="w-6 h-6 fill-current" /> : <ZapOff className="w-6 h-6" />}
          </button>
        </header>

        <div className="relative w-80 h-80">
          <div className="absolute inset-0 border border-white/20 rounded-3xl" />
          <div className="absolute top-0 left-0 w-12 h-12 border-t-4 border-l-4 border-[#283330] rounded-tl-3xl shadow-[0_0_10px_#283330]" />
          <div className="absolute top-0 right-0 w-12 h-12 border-t-4 border-r-4 border-[#283330] rounded-tr-3xl shadow-[0_0_10px_#283330]" />
          <div className="absolute bottom-0 left-0 w-12 h-12 border-b-4 border-l-4 border-[#283330] rounded-bl-3xl shadow-[0_0_10px_#283330]" />
          <div className="absolute bottom-0 right-0 w-12 h-12 border-b-4 border-r-4 border-[#283330] rounded-br-3xl shadow-[0_0_10px_#283330]" />
          <div className="absolute inset-x-4 top-1/2 -translate-y-1/2 h-0.5 bg-gradient-to-r from-transparent via-[#283330] to-transparent shadow-[0_0_12px_#283330] animate-pulse" />
          {!cameraActive && (
            <div className="w-full h-full flex flex-col items-center justify-center opacity-30">
              <QrCode className="w-24 h-24 text-white stroke-[1]" />
            </div>
          )}
        </div>

        <p aria-live="polite" className={`mt-8 text-sm font-medium text-center tracking-wide max-w-md drop-shadow-md ${scanStatusTone}`}>
          {scanStatusText}
        </p>

        <div className="mt-8 w-full max-w-md">
          <div className="bg-white text-slate-900 rounded-2xl p-5 shadow-2xl border border-slate-100 flex flex-col gap-3">
            <div className="flex items-start gap-3">
              <div className="w-10 h-10 rounded-xl bg-[#283330]/10 text-[#283330] flex items-center justify-center shrink-0 border border-[#283330]/20">
                <AlertCircle className="w-5 h-5" />
              </div>
              <div>
                <h2 className="text-sm font-bold text-slate-900">QR Code tidak bisa dipakai?</h2>
                <p className="text-xs text-slate-500 leading-snug">Jika stiker QR tergores atau rusak, Anda dapat memasukkan kode fisik aset.</p>
              </div>
            </div>
            <button type="button" onClick={() => setShowManualModal(true)} className="btn btn-outline w-full py-3 text-sm font-bold text-[#283330] border-[#283330] hover:bg-[#283330]/10 rounded-xl mt-1">
              Masukkan ID Aset Manual
            </button>
          </div>
        </div>
      </div>

      {showManualModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-in fade-in">
          <div className="bg-white text-slate-900 rounded-3xl w-full max-w-md p-6 shadow-2xl border border-slate-100">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 mb-4">
              <h3 className="text-lg font-bold text-slate-900">Input ID Aset Manual</h3>
              <button type="button" onClick={() => setShowManualModal(false)} className="w-9 h-9 rounded-full bg-slate-100 flex items-center justify-center text-slate-500 hover:bg-slate-200">
                <X className="w-5 h-5" />
              </button>
            </div>
            <form onSubmit={handleManualSubmit} className="space-y-4">
              <div className="form-control">
                <label className="label"><span className="label-text">Kode / ID Aset</span></label>
                <input type="text" value={manualCode} onChange={(e) => setManualCode(e.target.value)} placeholder="Contoh: AST-BGV-001" className="input input-bordered w-full font-mono font-semibold uppercase text-[#283330] text-center tracking-wider" required />
                <span className="text-xs text-slate-400 mt-1">ID tercetak di bagian bawah stiker plat aset taman.</span>
              </div>
              <div className="flex gap-2 pt-2">
                <button type="button" onClick={() => setShowManualModal(false)} className="btn flex-1 bg-slate-100 hover:bg-slate-200 text-slate-700 border-0 rounded-xl text-sm font-semibold">Batal</button>
                <button type="submit" className="btn flex-1 bg-[#283330] hover:bg-[#1e2725] text-white rounded-xl text-sm font-bold flex items-center justify-center gap-1.5">
                  <span>Lanjutkan</span>
                  <ArrowRight className="w-4 h-4" />
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
    </>
  );
}
