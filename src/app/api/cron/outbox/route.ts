import crypto from "crypto";
import { NextResponse } from "next/server";
import { processEmailOutbox } from "@/lib/email";

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

async function handleOutboxCron(request: Request) {
  if (!isAuthorizedCron(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const result = await processEmailOutbox(50);
    return NextResponse.json({ ok: true, ...result });
  } catch (err) {
    console.error("[cron/outbox] error:", err);
    return NextResponse.json(
      { ok: false, error: "Gagal memproses antrean email." },
      { status: 500 }
    );
  }
}

export async function GET(request: Request) {
  return handleOutboxCron(request);
}

export async function POST(request: Request) {
  return handleOutboxCron(request);
}
