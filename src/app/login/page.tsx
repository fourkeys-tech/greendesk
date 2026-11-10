import { redirect } from "next/navigation";
import { getCurrentSession } from "@/lib/auth";
import { LoginClient } from "./login-client";

export default async function LoginPage() {
  const session = await getCurrentSession();
  if (session) {
    redirect("/dashboard");
  }

  return <LoginClient />;
}
