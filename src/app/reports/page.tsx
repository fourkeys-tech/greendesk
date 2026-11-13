import { redirect } from "next/navigation";

/**
 * /reports → /beranda/laporan
 * Halaman ini di-redirect ke halaman daftar laporan warga yang baru.
 */
export default function ReportsPage() {
  redirect("/beranda/laporan");
}
