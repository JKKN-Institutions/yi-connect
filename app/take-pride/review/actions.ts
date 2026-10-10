"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { TP_REVIEW_COOKIE, TP_REVIEW_COOKIE_PATH, endReviewSession, reviewSignIn } from "@/lib/take-pride/review";

/*
 * Review sign-in. A wrong username or password gets ONE generic message,
 * never a hint about which part was wrong. A redirect happens only after a
 * SUCCESSFUL sign-in (or sign-out), never on a deny.
 */

// username is echoed back only so the form keeps it after a refusal.
type ReviewLoginState = { error: string | null; username?: string };

const GENERIC = "That username and password don't match.";

export async function reviewLogin(_prev: ReviewLoginState, form: FormData): Promise<ReviewLoginState> {
  const r = await reviewSignIn(form.get("username"), form.get("password"));
  if (!r.ok) {
    const u = form.get("username");
    const username = typeof u === "string" ? u.slice(0, 64) : "";
    if (r.reason === "locked") return { error: "Too many tries. Wait 15 minutes, then try again.", username };
    if (r.reason === "closed") {
      return { error: "This review login is closed now that real delegates are in. Use the admin review login instead.", username };
    }
    if (r.reason === "error") return { error: "Sign-in is not working right now. Try again in a minute.", username };
    return { error: GENERIC, username };
  }
  if (r.role === "admin") {
    (await cookies()).set(TP_REVIEW_COOKIE, r.sessionId, {
      httpOnly: true,
      secure: true,
      sameSite: "lax",
      path: TP_REVIEW_COOKIE_PATH,
      expires: r.expiresAt,
    });
    redirect("/take-pride/desk");
  }
  redirect(r.role === "delegate" ? `/take-pride/pass/${r.targetToken}` : `/take-pride/catalyst/p/${r.targetToken}`);
}

export async function reviewSignOut(): Promise<void> {
  const jar = await cookies();
  await endReviewSession(jar.get(TP_REVIEW_COOKIE)?.value);
  jar.set(TP_REVIEW_COOKIE, "", { httpOnly: true, secure: true, sameSite: "lax", path: TP_REVIEW_COOKIE_PATH, maxAge: 0 });
  redirect("/take-pride/review");
}
