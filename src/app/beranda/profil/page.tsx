import { redirect } from "next/navigation";
import { getCurrentSession } from "@/lib/auth";
import { queryOne } from "@/lib/db";
import type { UserRow } from "@/lib/db-types";
import { formatWibDate, formatWibDateTime } from "@/lib/dates";
import { CitizenProfileClient } from "./citizen-profile-client";

export const dynamic = "force-dynamic";

export default async function CitizenProfilePage() {
  const session = await getCurrentSession();
  if (!session) {
    redirect("/login?returnTo=%2Fberanda%2Fprofil");
  }
  if (session.role !== "PENGGUNA") {
    redirect("/dashboard/profil");
  }

  const userRow = await queryOne<UserRow>(
    `SELECT * FROM "User" WHERE "id" = $1`,
    [session.id]
  );

  if (!userRow) {
    redirect("/login");
  }

  return (
    <CitizenProfileClient
      user={{
        name: userRow.name,
        email: userRow.email,
        loginMethod: userRow.loginMethod,
        isActive: userRow.isActive,
        lastLoginLabel: userRow.lastLoginAt
          ? formatWibDateTime(userRow.lastLoginAt)
          : null,
        validReportCount: userRow.validReportCount,
        invalidReportCount: userRow.invalidReportCount,
        reporterStatus: userRow.reporterStatus,
        blockHouseNo: userRow.blockHouseNo,
        hasConsent: Boolean(userRow.dataConsentAt),
        dataConsentLabel: userRow.dataConsentAt
          ? `disetujui ${formatWibDate(userRow.dataConsentAt)}`
          : "belum disetujui",
      }}
    />
  );
}
