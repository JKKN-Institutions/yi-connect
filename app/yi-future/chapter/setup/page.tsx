import { redirect } from "next/navigation";
import { createServiceClient } from "@/lib/yi-future/supabase/server";
import { getChapterContext } from "@/lib/yi-future/chapter-context";
import { updateOwnChapterProfile } from "@/app/yi-future/actions/chapters";
import { ActionResultForm } from "@/components/yi-future/admin/ActionResultForm";
import {
  addCoreTeamMember,
  removeCoreTeamMember,
} from "@/app/yi-future/actions/core-team";
import { CORE_TEAM_ROLES, CORE_TEAM_ROLE_LABELS } from "@/lib/yi-future/constants";
import type { Database } from "@/types/yi-future/database";

type CoreRow = {
  id: string;
  full_name: string;
  email: string | null;
  phone: string | null;
  role: Database["future"]["Enums"]["user_role"];
  user_id: string | null;
  is_active: boolean | null;
};

async function getCore(
  chapterId: string,
  editionId: string
): Promise<CoreRow[]> {
  const svc = await createServiceClient();
  const { data } = await svc
    .schema("future")
    .from("chapter_core_team")
    .select("id, full_name, email, phone, role, user_id, is_active, person_id")
    .eq("chapter_id", chapterId)
    .eq("edition_id", editionId)
    .order("role", { ascending: true });
  const rows = (data as unknown as Array<CoreRow & { person_id: string | null }>) ?? [];

  // Resolve canonical identity from yi_directory.people. Cast: schema not in
  // generated types yet (migrations 023-025).
  const personIds = Array.from(
    new Set(rows.map((r) => r.person_id).filter((x): x is string => Boolean(x)))
  );
  if (personIds.length === 0) return rows;

  const svcDir = svc.schema("yi_directory" as never) as unknown as {
    from: (t: string) => {
      select: (c: string) => {
        in: (k: string, v: string[]) => Promise<{
          data: Array<{ id: string; full_name: string; email: string | null; phone: string | null }> | null;
        }>;
      };
    };
  };
  const { data: people } = await svcDir
    .from("people")
    .select("id, full_name, email, phone")
    .in("id", personIds);
  const personById = new Map(
    (people ?? []).map((p) => [p.id, p] as const)
  );

  return rows.map((r) => {
    const person = r.person_id ? personById.get(r.person_id) : undefined;
    return {
      ...r,
      full_name: person?.full_name ?? r.full_name,
      email: person?.email ?? r.email,
      phone: person?.phone ?? r.phone,
    };
  });
}

async function getChapter(id: string) {
  const svc = await createServiceClient();
  const { data } = await svc
    .schema("yi")
    .from("chapters")
    .select(
      "id, name, city, state, region, logo_url, programme_duration_days, finale_start_date, finale_end_date"
    )
    .eq("id", id)
    .maybeSingle();
  return data as unknown as {
    id: string;
    name: string;
    city: string;
    state: string | null;
    region: string | null;
    logo_url: string | null;
    programme_duration_days: number | null;
    finale_start_date: string | null;
    finale_end_date: string | null;
  } | null;
}

async function countPhaseEvents(
  chapterId: string,
  editionId: string
): Promise<number> {
  const svc = await createServiceClient();
  const { count } = await svc
    .schema("future")
    .from("phase_events")
    .select("id", { count: "exact", head: true })
    .eq("chapter_id", chapterId)
    .eq("edition_id", editionId);
  return count ?? 0;
}

export default async function ChapterSetupPage() {
  const ctx = await getChapterContext();
  if (!ctx) redirect("/yi-future/chapter");

  const chapter = await getChapter(ctx.chapterId);
  const core = await getCore(ctx.chapterId, ctx.editionId);
  const phaseEventCount = await countPhaseEvents(ctx.chapterId, ctx.editionId);
  const durationLocked = phaseEventCount > 0;
  const currentDuration =
    chapter?.programme_duration_days === 30
      ? 30
      : chapter?.programme_duration_days === 60
        ? 60
        : 90;

  async function saveChapter(formData: FormData) {
    "use server";
    // Profile + programme duration + finale dates saved in one chapter-scoped
    // action. (The old national-gated updateChapter 403'd every chapter admin
    // and skipped the duration/finale writes entirely.)
    return await updateOwnChapterProfile(formData);
  }

  async function addMember(formData: FormData) {
    "use server";
    await addCoreTeamMember(
      { chapterId: ctx!.chapterId, editionId: ctx!.editionId },
      formData
    );
  }

  async function removeMember(formData: FormData) {
    "use server";
    const id = String(formData.get("id") ?? "");
    await removeCoreTeamMember(id);
  }

  const filledRoles = new Set(core.map((c) => c.role));
  const missingRoles = CORE_TEAM_ROLES.filter((r) => !filledRoles.has(r));

  return (
    <div className="space-y-8">
      <div>
        <h2 className="text-2xl font-bold text-navy">Chapter Setup</h2>
        <p className="mt-1 text-sm text-navy/60">
          Chapter profile + 4-role core team for {ctx.editionName}.
        </p>
      </div>

      {/* ─── 6.0 info banner ────────────────────────────────────── */}
      <div className="rounded-lg border border-yi-gold/40 bg-yi-gold/10 p-3 text-sm text-navy">
        <span className="font-semibold">Future 6.0:</span> every chapter runs
        all 4 tracks. No track selection needed.
      </div>

      {/* ─── Profile form ───────────────────────────────────────── */}
      <section className="bg-white border border-navy/10 rounded-lg p-6">
        <h3 className="text-lg font-bold text-navy mb-5">Chapter profile</h3>
        <ActionResultForm action={saveChapter} className="space-y-4">
          <div>
            <label className="block text-xs font-semibold uppercase tracking-widest text-navy/70 mb-1.5">
              Name
            </label>
            {/* Chapter name is national identity — read-only here (2026-07-17:
                a chair accidentally renamed the Nagpur chapter to a student's
                name via this field). */}
            <input
              value={chapter?.name ?? ""}
              readOnly
              className="w-full px-3 py-2 border border-navy/20 rounded-md text-sm bg-navy/5 text-navy/60 cursor-not-allowed"
            />
            <p className="text-xs text-navy/50 mt-1">
              Managed by the Yi Future national team — contact them to change
              the chapter name.
            </p>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold uppercase tracking-widest text-navy/70 mb-1.5">
                City
              </label>
              <input
                name="city"
                defaultValue={chapter?.city ?? ""}
                required
                className="w-full px-3 py-2 border border-navy/20 rounded-md text-sm"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold uppercase tracking-widest text-navy/70 mb-1.5">
                State
              </label>
              <input
                name="state"
                defaultValue={chapter?.state ?? ""}
                className="w-full px-3 py-2 border border-navy/20 rounded-md text-sm"
              />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold uppercase tracking-widest text-navy/70 mb-1.5">
                Region
              </label>
              <input
                value={chapter?.region ?? ""}
                readOnly
                className="w-full px-3 py-2 border border-navy/20 rounded-md text-sm bg-navy/5 text-navy/60 cursor-not-allowed"
              />
              <p className="text-xs text-navy/50 mt-1">
                Set by the national team.
              </p>
            </div>
            <div>
              <label className="block text-xs font-semibold uppercase tracking-widest text-navy/70 mb-1.5">
                Logo URL
              </label>
              <input
                name="logo_url"
                type="url"
                defaultValue={chapter?.logo_url ?? ""}
                className="w-full px-3 py-2 border border-navy/20 rounded-md text-sm"
              />
            </div>
          </div>
          <div>
            <label
              htmlFor="programme_duration_days"
              className="block text-xs font-semibold uppercase tracking-widest text-navy/70 mb-1.5"
            >
              Programme duration
            </label>
            {durationLocked ? (
              <>
                <input
                  id="programme_duration_days"
                  name="programme_duration_days"
                  value={currentDuration}
                  readOnly
                  className="w-full px-3 py-2 border border-navy/20 rounded-md text-sm bg-navy/5 text-navy/60 cursor-not-allowed"
                />
                <p className="text-xs text-navy/50 mt-1">
                  Locked — first session created. Duration can only be changed
                  before the first phase event.
                </p>
              </>
            ) : (
              <>
                <select
                  id="programme_duration_days"
                  name="programme_duration_days"
                  defaultValue={String(currentDuration)}
                  className="w-full px-3 py-2 border border-navy/20 rounded-md text-sm bg-white"
                >
                  <option value="30">30 days</option>
                  <option value="60">60 days</option>
                  <option value="90">90 days</option>
                </select>
                <p className="text-xs text-navy/50 mt-1">
                  Chapter-defined per PRD §1.1. Locks once the first session is
                  created.
                </p>
              </>
            )}
          </div>
          {/* ─── Finale dates ──────────────────────────────────── */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label
                htmlFor="finale_start_date"
                className="block text-xs font-semibold uppercase tracking-widest text-navy/70 mb-1.5"
              >
                Finale start date
              </label>
              <input
                id="finale_start_date"
                name="finale_start_date"
                type="date"
                defaultValue={chapter?.finale_start_date ?? ""}
                className="w-full px-3 py-2 border border-navy/20 rounded-md text-sm bg-white"
              />
            </div>
            <div>
              <label
                htmlFor="finale_end_date"
                className="block text-xs font-semibold uppercase tracking-widest text-navy/70 mb-1.5"
              >
                Finale end date
              </label>
              <input
                id="finale_end_date"
                name="finale_end_date"
                type="date"
                defaultValue={chapter?.finale_end_date ?? ""}
                className="w-full px-3 py-2 border border-navy/20 rounded-md text-sm bg-white"
              />
            </div>
          </div>
          <div className="flex justify-end pt-2">
            <button
              type="submit"
              className="px-4 py-2 rounded-md bg-navy text-ivory text-sm font-semibold hover:bg-navy-dark"
            >
              Save profile
            </button>
          </div>
        </ActionResultForm>
      </section>

      {/* ─── Core team ──────────────────────────────────────────── */}
      <section className="bg-white border border-navy/10 rounded-lg p-6">
        <div className="flex items-start justify-between mb-5">
          <div>
            <h3 className="text-lg font-bold text-navy">
              Core team (4 roles)
            </h3>
            <p className="text-xs text-navy/60 mt-1">
              Event Lead · Outreach Lead · Mentorship & Content Lead · Ops &
              Documentation Lead
            </p>
          </div>
          <div className="text-xs font-semibold">
            {core.length === 4 ? (
              <span className="text-yi-green">✓ COMPLETE</span>
            ) : (
              <span className="text-navy/40">
                {core.length}/4 filled
              </span>
            )}
          </div>
        </div>

        <div className="space-y-2 mb-6">
          {core.map((m) => (
            <div
              key={m.id}
              className="flex items-center justify-between p-3 border border-navy/10 rounded-md"
            >
              <div className="flex-1">
                <div className="flex items-center gap-2">
                  <span className="font-semibold text-navy">
                    {m.full_name}
                  </span>
                  {m.user_id && (
                    <span className="text-[10px] font-semibold text-yi-green">
                      ✓ Linked to auth
                    </span>
                  )}
                </div>
                <div className="text-xs text-navy/60">
                  <span className="font-mono">
                    {CORE_TEAM_ROLE_LABELS[
                      m.role as keyof typeof CORE_TEAM_ROLE_LABELS
                    ] ?? m.role}
                  </span>
                  {m.email && <span> · {m.email}</span>}
                  {m.phone && <span> · {m.phone}</span>}
                </div>
              </div>
              {(m.role as string) === "chapter_chair" ||
              (m.role as string) === "chapter_co_chair" ? (
                <span
                  className="text-xs text-navy/40"
                  title="Chapter chairs are managed in the Directory — they can't be removed from the team screen."
                >
                  Managed in Directory
                </span>
              ) : (
                <form action={removeMember}>
                  <input type="hidden" name="id" value={m.id} />
                  <button
                    type="submit"
                    className="text-xs text-red-600/70 hover:text-red-600"
                  >
                    Remove
                  </button>
                </form>
              )}
            </div>
          ))}
          {core.length === 0 && (
            <div className="text-center py-8 text-sm text-navy/40">
              No core team members yet. Add all four below.
            </div>
          )}
        </div>

        {/* Add new */}
        <div className="pt-5 border-t border-navy/10">
          <h4 className="text-sm font-bold text-navy mb-3">Add member</h4>
          <form action={addMember} className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <input
                name="full_name"
                placeholder="Full name *"
                required
                className="px-3 py-2 border border-navy/20 rounded-md text-sm"
              />
              <select
                name="role"
                required
                defaultValue=""
                className="px-3 py-2 border border-navy/20 rounded-md text-sm bg-white"
              >
                <option value="" disabled>
                  — pick role —
                </option>
                {CORE_TEAM_ROLES.map((r) => (
                  <option
                    key={r}
                    value={r}
                    disabled={filledRoles.has(r)}
                  >
                    {CORE_TEAM_ROLE_LABELS[r]}
                    {filledRoles.has(r) ? " (filled)" : ""}
                  </option>
                ))}
              </select>
              <input
                name="email"
                type="email"
                placeholder="Email (auto-links if user exists)"
                className="px-3 py-2 border border-navy/20 rounded-md text-sm"
              />
              <input
                name="phone"
                type="tel"
                placeholder="Phone"
                className="px-3 py-2 border border-navy/20 rounded-md text-sm"
              />
            </div>
            <div className="flex justify-end">
              <button
                type="submit"
                disabled={missingRoles.length === 0}
                className="px-4 py-2 rounded-md bg-navy text-ivory text-sm font-semibold hover:bg-navy-dark disabled:opacity-40"
              >
                Add
              </button>
            </div>
          </form>
        </div>
      </section>
    </div>
  );
}
