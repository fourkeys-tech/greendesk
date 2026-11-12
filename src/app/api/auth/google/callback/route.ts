import crypto from "crypto";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { setSessionCookie, type SessionUser } from "@/lib/auth";
import { execute, queryOne, withTransaction } from "@/lib/db";
import type { Role } from "@/lib/db-types";
import {
  exchangeGoogleCodeForIdToken,
  getGoogleAppOrigin,
  getGoogleRedirectUri,
  GOOGLE_OAUTH_COOKIE_NAME,
  isGoogleOAuthConfigured,
  getDefaultLanding,
  sanitizeReturnTo,
  verifyGoogleIdToken,
  verifyGoogleOAuthStateCookie,
} from "@/lib/google-oauth";

function timingSafeEquals(a: string, b: string): boolean {
  const bufA = Buffer.from(a);
  const bufB = Buffer.from(b);
  if (bufA.length !== bufB.length) return false;
  return crypto.timingSafeEqual(bufA, bufB);
}

function withQueryParam(path: string, key: string, value: string, origin = "https://app.invalid"): string {
  const parsed = new URL(path, origin);
  parsed.searchParams.set(key, value);
  return `${parsed.pathname}${parsed.search}`;
}

export async function GET(request: Request) {
  const reqUrl = new URL(request.url);
  const appOrigin = getGoogleAppOrigin(request);
  const cookieStore = await cookies();
  const rawStateCookie = cookieStore.get(GOOGLE_OAUTH_COOKIE_NAME)?.value;

  const clearStateAndRedirect = (path: string) => {
    const res = NextResponse.redirect(
      new URL(sanitizeReturnTo(path) ?? "/beranda", appOrigin)
    );
    res.cookies.delete(GOOGLE_OAUTH_COOKIE_NAME);
    return res;
  };

  if (!isGoogleOAuthConfigured() || !rawStateCookie) {
    return clearStateAndRedirect(withQueryParam("/login", "oauthError", "invalid_state", appOrigin));
  }

  const stateData = await verifyGoogleOAuthStateCookie(rawStateCookie);
  if (!stateData) {
    return clearStateAndRedirect(withQueryParam("/login", "oauthError", "expired_state", appOrigin));
  }

  const fallbackErrorPath = stateData.assetCode
    ? `/r/${encodeURIComponent(stateData.assetCode)}`
    : "/login";

  if (reqUrl.searchParams.get("error")) {
    return clearStateAndRedirect(
      withQueryParam(fallbackErrorPath, "oauthError", "access_denied", appOrigin)
    );
  }

  const code = reqUrl.searchParams.get("code")?.trim();
  const returnedState = reqUrl.searchParams.get("state")?.trim();
  if (!code || !returnedState || !timingSafeEquals(returnedState, stateData.state)) {
    return clearStateAndRedirect(
      withQueryParam(fallbackErrorPath, "oauthError", "invalid_state", appOrigin)
    );
  }

  try {
    const redirectUri = getGoogleRedirectUri(request.url);
    const idToken = await exchangeGoogleCodeForIdToken({
      code,
      codeVerifier: stateData.codeVerifier,
      redirectUri,
    });
    const identity = await verifyGoogleIdToken(idToken, stateData.nonce);

    const derivedCompanyId = stateData.assetCode
      ? (
          await queryOne<{ companyId: string }>(
            `SELECT "companyId" FROM "Asset" WHERE "code" = $1`,
            [stateData.assetCode]
          )
        )?.companyId ?? null
      : null;

    const now = new Date();
    const userResult = await withTransaction(async (tx) => {
      const existing = await queryOne<{
        id: string;
        name: string;
        email: string;
        role: Role;
        companyId: string | null;
        staffClusterId: string | null;
        isActive: boolean;
        isBlocked: boolean;
        companyName: string | null;
      }>(
        `SELECT u."id", u."name", u."email", u."role", u."companyId", u."staffClusterId",
                u."isActive", u."isBlocked", c."name" AS "companyName"
         FROM "User" u
         LEFT JOIN "Company" c ON c."id" = u."companyId"
         WHERE LOWER(u."email") = LOWER($1)
         LIMIT 1`,
        [identity.email],
        tx
      );

      if (existing) {
        if (!existing.isActive || existing.isBlocked) {
          return { error: "account_blocked" as const };
        }
        if (existing.role !== "PENGGUNA") {
          return { error: "internal_role_password_required" as const };
        }

        await execute(
          `UPDATE "User"
           SET "lastLoginAt" = $2,
               "dataConsentAt" = COALESCE("dataConsentAt", $2),
               "updatedAt" = NOW()
           WHERE "id" = $1`,
          [existing.id, now],
          tx
        );

        const sessionUser: SessionUser = {
          id: existing.id,
          name: existing.name,
          email: existing.email,
          role: existing.role,
          companyId: existing.companyId,
          companyName: existing.companyName ?? null,
          staffClusterId: existing.staffClusterId,
        };
        return { sessionUser };
      }

      if (!stateData.consent) {
        return { error: "consent_required" as const };
      }

      const created = await queryOne<{
        id: string;
        name: string;
        email: string;
        role: Role;
        companyId: string | null;
        staffClusterId: string | null;
      }>(
        `INSERT INTO "User" (
           "companyId", "name", "email", "role", "loginMethod",
           "reporterStatus", "dataConsentAt", "lastLoginAt", "isActive"
         )
         VALUES ($1, $2, $3, 'PENGGUNA'::"Role", 'GOOGLE', 'WARGA', $4, $4, true)
         RETURNING "id", "name", "email", "role", "companyId", "staffClusterId"`,
        [derivedCompanyId, identity.name, identity.email, now],
        tx
      );
      if (!created) {
        return { error: "create_failed" as const };
      }

      const comp = created.companyId
        ? await queryOne<{ name: string }>(
            `SELECT "name" FROM "Company" WHERE "id" = $1`,
            [created.companyId],
            tx
          )
        : null;

      const sessionUser: SessionUser = {
        id: created.id,
        name: created.name,
        email: created.email,
        role: created.role,
        companyId: created.companyId,
        companyName: comp?.name ?? null,
        staffClusterId: created.staffClusterId,
      };
      return { sessionUser };
    });

    if ("error" in userResult) {
      return clearStateAndRedirect(
        withQueryParam(fallbackErrorPath, "oauthError", userResult.error ?? "oauth_failed")
      );
    }

    await setSessionCookie(userResult.sessionUser);
    const returnTo = stateData.hasExplicitReturnTo
      ? stateData.returnTo
      : getDefaultLanding(userResult.sessionUser.role);
    const successTarget = stateData.assetCode
      ? withQueryParam(returnTo, "googleAuth", "1", appOrigin)
      : returnTo;

    return clearStateAndRedirect(successTarget);
  } catch (err) {
    console.error("[google-oauth/callback] error:", err);
    return clearStateAndRedirect(
      withQueryParam(fallbackErrorPath, "oauthError", "oauth_failed")
    );
  }
}
