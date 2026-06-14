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
  return (
    <main className="min-h-screen bg-[#f4f4f5] flex items-center justify-center px-4 py-12">
      <div className="w-full max-w-sm">
        <div className="text-center mb-6">
          <h1 className="text-2xl font-bold text-[#000066]">Yi Connect</h1>
          <p className="mt-1 text-sm text-gray-500">
            Sign in to your Yi workspace.
          </p>
        </div>
        <div className="bg-white border border-gray-200 rounded-2xl p-6 shadow-sm">
          {message && (
            <div className="mb-4 rounded-lg bg-red-50 border border-red-200 px-3 py-2 text-sm text-red-700">
              {message}
            </div>
          )}
          <form method="POST" action="/hub/api/login" className="space-y-4">
            <div>
              <label
                htmlFor="email"
                className="block text-xs font-semibold text-gray-600 mb-1.5"
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
                className="w-full px-3 py-2.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:border-[#000066] focus:ring-1 focus:ring-[#000066]/30"
              />
            </div>
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label
                  htmlFor="password"
                  className="block text-xs font-semibold text-gray-600"
                >
                  Password
                </label>
                <Link
                  href="/forgot-password"
                  className="text-xs text-[#000066]/70 hover:text-[#000066]"
                >
                  Forgot password?
                </Link>
              </div>
              <input
                id="password"
                name="password"
                type="password"
                required
                autoComplete="current-password"
                placeholder="Enter password"
                className="w-full px-3 py-2.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:border-[#000066] focus:ring-1 focus:ring-[#000066]/30"
              />
            </div>
            <button
              type="submit"
              className="w-full py-2.5 bg-[#000066] hover:bg-[#000066]/90 text-white text-sm font-semibold rounded-lg transition-colors"
            >
              Sign in
            </button>
          </form>

          <div className="my-4 flex items-center gap-3">
            <div className="h-px flex-1 bg-gray-200" />
            <span className="text-xs text-gray-400">OR</span>
            <div className="h-px flex-1 bg-gray-200" />
          </div>

          <OAuthButtons />
        </div>
        <p className="text-center text-[11px] text-gray-400 mt-6">
          Young Indians · Yi Connect
        </p>
      </div>
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

  // Priority 1: access-code sessions (delegate / mentor / jury / participant).
  const yifi = parseSession(cookieStore.get("yifi_session")?.value);
  if (yifi?.type === "member") redirect("/yifi/me");

  const yifuture = parseSession(cookieStore.get("yifuture_session")?.value);
  if (yifuture?.type === "delegate") redirect("/yi-future/me");
  if (yifuture?.type === "mentor") redirect("/yi-future/mentor");
  if (yifuture?.type === "jury") redirect("/yi-future/jury");

  const yip = await getYipSession();
  if (yip?.type === "participant") redirect("/yip/me");
  if (yip?.type === "jury") redirect("/yip/jury");

  // Priority 2: Supabase session → route by the modules this person holds an
  // admin role in (yi_directory). 2+ → "pick your module" hub; exactly 1 →
  // straight in; none → not-registered.
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

    redirect("/not-registered");
  }

  // Signed out → unified login (email + password + Google).
  return <HubLogin error={error} />;
}
