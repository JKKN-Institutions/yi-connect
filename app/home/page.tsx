import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { isPlatformSuperAdmin } from "@/lib/yi/auth/yi-directory-roles";

function parseSession(raw: string | undefined): Record<string, unknown> | null {
  if (!raw) return null;
  // Plaintext JSON cookie (yifi_session, yip_session, legacy yifuture_session).
  if (raw.startsWith("{")) {
    try {
      return JSON.parse(raw);
    } catch {
      return null;
    }
  }
  // Signed yifuture_session: base64url(json) "." base64url(hmac). Decode the
  // payload to read `type` for routing only — the module's own gate verifies
  // the signature. (Server component → Node Buffer is available.)
  const dot = raw.indexOf(".");
  if (dot <= 0) return null;
  try {
    const json = Buffer.from(raw.slice(0, dot), "base64url").toString("utf8");
    return JSON.parse(json);
  } catch {
    return null;
  }
}

export default async function SmartHomePage() {
  const cookieStore = await cookies();

  // Priority 0: platform super-admins land on the super-admin hub — even if
  // they also hold a module session cookie (e.g. they're registered as a
  // YiFuture delegate). The hub links every module's admin, so nothing is
  // lost and they never get dumped into a single module view.
  if (await isPlatformSuperAdmin()) redirect("/super-admin");

  // Priority 1: existing module session cookies (set by access code OR by OAuth callback)
  const yifi = parseSession(cookieStore.get("yifi_session")?.value);
  if (yifi?.type === "member") redirect("/yifi/me");

  const yifuture = parseSession(cookieStore.get("yifuture_session")?.value);
  if (yifuture?.type === "delegate") redirect("/yi-future/me");
  if (yifuture?.type === "mentor") redirect("/yi-future/mentor");
  if (yifuture?.type === "jury") redirect("/yi-future/jury");

  const yip = parseSession(cookieStore.get("yip_session")?.value);
  if (yip?.type === "participant") redirect("/yip/me");
  if (yip?.type === "jury") redirect("/yip/jury");

  // Priority 2: OAuth session → check if they're a chapter admin/member
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (user) {
    // Check if they have a yi_connect member record (chapter admin/member)
    const { data: member } = await supabase
      .schema("yi_connect" as any)
      .from("members")
      .select("id")
      .eq("id", user.id)
      .single();

    if (member) redirect("/dashboard");

    // Authenticated but not a member of any module — show "not registered" page
    redirect("/not-registered");
  }

  // Priority 3: anonymous → show YiFi landing (current flagship)
  redirect("/yifi");
}
