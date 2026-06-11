import { NextResponse, type NextRequest } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase/server";

/**
 * Yi Youth Academy — staff email/password sign-in (route handler).
 *
 * A plain <form method="POST"> posts here, so login works with zero
 * client-side JS / hydration, and a route handler flushes the Supabase
 * session cookie reliably (server actions can drop it). On success the
 * Supabase client has written the `sb-…-auth-token` cookie onto this
 * redirect response; the middleware then sees the session.
 *
 * This only AUTHENTICATES — Youth Academy authorization is still enforced by
 * the persona layouts' yuva-role gates, so a user with no yuva role lands on
 * Forbidden403, not on data.
 */

export const dynamic = "force-dynamic";

/** Restrict the post-login redirect to the Youth Academy mount (no open redirect). */
function safeRedirect(target: string | null): string {
  if (target && target.startsWith("/youth-academy")) return target;
  return "/youth-academy";
}

function backToLogin(
  origin: string,
  reason: string,
  redirectTo: string
): NextResponse {
  const url = new URL("/youth-academy/login", origin);
  url.searchParams.set("error", reason);
  if (redirectTo !== "/youth-academy") url.searchParams.set("redirectTo", redirectTo);
  return NextResponse.redirect(url, 303);
}

export async function POST(request: NextRequest): Promise<NextResponse> {
  const origin = request.nextUrl.origin;
  const form = await request.formData();
  const email = String(form.get("email") ?? "").trim();
  const password = String(form.get("password") ?? "");
  const redirectTo = safeRedirect(
    form.get("redirectTo") ? String(form.get("redirectTo")) : null
  );

  if (!email || !password) {
    return backToLogin(origin, "missing", redirectTo);
  }

  const supabase = await createServerSupabaseClient();
  const { error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) {
    // Generic — never reveal whether the email exists.
    return backToLogin(origin, "invalid", redirectTo);
  }

  // Session cookie is now attached to this response by the Supabase client.
  return NextResponse.redirect(new URL(redirectTo, origin), 303);
}
