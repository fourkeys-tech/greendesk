"use client";

import { useEffect, useRef, useState, type FormEvent } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  MapPin,
  ScanQrCode,
  Armchair,
  ChevronDown,
  Check,
  BookOpen,
  ArrowRight,
  X,
  Search,
  LogIn,
  LayoutDashboard,
  UserRound,
  Megaphone,
} from "lucide-react";
import { BottomNav } from "@/components/BottomNav";
import { MobileContainer } from "@/components/MobileContainer";
import type { ReportStatus, Role } from "@/lib/db-types";
import { sanitizeMediaHref } from "@/lib/url-safety";

export interface BerandaParkItem {
  id: string;
  name: string;
  clusterName: string;
}

export interface BerandaReportItem {
  id: string;
  ticketNo: string;
  status: ReportStatus;
  createdAtLabel: string;
  parkId: string;
  parkName: string;
  assetCode: string;
  assetName: string;
  assetLocationNote: string | null;
  photoUrl: string | null;
  isOwnReport: boolean;
}

interface BerandaClientProps {
  session: { name: string; role: Role } | null;
  parks: BerandaParkItem[];
  reports: BerandaReportItem[];
}

const ALL_PARKS_ID = "__ALL__";

const GUIDE_STEPS = [
  {
    title: "Temukan Fasilitas Rusak",
    desc: "Cari kode atau stiker QR Code yang tertera pada fasilitas taman yang membutuhkan perbaikan.",
  },
  {
    title: "Pindai (Scan) QR Code",
    desc: "Buka menu Scan QR Code di aplikasi, lalu arahkan kamera ke kode QR aset tersebut.",
  },
  {
    title: "Isi Formulir Laporan",
    desc: "Unggah foto bukti kerusakan dan tuliskan deskripsi singkat kerusakan. Belum login? Isian disimpan sementara, lalu Anda masuk untuk kembali ke formulir.",
  },
  {
    title: "Kirim & Pantau Progres",
    desc: "Setelah masuk, tekan Kirim untuk mengirim laporan. Pantau progres melalui nomor tiket atau riwayat laporan.",
  },
];

function getGreeting(hour: number) {
  if (hour < 11) return "Selamat Pagi";
  if (hour < 15) return "Selamat Siang";
  if (hour < 18) return "Selamat Sore";
  return "Selamat Malam";
}

function StatusBadge({ status }: { status: ReportStatus }) {
  const base =
    "shrink-0 rounded-full px-3 py-1 text-[11px] font-bold text-white leading-none";
  switch (status) {
    case "SELESAI":
      return <span className={`${base} bg-[#6fcf7a]`}>Selesai</span>;
    case "DIKERJAKAN":
    case "DISETUJUI":
    case "MENUNGGU_KONFIRMASI":
      return <span className={`${base} bg-[#3b9de0]`}>Diproses</span>;
    case "DITOLAK":
    case "TIDAK_VALID":
    case "DIBATALKAN":
      return <span className={`${base} bg-rose-500`}>Ditutup</span>;
    case "DIGABUNG":
      return <span className={`${base} bg-purple-500`}>Digabung</span>;
    case "MENUNGGU_KEPUTUSAN":
    case "BARU":
    default:
      return <span className={`${base} bg-[#e8a000]`}>Pending</span>;
  }
}

/* ---------- Park selector (dropdown dari DB) ---------- */
function ParkSelector({
  parks,
  selectedId,
  onChange,
  variant,
}: {
  parks: BerandaParkItem[];
  selectedId: string;
  onChange: (parkId: string) => void;
  variant: "mobile" | "desktop";
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open]);

  const isMobile = variant === "mobile";
  const selectedLabel =
    selectedId === ALL_PARKS_ID
      ? "Semua Kawasan Taman"
      : parks.find((p) => p.id === selectedId)?.name || "Semua Kawasan Taman";

  return (
    <div
      ref={ref}
      className={isMobile ? "relative mt-1 flex justify-center" : "relative mt-6"}
    >
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        className={
          isMobile
            ? "inline-flex items-center gap-1.5 text-xs font-semibold text-[#1f7a55] cursor-pointer"
            : "flex w-full max-w-sm items-center justify-between gap-2 rounded-full bg-[#F6F5F0] px-5 py-3 text-sm font-bold text-slate-800 border border-slate-200 transition-colors hover:bg-slate-200/70 cursor-pointer"
        }
      >
        <span className="flex items-center gap-2">
          <MapPin
            className={isMobile ? "h-3.5 w-3.5 text-[#1f7a55]" : "h-4 w-4 text-[#1b5e45]"}
          />
          <span>{selectedLabel}</span>
        </span>
        <ChevronDown
          className={`transition-transform ${isMobile ? "h-3.5 w-3.5" : "h-4 w-4 text-[#1b5e45]"
            } ${open ? "rotate-180" : ""}`}
        />
      </button>

      {open && (
        <div
          className={`absolute top-full z-[60] mt-2 w-64 max-h-72 overflow-y-auto rounded-2xl border border-slate-200 bg-white p-1.5 shadow-xl ${isMobile ? "left-1/2 -translate-x-1/2" : "left-0"
            }`}
        >
          {!isMobile && (
            <span className="block px-3 py-1.5 text-[11px] font-bold uppercase tracking-wider text-slate-400">
              Pilih Kawasan Taman
            </span>
          )}
          <button
            type="button"
            onClick={() => {
              onChange(ALL_PARKS_ID);
              setOpen(false);
            }}
            className={`flex w-full items-center justify-between rounded-xl px-3 py-2 text-left text-xs transition-colors ${selectedId === ALL_PARKS_ID
              ? "bg-[#283330] font-bold text-white"
              : "text-slate-700 hover:bg-slate-50"
              }`}
          >
            <span>Semua Kawasan Taman</span>
            {selectedId === ALL_PARKS_ID && <Check className="h-3.5 w-3.5" />}
          </button>
          {parks.map((park) => (
            <button
              key={park.id}
              type="button"
              onClick={() => {
                onChange(park.id);
                setOpen(false);
              }}
              className={`flex w-full items-center justify-between rounded-xl px-3 py-2 text-left text-xs transition-colors ${selectedId === park.id
                ? "bg-[#283330] font-bold text-white"
                : "text-slate-700 hover:bg-slate-50"
                }`}
            >
              <span className="truncate">
                {park.name}
                <span
                  className={`block text-[10px] font-normal ${selectedId === park.id ? "text-emerald-200" : "text-slate-400"
                    }`}
                >
                  {park.clusterName}
                </span>
              </span>
              {selectedId === park.id && <Check className="h-3.5 w-3.5 shrink-0" />}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

/* ---------- Guide modal (satu instance saja) ---------- */
function GuideModal({ onClose }: { onClose: () => void }) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose]);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm animate-in fade-in duration-200"
      onClick={onClose}
    >
      <div
        className="w-full max-w-sm md:max-w-md space-y-4 rounded-3xl bg-white p-5 md:p-6 shadow-2xl animate-in zoom-in-95 duration-150"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
      >
        <div className="flex items-center justify-between border-b border-slate-100 pb-3">
          <div className="flex items-center gap-2.5">
            <div className="flex h-9 w-9 md:h-10 md:w-10 items-center justify-center rounded-xl bg-[#1b5e45]/10 text-[#1b5e45]">
              <BookOpen className="h-5 w-5" />
            </div>
            <div>
              <h3 className="text-base md:text-lg font-bold leading-tight text-slate-900">
                Panduan Pelaporan
              </h3>
              <p className="text-[11px] md:text-xs text-slate-500">
                Langkah mudah melaporkan fasilitas taman
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Tutup"
            className="flex h-8 w-8 items-center justify-center rounded-full bg-slate-100 text-slate-500 transition-colors hover:bg-slate-200"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="max-h-[60vh] space-y-3 overflow-y-auto pr-1">
          {GUIDE_STEPS.map((step, i) => (
            <div
              key={step.title}
              className="flex items-start gap-3 rounded-xl bg-[#F6F5F0] p-2.5 md:p-3"
            >
              <div className="mt-0.5 flex h-6 w-6 md:h-7 md:w-7 shrink-0 items-center justify-center rounded-full bg-[#1b5e45] text-xs font-bold text-white">
                {i + 1}
              </div>
              <div>
                <h4 className="text-xs md:text-sm font-bold text-slate-900">
                  {step.title}
                </h4>
                <p className="mt-0.5 text-[11px] md:text-xs leading-relaxed text-slate-600">
                  {step.desc}
                </p>
              </div>
            </div>
          ))}
        </div>

        <button
          type="button"
          onClick={onClose}
          className="h-11 md:h-12 w-full rounded-2xl bg-[#1b5e45] text-xs md:text-sm font-semibold text-white shadow-md transition-colors hover:bg-[#154a36] cursor-pointer"
        >
          Tutup
        </button>
      </div>
    </div>
  );
}

/* ---------- Report item ---------- */
function ReportItem({
  report,
  variant,
}: {
  report: BerandaReportItem;
  variant: "mobile" | "desktop";
}) {
  const isMobile = variant === "mobile";
  const thumb = isMobile ? "h-[52px] w-[52px] rounded-lg" : "h-12 w-12 rounded-xl";
  // Pemilik laporan langsung ke halaman status; tamu diarahkan ke halaman aset publik agar tidak tertolak token.
  const href = report.isOwnReport
    ? `/status/${encodeURIComponent(report.ticketNo)}`
    : `/r/${encodeURIComponent(report.assetCode)}`;

  const safePhotoUrl = sanitizeMediaHref(report.photoUrl);

  return (
    <Link
      href={href}
      className={`group flex items-center justify-between gap-3 rounded-2xl bg-white shadow-sm transition-all hover:shadow-md ${isMobile
        ? "p-2.5"
        : "p-4 border border-slate-200/70 hover:border-[#1b5e45]/40"
        }`}
    >
      <div className="flex min-w-0 items-center gap-3">
        {safePhotoUrl ? (
          <img
            src={safePhotoUrl}
            alt={report.assetName}
            className={`${thumb} shrink-0 object-cover`}
          />
        ) : (
          <div
            className={`${thumb} flex shrink-0 items-center justify-center bg-[#dff1e7] text-[#1f7a55]`}
          >
            <Armchair className="h-6 w-6" />
          </div>
        )}
        <div className="min-w-0">
          <span className="block text-[11px] font-bold leading-none text-[#1f7a55]">
            {report.ticketNo}
          </span>
          <h4
            className={`mt-1 truncate font-extrabold leading-tight text-black transition-colors ${isMobile ? "text-[13px]" : "text-sm group-hover:text-[#1b5e45]"
              }`}
          >
            {report.assetName}
          </h4>
          <p className="mt-0.5 truncate text-[11px] text-slate-400">
            {report.assetLocationNote || report.parkName} • {report.createdAtLabel}
          </p>
        </div>
      </div>
      <StatusBadge status={report.status} />
    </Link>
  );
}

/* ---------- Cek status (redirect ke /status/[ticketNo]) ---------- */
function TrackTicket() {
  const router = useRouter();
  const [ticket, setTicket] = useState("");
  const [error, setError] = useState("");

  const onSubmit = (e: FormEvent) => {
    e.preventDefault();
    const raw = ticket.trim();
    if (!raw) {
      setError("Masukkan nomor tiket terlebih dahulu.");
      return;
    }
    setError("");
    // Jika user menempelkan path/URL /status/TK-...?k=..., teruskan query token-nya.
    const statusMatch = raw.match(/\/status\/([^?\s]+)(?:\?([^\s]+))?/i);
    if (statusMatch) {
      const targetTicket = decodeURIComponent(statusMatch[1]);
      const qs = statusMatch[2] ? `?${statusMatch[2]}` : "";
      router.push(`/status/${encodeURIComponent(targetTicket)}${qs}`);
      return;
    }
    router.push(`/status/${encodeURIComponent(raw.toUpperCase())}`);
  };

  return (
    <form
      onSubmit={onSubmit}
      className="flex flex-col md:flex-row md:items-center justify-between gap-4 md:gap-6 rounded-3xl border border-slate-200/80 bg-white p-5 md:p-6 shadow-sm"
    >
      <div className="min-w-0">
        <h3 className="text-sm md:text-base font-bold text-slate-900">
          Cek status laporan
        </h3>
        <p className="mt-1 max-w-md text-xs leading-relaxed text-slate-500">
          Masukkan nomor tiket (atau tempel tautan dari email konfirmasi Anda) untuk
          melihat progres penanganan laporan.
        </p>
      </div>
      <div className="shrink-0">
        <div className="flex items-center gap-2.5 md:gap-3">
          <input
            value={ticket}
            onChange={(e) => {
              setTicket(e.target.value);
              if (error) setError("");
            }}
            placeholder="Contoh: GP-2026-0001"
            aria-label="Nomor tiket"
            className="w-full md:w-64 rounded-xl border border-slate-200 bg-[#F6F5F0] px-4 py-2.5 text-sm text-slate-800 outline-none placeholder:text-slate-400 focus:border-[#1b5e45] focus:ring-2 focus:ring-[#1b5e45]/20"
          />
          <button
            type="submit"
            className="inline-flex shrink-0 items-center gap-2 rounded-xl bg-[#14231d] px-4 md:px-5 py-2.5 text-xs md:text-sm font-bold text-white transition-colors hover:bg-[#1b5e45] cursor-pointer"
          >
            <Search className="h-4 w-4" />
            Cek Status
          </button>
        </div>
        {error && (
          <p className="mt-2 text-[11px] font-medium text-red-600">{error}</p>
        )}
      </div>
    </form>
  );
}

/* ================== PAGE ================== */
export function BerandaClient({
  session,
  parks,
  reports,
}: BerandaClientProps) {
  const [selectedParkId, setSelectedParkId] = useState<string>(ALL_PARKS_ID);
  const [isGuideOpen, setIsGuideOpen] = useState(false);
  const [greeting, setGreeting] = useState("Selamat Datang");

  useEffect(() => {
    setGreeting(getGreeting(new Date().getHours()));
  }, []);

  const filteredReports =
    selectedParkId === ALL_PARKS_ID
      ? reports
      : reports.filter((r) => r.parkId === selectedParkId);
  const reportHistoryHref = session
    ? session.role === "PENGGUNA"
      ? "/beranda/laporan"
      : "/dashboard/laporan"
    : "/login?returnTo=%2Fberanda%2Flaporan";
  const reportHistoryLabel = session ? "Laporan Saya" : "Masuk untuk Riwayat";

  const closeGuide = () => setIsGuideOpen(false);

  const authLink = session ? (
    <Link
      href={session.role === "PENGGUNA" ? "/beranda/profil" : "/dashboard"}
      className="inline-flex items-center gap-1.5 rounded-full bg-[#1b5e45]/10 px-3.5 py-1.5 text-xs font-bold text-[#1b5e45] hover:bg-[#1b5e45]/20 transition-colors"
    >
      {session.role === "PENGGUNA" ? (
        <UserRound className="h-3.5 w-3.5" />
      ) : (
        <LayoutDashboard className="h-3.5 w-3.5" />
      )}
      <span>
        {session.role === "PENGGUNA"
          ? `Profil (${session.name.split(" ")[0]})`
          : `Dashboard (${session.name.split(" ")[0]})`}
      </span>
    </Link>
  ) : (
    <Link
      href="/login"
      className="inline-flex items-center gap-1.5 rounded-full bg-white border border-slate-200 px-3.5 py-1.5 text-xs font-bold text-slate-700 hover:border-[#1b5e45] hover:text-[#1b5e45] transition-colors"
    >
      <LogIn className="h-3.5 w-3.5" />
      <span>Masuk Akun</span>
    </Link>
  );

  return (
    <>
      {/* ===== MOBILE (< md) ===== */}
      <div className="md:hidden">
        <MobileContainer className="bg-[#F6F5F0] pb-28">
          <header className="px-5 pt-6 pb-4 text-center">
            <div className="flex items-center justify-between mb-3">
              <Link href="/" className="text-xs font-semibold text-slate-500 hover:text-[#1b5e45]">
                ← Awal
              </Link>
              {authLink}
            </div>
            <img
              src="/images/GreenDesk.png"
              alt="GreenDesk Logo"
              className="mx-auto h-auto max-w-[130px] object-contain"
            />
            <h1 className="mt-4 text-[22px] font-extrabold tracking-tight text-black">
              Halo, {greeting}!
            </h1>
            <ParkSelector
              parks={parks}
              selectedId={selectedParkId}
              onChange={setSelectedParkId}
              variant="mobile"
            />
          </header>

          <main className="flex-1 space-y-5 px-5 pb-6">
            <section className="rounded-3xl border border-[#2f8f5b] bg-[#272727] px-5 py-6 text-center shadow-lg">
              <ScanQrCode className="mx-auto h-16 w-16 text-white" strokeWidth={2} />
              <h2 className="mt-3 text-base font-extrabold text-white">
                Laporan Kerusakan
              </h2>
              <p className="mx-auto mt-1 max-w-[220px] text-[11px] leading-snug text-slate-300">
                Scan QR code pada fasilitas taman untuk melaporkan kerusakan.
              </p>
              <Link
                href="/scan"
                className="mt-5 flex w-full items-center justify-center gap-2 rounded-xl bg-[#66d36e] py-2.5 text-sm font-extrabold text-[#1f2a27] transition-transform active:scale-[0.98]"
              >
                <ScanQrCode className="h-5 w-5" strokeWidth={2.4} />
                <span>Scan QR Code</span>
              </Link>
            </section>

            <TrackTicket />

            <button
              type="button"
              onClick={() => setIsGuideOpen(true)}
              className="flex w-full items-center gap-3.5 rounded-2xl border border-slate-200/80 bg-white p-4 text-left shadow-sm transition-transform active:scale-[0.98]"
            >
              <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-[#1b5e45]/10 text-[#1b5e45]">
                <BookOpen className="h-6 w-6" strokeWidth={1.75} />
              </div>
              <div className="min-w-0 flex-1">
                <h3 className="text-sm font-bold leading-tight text-slate-900">
                  Panduan / Cara Laporan
                </h3>
                <p className="mt-0.5 text-[11px] leading-snug text-slate-500">
                  Pelajari 4 langkah mudah melaporkan fasilitas rusak
                </p>
              </div>
              <ArrowRight className="h-4 w-4 shrink-0 text-[#1b5e45]" />
            </button>

            <section>
              <div className="mb-3 flex items-center justify-between">
                <h3 className="text-sm font-extrabold text-black">
                  Laporan Terbaru
                </h3>
                <Link
                  href={reportHistoryHref}
                  className="text-xs font-medium text-black underline underline-offset-2"
                >
                  {reportHistoryLabel}
                </Link>
              </div>
              {filteredReports.length === 0 ? (
                <div className="rounded-2xl bg-white p-5 text-center text-xs text-slate-500 border border-slate-200/70">
                  Belum ada laporan aktif untuk kawasan ini.
                </div>
              ) : (
                <div className="space-y-3">
                  {filteredReports.slice(0, 3).map((report) => (
                    <ReportItem key={report.id} report={report} variant="mobile" />
                  ))}
                </div>
              )}
            </section>
          </main>
        </MobileContainer>
      </div>

      {/* ===== DESKTOP / TABLET (>= md) ===== */}
      <div className="hidden min-h-screen flex-col bg-[#F6F5F0] md:flex">
        <header className="mx-auto grid w-full max-w-screen-xl grid-cols-3 items-center px-6 pt-8 pb-6 lg:px-12 xl:px-16">
          <Link
            href="/"
            className="justify-self-start text-xs font-semibold text-slate-500 hover:text-[#1b5e45]"
          >
            ← Halaman Awal
          </Link>
          <img
            src="/assets/GreenDesk.svg"
            alt="GreenDesk Logo"
            className="justify-self-center h-10 w-auto object-contain"
          />
          <div className="justify-self-end">{authLink}</div>
        </header>

        <div className="mx-auto flex w-full max-w-screen-xl flex-1 flex-col gap-5 px-6 pb-14 lg:px-12 xl:px-16">
          {/* Hero */}
          <div className="relative overflow-visible rounded-3xl border border-slate-200/80 bg-white shadow-sm">
            <img
              src="/assets/BackgroundLeaf.svg"
              alt=""
              aria-hidden
              className="pointer-events-none absolute right-0 top-0 h-auto w-[200px] select-none object-contain opacity-60"
            />
            <div className="relative flex items-stretch">
              <div className="flex flex-1 flex-col justify-center p-8 lg:p-10">
                <h2 className="text-3xl font-extrabold leading-tight tracking-tight text-slate-900 lg:text-4xl">
                  Halo, {greeting}!
                </h2>
                <p className="mt-3 max-w-md text-sm leading-relaxed text-slate-500 lg:text-base">
                  Selamat datang di GreenDesk, pusat layanan pengaduan fasilitas
                  taman. Lihat ada yang rusak? Scan QR di fasilitasnya, isi laporan,
                  lalu masuk untuk kembali ke formulir.
                </p>
                <ParkSelector
                  parks={parks}
                  selectedId={selectedParkId}
                  onChange={setSelectedParkId}
                  variant="desktop"
                />
              </div>

              <div className="flex w-[300px] shrink-0 items-center p-5 lg:w-[340px]">
                <div className="relative w-full overflow-hidden rounded-3xl border border-[#2f8f5b] bg-[#272727] p-6 text-center shadow-lg">
                  <div className="absolute -right-10 -top-10 h-36 w-36 rounded-full bg-[#66d36e]/10 blur-2xl" />
                  <h3 className="relative text-lg font-black text-white">
                    Laporan Kerusakan
                  </h3>
                  <p className="relative mx-auto mt-2 max-w-[200px] text-xs leading-relaxed text-slate-300">
                    Scan QR code pada fasilitas taman untuk melaporkan kerusakan.
                  </p>
                  <Link
                    href="/scan"
                    className="relative mt-5 flex w-full items-center justify-center gap-2 rounded-2xl bg-[#66d36e] py-3 text-sm font-extrabold text-[#1f2a27] shadow-lg shadow-[#66d36e]/20 transition-transform hover:bg-[#5bc563] active:scale-[0.98]"
                  >
                    <ScanQrCode className="h-5 w-5" strokeWidth={2.4} />
                    <span>Scan QR Code</span>
                  </Link>
                  <p className="relative mt-3 text-[11px] text-slate-400">
                    Tidak perlu login di awal. Masuk, kembali ke formulir, lalu tekan Kirim.
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* Cek status */}
          <TrackTicket />

          {/* Panduan */}
          <section className="flex flex-col gap-5">
            <div className="relative overflow-hidden w-full rounded-3xl bg-white p-7 lg:p-8 shadow-sm border border-slate-100">
              <div className="flex items-center justify-between mb-5">
                <div>
                  <h3 className="text-lg font-bold text-[#1b5e45]">Panduan</h3>
                  <p className="text-sm text-[#1f7a55] mt-0.5">Pelajari Cara Menggunakan Aplikasi</p>
                </div>
                <button
                  type="button"
                  onClick={() => setIsGuideOpen(true)}
                  className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-[#1b5e45]/10 text-[#1b5e45] text-sm font-bold hover:bg-[#1b5e45]/20 transition-colors"
                >
                  <BookOpen className="w-4 h-4" />
                  <span>Lihat Panduan</span>
                </button>
              </div>

              <div className="grid grid-cols-4 gap-4 lg:gap-5">
                <div className="rounded-2xl border border-slate-100 bg-[#fcfcfb] p-4 lg:p-5 flex flex-col justify-start">
                  <div className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-[#e6f6ee] text-[#1b5e45] text-xs font-bold w-fit">
                    <span>1</span>
                    <span className="text-[10px] opacity-75">🍃</span>
                  </div>
                  <h4 className="font-bold text-sm text-slate-900 mt-2.5 leading-snug">Scan QR di aset</h4>
                  <p className="text-xs text-slate-500 leading-relaxed mt-1.5">Form terbuka dengan aset dan lokasi sudah terisi. Laporan aktif untuk aset itu ikut tampil agar tidak dobel.</p>
                </div>
                <div className="rounded-2xl border border-slate-100 bg-[#fcfcfb] p-4 lg:p-5 flex flex-col justify-start">
                  <div className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-[#e6f6ee] text-[#1b5e45] text-xs font-bold w-fit">
                    <span>2</span>
                    <span className="text-[10px] opacity-75">🍃</span>
                  </div>
                  <h4 className="font-bold text-sm text-slate-900 mt-2.5 leading-snug">Isi dan kirim</h4>
                  <p className="text-xs text-slate-500 leading-relaxed mt-1.5">Unggah minimal satu foto dan tulis deskripsi singkat. Belum login? Isian disimpan, lalu Anda masuk dan laporan terkirim otomatis.</p>
                </div>
                <div className="rounded-2xl border border-slate-100 bg-[#fcfcfb] p-4 lg:p-5 flex flex-col justify-start">
                  <div className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-[#e6f6ee] text-[#1b5e45] text-xs font-bold w-fit">
                    <span>3</span>
                    <span className="text-[10px] opacity-75">🍃</span>
                  </div>
                  <h4 className="font-bold text-sm text-slate-900 mt-2.5 leading-snug">Diverifikasi pengelola</h4>
                  <p className="text-xs text-slate-500 leading-relaxed mt-1.5">Pengelola taman memeriksa laporan dan menentukan prioritas, lalu manager memutuskan perbaikan.</p>
                </div>
                <div className="rounded-2xl border border-slate-100 bg-[#fcfcfb] p-4 lg:p-5 flex flex-col justify-start">
                  <div className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-[#e6f6ee] text-[#1b5e45] text-xs font-bold w-fit">
                    <span>4</span>
                    <span className="text-[10px] opacity-75">🍃</span>
                  </div>
                  <h4 className="font-bold text-sm text-slate-900 mt-2.5 leading-snug">Dikerjakan, Anda diberi kabar</h4>
                  <p className="text-xs text-slate-500 leading-relaxed mt-1.5">Email dikirim di setiap tahap. Saat selesai, Anda menerima foto hasil perbaikan.</p>
                </div>
              </div>

              <img src="/assets/LeafButton.svg" alt="" aria-hidden className="pointer-events-none select-none absolute -bottom-4 -left-2 w-32 h-auto object-contain opacity-90 scale-x-[-1]" />
              <img src="/assets/LeafButton.svg" alt="" aria-hidden className="pointer-events-none select-none absolute -bottom-4 -right-2 w-32 h-auto object-contain opacity-90" />
            </div>

            <div className="relative overflow-hidden flex items-center justify-between h-24 px-8 rounded-2xl bg-white shadow-sm border border-slate-100">
              <div className="flex items-center gap-4 z-10">
                <div className="relative w-12 h-12 shrink-0 flex items-center justify-center">
                  <Megaphone className="w-10 h-10 text-[#1b5e45] fill-[#1b5e45]/90" strokeWidth={1.5} />
                  <svg viewBox="0 0 24 24" className="absolute -top-0.5 right-0 w-4 h-4 text-[#f5b800]" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" aria-hidden>
                    <path d="M12 3v4M18 6l-2.5 2.5M21 12h-4" />
                  </svg>
                </div>
                <div>
                  <h3 className="text-base font-bold text-slate-900 leading-tight">Bersama Menjaga Taman</h3>
                  <p className="text-sm text-slate-600 leading-snug mt-0.5">Laporkan, Dukung, dan Bantu Kami Merawat Fasilitas Taman.</p>
                </div>
              </div>
              <img src="/assets/LeafButton.svg" alt="" aria-hidden className="pointer-events-none select-none absolute -bottom-6 right-0 w-28 h-auto object-contain opacity-90" />
            </div>
          </section>


          {/* Laporan terbaru */}
          <div>
            <div className="mb-4 flex items-center justify-between">
              <h3 className="text-lg font-bold text-slate-900">Laporan Terbaru</h3>
              <Link
                href={reportHistoryHref}
                className="text-sm font-bold text-[#1b5e45] underline underline-offset-2 hover:text-[#154a36]"
              >
                {session ? "Lihat Laporan Saya" : "Masuk untuk Riwayat Saya"}
              </Link>
            </div>
            {filteredReports.length === 0 ? (
              <div className="rounded-2xl border border-slate-200/80 bg-white p-8 text-center text-sm text-slate-500">
                Belum ada laporan untuk kawasan taman yang dipilih.
              </div>
            ) : (
              <div className="grid grid-cols-2 gap-4 lg:grid-cols-3">
                {filteredReports.slice(0, 6).map((report) => (
                  <ReportItem key={report.id} report={report} variant="desktop" />
                ))}
              </div>
            )}
          </div>
        </div>

        <footer className="relative mt-auto flex items-center justify-between overflow-hidden bg-[#0a1f15] px-8 pt-5 pb-24 text-xs text-white lg:px-12">
          <span className="relative font-bold">GreenDesk</span>
          <span className="relative text-white/60">
            Pelaporan kerusakan fasilitas taman untuk warga dan pengunjung.
          </span>
        </footer>
      </div>

      <BottomNav
        isLoggedIn={Boolean(session)}
        userRole={session?.role ?? null}
      />

      {isGuideOpen && <GuideModal onClose={closeGuide} />}
    </>
  );
}
