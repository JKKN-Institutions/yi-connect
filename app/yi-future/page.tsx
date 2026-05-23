import Image from "next/image";
import Link from "next/link";
import { createServiceClient } from "@/lib/yi-future/supabase/server";
import { getLiveCounts } from "@/app/yi-future/actions/gamification";
import { CountUp } from "@/components/ui/count-up";
import { BrandStrip } from "@/components/yi-future/brand/BrandHeader";

// ─── Types ────────────────────────────────────────────────────────────────

type TrackCard = {
  id: string;
  slug: string;
  name: string;
  description: string | null;
  color_hex: string | null;
  icon: string | null;
  display_order: number | null;
};

type FinaleCity = {
  id: string;
  name: string;
  region_label: string;
};

// ─── Data fetchers (server, future.* schema) ──────────────────────────────

async function getTracks(): Promise<TrackCard[]> {
  const svc = await createServiceClient();
  const { data: edition } = await svc
    .schema("future")
    .from("editions")
    .select("id")
    .eq("slug", "2026")
    .maybeSingle();
  if (!edition) return [];
  const editionId = (edition as { id: string }).id;
  const { data } = await svc
    .schema("future")
    .from("tracks")
    .select("id, slug, name, description, color_hex, icon, display_order")
    .eq("edition_id", editionId)
    .order("display_order", { ascending: true });
  return (data as unknown as TrackCard[]) ?? [];
}

// Finale host cities are fixed for 2026 [HPB §2] — static list.
// When the DB has an is_finale_host flag, this can be replaced with a query.
function getFinaleHosts(): FinaleCity[] {
  return [
    { id: "1", name: "Hosur", region_label: "SRTN" },
    { id: "2", name: "Kochi", region_label: "SRTKKA" },
    { id: "3", name: "Jaipur", region_label: "NR" },
    { id: "4", name: "Bhavnagar", region_label: "WR" },
    { id: "5", name: "Raipur", region_label: "ER + NER" },
  ];
}

// ─── Static data ─────────────────────────────────────────────────────────

const TRACK_BG_FALLBACKS: Record<string, string> = {
  climate_change: "#138808",
  road_safety: "#FF9933",
  accessibility: "#1a1a3e",
  public_health: "#F5A623",
};

const VALUE_PROPS = [
  {
    icon: "🧭",
    title: "Industry mentors, not classroom theory",
    body: "Every team is paired with a practitioner — a policymaker, entrepreneur, or sector expert who guides your solution through real constraints.",
  },
  {
    icon: "🏛️",
    title: "Pitch to a national jury",
    body: "Make it past your Chapter Final and you present in front of a national jury at one of 5 Track Finals across India.",
  },
  {
    icon: "📜",
    title: "Your idea goes into national policy",
    body: "Top solutions are consolidated into a national Whitepaper submitted to government and industry. Your work doesn't die in a slide deck.",
  },
  {
    icon: "🚀",
    title: "Win opportunities, not just trophies",
    body: "Corporate partners at the finale offer internships, fellowships, and visibility to the best teams — no vague 'certificates'.",
  },
];

const JOURNEY_STEPS = [
  {
    number: "01",
    title: "Pick a Problem",
    body: "All 4 tracks run at every chapter. Pick the problem statement you care about — climate, road safety, accessibility, or health.",
    phase: "Month 1",
  },
  {
    number: "02",
    title: "Build Your Solution",
    body: "90 days of mentorship clinics, policy workshops, expert talks, and peer reviews. You build a real, grounded solution.",
    phase: "Month 2",
  },
  {
    number: "03",
    title: "Compete Locally",
    body: "Chapter Final: your city's best teams present in front of a jury. Top teams advance to the national stage.",
    phase: "Month 3",
  },
  {
    number: "04",
    title: "Go National",
    body: "5 National Track Finals. 2 days of learning + competition. Winners co-author India's youth policy roadmap.",
    phase: "Finals",
  },
];

const FAQS: { q: string; a: string }[] = [
  {
    q: "Who can participate?",
    a: "Any college student aged 18–25 from any Indian college. Yi YUVA membership is not required. If you have a Yi chapter in your city, register through them. If not, reach out to yi.national@cii.in.",
  },
  {
    q: "Do I need a full team to register?",
    a: "No. You can register solo and form a team later. Teams are 1–5 members and your chapter's core team will help you find co-participants.",
  },
  {
    q: "Is there a registration or participation fee?",
    a: "No. Future 6.0 is fully free to participate. The program is supported by Yi chapters and corporate partners.",
  },
  {
    q: "What happens if my team doesn't advance to nationals?",
    a: "Your Chapter Final still counts. You will have worked through a real problem statement, received mentorship, and presented to an industry jury — that's a rare experience at any stage.",
  },
  {
    q: "Can our college nominate teams directly?",
    a: "Colleges participate through the Yi chapter in their city. Talk to your Yi chapter lead or email yi.national@cii.in to find the chapter nearest to your college.",
  },
  {
    q: "What if there's no Yi chapter in my city?",
    a: "Email yi.national@cii.in — Yi is actively onboarding new chapters for 2026, and there may be a remote or adjacent chapter that can accommodate you.",
  },
  {
    q: "What does winning at nationals actually mean?",
    a: "Your solution is featured in the track's national Whitepaper. You receive recognition from CII and Yi YUVA at a national stage. Corporate partners may offer internships or project opportunities. Past winners have gone on to policy fellowships and startup programs.",
  },
];

// ─── Page ─────────────────────────────────────────────────────────────────

export default async function Home() {
  const [tracks, counts] = await Promise.all([
    getTracks(),
    getLiveCounts("2026"),
  ]);
  const finaleHosts = getFinaleHosts();

  const showCounters =
    counts.delegatesTotal > 0 ||
    counts.chaptersActive > 0 ||
    counts.teamsCount > 0;

  return (
    <main className="min-h-screen bg-ivory overflow-x-hidden">
      {/* ─── 1. Top Brand Header ──────────────────────────────────────── */}
      <header
        className="sticky top-0 z-50 w-full"
        style={{ background: "#1a1a3e", borderBottom: "1px solid rgba(245,166,35,0.2)" }}
      >
        <div className="max-w-6xl mx-auto px-4 py-3 flex items-center justify-between gap-4">
          <Link href="/" aria-label="Future 6.0 home">
            <Image
              src="/yi-future/future-6-logo.png"
              alt="Future 6.0 by Yi YUVA"
              width={200}
              height={60}
              className="h-12 w-auto object-contain"
              priority
            />
          </Link>
          <nav className="hidden md:flex items-center gap-6">
            <a href="#tracks" className="text-sm font-medium text-white/70 hover:text-yi-gold transition-colors">Tracks</a>
            <a href="#journey" className="text-sm font-medium text-white/70 hover:text-yi-gold transition-colors">Journey</a>
            <a href="#finale" className="text-sm font-medium text-white/70 hover:text-yi-gold transition-colors">Nationals</a>
            <a href="#faq" className="text-sm font-medium text-white/70 hover:text-yi-gold transition-colors">FAQ</a>
            <Link
              href="/yi-future/join"
              className="inline-flex items-center justify-center px-5 py-2 rounded-md text-sm font-semibold transition-colors"
              style={{ background: "#F5A623", color: "#1a1a3e" }}
            >
              Register now
            </Link>
          </nav>
          {/* Mobile register CTA */}
          <Link
            href="/yi-future/join"
            className="md:hidden inline-flex items-center justify-center px-4 py-1.5 rounded-md text-sm font-semibold"
            style={{ background: "#F5A623", color: "#1a1a3e" }}
          >
            Register
          </Link>
        </div>
      </header>

      {/* ─── 2. Hero ──────────────────────────────────────────────────── */}
      <section
        className="relative px-4 pt-20 pb-24 overflow-hidden"
        style={{
          background: "linear-gradient(160deg, #1a1a3e 0%, #0f0f28 55%, #1a2b1a 100%)",
        }}
      >
        {/* Decorative gradient orbs */}
        <div
          aria-hidden="true"
          className="absolute top-0 right-0 w-[600px] h-[600px] rounded-full opacity-10 pointer-events-none"
          style={{
            background: "radial-gradient(circle, #F5A623 0%, transparent 70%)",
            transform: "translate(30%, -30%)",
          }}
        />
        <div
          aria-hidden="true"
          className="absolute bottom-0 left-0 w-[400px] h-[400px] rounded-full opacity-10 pointer-events-none"
          style={{
            background: "radial-gradient(circle, #138808 0%, transparent 70%)",
            transform: "translate(-30%, 30%)",
          }}
        />

        <div className="relative max-w-4xl mx-auto text-center">
          {/* Eyebrow */}
          <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full mb-8 text-xs font-bold tracking-widest uppercase"
            style={{ background: "rgba(245,166,35,0.15)", color: "#F5A623", border: "1px solid rgba(245,166,35,0.3)" }}>
            <span className="h-1.5 w-1.5 rounded-full bg-yi-gold animate-pulse" />
            Yi YUVA · 2026 Edition · Registrations Open
          </div>

          {/* Main headline */}
          <h1 className="text-5xl sm:text-6xl md:text-7xl lg:text-8xl font-black tracking-tight text-white leading-[1.0] mb-6">
            India&apos;s{" "}
            <span
              style={{
                background: "linear-gradient(90deg, #F5A623, #FF9933, #F5A623)",
                backgroundClip: "text",
                WebkitBackgroundClip: "text",
                WebkitTextFillColor: "transparent",
              }}
            >
              Youth.
            </span>
            <br />
            India&apos;s{" "}
            <span
              style={{
                background: "linear-gradient(90deg, #138808, #4caf50, #138808)",
                backgroundClip: "text",
                WebkitBackgroundClip: "text",
                WebkitTextFillColor: "transparent",
              }}
            >
              Solutions.
            </span>
          </h1>

          {/* Sub-headline */}
          <p className="text-base sm:text-lg md:text-xl text-white/75 max-w-2xl mx-auto leading-relaxed mb-4">
            Future 6.0 is a 60–90 day mentored journey where college students
            stop writing opinions and start shipping policy.
          </p>
          <p className="text-sm text-white/50 max-w-xl mx-auto mb-10">
            This is not just another competition. This is where ideas meet action.
          </p>

          {/* CTAs */}
          <div className="flex flex-col sm:flex-row gap-3 justify-center mb-16">
            <Link
              href="/yi-future/join"
              className="inline-flex items-center justify-center px-8 py-4 rounded-lg text-base font-bold transition-all hover:scale-105 active:scale-100"
              style={{ background: "linear-gradient(135deg, #F5A623, #FF9933)", color: "#1a1a3e" }}
            >
              Register as a delegate →
            </Link>
            <Link
              href="/yi-future/unlock"
              className="inline-flex items-center justify-center px-8 py-4 rounded-lg text-base font-semibold transition-colors"
              style={{ border: "1px solid rgba(255,255,255,0.2)", color: "rgba(255,255,255,0.85)" }}
            >
              Have a code? Unlock →
            </Link>
            <Link
              href="/yi-future/about"
              className="inline-flex items-center justify-center px-8 py-4 rounded-lg text-base font-semibold transition-colors"
              style={{ border: "1px solid rgba(255,255,255,0.2)", color: "rgba(255,255,255,0.85)" }}
            >
              Read the playbook
            </Link>
          </div>

          {/* Live counters */}
          {showCounters && (
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 max-w-2xl mx-auto">
              {[
                { value: counts.delegatesTotal, label: "Delegates", color: "#F5A623" },
                { value: counts.chaptersActive, label: "Chapters live", color: "#FF9933" },
                { value: counts.teamsCount, label: "Teams formed", color: "#138808" },
                { value: counts.problemsPicked, label: "Problems picked", color: "#7b8fff" },
              ].map(({ value, label, color }) => (
                <div
                  key={label}
                  className="rounded-xl py-4 px-3 text-center"
                  style={{ background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.1)" }}
                >
                  <div className="text-3xl font-extrabold" style={{ color }}>
                    <CountUp to={value} />
                  </div>
                  <div className="text-[11px] text-white/50 uppercase tracking-wider mt-1">{label}</div>
                </div>
              ))}
            </div>
          )}
        </div>
      </section>

      {/* ─── 3. Value Props ───────────────────────────────────────────── */}
      <section className="px-4 py-20 max-w-6xl mx-auto">
        <div className="text-center mb-12">
          <p className="text-xs font-bold tracking-widest uppercase mb-3" style={{ color: "#FF9933" }}>
            Why Future 6.0
          </p>
          <h2 className="text-3xl sm:text-4xl font-black text-navy leading-tight">
            This is not just another competition.
          </h2>
          <p className="mt-3 text-navy/60 max-w-xl mx-auto text-sm sm:text-base">
            Most student programs end with a certificate. This one starts there.
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
          {VALUE_PROPS.map((vp) => (
            <div
              key={vp.title}
              className="group relative rounded-2xl p-6 transition-all hover:-translate-y-1 hover:shadow-xl"
              style={{ background: "white", border: "1px solid rgba(26,26,62,0.08)" }}
            >
              <div className="text-4xl mb-4">{vp.icon}</div>
              <h3 className="text-base font-bold text-navy mb-2 leading-snug">{vp.title}</h3>
              <p className="text-sm text-navy/60 leading-relaxed">{vp.body}</p>
              {/* Subtle gold accent line on hover */}
              <div
                className="absolute bottom-0 left-6 right-6 h-0.5 rounded-full scale-x-0 group-hover:scale-x-100 transition-transform origin-left"
                style={{ background: "linear-gradient(90deg, #F5A623, #FF9933)" }}
              />
            </div>
          ))}
        </div>
      </section>

      {/* ─── 4. The 4 Tracks ─────────────────────────────────────────── */}
      <section id="tracks" className="px-4 py-20" style={{ background: "#f7f5ef" }}>
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-12">
            <p className="text-xs font-bold tracking-widest uppercase mb-3" style={{ color: "#FF9933" }}>
              The 4 National Tracks
            </p>
            <h2 className="text-3xl sm:text-4xl font-black text-navy leading-tight">
              Pick a problem that matters to you.
            </h2>
            <p className="mt-3 text-navy/60 max-w-xl mx-auto text-sm sm:text-base">
              Every chapter runs all 4 tracks. Pick the problem you care about — climate, road safety, accessibility, or health — and build your solution.
            </p>
          </div>

          {tracks.length === 0 ? (
            <div className="text-center text-navy/50 text-sm py-8">Tracks will be announced shortly.</div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
              {tracks.map((t) => {
                const trackColor = t.color_hex ?? TRACK_BG_FALLBACKS[t.slug] ?? "#1a1a3e";
                return (
                  <Link
                    key={t.id}
                    href={`/problems?track=${t.slug}`}
                    className="group block rounded-2xl overflow-hidden transition-all hover:-translate-y-1.5 hover:shadow-2xl"
                  >
                    {/* Color header bar */}
                    <div
                      className="h-2 w-full"
                      style={{ background: trackColor }}
                    />
                    <div
                      className="p-6"
                      style={{ background: "white", border: "1px solid rgba(26,26,62,0.08)", borderTop: "none" }}
                    >
                      <div className="text-4xl mb-4">{t.icon ?? "•"}</div>
                      <h3 className="text-lg font-black mb-2 leading-snug" style={{ color: trackColor }}>
                        {t.name}
                      </h3>
                      <p className="text-sm text-navy/65 leading-relaxed mb-4">
                        {t.description ?? ""}
                      </p>
                      <span
                        className="inline-flex items-center text-xs font-bold gap-1 transition-colors"
                        style={{ color: trackColor }}
                      >
                        View problems
                        <span className="group-hover:translate-x-0.5 transition-transform inline-block">→</span>
                      </span>
                    </div>
                  </Link>
                );
              })}
            </div>
          )}
        </div>
      </section>

      {/* ─── 5. 4-Step Journey ───────────────────────────────────────── */}
      <section id="journey" className="px-4 py-20" style={{ background: "#1a1a3e" }}>
        <div className="max-w-5xl mx-auto">
          <div className="text-center mb-14">
            <p className="text-xs font-bold tracking-widest uppercase mb-3" style={{ color: "#F5A623" }}>
              The Journey
            </p>
            <h2 className="text-3xl sm:text-4xl font-black text-white leading-tight">
              60–90 days. One clear path.
            </h2>
          </div>

          {/* Steps — horizontal on desktop, vertical on mobile */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-0 relative">
            {/* Connector line — desktop only */}
            <div
              aria-hidden="true"
              className="absolute hidden md:block top-8 left-[12.5%] right-[12.5%] h-px"
              style={{ background: "linear-gradient(90deg, rgba(245,166,35,0.2), rgba(245,166,35,0.6), rgba(19,136,8,0.4))" }}
            />

            {JOURNEY_STEPS.map((step, i) => (
              <div key={step.number} className="relative flex flex-col items-center text-center px-4 pb-8 md:pb-0">
                {/* Number badge */}
                <div
                  className="relative z-10 w-16 h-16 rounded-full flex items-center justify-center mb-5 text-lg font-black"
                  style={{
                    background: i < 2
                      ? "linear-gradient(135deg, #F5A623, #FF9933)"
                      : i === 2
                      ? "linear-gradient(135deg, #138808, #4caf50)"
                      : "linear-gradient(135deg, #7b8fff, #1a1a3e)",
                    color: i === 3 ? "white" : "#1a1a3e",
                    boxShadow: "0 4px 16px rgba(0,0,0,0.3)",
                  }}
                >
                  {step.number}
                </div>
                {/* Phase label */}
                <div
                  className="text-[10px] font-bold tracking-widest uppercase mb-2"
                  style={{ color: "rgba(245,166,35,0.6)" }}
                >
                  {step.phase}
                </div>
                <h3 className="text-base font-black text-white mb-2">{step.title}</h3>
                <p className="text-sm text-white/55 leading-relaxed">{step.body}</p>

                {/* Vertical connector — mobile only */}
                {i < JOURNEY_STEPS.length - 1 && (
                  <div
                    aria-hidden="true"
                    className="md:hidden w-px h-8 my-2"
                    style={{ background: "rgba(245,166,35,0.3)" }}
                  />
                )}
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ─── 6. Prelims vs Finale ─────────────────────────────────────── */}
      <section className="px-4 py-20 bg-ivory">
        <div className="max-w-4xl mx-auto">
          <div className="text-center mb-12">
            <p className="text-xs font-bold tracking-widest uppercase mb-3" style={{ color: "#FF9933" }}>
              Two Stages
            </p>
            <h2 className="text-3xl sm:text-4xl font-black text-navy leading-tight">
              Local finals → National stage.
            </h2>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Chapter Final */}
            <div
              className="rounded-2xl p-8"
              style={{ background: "white", border: "2px solid rgba(26,26,62,0.1)" }}
            >
              <div
                className="inline-block px-3 py-1 rounded-full text-xs font-bold mb-5"
                style={{ background: "rgba(245,166,35,0.12)", color: "#F5A623" }}
              >
                Stage 1
              </div>
              <h3 className="text-2xl font-black text-navy mb-1">Chapter Final</h3>
              <p className="text-sm text-navy/50 mb-6">Prelims — your city</p>
              <ul className="space-y-3">
                {[
                  "Held in your city by your Yi chapter",
                  "60–90 days of preparation",
                  "Up to 30 teams compete",
                  "Jury of industry + policy experts",
                  "Top teams advance to nationals",
                  "All participants receive recognition",
                ].map((item) => (
                  <li key={item} className="flex items-start gap-3 text-sm text-navy/75">
                    <span className="mt-0.5 text-yi-gold font-bold">✓</span>
                    {item}
                  </li>
                ))}
              </ul>
            </div>

            {/* National Track Final */}
            <div
              className="rounded-2xl p-8"
              style={{
                background: "linear-gradient(145deg, #1a1a3e, #0f0f28)",
                border: "2px solid rgba(245,166,35,0.25)",
              }}
            >
              <div
                className="inline-block px-3 py-1 rounded-full text-xs font-bold mb-5"
                style={{ background: "rgba(245,166,35,0.2)", color: "#F5A623" }}
              >
                Stage 2
              </div>
              <h3 className="text-2xl font-black text-white mb-1">National Track Final</h3>
              <p className="text-sm text-white/40 mb-6">Finale — 5 host cities</p>
              <ul className="space-y-3">
                {[
                  "5 host cities across India",
                  "~30 finalist teams per track",
                  "Day 1: masterclasses + keynotes",
                  "Day 2: live competition before national jury",
                  "Winners co-author the national Whitepaper",
                  "Corporate partners offer internships on-site",
                ].map((item) => (
                  <li key={item} className="flex items-start gap-3 text-sm text-white/70">
                    <span className="mt-0.5 text-yi-gold font-bold">✓</span>
                    {item}
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      </section>

      {/* ─── 7. Eligibility strip ─────────────────────────────────────── */}
      <div
        className="px-4 py-5"
        style={{ background: "linear-gradient(90deg, #F5A623, #FF9933)" }}
      >
        <div className="max-w-5xl mx-auto">
          <div className="flex flex-wrap justify-center gap-x-6 gap-y-2 text-center text-sm font-bold text-navy">
            {[
              "18–25 years",
              "All Indian colleges",
              "Team size 1–5",
              "No Yi YUVA membership required",
              "No registration fee",
            ].map((item, i) => (
              <span key={item} className="flex items-center gap-2">
                {i > 0 && <span className="hidden sm:inline opacity-40">·</span>}
                {item}
              </span>
            ))}
          </div>
        </div>
      </div>

      {/* ─── 9. Finale host cities ─────────────────────────────────────── */}
      <section id="finale" className="px-4 py-20 bg-ivory">
        <div className="max-w-5xl mx-auto">
          <div className="text-center mb-12">
            <p className="text-xs font-bold tracking-widest uppercase mb-3" style={{ color: "#FF9933" }}>
              5 National Track Finals
            </p>
            <h2 className="text-3xl sm:text-4xl font-black text-navy leading-tight">
              One of these cities could be yours.
            </h2>
            <p className="mt-3 text-navy/60 max-w-xl mx-auto text-sm sm:text-base">
              Finalists travel to their track&apos;s host city for a 2-day national conclave.
            </p>
          </div>

          <div className="flex gap-4 overflow-x-auto pb-4 snap-x snap-mandatory -mx-4 px-4 md:overflow-visible md:mx-0 md:px-0 md:grid md:grid-cols-5">
            {finaleHosts.map((city, i) => {
              const gradients = [
                "linear-gradient(145deg, #1a1a3e, #2d2d5c)",
                "linear-gradient(145deg, #138808, #0f5e0a)",
                "linear-gradient(145deg, #FF9933, #e6851a)",
                "linear-gradient(145deg, #1a1a3e, #0f0f28)",
                "linear-gradient(145deg, #F5A623, #d4891e)",
              ];
              const textColors = ["white", "white", "#1a1a3e", "white", "#1a1a3e"];
              return (
                <div
                  key={city.id}
                  className="flex-none w-44 md:w-auto snap-start rounded-2xl p-5 text-center transition-all hover:-translate-y-1 hover:shadow-lg"
                  style={{ background: gradients[i % gradients.length] }}
                >
                  <div
                    className="text-2xl font-black mb-1 leading-tight"
                    style={{ color: textColors[i % textColors.length] }}
                  >
                    {city.name}
                  </div>
                  {city.region_label && (
                    <div
                      className="text-xs font-bold tracking-wider uppercase px-2 py-0.5 rounded-full inline-block mt-1"
                      style={{
                        background: "rgba(255,255,255,0.15)",
                        color: textColors[i % textColors.length],
                        opacity: 0.8,
                      }}
                    >
                      {city.region_label}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* ─── 10. FAQ ──────────────────────────────────────────────────── */}
      <section id="faq" className="px-4 py-20" style={{ background: "#f7f5ef" }}>
        <div className="max-w-3xl mx-auto">
          <div className="text-center mb-12">
            <p className="text-xs font-bold tracking-widest uppercase mb-3" style={{ color: "#FF9933" }}>
              FAQ
            </p>
            <h2 className="text-3xl sm:text-4xl font-black text-navy leading-tight">
              Common questions.
            </h2>
          </div>

          <div className="space-y-3">
            {FAQS.map((faq, i) => (
              <details
                key={i}
                className="group rounded-xl overflow-hidden"
                style={{ background: "white", border: "1px solid rgba(26,26,62,0.08)" }}
              >
                <summary
                  className="flex items-center justify-between gap-4 px-6 py-4 cursor-pointer list-none select-none"
                  style={{ color: "#1a1a3e" }}
                >
                  <span className="text-sm font-bold pr-4">{faq.q}</span>
                  <span
                    className="flex-none text-xl font-light transition-transform group-open:rotate-45"
                    style={{ color: "#F5A623" }}
                    aria-hidden="true"
                  >
                    +
                  </span>
                </summary>
                <div
                  className="px-6 pb-5 pt-1 text-sm leading-relaxed"
                  style={{ color: "rgba(26,26,62,0.65)", borderTop: "1px solid rgba(26,26,62,0.06)" }}
                >
                  {faq.a}
                </div>
              </details>
            ))}
          </div>
        </div>
      </section>

      {/* ─── 11. Final CTA strip ──────────────────────────────────────── */}
      <section
        className="px-4 py-24 text-center"
        style={{
          background: "linear-gradient(160deg, #1a1a3e 0%, #0f0f28 60%, #1a1a0e 100%)",
        }}
      >
        <div className="max-w-2xl mx-auto">
          <h2 className="text-3xl sm:text-4xl font-black text-white mb-4 leading-tight">
            Ready?{" "}
            <span
              style={{
                background: "linear-gradient(90deg, #F5A623, #FF9933)",
                backgroundClip: "text",
                WebkitBackgroundClip: "text",
                WebkitTextFillColor: "transparent",
              }}
            >
              Your 90 days
            </span>{" "}
            start the moment you register.
          </h2>
          <p className="text-white/55 mb-10 text-sm sm:text-base max-w-md mx-auto">
            No team needed. No experience required. Just a problem you want to solve and the drive to see it through.
          </p>
          <Link
            href="/yi-future/join"
            className="inline-flex items-center justify-center px-10 py-4 rounded-xl text-base font-black transition-all hover:scale-105 active:scale-100"
            style={{
              background: "linear-gradient(135deg, #F5A623, #FF9933)",
              color: "#1a1a3e",
              boxShadow: "0 8px 32px rgba(245,166,35,0.35)",
            }}
          >
            Register as a delegate →
          </Link>
          <p className="mt-5 text-xs text-white/30">
            Questions? Write to{" "}
            <a href="mailto:yi.national@cii.in" className="underline text-white/50 hover:text-white/80 transition-colors">
              yi.national@cii.in
            </a>
          </p>
        </div>
      </section>

      {/* ─── 12. Footer ───────────────────────────────────────────────── */}
      <footer
        className="border-t px-4 py-10"
        style={{ background: "#1a1a3e", borderColor: "rgba(245,166,35,0.15)" }}
      >
        <div className="max-w-5xl mx-auto">
          <div className="flex flex-col items-center gap-6 text-center">
            <BrandStrip className="opacity-90" />
            <div className="flex flex-wrap justify-center gap-x-5 gap-y-1 text-xs text-white/40">
              <span>Yi (Young Indians)</span>
              <span>·</span>
              <span>Yi YUVA</span>
              <span>·</span>
              <span>CII — Confederation of Indian Industry</span>
            </div>
            <p className="text-xs text-white/30">
              © 2026 Yi (Young Indians) · Yi YUVA · CII. Future 6.0 is a Yi YUVA flagship program.
              <br />
              Contact:{" "}
              <a
                href="mailto:yi.national@cii.in"
                className="underline hover:text-white/60 transition-colors"
              >
                yi.national@cii.in
              </a>
            </p>
          </div>
        </div>
      </footer>
    </main>
  );
}
