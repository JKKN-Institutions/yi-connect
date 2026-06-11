"use server";

// ═══════════════════════════════════════════════════════════════════════
// Yi Youth Academy — PUBLIC application actions (Phase 8).
//
//   submitApplication          — anonymous, zod-validated, rate-capped
//                                insert into yuva.applications + durable
//                                confirmation-email enqueue.
//   getApplicationStatusByToken — tokenized status lookup; returns ONLY the
//                                applicant's own data; invalid token → null
//                                (the page 404s).
//
// These are the ONLY anon-reachable write/read paths in the yuva schema
// (everything else is gate-first). The service client is safe here because
// every query is pinned to caller-supplied-and-validated identifiers and
// explicit status filters — never a broad read.
// ═══════════════════════════════════════════════════════════════════════

import { headers } from "next/headers";
import { z } from "zod";
import type { ActionResult } from "@/lib/yuva/action-result";
import { logYuvaAudit } from "@/lib/yuva/audit";
import { sendYuvaEmail } from "@/lib/yuva/email";
import { applicationConfirmationEmail } from "@/lib/yuva/email-templates";
import { createServiceClient } from "@/lib/yuva/supabase/service";
import { verifyTurnstile } from "@/lib/yuva/turnstile";

const APP_URL =
  process.env.NEXT_PUBLIC_APP_URL ?? "https://yi-connect-app.vercel.app";

// ─── Abuse caps (per UTC-rolling 24h window) ─────────────────────────────
// Per-email: count of yuva.applications rows (any run) in the window.
// Per-IP: count of audit_log 'application_submit' rows tagged with the IP
//   (applications has no ip column — the audit row written per successful
//   submission doubles as the durable per-IP counter).
// Pending-email cap: stops the confirmation queue being used to bomb an
//   address that already has a backlog of undelivered mail.
const MAX_APPLICATIONS_PER_EMAIL_PER_DAY = 5;
const MAX_APPLICATIONS_PER_IP_PER_DAY = 20;
const MAX_PENDING_EMAILS_PER_RECIPIENT = 10;

const RATE_ERROR =
  "Too many applications from here in the last 24 hours. Please try again tomorrow.";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const INDIA_MOBILE_RE = /^[6-9]\d{9}$/;

/** First hop of x-forwarded-for (donor precedent: app/api/bug-reporter). */
async function callerIp(): Promise<string | null> {
  const h = await headers();
  const fwd = h.get("x-forwarded-for");
  if (fwd) {
    const first = fwd.split(",")[0]?.trim();
    if (first) return first.slice(0, 64);
  }
  const real = h.get("x-real-ip")?.trim();
  return real ? real.slice(0, 64) : null;
}

function normalizeMobile(raw: string): string {
  return raw.replace(/[^\d]/g, "").replace(/^91(?=\d{10}$)/, "");
}

// ─── Input schema ─────────────────────────────────────────────────────────

const applySchema = z
  .object({
    runId: z.string().uuid("That program link is not valid."),
    fullName: z
      .string()
      .trim()
      .min(2, "Please enter your full name.")
      .max(120, "Name is too long."),
    email: z
      .string()
      .trim()
      .toLowerCase()
      .max(254, "Email is too long.")
      .regex(EMAIL_RE, "Please enter a valid email address."),
    phone: z.string().trim().max(20).optional().default(""),
    /** Optional, "YYYY-MM-DD" or empty string (⇒ stored as NULL). */
    dob: z.string().trim().optional().default(""),
    institutionId: z.string().uuid().nullable().optional().default(null),
    institutionOther: z
      .string()
      .trim()
      .max(200)
      .nullable()
      .optional()
      .default(null),
    degree: z
      .string()
      .trim()
      .min(2, "Please enter your degree / department.")
      .max(160),
    yearOfStudy: z
      .string()
      .trim()
      .min(1, "Please pick your year of study.")
      .max(40),
    motivation: z
      .string()
      .trim()
      .min(20, "Tell us a little more — at least a couple of sentences.")
      .max(2000, "Please keep your motivation under 2000 characters."),
    membershipClaim: z.enum(["member", "want_to_join"], {
      message: "Please answer the Yi YUVA membership question.",
    }),
    declarationAccepted: z
      .boolean()
      .refine((v) => v === true, "Please accept the declaration to continue."),
    /** Cloudflare Turnstile token. Optional/back-compatible; only verified
     *  server-side when TURNSTILE_SECRET_KEY is set (else a no-op). */
    turnstileToken: z.string().nullable().optional().default(null),
  })
  .superRefine((v, ctx) => {
    if (!v.institutionId && !v.institutionOther?.trim()) {
      ctx.addIssue({
        code: "custom",
        path: ["institutionId"],
        message: "Pick your institution from the list or type its name.",
      });
    }
    if (v.phone) {
      const digits = normalizeMobile(v.phone);
      if (!INDIA_MOBILE_RE.test(digits)) {
        ctx.addIssue({
          code: "custom",
          path: ["phone"],
          message: "Mobile must be a 10-digit Indian number.",
        });
      }
    }
    if (v.dob) {
      const d = new Date(`${v.dob}T00:00:00Z`);
      if (
        !/^\d{4}-\d{2}-\d{2}$/.test(v.dob) ||
        Number.isNaN(d.getTime()) ||
        d > new Date() ||
        d < new Date("1940-01-01T00:00:00Z")
      ) {
        ctx.addIssue({
          code: "custom",
          path: ["dob"],
          message: "Please enter a valid date of birth.",
        });
      }
    }
  });

export type SubmitApplicationInput = z.input<typeof applySchema>;

export type SubmitApplicationData = {
  statusToken: string;
  /** True ⇒ this email had already applied to this run — the token points
   *  at the EXISTING application (no second row was created). */
  duplicate: boolean;
};

// ─── submitApplication (PUBLIC, anon) ─────────────────────────────────────

export async function submitApplication(
  input: SubmitApplicationInput
): Promise<ActionResult<SubmitApplicationData>> {
  const parsed = applySchema.safeParse(input);
  if (!parsed.success) {
    return {
      success: false,
      error:
        parsed.error.issues[0]?.message ?? "Please check the form and retry.",
    };
  }
  const v = parsed.data;
  const email = v.email; // already lowercased+trimmed by the schema
  const phone = v.phone ? normalizeMobile(v.phone) : null;
  const dob = v.dob || null;
  const institutionOther = v.institutionId
    ? null
    : v.institutionOther?.trim() || null;

  const svc = await createServiceClient();
  const ip = await callerIp();
  const sinceIso = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();

  // 0) Turnstile (abuse hardening). No-op when TURNSTILE_SECRET_KEY is unset
  //    — verifyTurnstile returns true, so behaviour is unchanged until keys
  //    are added. When enforcing, a missing/invalid token is rejected before
  //    any DB read.
  if (!(await verifyTurnstile(v.turnstileToken ?? null, ip ?? undefined))) {
    return {
      success: false,
      error: "Please complete the verification and try again.",
    };
  }

  // 1) Rate caps — all fail CLOSED on a definite over-cap count.
  const { count: emailCount } = await svc
    .from("applications")
    .select("id", { count: "exact", head: true })
    .eq("email", email)
    .gte("created_at", sinceIso);
  if ((emailCount ?? 0) >= MAX_APPLICATIONS_PER_EMAIL_PER_DAY) {
    return { success: false, error: RATE_ERROR };
  }

  if (ip) {
    const { count: ipCount } = await svc
      .from("audit_log")
      .select("id", { count: "exact", head: true })
      .eq("action", "application_submit")
      .gte("created_at", sinceIso)
      .filter("meta->>ip", "eq", ip);
    if ((ipCount ?? 0) >= MAX_APPLICATIONS_PER_IP_PER_DAY) {
      return { success: false, error: RATE_ERROR };
    }
  }

  const { count: pendingCount } = await svc
    .from("notification_log")
    .select("id", { count: "exact", head: true })
    .eq("recipient", email)
    .eq("status", "pending");
  if ((pendingCount ?? 0) >= MAX_PENDING_EMAILS_PER_RECIPIENT) {
    return {
      success: false,
      error:
        "We can't send more emails to this address right now. Please try again later.",
    };
  }

  // 2) Run must be accepting: published + inside the apply window. A null
  //    apply_open_at means open-now; a null apply_close_at means no deadline.
  //    Capacity is NOT enforced here — soft cap, handled by the chapter at
  //    accept time (spec decision).
  const { data: run } = await svc
    .from("runs")
    .select("id, program_id, chapter, status, apply_open_at, apply_close_at")
    .eq("id", v.runId)
    .maybeSingle();
  if (!run) {
    return { success: false, error: "This program could not be found." };
  }

  const now = new Date();
  if (run.status !== "published") {
    return {
      success: false,
      error: "This program is not accepting applications.",
    };
  }
  if (run.apply_open_at && now < new Date(run.apply_open_at)) {
    return {
      success: false,
      error: "Applications for this program haven't opened yet.",
    };
  }
  if (run.apply_close_at && now > new Date(run.apply_close_at)) {
    return {
      success: false,
      error: "Applications for this program have closed.",
    };
  }

  // 3) Duplicate (run_id, lower(email)) → point at the EXISTING application.
  //    Success-shaped on purpose: never a second row, never an error that
  //    could leak whether someone else applied with a different address.
  //    (This action always stores email lowercased, so eq() is exact.)
  const { data: existing } = await svc
    .from("applications")
    .select("id, status_token")
    .eq("run_id", run.id)
    .eq("email", email)
    .maybeSingle();
  if (existing) {
    return {
      success: true,
      data: { statusToken: existing.status_token, duplicate: true },
    };
  }

  // 4) Insert. consent_at = now (the checked declaration); chapter copied
  //    from the run; status_token is DB-defaulted — read it back.
  const { data: created, error: insertError } = await svc
    .from("applications")
    .insert({
      run_id: run.id,
      chapter: run.chapter,
      full_name: v.fullName,
      email,
      phone,
      dob,
      institution_id: v.institutionId ?? null,
      institution_other: institutionOther,
      degree: v.degree,
      year_of_study: v.yearOfStudy,
      motivation: v.motivation,
      yuva_member_claim: v.membershipClaim,
      consent_at: now.toISOString(),
    })
    .select("id, status_token")
    .single();

  if (insertError || !created) {
    // Unique (run_id, lower(email)) race: someone double-submitted — fetch
    // the row that won and return the duplicate-shaped success.
    if (insertError?.code === "23505") {
      const { data: raced } = await svc
        .from("applications")
        .select("id, status_token")
        .eq("run_id", run.id)
        .eq("email", email)
        .maybeSingle();
      if (raced) {
        return {
          success: true,
          data: { statusToken: raced.status_token, duplicate: true },
        };
      }
    }
    return {
      success: false,
      error: `Could not submit your application: ${insertError?.message ?? "unknown error"}`,
    };
  }

  // Audit row (also the durable per-IP rate counter — see cap above).
  await logYuvaAudit({
    action: "application_submit",
    entity: "applications",
    entity_id: created.id,
    chapter: run.chapter,
    meta: { ip, run_id: run.id },
  });

  // Confirmation email — durable queue; a delivery failure must NOT fail the
  // submission (spec edge case: "email service down → application still
  // saved, email queued").
  const { data: program } = await svc
    .from("programs")
    .select("title")
    .eq("id", run.program_id)
    .maybeSingle();
  const statusUrl = `${APP_URL}/youth-academy/applications/${created.status_token}`;
  const rendered = applicationConfirmationEmail({
    studentName: v.fullName,
    programName: program?.title ?? "Yi Youth Academy program",
    statusUrl,
  });
  const emailResult = await sendYuvaEmail({
    to: email,
    emailType: "application_confirmation",
    subject: rendered.subject,
    html: rendered.html,
    text: rendered.text,
    dedupeKey: `application_confirmation:${created.id}`,
    meta: { application_id: created.id, run_id: run.id },
  });
  if (!emailResult.ok) {
    console.error(
      "[yuva-apply] confirmation email enqueue failed for",
      created.id,
      ":",
      emailResult.error
    );
  }

  // 5) The status token is the applicant's only credential — return it.
  return {
    success: true,
    data: { statusToken: created.status_token, duplicate: false },
  };
}

// ─── getApplicationStatusByToken (PUBLIC, tokenized) ──────────────────────

export type ApplicationStatusView = {
  status: "pending" | "accepted" | "rejected" | "withdrawn";
  fullName: string;
  programTitle: string;
  academyName: string;
  startDate: string | null;
  endDate: string | null;
  cohortAnnounceDate: string | null;
};

// DB default is encode(gen_random_bytes(24),'hex') = 48 hex chars; accept a
// hex band around that so a future token rotation doesn't strand applicants.
const TOKEN_RE = /^[0-9a-f]{32,128}$/i;

/**
 * Single lookup by the unguessable status_token. Returns ONLY the
 * applicant's own application + run context — NEVER other applicants' data.
 * Invalid/unknown token → null (the page renders notFound()).
 */
export async function getApplicationStatusByToken(
  token: string
): Promise<ApplicationStatusView | null> {
  const t = (token ?? "").trim();
  if (!TOKEN_RE.test(t)) return null;

  const svc = await createServiceClient();
  const { data: application } = await svc
    .from("applications")
    .select("id, run_id, status, full_name")
    .eq("status_token", t)
    .maybeSingle();
  if (!application) return null;

  const { data: run } = await svc
    .from("runs")
    .select(
      "id, program_id, academy_id, start_date, end_date, cohort_announce_date"
    )
    .eq("id", application.run_id)
    .maybeSingle();

  let programTitle = "Yi Youth Academy program";
  let academyName = "Yi Youth Academy";
  if (run) {
    const [programRes, academyRes] = await Promise.all([
      svc
        .from("programs")
        .select("title")
        .eq("id", run.program_id)
        .maybeSingle(),
      svc
        .from("academies")
        .select("display_name")
        .eq("id", run.academy_id)
        .maybeSingle(),
    ]);
    programTitle = programRes.data?.title ?? programTitle;
    academyName = academyRes.data?.display_name ?? academyName;
  }

  return {
    status: application.status,
    fullName: application.full_name,
    programTitle,
    academyName,
    startDate: run?.start_date ?? null,
    endDate: run?.end_date ?? null,
    cohortAnnounceDate: run?.cohort_announce_date ?? null,
  };
}
