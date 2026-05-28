/**
 * Diagnostic endpoint — returns what the super-admin gate sees for the
 * current session. Used to debug why isCurrentUserSuperAdmin() returns
 * false for users who appear to have valid role_assignments.
 *
 * Strip after 2026-05-30.
 */
import { NextResponse } from "next/server";
import { createClient as createYipClient, createServiceClient } from "@/lib/yip/supabase/server";

export async function GET() {
  try {
    const yip = await createYipClient();
    const { data: userData, error: userErr } = await yip.auth.getUser();
    const user = userData?.user ?? null;

    if (!user) {
      return NextResponse.json({
        ok: false,
        stage: "auth.getUser",
        user: null,
        error: userErr?.message ?? "no user",
      });
    }

    const svc = await createServiceClient();

    const { data: person, error: personErr } = await svc
      .schema("yi_directory" as never).from("people")
      .select("id, email")
      .eq("user_id", user.id)
      .maybeSingle();

    if (personErr || !person) {
      return NextResponse.json({
        ok: false,
        stage: "people lookup",
        user: { id: user.id, email: user.email },
        person: null,
        error: personErr?.message ?? "no person row",
      });
    }

    const { data: rows, error: rowsErr } = await svc
      .schema("yi_directory" as never).from("role_assignments")
      .select("app, role, yi_year, yi_chapter, yi_zone, is_active")
      .eq("person_id", (person as { id: string }).id);

    return NextResponse.json({
      ok: true,
      user: { id: user.id, email: user.email },
      person: person,
      role_assignments: rows ?? [],
      role_assignments_error: rowsErr?.message ?? null,
    });
  } catch (e) {
    return NextResponse.json({
      ok: false,
      stage: "catch",
      error: e instanceof Error ? e.message : String(e),
    });
  }
}
