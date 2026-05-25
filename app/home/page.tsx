import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

function parseSession(raw: string | undefined): Record<string, unknown> | null {
  if (!raw) return null;
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

export default async function SmartHomePage() {
  const cookieStore = await cookies();

  const yifi = parseSession(cookieStore.get("yifi_session")?.value);
  if (yifi?.type === "member") redirect("/yifi/me");

  const yifuture = parseSession(cookieStore.get("yifuture_session")?.value);
  if (yifuture?.type === "delegate") redirect("/yi-future/me");
  if (yifuture?.type === "mentor") redirect("/yi-future/mentor");
  if (yifuture?.type === "jury") redirect("/yi-future/jury");

  const yip = parseSession(cookieStore.get("yip_session")?.value);
  if (yip?.type === "participant") redirect("/yip/me");
  if (yip?.type === "jury") redirect("/yip/jury");

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (user) redirect("/dashboard");

  redirect("/yifi");
}
