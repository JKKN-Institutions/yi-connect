/**
 * Per-app branded password-reset email.
 *
 * Supabase's built-in `resetPasswordForEmail` sends ONE platform-wide template
 * with a generic "Yi Connect" sender — there is no per-app branding. To brand
 * the reset email per app (Yi Connect / Yi YUVA Future 6.0 / YiFi) we instead:
 *
 *   1. `auth.admin.generateLink({ type: "recovery" })` to MINT a recovery token
 *      WITHOUT Supabase sending its own email, and read `properties.hashed_token`.
 *   2. Build our own link to the app's reset page carrying that token:
 *      `${baseUrl}${resetPath}?token_hash=<hashed_token>&type=recovery`.
 *   3. Send a branded email through our own Resend sender (`lib/email`).
 *
 * The reset page then calls `supabase.auth.verifyOtp({ type: "recovery",
 * token_hash })` to establish the recovery session and let the user set a new
 * password. This token_hash flow works with PKCE-configured browser clients
 * (it does not need a code_verifier), so it is robust regardless of the client's
 * flow type.
 *
 * SECURITY: never reveal whether an email is registered. `generateLink` errors
 * for an unknown email; we swallow that and return ok:true so the caller shows
 * the same "if an account exists, we sent a link" message either way.
 */

import { createAdminSupabaseClient } from "@/lib/supabase/server";
import { sendEmail } from "@/lib/email";

export type BrandedResetApp = {
  /** Display name shown in the email body, subject, and footer. */
  appName: string;
  /** One-line tagline under the header (optional). */
  tagline?: string;
  /** Resend "From" — must use a verified domain (jkkn.ai). */
  fromEmail: string;
  /** Header background colour (hex). */
  headerColor: string;
  /** Accent / button colour (hex). */
  accentColor: string;
  /** App origin, e.g. https://yi-connect-app.vercel.app */
  baseUrl: string;
  /** Path to the reset page, e.g. /yi-future/access/reset-password */
  resetPath: string;
};

export type BrandedResetResult = { ok: boolean; error?: string };

function isUserNotFound(error: { message?: string; status?: number; code?: string }): boolean {
  const msg = (error.message ?? "").toLowerCase();
  return (
    error.status === 404 ||
    error.code === "user_not_found" ||
    msg.includes("user not found") ||
    msg.includes("no user") ||
    msg.includes("unable to find user")
  );
}

function brandedResetHtml(app: BrandedResetApp, resetUrl: string): string {
  return `<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"></head>
<body style="margin:0;padding:0;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;background-color:#f4f4f5;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:#f4f4f5;">
    <tr><td align="center" style="padding:40px 20px;">
      <table role="presentation" width="100%" style="max-width:600px;background-color:#ffffff;border-radius:12px;overflow:hidden;box-shadow:0 4px 6px rgba(0,0,0,0.08);">
        <tr><td style="background:${app.headerColor};padding:28px 24px;text-align:center;">
          <h1 style="color:#ffffff;margin:0;font-size:22px;font-weight:700;">${app.appName}</h1>
          ${app.tagline ? `<p style="color:rgba(255,255,255,0.85);margin:8px 0 0;font-size:13px;">${app.tagline}</p>` : ""}
        </td></tr>
        <tr><td style="padding:32px 28px;color:#1f2937;">
          <h2 style="margin:0 0 12px;font-size:18px;font-weight:700;">Reset your password</h2>
          <p style="margin:0 0 20px;font-size:14px;line-height:1.6;color:#4b5563;">
            We received a request to reset the password for your ${app.appName} account.
            Click the button below to choose a new password. This link is valid for a limited time.
          </p>
          <table role="presentation" cellpadding="0" cellspacing="0" style="margin:0 0 24px;">
            <tr><td style="border-radius:8px;background:${app.accentColor};">
              <a href="${resetUrl}" style="display:inline-block;padding:12px 28px;color:#ffffff;font-size:15px;font-weight:600;text-decoration:none;border-radius:8px;">Reset password</a>
            </td></tr>
          </table>
          <p style="margin:0 0 8px;font-size:12px;color:#6b7280;">If the button doesn't work, copy and paste this link into your browser:</p>
          <p style="margin:0 0 20px;font-size:12px;word-break:break-all;"><a href="${resetUrl}" style="color:${app.accentColor};">${resetUrl}</a></p>
          <p style="margin:0;font-size:13px;color:#9ca3af;">If you didn't request this, you can safely ignore this email — your password won't change.</p>
        </td></tr>
        <tr><td style="background-color:#f8fafc;padding:20px 24px;text-align:center;border-top:1px solid #e2e8f0;">
          <p style="color:#94a3b8;margin:0;font-size:11px;">${app.appName} · Young Indians</p>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`;
}

/**
 * Mint a recovery token and send a branded reset email for one app.
 * Returns ok:true even when the email is not registered (no enumeration).
 */
export async function sendBrandedPasswordReset(
  email: string,
  app: BrandedResetApp
): Promise<BrandedResetResult> {
  const clean = email.trim().toLowerCase();
  if (!clean || !clean.includes("@")) {
    return { ok: false, error: "Enter a valid email address." };
  }

  let admin;
  try {
    admin = createAdminSupabaseClient();
  } catch {
    return { ok: false, error: "Email service is not configured." };
  }

  const redirectTo = `${app.baseUrl}${app.resetPath}`;
  const { data, error } = await admin.auth.admin.generateLink({
    type: "recovery",
    email: clean,
    options: { redirectTo },
  });

  if (error) {
    // Never reveal whether the account exists.
    if (isUserNotFound(error as { message?: string; status?: number; code?: string })) {
      return { ok: true };
    }
    return { ok: false, error: error.message };
  }

  const hashedToken = data?.properties?.hashed_token;
  if (!hashedToken) {
    return { ok: false, error: "Could not generate a reset link. Please try again." };
  }

  const resetUrl = `${app.baseUrl}${app.resetPath}?token_hash=${encodeURIComponent(
    hashedToken
  )}&type=recovery`;

  const result = await sendEmail({
    to: clean,
    from: app.fromEmail,
    subject: `Reset your ${app.appName} password`,
    html: brandedResetHtml(app, resetUrl),
    text: `Reset your ${app.appName} password by opening this link (valid for a limited time):\n\n${resetUrl}\n\nIf you didn't request this, ignore this email — your password won't change.`,
  });

  if (!result.success) {
    return { ok: false, error: result.error ?? "Failed to send reset email." };
  }
  return { ok: true };
}

/** Resolve the public app origin for building reset links. */
export function appBaseUrl(): string {
  return (
    process.env.NEXT_PUBLIC_APP_URL ||
    process.env.NEXT_PUBLIC_SITE_URL ||
    "https://yi-connect-app.vercel.app"
  );
}
