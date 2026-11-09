import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "GreenPark – Platform Manajemen Aset Taman",
  description:
    "Platform pelaporan kerusakan dan pemeliharaan fasilitas taman berbasis QR untuk perumahan dan cluster swasta.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="id">
      <body className="min-h-screen bg-[#F6F5F0] text-slate-900 antialiased">
        {children}
      </body>
    </html>
  );
}

