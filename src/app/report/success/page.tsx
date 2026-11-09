"use client";

import { Suspense } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Check, Home, FileText } from "lucide-react";
import { MobileContainer } from "@/components/MobileContainer";

function SuccessContent() {
  const searchParams = useSearchParams();
  const ticketNumber = searchParams.get("ticketNo") || "TK-0824-91";
  const reportId = searchParams.get("reportId") || "rep-1";

  return (
    <div className="flex-1 flex flex-col justify-between py-6">
      <div className="flex flex-col items-center justify-center text-center my-auto py-8">
        <div className="w-24 h-24 rounded-full bg-[#283330] text-white flex items-center justify-center shadow-2xl shadow-[#283330]/30 mb-6 animate-in zoom-in-75 duration-300">
          <Check className="w-14 h-14 stroke-[3]" />
        </div>

        <h1 className="text-2xl font-extrabold text-slate-900 tracking-tight">
          Laporan Berhasil!
        </h1>
        <p className="text-xs text-slate-500 max-w-xs mt-2 leading-relaxed">
          Terimakasih telah membantu menjaga fasilitas taman. Petugas kami akan segera meninjau dan menindaklanjuti.
        </p>

        <div className="w-full max-w-xs bg-slate-50 border border-slate-200/80 rounded-2xl p-4 mt-8 flex flex-col items-center shadow-inner">
          <span className="text-[11px] font-bold text-slate-400 uppercase tracking-widest">
            Nomor Tiket
          </span>
          <span className="text-xl font-black text-slate-800 font-mono tracking-wider mt-1">
            {ticketNumber}
          </span>
          <span className="text-[10px] text-[#283330] bg-[#283330]/10 font-semibold px-2.5 py-0.5 rounded-full mt-2 border border-[#283330]/20">
            Status: Menunggu Keputusan
          </span>
        </div>
      </div>

      <div className="space-y-3 pt-4 w-full">
        <Link
          href="/beranda"
          className="btn w-full bg-[#283330] hover:bg-[#1e2725] text-white font-bold py-3.5 rounded-2xl shadow-lg shadow-[#283330]/20 flex items-center justify-center gap-2"
        >
          <Home className="w-4 h-4 text-white" />
          <span>Kembali ke Beranda</span>
        </Link>

        <Link
          href={`/reports/${reportId}`}
          className="btn btn-outline w-full py-3.5 border-slate-200 hover:bg-[#283330]/10 text-slate-700 font-semibold rounded-2xl flex items-center justify-center gap-2 text-xs"
        >
          <FileText className="w-4 h-4 text-slate-500" />
          <span>Lihat Detail Laporan</span>
        </Link>
      </div>
    </div>
  );
}

export default function ReportSuccessPage() {
  return (
    <MobileContainer className="bg-[#F6F5F0] p-6">
      <Suspense fallback={<div className="p-8 text-center text-xs text-slate-400">Memuat hasil...</div>}>
        <SuccessContent />
      </Suspense>
    </MobileContainer>
  );
}
