import { getCurrentSession } from "@/lib/auth";
import { query } from "@/lib/db";
import type { ReportStatus } from "@/lib/db-types";
import { sanitizeMediaHref } from "@/lib/url-safety";
import { BerandaClient, type BerandaParkItem, type BerandaReportItem } from "./beranda-client";

export const dynamic = "force-dynamic";

interface RawParkRow {
  id: string;
  name: string;
  clusterName: string;
}

interface RawReportRow {
  id: string;
  ticketNo: string;
  status: ReportStatus;
  createdAt: Date;
  reporterId: string;
  parkId: string;
  parkName: string;
  assetCode: string;
  assetName: string;
  assetLocationNote: string | null;
  photoUrl: string | null;
}

export default async function BerandaPage() {
  const session = await getCurrentSession().catch(() => null);

  let parks: BerandaParkItem[] = [];
  let reports: BerandaReportItem[] = [];

  try {
    const companyId = session?.companyId ?? null;
    const [parkRows, reportRows] = await Promise.all([
      query<RawParkRow>(
        `SELECT p."id", p."name", cl."name" AS "clusterName"
         FROM "Park" p
         JOIN "Cluster" cl ON cl."id" = p."clusterId"
         JOIN "Complex" cx ON cx."id" = cl."complexId"
         WHERE p."isActive" = true
           AND cl."isActive" = true
           AND cx."isActive" = true${companyId ? ` AND cl."companyId" = $1` : ""}
         ORDER BY p."name" ASC`,
        companyId ? [companyId] : []
      ),
      query<RawReportRow>(
        `SELECT r."id",
                r."ticketNo",
                r."status",
                r."createdAt",
                r."reporterId",
                p."id" AS "parkId",
                p."name" AS "parkName",
                a."code" AS "assetCode",
                a."name" AS "assetName",
                a."locationNote" AS "assetLocationNote",
                (
                  SELECT rp."url"
                  FROM "ReportPhoto" rp
                  WHERE rp."reportId" = r."id"
                  ORDER BY rp."createdAt" ASC
                  LIMIT 1
                ) AS "photoUrl"
         FROM "Report" r
         JOIN "Asset" a ON a."id" = r."assetId"
         JOIN "Category" cat ON cat."id" = a."categoryId"
         JOIN "Park" p ON p."id" = a."parkId"
         JOIN "Cluster" cl ON cl."id" = p."clusterId"
         JOIN "Complex" cx ON cx."id" = cl."complexId"
         WHERE r."archivedAt" IS NULL
           AND a."isActive" = true
           AND cat."isActive" = true
           AND p."isActive" = true
           AND cl."isActive" = true
           AND cx."isActive" = true${companyId ? ` AND r."companyId" = $1` : ""}
         ORDER BY r."createdAt" DESC
         LIMIT 30`,
        companyId ? [companyId] : []
      ),
    ]);

    parks = parkRows;
    // Privasi publik: jangan kirim reporterId maupun statusToken ke client.
    reports = reportRows.map((r) => ({
      id: r.id,
      ticketNo: r.ticketNo,
      status: r.status,
      createdAtLabel: new Date(r.createdAt).toLocaleDateString("id-ID", {
        day: "numeric",
        month: "short",
        year: "numeric",
      }),
      parkId: r.parkId,
      parkName: r.parkName,
      assetCode: r.assetCode,
      assetName: r.assetName,
      assetLocationNote: r.assetLocationNote,
      photoUrl: sanitizeMediaHref(r.photoUrl),
      isOwnReport: Boolean(session && r.reporterId === session.id),
    }));
  } catch (err) {
    console.error("[beranda] gagal memuat data taman/laporan:", err);
  }

  return (
    <BerandaClient
      session={session ? { name: session.name, role: session.role } : null}
      parks={parks}
      reports={reports}
    />
  );
}
