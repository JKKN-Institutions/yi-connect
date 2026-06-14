/**
 * Yi Youth Academy — PUBLIC landing page (Phase 8, replaces the Phase 0
 * placeholder). Spec: docs/yi-youth-academy-spec.md → "Public landing page".
 *
 * Anonymous render via service-client RSC with explicit status filters (the
 * yuva schema has NO anon grants — this is the designed pattern). Sections:
 * hero (concept-note positioning) → published-runs grid with category/city
 * filters (searchParams-driven, server-rendered link-chips) → "Our Network"
 * active-academies showcase → Mentor YUVA Network link card.
 */

import Image from "next/image";
import Link from "next/link";
import { BookOpen, GraduationCap, Sparkles, Users } from "lucide-react";
import {
  CATEGORY_LABELS,
  PROGRAM_CATEGORIES,
  type ProgramCategory,
} from "@/lib/yuva/constants";
import {
  fetchActiveAcademiesPublic,
  fetchPublicRuns,
} from "@/components/yuva/public/data";
import { AcademyNetworkSection } from "@/components/yuva/public/academy-network-section";
import { PublicRunCard } from "@/components/yuva/public/run-card";
import { PartnerLogos } from "@/components/yuva/partner-logos";
import { redirect } from "next/navigation";
import { getYuvaAccess } from "@/lib/yuva/auth/yuva-access";

export const dynamic = "force-dynamic";

function filterHref(
  category: string | null,
  city: string | null
): string {
  const params = new URLSearchParams();
  if (category) params.set("category", category);
  if (city) params.set("city", city);
  const qs = params.toString();
  return qs ? `/youth-academy?${qs}` : "/youth-academy";
}

function Chip({
  href,
  active,
  children,
}: {
  href: string;
  active: boolean;
  children: React.ReactNode;
}) {
  return (
    <Link
      href={href}
      className={
        active
          ? "inline-flex items-center rounded-full bg-slate-900 px-3 py-1 text-sm font-medium text-white"
          : "inline-flex items-center rounded-full border border-slate-200 bg-white px-3 py-1 text-sm font-medium text-slate-600 hover:border-slate-300 hover:text-slate-900"
      }
    >
      {children}
    </Link>
  );
}

export default async function YouthAcademyLandingPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  // Signed-in STAFF should land on their dashboard, not this public marketing
  // page. The staff-login route can't read the just-set session cookie within
  // its own request, so the forward happens here on the next request. Anonymous
  // visitors and non-staff (incl. students, who use a separate session) fall
  // through to the public landing below. (redirect() throws — keep it before any
  // try/catch.)
  const access = await getYuvaAccess();
  if (access.isNational) redirect("/youth-academy/national");
  if (access.chapterAdminOf !== null || access.coordinatorAcademyIds.length > 0) {
    redirect("/youth-academy/chapter");
  }

  const sp = await searchParams;
  const rawCategory = typeof sp.category === "string" ? sp.category : null;
  const activeCategory = (PROGRAM_CATEGORIES as readonly string[]).includes(
    rawCategory ?? ""
  )
    ? (rawCategory as ProgramCategory)
    : null;
  const activeCity = typeof sp.city === "string" ? sp.city : null;

  const [allRuns, academies] = await Promise.all([
    fetchPublicRuns(),
    fetchActiveAcademiesPublic(),
  ]);

  // Filter option lists come from what's actually on offer.
  const categories = [
    ...new Set(allRuns.map((r) => r.program_category)),
  ].sort((a, b) => CATEGORY_LABELS[a].localeCompare(CATEGORY_LABELS[b]));
  const cities = [
    ...new Set(
      allRuns.map((r) => r.city).filter((c): c is string => !!c)
    ),
  ].sort((a, b) => a.localeCompare(b));

  const runs = allRuns.filter(
    (r) =>
      (!activeCategory || r.program_category === activeCategory) &&
      (!activeCity || r.city === activeCity)
  );

  return (
    <main className="min-h-screen bg-slate-50">
      {/* ── Hero ─────────────────────────────────────────────────────── */}
      <header className="bg-[#0f2557] text-white">
        <div className="mx-auto max-w-6xl px-6 py-16 sm:py-20">
          {/* Academy brand mark — the logo carries the name visually; the
              <h1> below is sr-only so the heading is not read twice. */}
          <div className="inline-flex rounded-2xl bg-white px-6 py-4 shadow-sm">
            <Image
              src="/youth-academy/academy-logo.jpg"
              alt="Yi Youth Academy"
              width={1200}
              height={593}
              priority
              className="h-14 w-auto sm:h-20"
            />
          </div>
          <h1 className="sr-only">Yi Youth Academy</h1>
          <p className="mt-6 max-w-2xl text-lg text-slate-200">
            A thought, leadership and action space inside your campus —
            cohort-based certificate programs in Entrepreneurship, Innovation
            &amp; Learning, delivered by Yi chapters and the Mentor YUVA
            Network for students across India.
          </p>
          <div className="mt-8 flex flex-wrap gap-3">
            <a
              href="#programs"
              className="inline-flex items-center gap-2 rounded-lg bg-amber-500 px-5 py-2.5 text-sm font-semibold text-slate-900 transition-colors hover:bg-amber-400"
            >
              <GraduationCap className="size-4" />
              Browse programs
            </a>
            <Link
              href="/youth-academy/mentors"
              className="inline-flex items-center gap-2 rounded-lg border border-white/30 px-5 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-white/10"
            >
              <Users className="size-4" />
              Meet our mentors
            </Link>
            <Link
              href="/youth-academy/guide"
              className="inline-flex items-center gap-2 rounded-lg border border-white/30 px-5 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-white/10"
            >
              <BookOpen className="size-4" />
              How it works
            </Link>
          </div>
          {/* "An initiative of" — governing-body endorsement strip. */}
          <div className="mt-12">
            <p className="mb-3 text-xs font-semibold uppercase tracking-widest text-slate-300/80">
              An initiative of
            </p>
            <PartnerLogos variant="onDark" />
          </div>
        </div>
      </header>

      {/* ── About the Academy ────────────────────────────────────────── */}
      <section className="border-b border-slate-200 bg-white">
        <div className="mx-auto max-w-3xl px-6 py-14">
          <p className="text-sm font-semibold uppercase tracking-widest text-amber-600">
            About the Academy
          </p>
          <h2 className="mt-2 text-2xl font-bold text-slate-900 sm:text-3xl">
            A thought, leadership &amp; action space
          </h2>
          <div className="mt-5 space-y-4 text-base leading-relaxed text-slate-600">
            <p>
              The Yi Youth Academy is an open-access platform for students
              within the Yi YUVA network. It serves as a dedicated intellectual
              and leadership space within partner Institutions of Higher
              Education (IHEs), designed to nurture responsible youth leadership
              aligned with Yi&rsquo;s nation-building agenda.
            </p>
            <p>
              More than a conventional classroom or laboratory, the Academy is a
              space for thought, leadership, and action &mdash; driven by ideas,
              dialogue, collaboration, and measurable outcomes.
            </p>
            <p>
              Through cohort-based certificate programs, students gain exposure
              to entrepreneurship, innovation, leadership, and Yi&rsquo;s
              nation-building initiatives. The Academy empowers young leaders to
              develop future-ready skills, build meaningful networks, and
              contribute actively to India&rsquo;s growth and development.
            </p>
          </div>
        </div>
      </section>

      {/* ── Programs grid ────────────────────────────────────────────── */}
      <section id="programs" className="mx-auto max-w-6xl px-6 py-14">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="text-sm font-semibold tracking-widest text-amber-600 uppercase">
              Programs
            </p>
            <h2 className="mt-2 text-2xl font-bold text-slate-900 sm:text-3xl">
              Open &amp; upcoming cohorts
            </h2>
          </div>
          <Link
            href="/youth-academy/login"
            className="text-sm font-medium text-slate-500 underline-offset-2 hover:text-slate-900 hover:underline"
          >
            Already accepted? Log in →
          </Link>
        </div>

        {(categories.length > 0 || cities.length > 0) && (
          <div className="mt-6 space-y-3">
            {categories.length > 0 && (
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-xs font-semibold uppercase tracking-wide text-slate-400">
                  Category
                </span>
                <Chip
                  href={filterHref(null, activeCity)}
                  active={!activeCategory}
                >
                  All
                </Chip>
                {categories.map((c) => (
                  <Chip
                    key={c}
                    href={filterHref(
                      activeCategory === c ? null : c,
                      activeCity
                    )}
                    active={activeCategory === c}
                  >
                    {CATEGORY_LABELS[c]}
                  </Chip>
                ))}
              </div>
            )}
            {cities.length > 0 && (
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-xs font-semibold uppercase tracking-wide text-slate-400">
                  City
                </span>
                <Chip
                  href={filterHref(activeCategory, null)}
                  active={!activeCity}
                >
                  All
                </Chip>
                {cities.map((city) => (
                  <Chip
                    key={city}
                    href={filterHref(
                      activeCategory,
                      activeCity === city ? null : city
                    )}
                    active={activeCity === city}
                  >
                    {city}
                  </Chip>
                ))}
              </div>
            )}
          </div>
        )}

        {runs.length === 0 ? (
          <div className="mx-auto mt-10 max-w-md rounded-xl border border-dashed border-slate-300 bg-white p-12 text-center">
            <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-xl bg-amber-500/10">
              <Sparkles className="size-6 text-amber-600" />
            </div>
            <h3 className="mt-4 text-lg font-semibold text-slate-900">
              {allRuns.length === 0
                ? "Programs coming soon"
                : "No programs match those filters"}
            </h3>
            <p className="mt-2 text-sm text-slate-600">
              {allRuns.length === 0
                ? "Yi chapters are scheduling the first cohorts right now. Check back shortly — or meet the network below."
                : "Try clearing a filter to see every open and upcoming cohort."}
            </p>
            {allRuns.length > 0 && (
              <Link
                href="/youth-academy"
                className="mt-6 inline-flex items-center justify-center rounded-lg bg-slate-900 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-slate-800"
              >
                Clear filters
              </Link>
            )}
          </div>
        ) : (
          <div className="mt-8 grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {runs.map((run) => (
              <PublicRunCard key={run.id} run={run} />
            ))}
          </div>
        )}
      </section>

      {/* ── Our Network ──────────────────────────────────────────────── */}
      <AcademyNetworkSection academies={academies} />

      {/* ── Mentor YUVA Network link card ────────────────────────────── */}
      <section className="mx-auto max-w-6xl px-6 py-14">
        <Link
          href="/youth-academy/mentors"
          className="group flex flex-col items-start justify-between gap-6 rounded-2xl bg-[#0f2557] p-8 text-white transition-shadow hover:shadow-lg sm:flex-row sm:items-center"
        >
          <div>
            <p className="text-sm font-semibold tracking-widest text-amber-400 uppercase">
              Mentor YUVA Network
            </p>
            <h2 className="mt-2 text-2xl font-bold">
              Learn from the people who&apos;ve done it
            </h2>
            <p className="mt-2 max-w-xl text-slate-300">
              Industry leaders, founders and practitioners deliver every Yi
              Youth Academy session — meet the mentors behind the programs.
            </p>
          </div>
          <span className="inline-flex shrink-0 items-center gap-2 rounded-lg bg-amber-500 px-5 py-2.5 text-sm font-semibold text-slate-900 transition-colors group-hover:bg-amber-400">
            <Users className="size-4" />
            Explore the network
          </span>
        </Link>
      </section>

      <footer className="border-t border-slate-200 bg-white">
        <div className="mx-auto max-w-6xl px-6 py-8 text-sm text-slate-500">
          Yi Youth Academy · an initiative of Yi YUVA — Young Indians (CII)
        </div>
      </footer>
    </main>
  );
}
