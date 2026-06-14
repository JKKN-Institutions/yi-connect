import { NextResponse, type NextRequest } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase/server";

/**
 * Yi Connect unified entry — email/password sign-in (route handler).
 *
 * The /hub login form posts here. A route handler flushes the Supabase session
 * cookie reliably onto the redirect response (server actions can drop it); the
 * middleware then sees the session and /hub routes the user to their modules.
 * This only AUTHENTICATES — per-module authorization is enforced by each
 * module's own gates.
 */

export const dynamic = "force-dynamic";

function backToLogin(origin: string, reason: string): NextResponse {
  const url = new URL("/hub", origin);
  url.searchParams.set("error", reason);
  return NextResponse.redirect(url, 303);
}

export async function POST(request: NextRequest): Promise<NextResponse> {
  const origin = request.nextUrl.origin;

  let form: FormData;
  try {
    form = await request.formData();
  } catch {
    return backToLogin(origin, "missing");
  }

  const email = String(form.get("email") ?? "").trim();
  const password = String(form.get("password") ?? "");
  if (!email || !password) {
    return backToLogin(origin, "missing");
  }

  const supabase = await createServerSupabaseClient();
  const { error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) {
    // Generic — never reveal whether the email exists.
    return backToLogin(origin, "invalid");
  }

  // Session cookie is now attached to this response; /hub will route by role.
  return NextResponse.redirect(new URL("/hub", origin), 303);
}
