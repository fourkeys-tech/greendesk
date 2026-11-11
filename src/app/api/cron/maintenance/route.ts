import crypto from "crypto";
import { NextResponse } from "next/server";
import { query } from "@/lib/db";
import { runPhase2MaintenanceJob } from "@/lib/services/phase2-vendor";

function isAuthorizedCron(request: Request): boolean {
  const expected = process.env.CRON_SECRET?.trim();
  if (!expected) return false;

  const authHeader = request.headers.get("authorization") ?? "";
  if (!authHeader.startsWith("Bearer ")) return false;
  const provided = authHeader.slice(7).trim();

  const a = Buffer.from(provided);
  const b = Buffer.from(expected);
  if (a.length !== b.length) return false;
  return crypto.timingSafeEqual(a, b);
}

async function handleMaintenanceCron(request: Request) {
  if (!isAuthorizedCron(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const companies = await query<{ id: string; name: string }>(
      `SELECT "id", "name" FROM "Company" WHERE "isActive" = true`
    );

    let deactivatedCount = 0;
    let reminderSentCount = 0;

    for (const company of companies) {
      const res = await runPhase2MaintenanceJob(company.id);
      deactivatedCount += res.deactivatedCount;
      reminderSentCount += res.reminderSentCount;
    }

    return NextResponse.json({
      ok: true,
      companiesProcessed: companies.length,
      deactivatedCount,
      reminderSentCount,
    });
  } catch (err) {
    console.error("[cron/maintenance] error:", err);
    return NextResponse.json(
      { ok: false, error: "Gagal menjalankan job pemeliharaan." },
      { status: 500 }
    );
  }
}

export async function GET(request: Request) {
  return handleMaintenanceCron(request);
}

export async function POST(request: Request) {
  return handleMaintenanceCron(request);
}
