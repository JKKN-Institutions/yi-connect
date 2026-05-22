import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

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

  // Refresh Supabase session (important — keeps auth alive)
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { pathname } = request.nextUrl;

  // ─── Public routes — always allowed ────────────────────────────
  const publicRoutes = ["/", "/join", "/login", "/event"];
  const isPublic = publicRoutes.some(
    (route) => pathname === route || pathname.startsWith(route + "/")
  );

  if (isPublic) {
    return supabaseResponse;
  }

  // ─── Protect /dashboard/* — require Supabase auth ──────────────
  if (pathname.startsWith("/dashboard")) {
    if (!user) {
      const url = request.nextUrl.clone();
      url.pathname = "/login";
      return NextResponse.redirect(url);
    }
    return supabaseResponse;
  }

  // ─── Protect /jury/* — require yip_session cookie with type=jury
  if (pathname.startsWith("/jury")) {
    const session = request.cookies.get("yip_session")?.value;
    if (!session) {
      const url = request.nextUrl.clone();
      url.pathname = "/join";
      return NextResponse.redirect(url);
    }
    try {
      const parsed = JSON.parse(session);
      if (parsed.type !== "jury") {
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

  // ─── Protect /me/* — require yip_session cookie with type=participant
  if (pathname.startsWith("/me")) {
    const session = request.cookies.get("yip_session")?.value;
    if (!session) {
      const url = request.nextUrl.clone();
      url.pathname = "/join";
      return NextResponse.redirect(url);
    }
    try {
      const parsed = JSON.parse(session);
      if (parsed.type !== "participant") {
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

  return supabaseResponse;
}
