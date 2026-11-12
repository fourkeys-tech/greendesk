import { redirect } from "next/navigation";
import { getCurrentSession } from "@/lib/auth";
import { getPublicAppBaseUrl } from "@/lib/app-url";
import { isGoogleOAuthConfigured } from "@/lib/google-oauth";
import { sanitizeInternalHref } from "@/lib/url-safety";
import { RegisterClient } from "./register-client";

export default async function RegisterPage({
  searchParams,
}: {
  searchParams?: Promise<{ returnTo?: string }>;
}) {
  const params = searchParams ? await searchParams : {};
  const returnTo = sanitizeInternalHref(params.returnTo) ?? "/beranda";
  const session = await getCurrentSession();
  if (session) redirect(returnTo);

  return (
    <RegisterClient
      returnTo={returnTo}
      googleOAuthEnabled={isGoogleOAuthConfigured()}
      googleStartUrl={`${getPublicAppBaseUrl()}/api/auth/google/start`}
    />
  );
}
