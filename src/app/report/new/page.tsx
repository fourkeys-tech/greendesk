
"use client";

import { useState, useEffect, Suspense, type FormEvent } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import {
  ChevronLeft,
  CheckCircle2,
  AlertTriangle,
  Camera,
  X,
  Send,
  Armchair,
  Info,
  ArrowRight,
} from "lucide-react";

import { MobileContainer } from "@/components/MobileContainer";
import { mockAssets, mockCurrentUser } from "@/data/mock-park-data";

/* -------------------------------------------------------------------------- */
/* Constants                                                                  */
/* -------------------------------------------------------------------------- */

type Asset = (typeof mockAssets)[number];

const DAMAGE_TYPES = [
  "Rusak Fisik / Patah",
  "Baut / Sambungan Lepas",
  "Cat Mengelupas / Berkarat",
  "Kotor / Vandalisme",
  "Kelistrikan / Mati Total",
  "Lainnya",
] as const;

const DEFAULT_PHONE = "0812-9876-5432";

const SIMULATED_PHOTO_URL =
  "https://images.unsplash.com/photo-1519331379826-f10be5486c6f?w=600";

const ASSETS = {
  leafButton: "/assets/LeafButton.svg",
} as const;

const FIELD_SURFACE =
  "w-full rounded-xl border-0 bg-white px-4 text-sm text-slate-800 shadow-sm outline-none ring-1 ring-transparent transition focus:ring-[#1b5e45]/40 placeholder:text-slate-400";

/* -------------------------------------------------------------------------- */
/* Form Logic                                                                 */
/* -------------------------------------------------------------------------- */

function findAsset(param: string | null): Asset {
  const key = param?.toLowerCase();

  return (
    mockAssets.find(
      (asset) =>
        asset.code.toLowerCase() === key ||
        asset.id.toLowerCase() === key
    ) || mockAssets[0]
  );
}

function useSubmitTicketForm() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const asset = findAsset(searchParams.get("assetId"));

  const [damageType, setDamageType] = useState<string>(DAMAGE_TYPES[0]);
  const [description, setDescription] = useState("");
  const [phone, setPhone] = useState(DEFAULT_PHONE);
  const [email, setEmail] = useState(mockCurrentUser.email);

  const [previewPhoto, setPreviewPhoto] = useState<string | null>(
    asset.photoUrl || null
  );

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");

  // Load contact information from logged-in user.
  useEffect(() => {
    try {
      const stored = localStorage.getItem("greendesk_user");

      if (!stored) return;

      const parsed = JSON.parse(stored);

      if (parsed?.email) {
        setEmail(parsed.email);
      }

      if (parsed?.phone) {
        setPhone(parsed.phone);
      }
    } catch (error) {
      console.error("Failed to load user information:", error);
    }
  }, []);

  // Submit report.
  const handleSubmit = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();

    if (isSubmitting) return;

    if (!previewPhoto) {
      setErrorMessage("Silakan unggah foto bukti kerusakan terlebih dahulu.");
      return;
    }

    if (!description.trim()) {
      setErrorMessage("Deskripsi kerusakan wajib diisi.");
      return;
    }

    setErrorMessage("");
    setIsSubmitting(true);

    setTimeout(() => {
      router.push(
        `/report/success?ticketNo=${encodeURIComponent(
          asset.code
        )}&reportId=rep-1`
      );
    }, 400);
  };

  // Simulate photo upload.
  const handleSimulatePhotoUpload = () => {
    setPreviewPhoto(SIMULATED_PHOTO_URL);
    setErrorMessage("");
  };

  return {
    asset,
    damageType,
    setDamageType,
    description,
    setDescription,
    phone,
    setPhone,
    email,
    setEmail,
    previewPhoto,
    setPreviewPhoto,
    isSubmitting,
    errorMessage,
    setErrorMessage,
    handleSubmit,
    handleSimulatePhotoUpload,
  };
}

/* -------------------------------------------------------------------------- */
/* Mobile                                                                     */
/* -------------------------------------------------------------------------- */

function SubmitTicketContent() {
  const {
    asset,
    damageType,
    setDamageType,
    description,
    setDescription,
    phone,
    email,
    previewPhoto,
    setPreviewPhoto,
    isSubmitting,
    errorMessage,
    setErrorMessage,
    handleSubmit,
    handleSimulatePhotoUpload,
  } = useSubmitTicketForm();

  return (
    <main className="flex-1 space-y-4 p-4">
      <section className="card rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
        <div className="mb-2 flex items-center justify-between">
          <span className="badge badge-success gap-1 text-[11px] font-semibold">
            <CheckCircle2 className="h-3 w-3" />
            QR / Kode Terverifikasi
          </span>

          <span className="rounded-md bg-slate-100 px-2 py-0.5 text-[11px] font-semibold text-slate-400">
            10 Laporan Terdaftar
          </span>
        </div>

        <div className="flex items-center gap-3 pt-1">
          <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl border border-[#283330]/20 bg-[#283330]/10 text-[#283330]">
            <Armchair className="h-6 w-6" />
          </div>

          <div>
            <h2 className="text-base font-bold leading-tight text-slate-900">
              {asset.name}
            </h2>

            <p className="mt-0.5 font-mono text-xs text-slate-500">
              ID: {asset.code} • {asset.parkName}, {asset.locationNote}
            </p>
          </div>
        </div>
      </section>

      <section className="alert flex items-start gap-3 rounded-2xl border border-amber-200 p-3.5 shadow-sm">
        <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-amber-600" />

        <div className="text-xs leading-relaxed text-amber-900">
          <span className="mb-0.5 block font-bold">
            Perhatian: Laporan Sedang Berjalan
          </span>

          Aset ini memiliki laporan aktif yang sedang ditindaklanjuti.
          Laporan Anda akan digabung untuk menambah prioritas teknisi.
        </div>
      </section>

      <form onSubmit={handleSubmit} className="space-y-4">
        {/* Photo Upload */}

        <div className="form-control">
          <label className="label">
            <span className="label-text">Foto Bukti Kerusakan</span>

            <span className="text-xs text-slate-400">
              Wajib (Maks. 3 Foto)
            </span>
          </label>

          {previewPhoto ? (
            <div className="group relative h-44 overflow-hidden rounded-2xl border border-slate-200 bg-slate-100">
              <img
                src={previewPhoto}
                alt="Preview Kerusakan"
                className="h-full w-full object-cover"
              />

              <button
                type="button"
                onClick={() => {
                  setPreviewPhoto(null);
                  setErrorMessage("");
                }}
                aria-label="Hapus foto"
                className="absolute right-2 top-2 flex h-8 w-8 items-center justify-center rounded-full bg-slate-900/70 text-white hover:bg-slate-900"
              >
                <X className="h-4 w-4" />
              </button>

              <div className="absolute bottom-2 left-2 flex items-center gap-1.5 rounded-lg bg-black/60 px-2.5 py-1 text-[10px] font-medium text-white backdrop-blur-md">
                <CheckCircle2 className="h-3 w-3 text-[#66d36e]" />
                Foto Siap Diunggah
              </div>
            </div>
          ) : (
            <button
              type="button"
              onClick={handleSimulatePhotoUpload}
              className="flex flex-col items-center justify-center rounded-2xl border-2 border-dashed border-slate-300 bg-white p-6 text-center transition-colors hover:border-[#283330]"
            >
              <div className="mb-2 flex h-12 w-12 items-center justify-center rounded-full bg-[#283330]/10 text-[#283330]">
                <Camera className="h-6 w-6" />
              </div>

              <span className="text-xs font-bold text-slate-800">
                Ambil Foto / Pilih dari Galeri
              </span>

              <span className="mt-0.5 text-[11px] text-slate-400">
                Format JPG atau PNG (Maks 5MB)
              </span>
            </button>
          )}
        </div>

        {/* Damage Type */}

        <div className="form-control">
          <label className="label">
            <span className="label-text">Jenis Kerusakan</span>
          </label>

          <select
            value={damageType}
            onChange={(e) => setDamageType(e.target.value)}
            className="select select-bordered w-full text-sm font-medium text-slate-800"
            required
          >
            {DAMAGE_TYPES.map((type) => (
              <option key={type} value={type}>
                {type}
              </option>
            ))}
          </select>
        </div>

        {/* Description */}

        <div className="form-control">
          <label className="label">
            <span className="label-text">Deskripsi Kerusakan</span>
          </label>

          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Jelaskan kerusakan secara singkat dan posisi spesifik pada aset..."
            className="textarea textarea-bordered h-24 w-full text-sm"
            required
          />
        </div>

        {/* Contact Information */}

        <div className="space-y-3 pt-1">
          <div className="flex items-center gap-1.5 text-xs font-bold text-slate-700">
            <Info className="h-4 w-4 text-[#283330]" />
            <span>Kontak Pelapor (Otomatis)</span>
          </div>

          <div className="grid grid-cols-1 gap-2.5">
            <div className="form-control">
              <label className="label py-1">
                <span className="text-xs font-medium text-slate-500">
                  No. Telepon
                </span>
              </label>

              <input
                type="tel"
                value={phone}
                disabled
                readOnly
                className="input input-bordered w-full cursor-not-allowed select-none bg-slate-100 text-xs font-semibold text-slate-500"
              />
            </div>

            <div className="form-control">
              <label className="label py-1">
                <span className="text-xs font-medium text-slate-500">
                  Email Pelapor
                </span>
              </label>

              <input
                type="email"
                value={email}
                disabled
                readOnly
                className="input input-bordered w-full cursor-not-allowed select-none bg-slate-100 text-xs font-semibold text-slate-500"
              />
            </div>
          </div>
        </div>

        {/* Error Message */}

        {errorMessage && (
          <div
            role="alert"
            className="rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-xs font-medium text-red-600"
          >
            {errorMessage}
          </div>
        )}

        {/* Submit */}

        <div className="pt-3">
          <button
            type="submit"
            disabled={isSubmitting}
            className="btn flex w-full items-center justify-center gap-2 rounded-2xl bg-[#283330] py-3.5 font-bold text-white shadow-lg shadow-[#283330]/20 hover:bg-[#1e2725] disabled:cursor-not-allowed disabled:opacity-70"
          >
            <Send className="h-4 w-4" />

            <span>
              {isSubmitting ? "Mengirim Laporan..." : "Submit Report"}
            </span>
          </button>
        </div>
      </form>
    </main>
  );
}

function MobileSubmitTicket() {
  return (
    <MobileContainer className="bg-[#F6F5F0]">
      <header className="sticky top-0 z-30 flex items-center justify-between border-b border-slate-100 bg-white/90 p-4 backdrop-blur-md">
        <Link
          href="/scan"
          aria-label="Kembali"
          className="flex h-9 w-9 items-center justify-center rounded-full bg-slate-100 text-slate-700 transition-colors hover:bg-slate-200"
        >
          <ChevronLeft className="h-5 w-5" />
        </Link>

        <h1 className="text-base font-bold tracking-tight text-slate-900">
          Submit Ticket
        </h1>

        <div className="h-9 w-9" />
      </header>

      <Suspense
        fallback={
          <div className="p-8 text-center text-xs text-slate-400">
            Memuat form...
          </div>
        }
      >
        <SubmitTicketContent />
      </Suspense>
    </MobileContainer>
  );
}

/* -------------------------------------------------------------------------- */
/* Desktop Components                                                         */
/* -------------------------------------------------------------------------- */

function FieldLabel({
  children,
  hint,
}: {
  children: React.ReactNode;
  hint?: string;
}) {
  return (
    <span className="mb-2 block text-sm font-bold text-slate-900">
      {children}

      {hint && (
        <span className="ml-1 font-normal text-slate-500">
          {hint}
        </span>
      )}
    </span>
  );
}

function DesktopAssetCard({ asset }: { asset: Asset }) {
  return (
    <aside className="relative rounded-3xl bg-white p-3 shadow-sm">
      <img
        src={ASSETS.leafButton}
        alt=""
        aria-hidden
        className="pointer-events-none absolute -left-10 -top-6 z-0 w-16 select-none object-contain"
      />

      <div className="relative z-10 flex aspect-[4/4.2] items-center justify-center rounded-2xl bg-[#e6f2e8] text-[#1b5e45]">
        <Armchair className="h-28 w-28" strokeWidth={1.25} />
      </div>

      <div className="relative z-10 flex flex-col items-center px-2 pb-3 pt-4 text-center">
        <span className="inline-flex items-center gap-1 rounded-full bg-[#e6f6ee] px-3 py-1 text-[10px] font-semibold text-[#1b5e45]">
          <CheckCircle2 className="h-3 w-3" />
          QR / Kode Terverifikasi
        </span>

        <h2 className="mt-2 text-sm font-bold text-slate-900">
          {asset.name}
        </h2>

        <p className="mt-0.5 text-[10px] text-slate-400">
          ID: {asset.code} • {asset.parkName}, {asset.locationNote}
        </p>
      </div>
    </aside>
  );
}

function PhotoUploadBar({
  previewPhoto,
  onUpload,
  onRemove,
}: {
  previewPhoto: string | null;
  onUpload: () => void;
  onRemove: () => void;
}) {
  return (
    <div className="mt-2 flex items-center justify-center gap-3 rounded-xl bg-white px-4 py-1.5 text-[11px] shadow-sm">
      {previewPhoto ? (
        <>
          <span className="inline-flex items-center gap-1 font-medium text-[#1b5e45]">
            <CheckCircle2 className="h-3 w-3" />
            Foto siap diunggah
          </span>

          <button
            type="button"
            onClick={onRemove}
            className="text-slate-500 underline hover:text-slate-800"
          >
            Hapus
          </button>
        </>
      ) : (
        <button
          type="button"
          onClick={onUpload}
          className="font-medium text-slate-500 underline hover:text-slate-800"
        >
          Upload Photo
        </button>
      )}
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/* Desktop Form                                                               */
/* -------------------------------------------------------------------------- */

function DesktopSubmitForm() {
  const {
    asset,
    damageType,
    setDamageType,
    description,
    setDescription,
    phone,
    setPhone,
    email,
    setEmail,
    previewPhoto,
    setPreviewPhoto,
    isSubmitting,
    errorMessage,
    handleSubmit,
    handleSimulatePhotoUpload,
  } = useSubmitTicketForm();

  return (
    <div className="grid grid-cols-[minmax(220px,260px)_1fr] items-start gap-6 lg:gap-8">
      <DesktopAssetCard asset={asset} />

      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        {/* Damage Type */}

        <div>
          <label>
            <FieldLabel>Jenis Kerusakan</FieldLabel>

            <select
              value={damageType}
              onChange={(e) => setDamageType(e.target.value)}
              className={`${FIELD_SURFACE} h-11`}
              required
            >
              {DAMAGE_TYPES.map((type) => (
                <option key={type} value={type}>
                  {type}
                </option>
              ))}
            </select>
          </label>

          <PhotoUploadBar
            previewPhoto={previewPhoto}
            onUpload={handleSimulatePhotoUpload}
            onRemove={() => setPreviewPhoto(null)}
          />

          {!previewPhoto && (
            <p className="mt-1 text-[10px] text-slate-400">
              Foto bukti kerusakan wajib diunggah.
            </p>
          )}
        </div>

        {/* Description */}

        <label>
          <FieldLabel>Deskripsi Kerusakan</FieldLabel>

          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Jelaskan kerusakan secara singkat..."
            className={`${FIELD_SURFACE} h-36 resize-none py-3`}
            required
          />
        </label>

        {/* Email */}

        <label>
          <FieldLabel hint="(opsional)">Email</FieldLabel>

          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="Email Address"
            className={`${FIELD_SURFACE} h-11`}
          />
        </label>

        {/* Phone */}

        <label>
          <FieldLabel hint="(opsional)">Kontak Pelapor</FieldLabel>

          <input
            type="tel"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            placeholder="08xx xxxx xxxx"
            className={`${FIELD_SURFACE} h-11`}
          />
        </label>

        {/* Error Message */}

        {errorMessage && (
          <div
            role="alert"
            className="rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-xs font-medium text-red-600"
          >
            {errorMessage}
          </div>
        )}

        {/* Submit */}

        <button
          type="submit"
          disabled={isSubmitting}
          className="mt-1 flex h-11 w-full items-center justify-center gap-3 rounded-full bg-[#66d36e] text-sm font-bold text-white shadow-sm transition hover:bg-[#58c261] active:scale-[0.99] disabled:cursor-not-allowed disabled:opacity-70"
        >
          <span>
            {isSubmitting ? "Mengirim Laporan..." : "Submit Report"}
          </span>

          {!isSubmitting && <ArrowRight className="h-5 w-5" />}
        </button>
      </form>
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/* Desktop Header                                                             */
/* -------------------------------------------------------------------------- */

function DesktopHeader() {
  return (
    <header className="relative flex items-center justify-center py-2">
      <Link
        href="/scan"
        aria-label="Kembali"
        className="absolute left-0 flex h-9 w-9 items-center justify-center rounded-full bg-white text-slate-800 shadow-sm transition-colors hover:bg-slate-50"
      >
        <ChevronLeft className="h-5 w-5" />
      </Link>

      <h1 className="text-3xl font-bold tracking-tight text-slate-900">
        Submit Ticket
      </h1>
    </header>
  );
}

/* -------------------------------------------------------------------------- */
/* Desktop Footer                                                             */
/* -------------------------------------------------------------------------- */

function DesktopFooter() {
  return (
    <footer className="flex items-center justify-between bg-[#0a1f15] px-8 py-4 text-xs text-white lg:px-12">
      <span className="font-bold">GreenDesk</span>

      <span className="text-white/60">
        Pelaporan kerusakan fasilitas taman untuk warga dan pengunjung.
      </span>
    </footer>
  );
}

/* -------------------------------------------------------------------------- */
/* Desktop Page                                                               */
/* -------------------------------------------------------------------------- */

function DesktopSubmitTicket() {
  return (
    <div className="hidden min-h-screen flex-col bg-[#F6F5F0] md:flex">
      <main className="mx-auto flex w-full max-w-4xl flex-1 flex-col gap-6 px-6 pb-12 pt-8">
        <DesktopHeader />

        <Suspense
          fallback={
            <div className="p-8 text-center text-sm text-slate-400">
              Memuat form...
            </div>
          }
        >
          <DesktopSubmitForm />
        </Suspense>
      </main>

      <DesktopFooter />
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/* Page                                                                       */
/* -------------------------------------------------------------------------- */

export default function SubmitTicketPage() {
  return (
    <>
      <MobileSubmitTicket />
      <DesktopSubmitTicket />
    </>
  );
}
