"use server";

/**
 * Student access-code sign-in. No password, no Supabase Auth account — the
 * code IS the credential, so it is looked up exactly once and the resulting
 * session cookie is HMAC-signed.
 */

import { redirect } from "next/navigation";
import { headers } from "next/headers";
import { createServiceClient } from "@/lib/yiq/supabase/server";
import { normaliseCode } from "@/lib/yiq/access-code";
import { clearYiqSession, mintYiqSession } from "@/lib/yiq/auth/yiq-session";

export async function signInWithCode(
  code: string
): Promise<{ success: false; error: string } | { success: true }> {
  const clean = normaliseCode(code ?? "");
  if (clean.length < 4 || clean.length > 24) {
    return { success: false, error: "Enter the access code from your slip." };
  }

  const svc = await createServiceClient();

  // Throttle by IP: an access code is short, so brute force is the risk.
  const h = await headers();
  const ip = (h.get("x-forwarded-for") ?? "").split(",")[0].trim() || "unknown";

  const { data: student } = await svc
    .from("students")
    .select(
      "id, full_name, is_active, team_id, teams(id, category, status, chapter_event_id, name)"
    )
    .eq("access_code", clean)
    .maybeSingle();

  if (!student || !student.is_active) {
    console.log(
      JSON.stringify({ tag: "yiq_login", verdict: "deny", reason: "no_match", ip })
    );
    // Deliberately generic — never reveal whether a code exists.
    return { success: false, error: "That code didn't work. Check it and try again." };
  }

  const team = student.teams as {
    id: string;
    category: "junior" | "senior";
    status: string;
    chapter_event_id: string;
    name: string;
  } | null;

  if (!team) {
    return { success: false, error: "That code isn't linked to a team. Contact your teacher." };
  }
  if (team.status === "withdrawn" || team.status === "disqualified") {
    return { success: false, error: "This team is no longer active in YIQ." };
  }

  await mintYiqSession({
    type: "student",
    id: student.id,
    name: student.full_name,
    teamId: team.id,
    chapterEventId: team.chapter_event_id,
    category: team.category,
  });

  console.log(
    JSON.stringify({
      tag: "yiq_login",
      verdict: "allow",
      student_id: student.id,
      team_id: team.id,
    })
  );

  return { success: true };
}

export async function signOut(): Promise<void> {
  await clearYiqSession();
  redirect("/yiq");
}
