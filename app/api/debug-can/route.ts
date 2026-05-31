// DEV-ONLY diagnostic — proves the scoped permission gate end-to-end in the real
// Next runtime against real yi_directory data. Returns 404 in production.
//
// Usage: GET /api/debug-can?email=someone@example.com
// It loads that person's role_assignments and runs canForAssignments() over a
// matrix of (capability, scope) cases so you can eyeball allow/deny per role.
//
// This is throwaway scaffolding for the Phase-7 "wire + test" gate; safe to
// delete once the permission layer is wired into real UI.

import { NextResponse } from "next/server";
import { createServiceClient } from "@/lib/yip/supabase/server";
import { canForAssignments } from "@/lib/yi/auth/can";
import type { RoleAssignment } from "@/lib/yi/auth/yi-directory-roles";

export const dynamic = "force-dynamic";

type RawRole = {
  app: string;
  role: string;
  yi_year: number;
  yi_chapter: string | null;
  yi_zone: string | null;
  is_active: boolean | null;
};

export async function GET(req: Request) {
  if (process.env.NODE_ENV === "production") {
    return NextResponse.json({ error: "disabled in production" }, { status: 404 });
  }
  const email = new URL(req.url).searchParams.get("email");
  if (!email) {
    return NextResponse.json({ error: "pass ?email=" }, { status: 400 });
  }

  const svc = await createServiceClient();
  const dir = svc.schema("yi_directory" as never) as unknown as {
    from: (t: string) => {
      select: (c: string) => {
        ilike: (
          k: string,
          v: string
        ) => {
          maybeSingle: () => Promise<{
            data: { id: string; full_name: string } | null;
          }>;
        };
        eq: (
          k: string,
          v: string
        ) => Promise<{ data: RawRole[] | null }>;
      };
    };
  };

  const { data: person } = await dir
    .from("people")
    .select("id, full_name")
    .ilike("email", email)
    .maybeSingle();
  if (!person) {
    return NextResponse.json({ error: `no person for ${email}` }, { status: 404 });
  }

  const { data: rows } = await dir
    .from("role_assignments")
    .select("app, role, yi_year, yi_chapter, yi_zone, is_active")
    .eq("person_id", person.id);

  const assignments: RoleAssignment[] = (rows ?? []).map((r) => ({
    app: r.app,
    role: r.role,
    yi_year: r.yi_year,
    yi_chapter: r.yi_chapter,
    yi_zone: r.yi_zone,
    is_active: r.is_active ?? false,
  }));

  const myZone = assignments.find((a) => a.yi_zone)?.yi_zone ?? null;
  const myChapter = assignments.find((a) => a.yi_chapter)?.yi_chapter ?? null;

  const cases: Array<{
    label: string;
    cap: string;
    target: { app: string; chapter?: string | null; zone?: string | null };
  }> = [
    { label: "event.delete (global WRITE)", cap: "event.delete", target: { app: "yip" } },
    { label: `event.read @ OWN zone (${myZone ?? "—"})`, cap: "event.read", target: { app: "yip", zone: myZone } },
    { label: "event.read @ FOREIGN zone (ZZ)", cap: "event.read", target: { app: "yip", zone: "ZZ" } },
    { label: `participant.manage @ OWN chapter (${myChapter ?? "—"})`, cap: "participant.manage", target: { app: "yip", chapter: myChapter } },
    { label: "participant.manage @ FOREIGN chapter", cap: "participant.manage", target: { app: "yip", chapter: "Nowhere-Chapter" } },
  ];

  const verdicts: Array<{ test: string; allowed: boolean }> = [];
  for (const c of cases) {
    verdicts.push({ test: c.label, allowed: await canForAssignments(assignments, c.cap, c.target) });
  }

  return NextResponse.json({
    email,
    person: person.full_name,
    assignments: assignments.map(
      (a) =>
        `${a.role}${a.yi_zone ? "@" + a.yi_zone : ""}${a.yi_chapter ? "/" + a.yi_chapter : ""}${a.is_active ? "" : " (inactive)"}`
    ),
    verdicts,
  });
}
