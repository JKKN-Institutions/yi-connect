/**
 * PUBLIC Mentor YUVA Network showcase (Phase 6).
 * Spec: docs/yi-youth-academy-spec.md → "Mentor YUVA Network (public)"
 * (/youth-academy/mentors — already public in middleware).
 *
 * Renders ANONYMOUSLY via service-client RSC: ALL active mentors with
 * is_public profiles, across chapters (photo, name, expertise, organization,
 * chapter). Mentors with is_public=false or a deactivated role are hidden;
 * zero public mentors ⇒ branded empty state.
 */

import Image from "next/image";
import Link from "next/link";
import { ArrowLeft, Users } from "lucide-react";
import { YUVA_APP, ROLE_MENTOR } from "@/lib/yuva/constants";
import { publicUrl } from "@/lib/yuva/storage";
import { PartnerLogos } from "@/components/yuva/partner-logos";
import { createServiceClient as createYuvaService } from "@/lib/yuva/supabase/service";
// yip server module's Database type includes the yi_directory schema (donor
// cross-schema access path — app/yip/actions/chapter-roles.ts).
import { createServiceClient as createDirService } from "@/lib/yip/supabase/server";
import {
  MentorCard,
  type MentorCardData,
} from "@/components/yuva/mentors/mentor-card";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Mentor YUVA Network",
  description:
    "Meet the mentors of the Yi Youth Academy — industry leaders and practitioners delivering cohort-based certificate programs across the Yi YUVA network.",
};

type PersonEmbed = {
  full_name: string;
  is_active: boolean | null;
};

export default async function PublicMentorNetworkPage() {
  // 1. Active mentor roles across ALL chapters (canonical: yi_directory).
  const dir = await createDirService();
  const { data: roleRows } = await dir
    .schema("yi_directory")
    .from("role_assignments")
    .select("person_id, yi_chapter, person:people!inner(full_name, is_active)")
    .eq("app", YUVA_APP)
    .eq("role", ROLE_MENTOR)
    .eq("is_active", true);

  // A multi-chapter mentor has one role row per chapter — fold to one card.
  const byPerson = new Map<string, { name: string; chapters: string[] }>();
  for (const r of roleRows ?? []) {
    const person = r.person as unknown as PersonEmbed;
    if (!person || person.is_active === false) continue;
    const entry = byPerson.get(r.person_id) ?? {
      name: person.full_name,
      chapters: [],
    };
    const ch = (r.yi_chapter ?? "").trim();
    if (ch && !entry.chapters.includes(ch)) entry.chapters.push(ch);
    byPerson.set(r.person_id, entry);
  }

  // 2. PUBLIC profiles only (is_public=true) — the showcase filter.
  let mentors: MentorCardData[] = [];
  const personIds = Array.from(byPerson.keys());
  if (personIds.length > 0) {
    const yuva = await createYuvaService();
    const { data: profiles } = await yuva
      .from("mentor_profiles")
      .select("person_id, bio, expertise, organization, photo_storage_path, updated_at")
      .in("person_id", personIds)
      .eq("is_public", true);

    mentors = (profiles ?? [])
      .flatMap((p): MentorCardData[] => {
        const identity = byPerson.get(p.person_id);
        if (!identity) return [];
        return [
          {
            personId: p.person_id,
            name: identity.name,
            chapters: identity.chapters.sort((a, b) => a.localeCompare(b)),
            organization: p.organization,
            expertise: p.expertise ?? [],
            bio: p.bio,
            photoUrl: p.photo_storage_path
              ? `${publicUrl(p.photo_storage_path)}?v=${Date.parse(p.updated_at) || 0}`
              : null,
          },
        ];
      })
      .sort((a, b) => a.name.localeCompare(b.name));
  }

  return (
    <main className="min-h-screen bg-slate-50">
      {/* Branded header */}
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto max-w-6xl px-6 py-10">
          <Link
            href="/youth-academy"
            className="inline-flex items-center gap-2 text-slate-600 transition-opacity hover:opacity-80"
            aria-label="Back to Yi Youth Academy"
          >
            <ArrowLeft className="size-4" />
            <Image
              src="/youth-academy/academy-logo.jpg"
              alt="Yi Youth Academy"
              width={1200}
              height={593}
              className="h-9 w-auto"
            />
          </Link>
          <PartnerLogos variant="onLight" className="mt-4" />
          <h1 className="mt-4 text-3xl font-bold text-slate-900 sm:text-4xl">
            Mentor YUVA Network
          </h1>
          <div className="mt-4 max-w-3xl space-y-3 text-slate-600">
            <p>
              The Mentor YUVA Network is the backbone of the Yi Youth Academy,
              connecting students with industry leaders, entrepreneurs,
              professionals, academicians, and Yi members who mentor and inspire
              future leaders.
            </p>
            <p>
              Through mentoring, expert interactions, coaching, and career
              conversations, students gain real-world insights, leadership
              skills, professional networks, and guidance to become responsible
              changemakers.
            </p>
          </div>
        </div>
      </header>

      <section className="mx-auto max-w-6xl px-6 py-10">
        {mentors.length === 0 ? (
          <div className="mx-auto max-w-md rounded-xl border border-dashed border-slate-300 bg-white p-12 text-center">
            <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-xl bg-amber-500/10">
              <Users className="size-6 text-amber-600" />
            </div>
            <h2 className="mt-4 text-lg font-semibold text-slate-900">
              Mentors coming soon
            </h2>
            <p className="mt-2 text-sm text-slate-600">
              Yi chapters are building the Mentor YUVA Network right now. Check
              back shortly to meet the people behind the programs.
            </p>
            <Link
              href="/youth-academy"
              className="mt-6 inline-flex items-center justify-center rounded-lg bg-slate-900 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-slate-800"
            >
              Explore programs
            </Link>
          </div>
        ) : (
          <>
            <p className="mb-6 text-sm text-slate-500">
              {mentors.length} mentor{mentors.length === 1 ? "" : "s"} across
              the network
            </p>
            <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
              {mentors.map((mentor) => (
                <MentorCard key={mentor.personId} mentor={mentor} />
              ))}
            </div>
          </>
        )}
      </section>
    </main>
  );
}
