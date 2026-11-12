import { redirect } from "next/navigation";
import { getCurrentSession } from "@/lib/auth";
import {
  getScopedReportsForUser,
  type ScopedFullReport,
} from "@/lib/services/foundation";
import { sanitizeMediaHref } from "@/lib/url-safety";
import {
  CitizenReportsClient,
  type CitizenReportItem,
} from "./citizen-reports-client";

export const dynamic = "force-dynamic";

export default async function CitizenReportsPage({
  searchParams,
}: {
  searchParams: Promise<{ arsip?: string; q?: string }>;
}) {
  const session = await getCurrentSession();
  if (!session) {
    redirect("/login?returnTo=%2Fberanda%2Flaporan");
  }
  if (session.role !== "PENGGUNA") {
    redirect("/dashboard/laporan");
  }

  const sp = await searchParams;
  const showArchived = sp.arsip === "1";
  const initialQuery = sp.q?.trim() || "";

  let rawReports: ScopedFullReport[] = [];
  let dbError = false;

  try {
    rawReports = (await getScopedReportsForUser(session, {
      includeArchived: showArchived,
      throwOnError: true,
    })) as ScopedFullReport[];
  } catch (err) {
    console.error("[beranda/laporan] gagal memuat laporan:", err);
    dbError = true;
  }

  const reports: CitizenReportItem[] = rawReports.map((r) => ({
    id: r.id,
    ticketNo: r.ticketNo,
    status: r.status,
    priority: r.priority,
    description: r.description,
    reason: r.reason,
    createdAtLabel: new Date(r.createdAt).toLocaleDateString("id-ID", {
      day: "numeric",
      month: "short",
      year: "numeric",
    }),
    assetCode: r.asset.code,
    assetName: r.asset.name,
    assetLocationNote: r.asset.locationNote,
    parkName: r.asset.park.name,
    clusterName: r.asset.park.cluster.name,
    photoUrl: sanitizeMediaHref(r.photos[0]?.url ?? null),
    spkNo: r.workOrder?.spkNo ?? null,
    parentTicketNo: r.parentReport?.ticketNo ?? null,
  }));

  return (
    <CitizenReportsClient
      reports={reports}
      showArchived={showArchived}
      initialQuery={initialQuery}
      dbError={dbError}
    />
  );
}
