import crypto from "crypto";
import { NextResponse } from "next/server";
import {
  buildGoogleAuthorizationUrl,
  createPkcePair,
  getGoogleAppOrigin,
  getGoogleRedirectUri,
  GOOGLE_OAUTH_COOKIE_NAME,
  isGoogleOAuthConfigured,
  sanitizeReturnTo,
  signGoogleOAuthStateCookie,
} from "@/lib/google-oauth";

function appendErrorQuery(path: string, errorCode: string, origin: string): string {
  const url = new URL(path, origin);
  url.searchParams.set("oauthError", errorCode);
  return `${url.pathname}${url.search}`;
}

export async function GET(request: Request) {
  const url = new URL(request.url);
  const appOrigin = getGoogleAppOrigin(request);
  const requestedReturnTo = sanitizeReturnTo(url.searchParams.get("returnTo"));
  const hasExplicitReturnTo = url.searchParams.has("returnTo") && requestedReturnTo !== null;
  const returnTo = requestedReturnTo ?? "/beranda";
  const rawAssetCode = url.searchParams.get("assetCode")?.trim().toUpperCase() || null;
  const consent = url.searchParams.get("consent") === "1";

  if (!isGoogleOAuthConfigured()) {
    return NextResponse.redirect(
      new URL(appendErrorQuery(returnTo, "google_not_configured", appOrigin), appOrigin)
    );
  }

  if (rawAssetCode && !consent) {
    return NextResponse.redirect(
      new URL(appendErrorQuery(returnTo, "consent_required", appOrigin), appOrigin)
    );
  }

  const state = crypto.randomBytes(24).toString("base64url");
  const nonce = crypto.randomBytes(24).toString("base64url");
  const { codeVerifier, codeChallenge } = createPkcePair();
  const redirectUri = getGoogleRedirectUri(request.url);

  const signedState = await signGoogleOAuthStateCookie({
    state,
    codeVerifier,
    nonce,
    returnTo,
    hasExplicitReturnTo,
    assetCode: rawAssetCode,
    consent,
  });

  const authUrl = buildGoogleAuthorizationUrl({
    redirectUri,
    state,
    codeChallenge,
    nonce,
  });

  const response = NextResponse.redirect(authUrl);
  response.cookies.set(GOOGLE_OAUTH_COOKIE_NAME, signedState, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 600,
  });
  return response;
}
