import { NextResponse } from "next/server";
import { getCurrentSession } from "@/lib/auth";
import { getAuthorizedSpkFile } from "@/lib/services/spk-file";
import { buildContentDisposition, resolvePrivateDownload } from "@/lib/storage";

const NO_STORE = { "Cache-Control": "private, no-store" };

/** Unduh berkas SPK: cek sesi + cakupan role, lalu arahkan ke presigned URL berumur pendek. */
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getCurrentSession();
  if (!session) {
    return NextResponse.json({ error: "Silakan login terlebih dahulu." }, { status: 401, headers: NO_STORE });
  }

  const { id } = await params;
  try {
    const file = await getAuthorizedSpkFile(session, id);
    if (!file) {
      return NextResponse.json({ error: "Berkas SPK tidak ditemukan." }, { status: 404, headers: NO_STORE });
    }

    const download = await resolvePrivateDownload(file.key, file.fileName, file.mimeType);
    if (download.kind === "redirect") {
      return NextResponse.redirect(download.url, { status: 302, headers: NO_STORE });
    }

    return new NextResponse(new Uint8Array(download.body), {
      status: 200,
      headers: {
        ...NO_STORE,
        "Content-Type": file.mimeType,
        "Content-Disposition": buildContentDisposition(file.fileName),
        "X-Content-Type-Options": "nosniff",
      },
    });
  } catch (err) {
    console.error("[spk/file] gagal menyiapkan unduhan:", err);
    return NextResponse.json({ error: "Gagal mengunduh berkas SPK." }, { status: 500, headers: NO_STORE });
  }
}
