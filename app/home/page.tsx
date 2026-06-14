import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import {
  isPlatformSuperAdmin,
  getCurrentPersonRoles,
} from "@/lib/yi/auth/yi-directory-roles";
import { getYipSession } from "@/lib/yip/auth/yip-session";

// Admin-tier roles per app (excludes pure participant roles like delegate /
// participant). Cross-app platform tiers are handled earlier (Priority 0).
const FUTURE_ADMIN_ROLES = [
  "future_super_admin",
  "future_admin",
  "national_admin",
  "regional_admin",
  "chapter_admin",
  "platform_admin",
];
const YUVA_ADMIN_ROLES = [
  "yuva_super_admin",
  "yuva_admin",
  "chapter_admin",
  "institution_coordinator",
];
const YIP_ADMIN_ROLES = [
  "yip_super_admin",
  "national",
  "regional_admin",
  "chapter_admin",
  "chapter_organizer",
];

type ModuleTile = {
  title: string;
  desc: string;
  href: string;
  icon: string;
  accent: string;
};

/**
 * "Pick your module" hub — shown when a signed-in admin holds roles in MORE
 * than one module, so the app entry never silently drops them into one view or
 * (worse) bounces them to the public YiFi landing. Tiles link to each module's
 * own entry, which self-routes to the right dashboard.
 */
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
          <Link
            href="/logout"
            className="text-xs text-gray-400 hover:text-gray-600"
          >
            Sign out
          </Link>
        </div>
      </div>
    </main>
  );
}

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

  const yip = await getYipSession();
  if (yip?.type === "participant") redirect("/yip/me");
  if (yip?.type === "jury") redirect("/yip/jury");

  // Priority 2: OAuth (Supabase) session → route by the modules this person
  // actually holds an admin role in (yi_directory is the canonical source).
  // Multiple modules → a "pick your module" hub; exactly one → straight in;
  // none → not-registered. This is what restores a Yi-Future / Youth-Academy
  // admin's entry — previously they fell through to the YiFi landing.
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (user) {
    const me = await getCurrentPersonRoles();
    const active = (me?.assignments ?? []).filter((a) => a.is_active);
    const hasRole = (app: string, roles: string[]) =>
      active.some((a) => a.app === app && roles.includes(a.role));

    const tiles: ModuleTile[] = [];
    if (hasRole("future", FUTURE_ADMIN_ROLES)) {
      tiles.push({
        title: "Yi Future",
        desc: "Editions, finales, delegates, and national admin.",
        href: "/yi-future",
        icon: "🚀",
        accent: "hover:border-[#F5A623]/60",
      });
    }
    if (hasRole("yuva", YUVA_ADMIN_ROLES)) {
      tiles.push({
        title: "Youth Academy",
        desc: "Academies, runs, students, and chapter delivery.",
        href: "/youth-academy",
        icon: "🎓",
        accent: "hover:border-[#229434]/60",
      });
    }
    if (hasRole("yip", YIP_ADMIN_ROLES)) {
      tiles.push({
        title: "Yi Parliament (YIP)",
        desc: "Parliament events, participants, and jury scoring.",
        href: "/yip/dashboard",
        icon: "⚖️",
        accent: "hover:border-[#FD7215]/60",
      });
    }

    // Chapter membership → the day-to-day chapter dashboard.
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

    // One module → go straight in. Two or more → let them choose.
    if (tiles.length === 1) redirect(tiles[0].href);
    if (tiles.length >= 2) {
      return <ModuleHub email={me?.email ?? user.email ?? null} tiles={tiles} />;
    }

    // Authenticated but no module role/membership — show "not registered".
    redirect("/not-registered");
  }

  // Priority 3: anonymous → show YiFi landing (current flagship)
  redirect("/yifi");
}
