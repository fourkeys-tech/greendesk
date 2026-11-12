import crypto from "crypto";
import { createRemoteJWKSet, jwtVerify, SignJWT } from "jose";
import type { Role } from "./db-types";
import { getPublicAppBaseUrl } from "./app-url";
import { sanitizeInternalHref } from "./url-safety";

export const GOOGLE_OAUTH_COOKIE_NAME = "greenpark_google_oauth";

const GOOGLE_JWKS = createRemoteJWKSet(
  new URL("https://www.googleapis.com/oauth2/v3/certs")
);

export interface GoogleOAuthStatePayload {
  state: string;
  codeVerifier: string;
  nonce: string;
  returnTo: string;
  hasExplicitReturnTo: boolean;
  assetCode: string | null;
  consent: boolean;
}

export interface VerifiedGoogleIdentity {
  sub: string;
  email: string;
  name: string;
  emailVerified: boolean;
}

function getGoogleCredentials() {
  const clientId = process.env.GOOGLE_CLIENT_ID?.trim() || "";
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET?.trim() || "";
  return { clientId, clientSecret };
}

export function isGoogleOAuthConfigured(): boolean {
  const { clientId, clientSecret } = getGoogleCredentials();
  return Boolean(clientId && clientSecret);
}

function getOAuthStateSecret(): Uint8Array {
  const secret = process.env.AUTH_SECRET?.trim();
  if (!secret) {
    throw new Error("AUTH_SECRET belum dikonfigurasi.");
  }
  return new TextEncoder().encode(secret);
}

export function sanitizeReturnTo(raw: string | null | undefined): string | null {
  const value = raw?.trim() || "";
  return sanitizeInternalHref(value);
}

export function getDefaultLanding(role: Role | null | undefined): string {
  return role === "PENGGUNA" ? "/beranda" : "/dashboard";
}

/**
 * Menentukan origin publik aplikasi untuk redirect OAuth.
 * Memprioritaskan `APP_BASE_URL` di `.env`, lalu header reverse proxy
 * (`x-forwarded-host` / `x-forwarded-proto`), dan terakhir `request.url`.
 */
export function getGoogleAppOrigin(request: Request): string {
  if (process.env.APP_BASE_URL?.trim()) {
    return getPublicAppBaseUrl();
  }

  const reqUrl = new URL(request.url);
  const forwardedHost = request.headers
    .get("x-forwarded-host")
    ?.split(",")[0]
    ?.trim();
  if (forwardedHost) {
    const rawProto = request.headers
      .get("x-forwarded-proto")
      ?.split(",")[0]
      ?.trim()
      .toLowerCase();
    const proto = rawProto === "http" || rawProto === "https" ? rawProto : "https";
    try {
      return new URL(`${proto}://${forwardedHost}`).origin;
    } catch {
      // Fallback ke origin request bila header proxy tidak valid
    }
  }

  return reqUrl.origin;
}

export function getGoogleRedirectUri(requestUrl: string): string {
  const explicit = process.env.GOOGLE_REDIRECT_URI?.trim();
  const callbackPath = "/api/auth/google/callback";

  // Avoid OAuth callbacks pointing to localhost when APP_BASE_URL is set.
  if (process.env.APP_BASE_URL?.trim()) {
    return `${getPublicAppBaseUrl()}${callbackPath}`;
  }
  if (explicit) {
    const explicitUrl = new URL(explicit);
    const requestOrigin = new URL(requestUrl).origin;
    if (explicitUrl.origin !== requestOrigin && process.env.NODE_ENV !== "production") {
      return `${requestOrigin}${callbackPath}`;
    }
    return explicit;
  }
  const parsed = new URL(requestUrl);
  return `${parsed.origin}${callbackPath}`;
}

export function createPkcePair(): {
  codeVerifier: string;
  codeChallenge: string;
} {
  const codeVerifier = crypto.randomBytes(32).toString("base64url");
  const codeChallenge = crypto
    .createHash("sha256")
    .update(codeVerifier)
    .digest("base64url");
  return { codeVerifier, codeChallenge };
}

export async function signGoogleOAuthStateCookie(
  payload: GoogleOAuthStatePayload
): Promise<string> {
  return new SignJWT({ ...payload })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime("10m")
    .sign(getOAuthStateSecret());
}

export async function verifyGoogleOAuthStateCookie(
  token: string
): Promise<GoogleOAuthStatePayload | null> {
  try {
    const { payload } = await jwtVerify(token, getOAuthStateSecret());
    if (
      typeof payload.state !== "string" ||
      typeof payload.codeVerifier !== "string" ||
      typeof payload.nonce !== "string" ||
      typeof payload.returnTo !== "string"
    ) {
      return null;
    }
    return {
      state: payload.state,
      codeVerifier: payload.codeVerifier,
      nonce: payload.nonce,
      returnTo: sanitizeReturnTo(payload.returnTo) ?? "/dashboard",
      hasExplicitReturnTo: payload.hasExplicitReturnTo === true,
      assetCode:
        typeof payload.assetCode === "string" && payload.assetCode
          ? payload.assetCode
          : null,
      consent: Boolean(payload.consent),
    };
  } catch {
    return null;
  }
}

export function buildGoogleAuthorizationUrl(params: {
  redirectUri: string;
  state: string;
  codeChallenge: string;
  nonce: string;
}): string {
  const { clientId } = getGoogleCredentials();
  if (!clientId) {
    throw new Error("GOOGLE_CLIENT_ID belum dikonfigurasi.");
  }

  const url = new URL("https://accounts.google.com/o/oauth2/v2/auth");
  url.searchParams.set("client_id", clientId);
  url.searchParams.set("redirect_uri", params.redirectUri);
  url.searchParams.set("response_type", "code");
  url.searchParams.set("scope", "openid email profile");
  url.searchParams.set("state", params.state);
  url.searchParams.set("nonce", params.nonce);
  url.searchParams.set("code_challenge", params.codeChallenge);
  url.searchParams.set("code_challenge_method", "S256");
  url.searchParams.set("prompt", "select_account");
  return url.toString();
}

export async function exchangeGoogleCodeForIdToken(params: {
  code: string;
  codeVerifier: string;
  redirectUri: string;
}): Promise<string> {
  const { clientId, clientSecret } = getGoogleCredentials();
  if (!clientId || !clientSecret) {
    throw new Error("Konfigurasi Google OAuth belum lengkap.");
  }

  const body = new URLSearchParams({
    code: params.code,
    client_id: clientId,
    client_secret: clientSecret,
    redirect_uri: params.redirectUri,
    grant_type: "authorization_code",
    code_verifier: params.codeVerifier,
  });

  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: body.toString(),
    cache: "no-store",
  });

  if (!res.ok) {
    throw new Error("Gagal menukar kode otorisasi Google.");
  }

  const data = (await res.json()) as { id_token?: string };
  if (!data.id_token || typeof data.id_token !== "string") {
    throw new Error("Respons Google tidak menyertakan id_token.");
  }
  return data.id_token;
}

export async function verifyGoogleIdToken(
  idToken: string,
  expectedNonce: string
): Promise<VerifiedGoogleIdentity> {
  const { clientId } = getGoogleCredentials();
  if (!clientId) {
    throw new Error("GOOGLE_CLIENT_ID belum dikonfigurasi.");
  }

  const { payload } = await jwtVerify(idToken, GOOGLE_JWKS, {
    issuer: ["https://accounts.google.com", "accounts.google.com"],
    audience: clientId,
  });

  if (payload.nonce !== expectedNonce) {
    throw new Error("Nonce ID token Google tidak cocok.");
  }
  if (payload.email_verified !== true || typeof payload.email !== "string") {
    throw new Error("Email Google belum terverifikasi.");
  }
  if (typeof payload.sub !== "string" || !payload.sub) {
    throw new Error("Subject ID token Google tidak valid.");
  }

  const email = payload.email.trim().toLowerCase();
  const rawName =
    typeof payload.name === "string" && payload.name.trim()
      ? payload.name.trim()
      : email.split("@")[0];

  return {
    sub: payload.sub,
    email,
    name: rawName,
    emailVerified: true,
  };
}
