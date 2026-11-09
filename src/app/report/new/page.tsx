"use client";

import { useState, useEffect, Suspense } from "react";
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
  Info
} from "lucide-react";
import { MobileContainer } from "@/components/MobileContainer";
import { mockAssets, mockCurrentUser } from "@/data/mock-park-data";

function SubmitTicketContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const assetIdParam = searchParams.get("assetId");

  const asset =
    mockAssets.find(
      (a) =>
        a.code.toLowerCase() === assetIdParam?.toLowerCase() ||
        a.id.toLowerCase() === assetIdParam?.toLowerCase()
    ) || mockAssets[0];

  const user = mockCurrentUser;

  const [damageType, setDamageType] = useState("Rusak Fisik / Patah");
  const [description, setDescription] = useState("");
  const [phone, setPhone] = useState("0812-9876-5432");
  const [email, setEmail] = useState(user.email);
  const [previewPhoto, setPreviewPhoto] = useState<string | null>(asset.photoUrl || null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    try {
      const stored = localStorage.getItem("greendesk_user");
      if (stored) {
        const parsed = JSON.parse(stored);
        if (parsed?.email) {
          setEmail(parsed.email);
        }
        if (parsed?.phone) {
          setPhone(parsed.phone);
        }
      }
    } catch {}
  }, []);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    setTimeout(() => {
      router.push(`/report/success?ticketNo=${encodeURIComponent(asset.code)}&reportId=rep-1`);
    }, 400);
  };

  const handleSimulatePhotoUpload = () => {
    setPreviewPhoto("https://images.unsplash.com/photo-1519331379826-f10be5486c6f?w=600");
  };

  return (
    <main className="p-4 space-y-4 flex-1">
      <section className="card bg-white border border-slate-200 rounded-2xl shadow-sm p-4">
        <div className="flex items-center justify-between mb-2">
          <span className="badge badge-success text-[11px] gap-1 font-semibold">
            <CheckCircle2 className="w-3 h-3" />
            QR / Kode Terverifikasi
          </span>
          <span className="text-[11px] font-semibold text-slate-400 bg-slate-100 px-2 py-0.5 rounded-md">
            10 Laporan Terdaftar
          </span>
        </div>

        <div className="flex items-center gap-3 pt-1">
          <div className="w-12 h-12 rounded-xl bg-[#283330]/10 text-[#283330] flex items-center justify-center shrink-0 border border-[#283330]/20">
            <Armchair className="w-6 h-6" />
          </div>
          <div>
            <h2 className="text-base font-bold text-slate-900 leading-tight">
              {asset.name}
            </h2>
            <p className="text-xs text-slate-500 font-mono mt-0.5">
              ID: {asset.code} • {asset.parkName}, {asset.locationNote}
            </p>
          </div>
        </div>
      </section>

      <section className="alert alert-warning rounded-2xl border border-amber-200 shadow-sm flex items-start gap-3 p-3.5">
        <AlertTriangle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
        <div className="text-xs text-amber-900 leading-relaxed">
          <span className="font-bold block mb-0.5">Perhatian: Laporan Sedang Berjalan</span>
          Aset ini memiliki laporan aktif yang sedang ditindaklanjuti. Laporan Anda akan digabung untuk menambah prioritas teknisi.
        </div>
      </section>

      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="form-control">
          <label className="label">
            <span className="label-text">Foto Bukti Kerusakan</span>
            <span className="text-xs text-slate-400">Wajib (Maks. 3 Foto)</span>
          </label>

          {previewPhoto ? (
            <div className="relative rounded-2xl overflow-hidden border border-slate-200 h-44 bg-slate-100 group">
              <img
                src={previewPhoto}
                alt="Preview Kerusakan"
                className="w-full h-full object-cover"
              />
              <button
                type="button"
                onClick={() => setPreviewPhoto(null)}
                className="absolute top-2 right-2 w-8 h-8 rounded-full bg-slate-900/70 text-white flex items-center justify-center hover:bg-slate-900"
              >
                <X className="w-4 h-4" />
              </button>
              <div className="absolute bottom-2 left-2 px-2.5 py-1 bg-black/60 backdrop-blur-md rounded-lg text-[10px] text-white font-medium flex items-center gap-1.5">
                <CheckCircle2 className="w-3 h-3 text-[#283330]" />
                Foto Siap Diunggah
              </div>
            </div>
          ) : (
            <button
              type="button"
              onClick={handleSimulatePhotoUpload}
              className="border-2 border-dashed border-slate-300 hover:border-[#283330] rounded-2xl p-6 flex flex-col items-center justify-center text-center bg-white transition-colors"
            >
              <div className="w-12 h-12 rounded-full bg-[#283330]/10 text-[#283330] flex items-center justify-center mb-2">
                <Camera className="w-6 h-6" />
              </div>
              <span className="text-xs font-bold text-slate-800">
                Ambil Foto / Pilih dari Galeri
              </span>
              <span className="text-[11px] text-slate-400 mt-0.5">
                Format JPG atau PNG (Maks 5MB)
              </span>
            </button>
          )}
        </div>

        <div className="form-control">
          <label className="label">
            <span className="label-text">Jenis Kerusakan</span>
          </label>
          <select
            value={damageType}
            onChange={(e) => setDamageType(e.target.value)}
            className="select select-bordered w-full font-medium text-slate-800 text-sm"
            required
          >
            <option value="Rusak Fisik / Patah">Rusak Fisik / Patah</option>
            <option value="Baut / Sambungan Lepas">Baut / Sambungan Lepas</option>
            <option value="Cat Mengelupas / Berkarat">Cat Mengelupas / Berkarat</option>
            <option value="Kotor / Vandalisme">Kotor / Vandalisme</option>
            <option value="Kelistrikan / Mati Total">Kelistrikan / Mati Total</option>
            <option value="Lainnya">Lainnya</option>
          </select>
        </div>

        <div className="form-control">
          <label className="label">
            <span className="label-text">Deskripsi Kerusakan</span>
          </label>
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Jelaskan kerusakan secara singkat dan posisi spesifik pada aset..."
            className="textarea textarea-bordered w-full h-24 text-sm"
            required
          />
        </div>

        <div className="space-y-3 pt-1">
          <div className="flex items-center gap-1.5 text-xs font-bold text-slate-700">
            <Info className="w-4 h-4 text-[#283330]" />
            <span>Kontak Pelapor (Otomatis)</span>
          </div>

          <div className="grid grid-cols-1 gap-2.5">
            <div className="form-control">
              <label className="label py-1">
                <span className="text-xs text-slate-500 font-medium">No. Telepon</span>
              </label>
              <input
                type="text"
                value={phone}
                disabled
                readOnly
                className="input input-bordered w-full text-xs font-semibold text-slate-500 bg-slate-100 cursor-not-allowed select-none"
              />
            </div>

            <div className="form-control">
              <label className="label py-1">
                <span className="text-xs text-slate-500 font-medium">Email Pelapor</span>
              </label>
              <input
                type="email"
                value={email}
                disabled
                readOnly
                className="input input-bordered w-full text-xs font-semibold text-slate-500 bg-slate-100 cursor-not-allowed select-none"
              />
            </div>
          </div>
        </div>

        <div className="pt-3">
          <button
            type="submit"
            disabled={isSubmitting}
            className="btn w-full bg-[#283330] hover:bg-[#1e2725] text-white font-bold py-3.5 rounded-2xl shadow-lg shadow-[#283330]/20 flex items-center justify-center gap-2"
          >
            <Send className="w-4 h-4" />
            <span>{isSubmitting ? "Mengirim Laporan..." : "Submit Report"}</span>
          </button>
        </div>
      </form>
    </main>
  );
}

export default function SubmitTicketPage() {
  return (
    <MobileContainer className="bg-[#F6F5F0]">
      <header className="sticky top-0 z-30 flex items-center justify-between p-4 bg-white/90 backdrop-blur-md border-b border-slate-100">
        <Link
          href="/scan"
          className="w-9 h-9 rounded-full bg-slate-100 flex items-center justify-center text-slate-700 hover:bg-slate-200 transition-colors"
        >
          <ChevronLeft className="w-5 h-5" />
        </Link>
        <h1 className="text-base font-bold text-slate-900 tracking-tight">
          Submit Ticket
        </h1>
        <div className="w-9" />
      </header>

      <Suspense fallback={<div className="p-8 text-center text-xs text-slate-400">Memuat form...</div>}>
        <SubmitTicketContent />
      </Suspense>
    </MobileContainer>
  );
}
