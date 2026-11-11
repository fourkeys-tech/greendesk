"use client";

import { useState, useEffect, useRef, type ReactNode } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ChevronLeft,
  ChevronUp,
  ChevronDown,
  FileText,
  Home,
  LogOut,
  QrCode,
  User as UserIcon,
  Pencil,
  X,
  Camera,
  Image as ImageIcon
} from "lucide-react";
import { MobileContainer } from "@/components/MobileContainer";
import { mockCurrentUser } from "@/data/mock-park-data";

function AccordionCard({
  title,
  defaultOpen = true,
  children,
}: {
  title: string;
  defaultOpen?: boolean;
  children: ReactNode;
}) {
  const [open, setOpen] = useState(defaultOpen);

  return (
    <section className="rounded-2xl bg-white border border-slate-300/70 px-4 py-3">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        className="w-full flex items-center justify-between"
      >
        <span className="flex items-center gap-2.5">
          <UserIcon className="w-5 h-5 text-slate-900" strokeWidth={2} />
          <span className="text-[16px] font-semibold text-slate-900">{title}</span>
        </span>
        {open ? (
          <ChevronUp className="w-5 h-5 text-slate-900" />
        ) : (
          <ChevronDown className="w-5 h-5 text-slate-900" />
        )}
      </button>
      {open && <div className="mt-3 text-[12px] text-slate-900 leading-snug">{children}</div>}
    </section>
  );
}

export default function ProfilePage() {
  const router = useRouter();
  const cameraInputRef = useRef<HTMLInputElement>(null);
  const galleryInputRef = useRef<HTMLInputElement>(null);

  const [user, setUser] = useState({
    id: mockCurrentUser.id,
    name: mockCurrentUser.name,
    email: mockCurrentUser.email,
    phone: "0812-9876-5432",
    cluster: "Cluster Taman Eden",
    avatarUrl: mockCurrentUser.avatarUrl,
  });

  const [isPhotoModalOpen, setIsPhotoModalOpen] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [editEmail, setEditEmail] = useState("");
  const [editPhone, setEditPhone] = useState("");
  const [editPassword, setEditPassword] = useState("");

  useEffect(() => {
    try {
      const stored = localStorage.getItem("greendesk_user");
      if (stored) {
        const parsed = JSON.parse(stored);
        if (parsed && parsed.email) {
          setUser(parsed);
        }
      }
    } catch { }
  }, []);

  const handleLogout = () => {
    try {
      localStorage.removeItem("greendesk_user");
    } catch { }
    router.push("/login");
  };

  const handlePhotoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        const newAvatar = reader.result as string;
        const updated = { ...user, avatarUrl: newAvatar };
        setUser(updated);
        try {
          localStorage.setItem("greendesk_user", JSON.stringify(updated));
        } catch { }
      };
      reader.readAsDataURL(file);
    }
    setIsPhotoModalOpen(false);
    e.target.value = "";
  };

  const openEditModal = () => {
    setEditEmail(user.email);
    setEditPhone(user.phone);
    setEditPassword("");
    setIsEditModalOpen(true);
  };

  const handleSaveAccountData = (e: React.FormEvent) => {
    e.preventDefault();
    const updated = {
      ...user,
      email: editEmail.trim() || user.email,
      phone: editPhone.trim() || user.phone,
    };
    setUser(updated);
    try {
      localStorage.setItem("greendesk_user", JSON.stringify(updated));
    } catch { }
    setIsEditModalOpen(false);
  };

  return (
    <>
      {/* ===== MOBILE (unchanged) ===== */}
      <MobileContainer className="bg-[#F6F5F0] relative overflow-hidden">
        <img
          src="/images/maskgroup.png"
          alt=""
          aria-hidden
          className="absolute bottom-0 right-0 w-40 h-40 object-contain opacity-40 -scale-x-100 pointer-events-none select-none"
        />

        <div className="relative z-10 flex flex-col flex-1 min-h-0">
          <header className="flex items-center gap-4 px-4 pt-6 pb-4">
            <Link
              href="/beranda"
              aria-label="Kembali"
              className="w-10 h-10 shrink-0 rounded-full bg-white flex items-center justify-center text-slate-800 shadow-sm"
            >
              <ChevronLeft className="w-6 h-6" />
            </Link>
            <h1 className="flex-1 text-center pr-10 text-[28px] font-bold text-slate-900 tracking-tight leading-none">
              Profile
            </h1>
          </header>

          <main className="flex-1 overflow-y-auto px-4 pb-32 space-y-3">
            <section className="rounded-2xl bg-white border border-slate-300/70 px-4 py-4 flex items-center gap-4">
              <div className="relative w-[60px] h-[60px] shrink-0">
                <div className="w-full h-full rounded-full overflow-hidden bg-slate-200 flex items-center justify-center">
                  {user.avatarUrl ? (
                    <img
                      src={user.avatarUrl}
                      alt={user.name}
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <UserIcon className="w-7 h-7 text-slate-500" strokeWidth={1.75} />
                  )}
                </div>
                <button
                  type="button"
                  onClick={() => setIsPhotoModalOpen(true)}
                  aria-label="Ubah Foto Profil"
                  className="absolute -bottom-1 -right-1 w-6 h-6 rounded-full bg-[#1b5e45] text-white flex items-center justify-center shadow-md hover:bg-[#154a36] transition-transform active:scale-95"
                >
                  <Pencil className="w-3 h-3" />
                </button>
              </div>
              <div className="min-w-0">
                <h2 className="text-[16px] font-bold text-slate-900 leading-tight truncate">
                  {user.name}
                </h2>
                <p className="text-[14px] text-slate-700 leading-tight mt-0.5 truncate">
                  {user.email}
                </p>
              </div>
            </section>

            <section className="rounded-2xl bg-white border border-slate-300/70 px-4 py-4">
              <div className="flex items-center gap-2.5 mb-3">
                <UserIcon className="w-5 h-5 text-slate-900" strokeWidth={2} />
                <h3 className="text-[16px] font-semibold text-slate-900">Pengaturan Akun</h3>
              </div>
              <div className="text-[12px] text-slate-900 leading-snug">
                <p>
                  <span className="font-bold">Nomor HP :</span> {user.phone}
                </p>
                <p className="mt-1">
                  <span className="font-bold">Email :</span> {user.email}
                </p>
                <button
                  type="button"
                  onClick={openEditModal}
                  className="mt-3 w-full h-11 rounded-xl border border-[#1b5e45] text-[#1b5e45] text-[14px] font-semibold flex items-center justify-center hover:bg-[#1b5e45]/5 transition-colors"
                >
                  Ubah Data Akun
                </button>
              </div>
            </section>

            <AccordionCard title="Panduan / Cara Laporan">
              <div className="space-y-2 text-[12px] text-slate-700 leading-relaxed">
                <div className="flex items-start gap-2.5 p-2 rounded-xl bg-[#F6F5F0]">
                  <div className="w-5 h-5 rounded-full bg-[#1b5e45] text-white flex items-center justify-center text-[10px] font-bold shrink-0 mt-0.5">
                    1
                  </div>
                  <div>
                    <h4 className="font-bold text-slate-900 text-[11px]">Temukan Fasilitas Rusak</h4>
                    <p className="text-[11px] text-slate-600 mt-0.5">
                      Cari kode atau stiker QR Code yang tertera pada fasilitas taman yang membutuhkan perbaikan.
                    </p>
                  </div>
                </div>

                <div className="flex items-start gap-2.5 p-2 rounded-xl bg-[#F6F5F0]">
                  <div className="w-5 h-5 rounded-full bg-[#1b5e45] text-white flex items-center justify-center text-[10px] font-bold shrink-0 mt-0.5">
                    2
                  </div>
                  <div>
                    <h4 className="font-bold text-slate-900 text-[11px]">Pindai (Scan) QR Code</h4>
                    <p className="text-[11px] text-slate-600 mt-0.5">
                      Buka menu Scan QR Code di aplikasi, lalu arahkan kamera ke kode QR aset tersebut.
                    </p>
                  </div>
                </div>

                <div className="flex items-start gap-2.5 p-2 rounded-xl bg-[#F6F5F0]">
                  <div className="w-5 h-5 rounded-full bg-[#1b5e45] text-white flex items-center justify-center text-[10px] font-bold shrink-0 mt-0.5">
                    3
                  </div>
                  <div>
                    <h4 className="font-bold text-slate-900 text-[11px]">Isi Formulir Laporan</h4>
                    <p className="text-[11px] text-slate-600 mt-0.5">
                      Unggah foto bukti kerusakan, pilih jenis kerusakan, dan sertakan deskripsi singkat posisi atau detail kerusakan.
                    </p>
                  </div>
                </div>

                <div className="flex items-start gap-2.5 p-2 rounded-xl bg-[#F6F5F0]">
                  <div className="w-5 h-5 rounded-full bg-[#1b5e45] text-white flex items-center justify-center text-[10px] font-bold shrink-0 mt-0.5">
                    4
                  </div>
                  <div>
                    <h4 className="font-bold text-slate-900 text-[11px]">Kirim & Pantau Progres</h4>
                    <p className="text-[11px] text-slate-600 mt-0.5">
                      Kirim laporan Anda. Anda dapat memantau status pengerjaan oleh teknisi hingga selesai di halaman riwayat laporan.
                    </p>
                  </div>
                </div>
              </div>
            </AccordionCard>

            <AccordionCard title="Kebijakan Privasi">
              <p>
                Nama dan kontak Anda hanya dilihat pengelola dan manager. Teknisi
                tidak dapat melihatnya. Data laporan digunakan hanya untuk
                keperluan perbaikan fasilitas taman.
              </p>
            </AccordionCard>

            <button
              type="button"
              onClick={handleLogout}
              className="w-full h-11 rounded-2xl border border-rose-200 bg-white text-rose-600 hover:bg-rose-50 flex items-center justify-center gap-2 text-[13px] font-bold transition-colors"
            >
              <LogOut className="w-4 h-4" />
              <span>Keluar Sesi</span>
            </button>
          </main>

          <nav className="md:hidden fixed bottom-0 inset-x-0 max-w-md mx-auto z-20 h-[72px] bg-white rounded-t-3xl shadow-[0_-4px_16px_rgba(0,0,0,0.08)] flex items-center justify-between px-16">
            <Link
              href="/beranda"
              className="flex flex-col items-center gap-1 text-slate-900 translate-x-1"
            >
              <Home className="w-6 h-6" strokeWidth={1.75} />
              <span className="text-[10px] font-bold">Home</span>
            </Link>

            <Link
              href="/beranda"
              aria-label="Scan QR"
              className="absolute left-1/2 -top-7 -translate-x-1/2 w-[72px] h-[72px] rounded-full bg-[#283330] border-4 border-white shadow-lg flex items-center justify-center text-white transition-transform active:scale-95"
            >
              <QrCode className="w-8 h-8" strokeWidth={1.75} />
            </Link>

            <Link
              href="/reports"
              className="flex flex-col items-center gap-1 text-slate-900 -translate-x-1"
            >
              <FileText className="w-6 h-6" strokeWidth={1.75} />
              <span className="text-[10px] font-bold">My Reports</span>
            </Link>
          </nav>
        </div>

        <input
          ref={cameraInputRef}
          type="file"
          accept="image/*"
          capture="environment"
          onChange={handlePhotoChange}
          className="hidden"
        />
        <input
          ref={galleryInputRef}
          type="file"
          accept="image/*"
          onChange={handlePhotoChange}
          className="hidden"
        />

        {isPhotoModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm">
            <div className="w-full max-w-sm rounded-2xl bg-white p-5 shadow-2xl animate-in fade-in zoom-in-95 duration-150">
              <div className="flex items-center justify-between pb-3 border-b border-slate-100">
                <h3 className="text-[16px] font-bold text-slate-900">Ubah Foto Profil</h3>
                <button
                  type="button"
                  onClick={() => setIsPhotoModalOpen(false)}
                  className="w-7 h-7 rounded-full bg-slate-100 flex items-center justify-center text-slate-500 hover:bg-slate-200"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <div className="mt-4 space-y-2.5">
                <button
                  type="button"
                  onClick={() => cameraInputRef.current?.click()}
                  className="w-full h-12 rounded-xl bg-[#1b5e45] text-white text-[14px] font-semibold flex items-center justify-center gap-2.5 hover:bg-[#154a36] shadow-md transition-colors"
                >
                  <Camera className="w-5 h-5" />
                  <span>Ambil dari Kamera</span>
                </button>

                <button
                  type="button"
                  onClick={() => galleryInputRef.current?.click()}
                  className="w-full h-12 rounded-xl border border-slate-300 bg-white text-slate-800 text-[14px] font-semibold flex items-center justify-center gap-2.5 hover:bg-slate-50 transition-colors"
                >
                  <ImageIcon className="w-5 h-5 text-[#1b5e45]" />
                  <span>Pilih dari Galeri</span>
                </button>

                <button
                  type="button"
                  onClick={() => setIsPhotoModalOpen(false)}
                  className="w-full h-10 mt-1 rounded-xl text-slate-500 text-[13px] font-medium hover:bg-slate-100 transition-colors"
                >
                  Batal
                </button>
              </div>
            </div>
          </div>
        )}

        {isEditModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm">
            <div className="w-full max-w-sm rounded-2xl bg-white p-5 shadow-2xl animate-in fade-in zoom-in-95 duration-150">
              <div className="flex items-center justify-between pb-3 border-b border-slate-100">
                <h3 className="text-[16px] font-bold text-slate-900">Ubah Data Akun</h3>
                <button
                  type="button"
                  onClick={() => setIsEditModalOpen(false)}
                  className="w-7 h-7 rounded-full bg-slate-100 flex items-center justify-center text-slate-500 hover:bg-slate-200"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <form onSubmit={handleSaveAccountData} className="mt-4 space-y-3">
                <div className="form-control">
                  <label className="label py-0.5">
                    <span className="text-[12px] font-semibold text-slate-700">Gmail Baru</span>
                  </label>
                  <input
                    type="email"
                    value={editEmail}
                    onChange={(e) => setEditEmail(e.target.value)}
                    placeholder="nama@gmail.com"
                    className="input input-bordered w-full h-10 text-[13px] text-slate-800"
                    required
                  />
                </div>

                <div className="form-control">
                  <label className="label py-0.5">
                    <span className="text-[12px] font-semibold text-slate-700">No. Telepon Baru</span>
                  </label>
                  <input
                    type="tel"
                    value={editPhone}
                    onChange={(e) => setEditPhone(e.target.value)}
                    placeholder="0812-xxxx-xxxx"
                    className="input input-bordered w-full h-10 text-[13px] text-slate-800"
                    required
                  />
                </div>

                <div className="form-control">
                  <label className="label py-0.5">
                    <span className="text-[12px] font-semibold text-slate-700">Password Baru</span>
                  </label>
                  <input
                    type="password"
                    value={editPassword}
                    onChange={(e) => setEditPassword(e.target.value)}
                    placeholder="••••••••"
                    className="input input-bordered w-full h-10 text-[13px] text-slate-800"
                    required
                  />
                </div>

                <div className="pt-2 flex gap-2">
                  <button
                    type="button"
                    onClick={() => setIsEditModalOpen(false)}
                    className="flex-1 h-10 rounded-xl border border-slate-200 text-slate-600 text-[13px] font-semibold hover:bg-slate-100 transition-colors"
                  >
                    Batal
                  </button>
                  <button
                    type="submit"
                    className="flex-1 h-10 rounded-xl bg-[#1b5e45] text-white text-[13px] font-semibold hover:bg-[#154a36] shadow-md transition-colors"
                  >
                    Simpan
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}
      </MobileContainer>

      {/* ===== DESKTOP / TABLET ===== */}
      <div className="hidden md:flex flex-col min-h-screen bg-[#F6F5F0] pb-28">
        <img src="/assets/BackgroundLeaf.svg" alt="" aria-hidden className="pointer-events-none select-none absolute bottom-0 right-0 w-64 h-auto object-contain opacity-20 -scale-x-100" />

        <div className="relative z-10 max-w-screen-xl mx-auto w-full px-6 lg:px-12 xl:px-16 pt-10 flex flex-col gap-5">
          <header className="relative flex items-center justify-center pb-2">
            <Link
              href="/beranda"
              aria-label="Kembali ke Beranda"
              className="absolute left-0 flex h-11 w-11 items-center justify-center rounded-full border border-slate-200 bg-white text-slate-800 shadow-sm transition-all hover:bg-slate-50 hover:scale-105 active:scale-95"
            >
              <ChevronLeft className="w-6 h-6" />
            </Link>

            <img
              src="/assets/GreenDesk.svg"
              alt="GreenDesk Logo"
              className="h-9 w-auto object-contain"
            />
          </header>

          {/* Profile card */}
          <section className="rounded-2xl bg-white border border-slate-300/70 px-6 py-5 flex items-center gap-5 shadow-sm">
            <div className="relative w-[72px] h-[72px] shrink-0">
              <div className="w-full h-full rounded-full overflow-hidden bg-slate-200 flex items-center justify-center">
                {user.avatarUrl ? (
                  <img src={user.avatarUrl} alt={user.name} className="w-full h-full object-cover" />
                ) : (
                  <UserIcon className="w-9 h-9 text-slate-500" strokeWidth={1.75} />
                )}
              </div>
              <button type="button" onClick={() => setIsPhotoModalOpen(true)} aria-label="Ubah Foto Profil" className="absolute -bottom-1 -right-1 w-7 h-7 rounded-full bg-[#1b5e45] text-white flex items-center justify-center shadow-md hover:bg-[#154a36] transition-transform active:scale-95">
                <Pencil className="w-3.5 h-3.5" />
              </button>
            </div>
            <div className="min-w-0">
              <h2 className="text-xl font-bold text-slate-900 leading-tight">{user.name}</h2>
              <p className="text-sm text-slate-700 leading-tight mt-1 truncate">{user.email}</p>
            </div>
          </section>

          {/* Account settings */}

          <section className="rounded-2xl bg-white border border-slate-200 px-7 py-6 shadow-sm">
            <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-6">

              {/* Header */}
              <div className="flex items-center gap-3 lg:min-w-[220px]">
                <div className="w-11 h-11 rounded-xl bg-[#1b5e45]/10 flex items-center justify-center">
                  <UserIcon
                    className="w-5 h-5 text-[#1b5e45]"
                    strokeWidth={2}
                  />
                </div>
                <div>
                  <h3 className="text-lg font-bold text-slate-900">
                    Pengaturan Akun
                  </h3>
                  <p className="text-xs text-slate-500 mt-0.5">
                    Kelola informasi akun Anda
                  </p>
                </div>
              </div>

              {/* Account Information */}
              <div className="flex-1 grid grid-cols-1 lg:grid-cols-2 gap-4">
                <div className="rounded-xl bg-[#F6F5F0] px-4 py-3">
                  <p className="text-xs font-medium text-slate-500 mb-1">
                    Nomor Telepon
                  </p>
                  <p className="text-sm font-semibold text-slate-900">
                    {user.phone}
                  </p>
                </div>

                <div className="rounded-xl bg-[#F6F5F0] px-4 py-3">
                  <p className="text-xs font-medium text-slate-500 mb-1">
                    Email
                  </p>
                  <p className="text-sm font-semibold text-slate-900 truncate">
                    {user.email}
                  </p>
                </div>
              </div>

              {/* Edit Button */}
              <button
                type="button"
                onClick={openEditModal}
                className="w-full lg:w-auto lg:min-w-[170px] h-11 px-6 rounded-xl border border-[#1b5e45] bg-white text-[#1b5e45] text-sm font-semibold flex items-center justify-center gap-2 hover:bg-[#1b5e45]/5 transition-colors"
              >
                <Pencil className="w-4 h-4" />
                Ubah Data Akun
              </button>

            </div>
          </section>


          {/* Guide accordion */}
          <AccordionCard title="Panduan / Cara Laporan">
            <div className="space-y-3 text-sm text-slate-700 leading-relaxed">
              <div className="flex items-start gap-3 p-3 rounded-xl bg-[#F6F5F0]">
                <div className="w-6 h-6 rounded-full bg-[#1b5e45] text-white flex items-center justify-center text-xs font-bold shrink-0 mt-0.5">1</div>
                <div><h4 className="font-bold text-slate-900 text-sm">Temukan Fasilitas Rusak</h4><p className="text-xs text-slate-600 mt-0.5">Cari kode atau stiker QR Code yang tertera pada fasilitas taman yang membutuhkan perbaikan.</p></div>
              </div>
              <div className="flex items-start gap-3 p-3 rounded-xl bg-[#F6F5F0]">
                <div className="w-6 h-6 rounded-full bg-[#1b5e45] text-white flex items-center justify-center text-xs font-bold shrink-0 mt-0.5">2</div>
                <div><h4 className="font-bold text-slate-900 text-sm">Pindai (Scan) QR Code</h4><p className="text-xs text-slate-600 mt-0.5">Buka menu Scan QR Code di aplikasi, lalu arahkan kamera ke kode QR aset tersebut.</p></div>
              </div>
              <div className="flex items-start gap-3 p-3 rounded-xl bg-[#F6F5F0]">
                <div className="w-6 h-6 rounded-full bg-[#1b5e45] text-white flex items-center justify-center text-xs font-bold shrink-0 mt-0.5">3</div>
                <div><h4 className="font-bold text-slate-900 text-sm">Isi Formulir Laporan</h4><p className="text-xs text-slate-600 mt-0.5">Unggah foto bukti kerusakan, pilih jenis kerusakan, dan sertakan deskripsi singkat posisi atau detail kerusakan.</p></div>
              </div>
              <div className="flex items-start gap-3 p-3 rounded-xl bg-[#F6F5F0]">
                <div className="w-6 h-6 rounded-full bg-[#1b5e45] text-white flex items-center justify-center text-xs font-bold shrink-0 mt-0.5">4</div>
                <div><h4 className="font-bold text-slate-900 text-sm">Kirim & Pantau Progres</h4><p className="text-xs text-slate-600 mt-0.5">Kirim laporan Anda. Anda dapat memantau status pengerjaan oleh teknisi hingga selesai di halaman riwayat laporan.</p></div>
              </div>
            </div>
          </AccordionCard>

          <AccordionCard title="Kebijakan Privasi">
            <p className="text-sm">Nama dan kontak Anda hanya dilihat pengelola dan manager. Teknisi tidak dapat melihatnya. Data laporan digunakan hanya untuk keperluan perbaikan fasilitas taman.</p>
          </AccordionCard>

          <button type="button" onClick={handleLogout} className="w-full max-w-xs h-12 rounded-2xl border border-rose-200 bg-white text-rose-600 hover:bg-rose-50 flex items-center justify-center gap-2 text-sm font-bold transition-colors mx-auto">
            <LogOut className="w-4 h-4" />
            <span>Keluar Sesi</span>
          </button>
        </div>


        {/* Modals (shared) */}
        <input ref={cameraInputRef} type="file" accept="image/*" capture="environment" onChange={handlePhotoChange} className="hidden" />
        <input ref={galleryInputRef} type="file" accept="image/*" onChange={handlePhotoChange} className="hidden" />

        {isPhotoModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm">
            <div className="w-full max-w-sm rounded-2xl bg-white p-5 shadow-2xl animate-in fade-in zoom-in-95 duration-150">
              <div className="flex items-center justify-between pb-3 border-b border-slate-100">
                <h3 className="text-lg font-bold text-slate-900">Ubah Foto Profil</h3>
                <button type="button" onClick={() => setIsPhotoModalOpen(false)} className="w-8 h-8 rounded-full bg-slate-100 flex items-center justify-center text-slate-500 hover:bg-slate-200">
                  <X className="w-4 h-4" />
                </button>
              </div>
              <div className="mt-4 space-y-2.5">
                <button type="button" onClick={() => cameraInputRef.current?.click()} className="w-full h-12 rounded-xl bg-[#1b5e45] text-white text-sm font-semibold flex items-center justify-center gap-2.5 hover:bg-[#154a36] shadow-md transition-colors">
                  <Camera className="w-5 h-5" /><span>Ambil dari Kamera</span>
                </button>
                <button type="button" onClick={() => galleryInputRef.current?.click()} className="w-full h-12 rounded-xl border border-slate-300 bg-white text-slate-800 text-sm font-semibold flex items-center justify-center gap-2.5 hover:bg-slate-50 transition-colors">
                  <ImageIcon className="w-5 h-5 text-[#1b5e45]" /><span>Pilih dari Galeri</span>
                </button>
                <button type="button" onClick={() => setIsPhotoModalOpen(false)} className="w-full h-10 mt-1 rounded-xl text-slate-500 text-sm font-medium hover:bg-slate-100 transition-colors">Batal</button>
              </div>
            </div>
          </div>
        )}

        {isEditModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm">
            <div className="w-full max-w-sm rounded-2xl bg-white p-5 shadow-2xl animate-in fade-in zoom-in-95 duration-150">
              <div className="flex items-center justify-between pb-3 border-b border-slate-100">
                <h3 className="text-lg font-bold text-slate-900">Ubah Data Akun</h3>
                <button type="button" onClick={() => setIsEditModalOpen(false)} className="w-8 h-8 rounded-full bg-slate-100 flex items-center justify-center text-slate-500 hover:bg-slate-200">
                  <X className="w-4 h-4" />
                </button>
              </div>
              <form onSubmit={handleSaveAccountData} className="mt-4 space-y-3">
                <div className="form-control">
                  <label className="label py-0.5"><span className="text-sm font-semibold text-slate-700">Gmail Baru</span></label>
                  <input type="email" value={editEmail} onChange={(e) => setEditEmail(e.target.value)} placeholder="nama@gmail.com" className="input input-bordered w-full h-10 text-sm text-slate-800" required />
                </div>
                <div className="form-control">
                  <label className="label py-0.5"><span className="text-sm font-semibold text-slate-700">No. Telepon Baru</span></label>
                  <input type="tel" value={editPhone} onChange={(e) => setEditPhone(e.target.value)} placeholder="0812-xxxx-xxxx" className="input input-bordered w-full h-10 text-sm text-slate-800" required />
                </div>
                <div className="form-control">
                  <label className="label py-0.5"><span className="text-sm font-semibold text-slate-700">Password Baru</span></label>
                  <input type="password" value={editPassword} onChange={(e) => setEditPassword(e.target.value)} placeholder="••••••••" className="input input-bordered w-full h-10 text-sm text-slate-800" required />
                </div>
                <div className="pt-2 flex gap-2">
                  <button type="button" onClick={() => setIsEditModalOpen(false)} className="flex-1 h-10 rounded-xl border border-slate-200 text-slate-600 text-sm font-semibold hover:bg-slate-100 transition-colors">Batal</button>
                  <button type="submit" className="flex-1 h-10 rounded-xl bg-[#1b5e45] text-white text-sm font-semibold hover:bg-[#154a36] shadow-md transition-colors">Simpan</button>
                </div>
              </form>
            </div>
          </div>
        )}
      </div>
      <footer className="relative mt-auto flex items-center justify-between overflow-hidden bg-[#0a1f15] px-8 py-4 text-xs text-white lg:px-12">
        <span className="relative font-bold">GreenDesk</span>
        <span className="relative text-white/60">
          Pelaporan kerusakan fasilitas taman untuk warga dan pengunjung.
        </span>
      </footer>
    </>
  );
}
