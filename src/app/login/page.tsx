import { redirect } from "next/navigation";
import { getCurrentSession } from "@/lib/auth";
import { isGoogleOAuthConfigured } from "@/lib/google-oauth";
import { getPublicAppBaseUrl } from "@/lib/app-url";
import { sanitizeInternalHref } from "@/lib/url-safety";
import { LoginClient } from "./login-client";

export default async function LoginPage({
  searchParams,
}: {
  searchParams?: Promise<{ oauthError?: string; returnTo?: string }>;
}) {
  const session = await getCurrentSession();
  const sp = searchParams ? await searchParams : {};
  const requestedReturnTo = sanitizeInternalHref(sp.returnTo);
  const roleLanding = session?.role === "PENGGUNA" ? "/beranda" : "/dashboard";

  if (session) {
    redirect(requestedReturnTo ?? roleLanding);
  }
  const allowDevQuickSwitch =
    process.env.NODE_ENV !== "production" &&
    process.env.ALLOW_DEV_QUICK_SWITCH === "true";

  return (
    <LoginClient
      allowDevQuickSwitch={allowDevQuickSwitch}
      googleOAuthEnabled={isGoogleOAuthConfigured()}
      googleStartUrl={`${getPublicAppBaseUrl()}/api/auth/google/start`}
      oauthError={sp.oauthError ?? null}
      returnTo={requestedReturnTo ?? undefined}
    />
  );
}
