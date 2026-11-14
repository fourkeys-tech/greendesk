import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "GreenDesk – Platform Manajemen Aset Taman",
  description:
    "Platform pelaporan kerusakan dan pemeliharaan fasilitas taman berbasis QR untuk perumahan dan cluster swasta.",
  icons: {
    icon: "/assets/greendesk_favicon.svg",
    shortcut: "/assets/greendesk_favicon.svg",
    apple: "/assets/greendesk_favicon.svg",
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="id" suppressHydrationWarning>
      <body
        className="min-h-screen bg-[#F6F5F0] text-slate-900 antialiased"
        suppressHydrationWarning
      >
        {children}
      </body>
    </html>
  );
}

