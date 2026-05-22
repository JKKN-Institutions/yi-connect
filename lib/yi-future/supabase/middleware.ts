import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

/**
 * YiFuture session middleware — ported from /Users/omm/PROJECTS/YiFuture/src/lib/supabase/middleware.ts
 * during Phase D monorepo merge (2026-05-22).
 *
 * IMPORTANT: this function is NOT wired into yi-connect's root middleware. The
 * pathname matching below uses bare paths (e.g. `/login`, `/join`, `/chapter`)
 * that were the YiFuture URL surface. After porting under /yi-future, those
 * routes live at `/yi-future/login`, `/yi-future/join`, etc.
 *
 * If/when the orchestrator decides to wire this into the root middleware, the
 * publicRoutes + adminPaths + accessCodeRoles tables below need either:
 *   (a) "/yi-future" prepended to each entry, or
 *   (b) a stripped-prefix comparison that strips "/yi-future" from `pathname`
 *       before matching.
 *
 * Also note: the supabase client created here does NOT set db.schema=future,
 * because the only cross-schema call (`.schema('yi').from('national_admins')`)
 * is already explicit and the auth.getUser() call is schema-agnostic.
 */
export async function updateSession(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value)
          );
          supabaseResponse = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          );
        },
      },
    }
  );

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { pathname } = request.nextUrl;

  // ─── Public routes — always allowed ────────────────────────────
  const publicRoutes = [
    "/",
    "/about",
    "/editions",
    "/tracks",
    "/problems",
    "/chapters",
    "/national",
    "/join",
    "/login",
    "/consent",
    "/event",
  ];
  const isPublic = publicRoutes.some(
    (route) => pathname === route || pathname.startsWith(route + "/")
  );

  // Admin /national/admin is a subpath of public /national — must protect first
  const isNationalAdmin = pathname.startsWith("/national/admin");

  if (isPublic && !isNationalAdmin) {
    return supabaseResponse;
  }

  // ─── Protect Supabase-authed admin routes ──────────────────────
  const adminPaths = ["/chapter", "/host", "/national/admin"];
  const isAdminPath = adminPaths.some(
    (p) => pathname === p || pathname.startsWith(p + "/")
  );

  if (isAdminPath) {
    if (!user) {
      const url = request.nextUrl.clone();
      url.pathname = "/login";
      return NextResponse.redirect(url);
    }

    // /national/admin/* needs an additional allow-list check.
    // Any Supabase-authed user can hit /chapter or /host (those are
    // already row-scoped by chapter_core_team); /national/admin is the
    // god-mode surface and must be locked down explicitly.
    if (isNationalAdmin) {
      const email = (user.email ?? "").toLowerCase();
      if (!email) {
        const url = request.nextUrl.clone();
        url.pathname = "/login";
        url.searchParams.set("error", "no_email");
        return NextResponse.redirect(url);
      }

      // Single cheap EXISTS-style query against yi.national_admins.
      // RLS allows authenticated users to SELECT, so this works with
      // the same anon-client + user cookie that authenticated them.
      const { data: adminRow, error: adminLookupErr } = await supabase
        .schema("yi")
        .from("national_admins")
        .select("email")
        .eq("email", email)
        .maybeSingle();

      if (adminLookupErr || !adminRow) {
        const url = request.nextUrl.clone();
        url.pathname = "/login";
        url.searchParams.set("error", "not_national_admin");
        return NextResponse.redirect(url);
      }
    }

    return supabaseResponse;
  }

  // ─── Protect access-code roles ────────────────────────────────
  const accessCodeRoles: Record<string, string> = {
    "/me": "delegate",
    "/mentor": "mentor",
    "/jury": "jury",
    "/partner": "partner",
  };

  for (const [path, expectedType] of Object.entries(accessCodeRoles)) {
    if (pathname === path || pathname.startsWith(path + "/")) {
      const session = request.cookies.get("yifuture_session")?.value;
      if (!session) {
        const url = request.nextUrl.clone();
        url.pathname = "/join";
        return NextResponse.redirect(url);
      }
      try {
        const parsed = JSON.parse(session);
        if (parsed.type !== expectedType) {
          const url = request.nextUrl.clone();
          url.pathname = "/join";
          return NextResponse.redirect(url);
        }
      } catch {
        const url = request.nextUrl.clone();
        url.pathname = "/join";
        return NextResponse.redirect(url);
      }
      return supabaseResponse;
    }
  }

  return supabaseResponse;
}
