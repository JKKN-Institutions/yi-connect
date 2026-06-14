import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import {
  isPlatformSuperAdmin,
  getCurrentPersonRoles,
  chairedChaptersFromRoles,
} from "@/lib/yi/auth/yi-directory-roles";
import { getYipSession } from "@/lib/yip/auth/yip-session";
import { signOut } from "@/app/actions/auth";
import { OAuthButtons } from "@/components/auth/oauth-buttons";
import { Fraunces, Plus_Jakarta_Sans } from "next/font/google";

// Distinctive pairing for the hub entry: a warm serif display + a clean,
// modern grotesque for UI. Scoped to the hub via CSS variables (not global).
const fraunces = Fraunces({
  subsets: ["latin"],
  weight: ["400", "500", "600"],
  variable: "--font-fraunces",
});
const jakarta = Plus_Jakarta_Sans({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-jakarta",
});

export const dynamic = "force-dynamic";

type ModuleTile = {
  title: string;
  desc: string;
  href: string;
  icon: string;
  accent: string;
};

// Every yi_directory role is a STAFF role (delegates/students sign in via
// separate access-code / session flows), so ANY active assignment in an app
// means the person works in that app → show its tile. Keyed by `app`, never by
// specific role names — those drift (e.g. Yi Future uses `chapter_chair`, not
// `chapter_admin`, and has ~6 other chapter-level role names). Each tile links
// to the module's own entry, which self-routes by the person's tier.
const MODULE_APPS: { app: string; tile: ModuleTile }[] = [
  {
    app: "future",
    tile: {
      title: "Yi Future",
      desc: "Editions, finales, delegates, and chapter delivery.",
      href: "/yi-future",
      icon: "🚀",
      accent: "hover:border-[#F5A623]/60",
    },
  },
  {
    app: "yuva",
    tile: {
      title: "Youth Academy",
      desc: "Academies, runs, students, and chapter delivery.",
      href: "/youth-academy",
      icon: "🎓",
      accent: "hover:border-[#229434]/60",
    },
  },
  {
    app: "yip",
    tile: {
      title: "Yi Parliament (YIP)",
      desc: "Parliament events, participants, and jury scoring.",
      href: "/yip/dashboard",
      icon: "⚖️",
      accent: "hover:border-[#FD7215]/60",
    },
  },
  {
    app: "yifi",
    tile: {
      title: "YiFi",
      desc: "Registrants, routing matches, census, and vows.",
      href: "/yifi/admin",
      icon: "🎯",
      accent: "hover:border-[#FD7215]/60",
    },
  },
];

// A chapter-wide chair leads the whole chapter across every vertical, so they
// get the chapter-scoped admin console of each vertical that is GENUINELY
// chapter-partitioned BY DEFAULT (Director, 2026-06-14) — additive on top of
// any explicit role they hold. YiFi is deliberately excluded: it is a single
// national summit with no per-chapter slice, so auto-granting would expose
// every founder's data nationally (decision 2026-06-14). A chair still sees
// YiFi if they hold an explicit `yifi` role (covered by the activeApps path).
const CHAIR_DEFAULT_APPS = new Set(["future", "yuva", "yip"]);

function parseSession(
  raw: string | undefined
): Record<string, unknown> | null {
  if (!raw) return null;
  if (raw.startsWith("{")) {
    try {
      return JSON.parse(raw);
    } catch {
      return null;
    }
  }
  const dot = raw.indexOf(".");
  if (dot <= 0) return null;
  try {
    const json = Buffer.from(raw.slice(0, dot), "base64url").toString("utf8");
    return JSON.parse(json);
  } catch {
    return null;
  }
}

/** "Pick your module" hub — shown when a signed-in admin holds 2+ module roles. */
function ModuleHub({
  email,
  tiles,
}: {
  email: string | null;
  tiles: ModuleTile[];
}) {
  return (
    <main className="min-h-screen bg-[#f4f4f5] flex flex-col items-center justify-center px-4 py-12">
      <div className="w-full max-w-2xl">
        <div className="text-center mb-8">
          <h1 className="text-2xl md:text-3xl font-bold text-[#000066]">
            Welcome back
          </h1>
          <p className="mt-2 text-sm text-gray-500">
            {email ? `Signed in as ${email}. ` : ""}Choose where you&apos;d like
            to go.
          </p>
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          {tiles.map((m) => (
            <Link
              key={m.href}
              href={m.href}
              className={`block rounded-2xl bg-white border border-gray-200 p-5 shadow-sm transition-all hover:shadow-md ${m.accent}`}
            >
              <div className="text-3xl mb-2">{m.icon}</div>
              <div className="font-semibold text-[#000066]">{m.title}</div>
              <div className="mt-1 text-xs text-gray-500 leading-relaxed">
                {m.desc}
              </div>
            </Link>
          ))}
        </div>
        <div className="text-center mt-8">
          <form action={signOut}>
            <button
              type="submit"
              className="text-xs text-gray-400 hover:text-gray-600"
            >
              Sign out
            </button>
          </form>
        </div>
      </div>
    </main>
  );
}

/** Unified signed-out login — email + password (form POST) AND Google. */
function HubLogin({ error }: { error?: string }) {
  const message =
    error === "invalid"
      ? "Incorrect email or password. Please try again."
      : error === "missing"
        ? "Enter both your email and password."
        : null;

  const modules = [
    { icon: "⚖️", label: "Parliament" },
    { icon: "🚀", label: "Future" },
    { icon: "🎓", label: "Youth Academy" },
    { icon: "🎯", label: "YiFi" },
    { icon: "🏛️", label: "Chapter" },
  ];

  const inputClass =
    "w-full rounded-xl border border-slate-300 bg-white px-3.5 py-3 text-sm text-slate-900 shadow-sm transition-colors placeholder:text-slate-400 focus:border-[#000066] focus:outline-none focus:ring-2 focus:ring-[#000066]/15";

  return (
    <main
      className={`${fraunces.variable} ${jakarta.variable} grid min-h-screen w-full grid-cols-1 [font-family:var(--font-jakarta)] lg:grid-cols-[1.05fr_1fr]`}
    >
      {/* ── Brand panel (desktop) ─────────────────────────────── */}
      <section className="relative hidden flex-col justify-between overflow-hidden bg-[#04041c] p-10 text-white lg:flex xl:p-16">
        {/* atmospheric gradient mesh */}
        <div
          aria-hidden
          className="absolute inset-0"
          style={{
            backgroundImage:
              "radial-gradient(110% 110% at 0% 0%, #11116b 0%, transparent 55%), radial-gradient(100% 100% at 100% 0%, #1b1b80 0%, transparent 48%), radial-gradient(120% 120% at 85% 115%, #3a1559 0%, transparent 55%)",
          }}
        />
        {/* warm saffron glow */}
        <div
          aria-hidden
          className="absolute -right-24 top-1/3 h-80 w-80 rounded-full bg-[#ff9933]/20 blur-[120px]"
        />
        {/* fine grain */}
        <div
          aria-hidden
          className="absolute inset-0 opacity-[0.05] mix-blend-soft-light"
          style={{
            backgroundImage:
              "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='160' height='160'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.8' numOctaves='3'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E\")",
          }}
        />
        {/* tricolor hairline (Yi · CII · India heritage) */}
        <div
          aria-hidden
          className="absolute left-0 top-0 h-full w-1 bg-gradient-to-b from-[#ff9933] via-white/70 to-[#138808]"
        />

        {/* brand mark */}
        <div className="relative flex items-center gap-3">
          <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-gradient-to-br from-[#ffb43d] to-[#ff8a00] text-lg font-bold text-[#04041c] shadow-lg shadow-black/30 [font-family:var(--font-fraunces)]">
            Yi
          </span>
          <span className="text-xl font-semibold tracking-tight [font-family:var(--font-fraunces)]">
            Yi Connect
          </span>
        </div>

        {/* headline */}
        <div className="relative max-w-md">
          <h2 className="text-[2.6rem] font-medium leading-[1.08] tracking-tight [font-family:var(--font-fraunces)]">
            One sign-in for every Yi&nbsp;initiative.
          </h2>
          <p className="mt-5 text-[15px] leading-relaxed text-white/65">
            Your single workspace for Parliament, Future, Youth Academy, YiFi,
            and chapter operations — pick up right where you left off.
          </p>
          <div className="mt-8 flex flex-wrap gap-2">
            {modules.map((m) => (
              <span
                key={m.label}
                className="inline-flex items-center gap-1.5 rounded-full border border-white/10 bg-white/[0.04] px-3 py-1.5 text-[13px] text-white/75 backdrop-blur-sm"
              >
                <span aria-hidden>{m.icon}</span>
                {m.label}
              </span>
            ))}
          </div>
        </div>

        {/* org footer */}
        <p className="relative text-[11px] font-medium uppercase tracking-[0.24em] text-white/40">
          Young Indians · CII
        </p>
      </section>

      {/* ── Login panel ───────────────────────────────────────── */}
      <section className="relative flex items-center justify-center bg-[#f5f5f3] px-5 py-12 text-slate-900 sm:px-10">
        {/* tricolor accent on the mobile top edge */}
        <div
          aria-hidden
          className="absolute inset-x-0 top-0 h-0.5 bg-gradient-to-r from-[#ff9933] via-white to-[#138808] lg:hidden"
        />
        <div className="w-full max-w-[400px]">
          {/* brand mark (mobile only) */}
          <div className="mb-8 flex items-center justify-center gap-2.5 lg:hidden">
            <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-[#ffb43d] to-[#ff8a00] text-base font-bold text-[#04041c] shadow-sm [font-family:var(--font-fraunces)]">
              Yi
            </span>
            <span className="text-lg font-semibold [font-family:var(--font-fraunces)]">
              Yi Connect
            </span>
          </div>

          <div className="mb-7">
            <h1 className="text-[1.9rem] font-medium leading-tight tracking-tight [font-family:var(--font-fraunces)]">
              Welcome back
            </h1>
            <p className="mt-1.5 text-sm text-slate-500">
              Sign in to your Yi workspace.
            </p>
          </div>

          {message && (
            <div className="mb-5 flex items-start gap-2 rounded-xl border border-red-200 bg-red-50 px-3.5 py-3 text-sm text-red-700">
              <svg
                aria-hidden
                viewBox="0 0 20 20"
                fill="currentColor"
                className="mt-0.5 h-4 w-4 shrink-0"
              >
                <path
                  fillRule="evenodd"
                  d="M8.485 2.495c.673-1.167 2.357-1.167 3.03 0l6.28 10.875c.673 1.167-.17 2.625-1.516 2.625H3.72c-1.347 0-2.189-1.458-1.515-2.625L8.485 2.495ZM10 6a.75.75 0 0 1 .75.75v3.5a.75.75 0 0 1-1.5 0v-3.5A.75.75 0 0 1 10 6Zm0 9a1 1 0 1 0 0-2 1 1 0 0 0 0 2Z"
                  clipRule="evenodd"
                />
              </svg>
              <span>{message}</span>
            </div>
          )}

          <form method="POST" action="/hub/api/login" className="space-y-4">
            <div>
              <label
                htmlFor="email"
                className="mb-1.5 block text-[11px] font-semibold uppercase tracking-wider text-slate-500"
              >
                Email
              </label>
              <input
                id="email"
                name="email"
                type="email"
                required
                autoComplete="email"
                autoFocus
                placeholder="you@example.com"
                className={inputClass}
              />
            </div>
            <div>
              <div className="mb-1.5 flex items-center justify-between">
                <label
                  htmlFor="password"
                  className="block text-[11px] font-semibold uppercase tracking-wider text-slate-500"
                >
                  Password
                </label>
                <Link
                  href="/forgot-password"
                  className="text-xs font-medium text-[#000066]/70 transition-colors hover:text-[#000066]"
                >
                  Forgot?
                </Link>
              </div>
              <input
                id="password"
                name="password"
                type="password"
                required
                autoComplete="current-password"
                placeholder="••••••••"
                className={inputClass}
              />
            </div>
            <button
              type="submit"
              className="w-full rounded-xl bg-[#000066] px-4 py-3 text-sm font-semibold text-white shadow-sm transition-all hover:bg-[#0a0a7a] hover:shadow-md active:scale-[0.99]"
            >
              Sign in
            </button>
          </form>

          <div className="my-5 flex items-center gap-3">
            <div className="h-px flex-1 bg-slate-200" />
            <span className="text-[11px] font-medium uppercase tracking-wider text-slate-400">
              or
            </span>
            <div className="h-px flex-1 bg-slate-200" />
          </div>

          <OAuthButtons />

          <p className="mt-8 text-center text-[11px] text-slate-400">
            Young Indians · Yi Connect
          </p>
        </div>
      </section>
    </main>
  );
}

export default async function HubPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const sp = await searchParams;
  const error = typeof sp.error === "string" ? sp.error : undefined;
  const cookieStore = await cookies();

  // Priority 0: platform super-admins → the all-modules super-admin hub.
  if (await isPlatformSuperAdmin()) redirect("/super-admin");

  // Priority 1: a Yi-STAFF (Supabase) session WINS over any leftover access-code
  // cookie — otherwise a stale participant cookie hijacks the hub for a staff
  // member (Director, 2026-06-15). Route by the modules this person holds an admin
  // role in (yi_directory): 2+ → "pick your module" hub; exactly 1 → straight in.
  // A signed-in user with NO staff role falls THROUGH to the access-code checks
  // below (then not-registered) — so a real participant is unaffected.
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (user) {
    const me = await getCurrentPersonRoles();
    const activeApps = new Set(
      (me?.assignments ?? []).filter((a) => a.is_active).map((a) => a.app)
    );

    // A chapter-wide chair sees the chapter consoles of every chapter-
    // partitioned vertical (CHAIR_DEFAULT_APPS), even after the chair role is
    // re-tagged off app='future' — chairedChaptersFromRoles matches by role
    // name, not app, so this is correct before and after that migration.
    const isChair = chairedChaptersFromRoles(me?.assignments ?? []).length > 0;

    const tiles: ModuleTile[] = [];
    for (const { app, tile } of MODULE_APPS) {
      if (activeApps.has(app) || (isChair && CHAIR_DEFAULT_APPS.has(app))) {
        tiles.push(tile);
      }
    }

    const { data: member } = await supabase
      .schema("yi_connect" as "public")
      .from("members")
      .select("id")
      .eq("id", user.id)
      .maybeSingle();
    if (member) {
      tiles.push({
        title: "Chapter Dashboard",
        desc: "Members, events, finance, and chapter operations.",
        href: "/dashboard",
        icon: "🏛️",
        accent: "hover:border-[#000066]/40",
      });
    }

    if (tiles.length === 1) redirect(tiles[0].href);
    if (tiles.length >= 2) {
      return <ModuleHub email={me?.email ?? user.email ?? null} tiles={tiles} />;
    }
    // Signed in but no staff role → fall through to the access-code checks below.
  }

  // Priority 2: access-code sessions (member / delegate / mentor / jury /
  // participant) — reached only when there is NO Yi-staff role above, so a real
  // student / delegate / jury still lands on their own home.
  const yifi = parseSession(cookieStore.get("yifi_session")?.value);
  if (yifi?.type === "member") redirect("/yifi/me");

  const yifuture = parseSession(cookieStore.get("yifuture_session")?.value);
  if (yifuture?.type === "delegate") redirect("/yi-future/me");
  if (yifuture?.type === "mentor") redirect("/yi-future/mentor");
  if (yifuture?.type === "jury") redirect("/yi-future/jury");

  const yip = await getYipSession();
  if (yip?.type === "participant") redirect("/yip/me");
  if (yip?.type === "jury") redirect("/yip/jury");

  // Signed in (Supabase) but neither a staff role nor an access-code identity.
  if (user) redirect("/not-registered");

  // Signed out → unified login (email + password + Google).
  return <HubLogin error={error} />;
}
