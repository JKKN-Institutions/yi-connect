"use server";

// ═══════════════════════════════════════════════════════════════════════
// Yi Youth Academy — certificate actions (Phase 14). PUBLISHED FACTS —
// certificate numbers are permanent; treat every write with highest care.
//
// Spec: docs/yi-youth-academy-spec.md → Server Actions Inventory row
// `actions/certificates.ts`.
//
// Exports:
//   issueCertificates    — manager-only batch issue. IDEMPOTENT: already-
//                          certified enrollments are skipped BEFORE any
//                          number is allocated (lib/yuva/issue-plan.ts), so
//                          a double-click burns no numbers and orphans no
//                          PDFs. Per row: yuva.next_certificate_no() (atomic,
//                          year-internal) → render PDF → upload
//                          yuva-certificates → INSERT certificates row
//                          (attendance_pct snapshot) → UPDATE
//                          enrollments.certificate_id → enqueue 'certificate'
//                          email (dedupe_key certificate:{enrollment_id}).
//                          Per-row failures are collected, never abort the
//                          batch. First successful issue transitions the run
//                          completed → certified (run-machine validated).
//   reissueCertificate   — SAME number, regenerate the PDF (e.g. after a
//                          name fix in yi_directory), overwrite the storage
//                          object, audit old/new path.
//   getCertificateSignedUrl — manager download path (signed, short-lived).
//   revokeCertificate    — manager, sets revoked, audited (rare).
//   getMyCertificateUrl  — STUDENT download path: getStudentSession +
//                          enrollment ownership; revoked → explicit notice.
//
// Contract: gate-first → pure plan (lib/yuva/issue-plan) → service-client
// writes → logYuvaAudit → revalidatePath → ActionResult. Expected failures
// return { success:false, error } — NEVER a throw, NEVER a silent redirect.
// ═══════════════════════════════════════════════════════════════════════

import { revalidatePath } from "next/cache";
import { z } from "zod";
import type { ActionResult } from "@/lib/yuva/action-result";
import { logYuvaAudit } from "@/lib/yuva/audit";
import { getStudentSession } from "@/lib/yuva/auth/student-session";
import { getYuvaAccess } from "@/lib/yuva/auth/yuva-access";
import { canOverrideEligibility } from "@/lib/yuva/certificate-eligibility";
import { renderCertificatePdfBuffer } from "@/lib/yuva/certificate-pdf";
import { CERT_ATTENDANCE_DEFAULT } from "@/lib/yuva/constants";
import { sendYuvaEmail } from "@/lib/yuva/email";
import { certificateEmail } from "@/lib/yuva/email-templates";
import { buildIssuePlan, type IssuePlanEntry } from "@/lib/yuva/issue-plan";
import {
  attendancePct,
  type AttendanceRow,
  type ProgressEnrollment,
  type ProgressSession,
} from "@/lib/yuva/progress";
import { canTransitionRun, runStatusLabel } from "@/lib/yuva/run-machine";
import {
  createSignedUrl,
  publicUrl,
  removeObject,
  uploadBase64,
} from "@/lib/yuva/storage";
import { createServiceClient } from "@/lib/yuva/supabase/service";
// yip server module's Database type includes the yi_directory schema
// (repo precedent: components/yuva/cohort/data.ts).
import { createServiceClient as createDirService } from "@/lib/yip/supabase/server";

const APP_URL =
  process.env.NEXT_PUBLIC_APP_URL ?? "https://yi-connect-app.vercel.app";
const CERTIFICATE_PAGE_URL = `${APP_URL}/youth-academy/me/certificate`;

const uuid = z.string().uuid();

const overridesSchema = z
  .array(
    z.object({
      enrollment_id: z.string().uuid(),
      include: z.boolean(),
    })
  )
  .max(500, "Too many overrides in one request.");

type Svc = Awaited<ReturnType<typeof createServiceClient>>;

function formatDate(value: string | null): string | null {
  if (!value) return null;
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return null;
  return d.toLocaleDateString("en-IN", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

function revalidateCertificatePaths(runId: string) {
  revalidatePath(`/youth-academy/chapter/runs/${runId}/cohort`);
  revalidatePath(`/youth-academy/chapter/runs/${runId}`);
  revalidatePath(`/youth-academy/me/certificate`);
}

// ─── Shared gate: certificate → enrollment → run → canManageRun ───────────

type CertGate =
  | {
      ok: true;
      svc: Svc;
      personId: string | null;
      cert: {
        id: string;
        certificate_no: string;
        enrollment_id: string;
        pdf_storage_path: string;
        revoked: boolean;
        issued_at: string;
      };
      enrollment: { id: string; person_id: string; run_id: string };
      run: {
        id: string;
        academy_id: string;
        chapter: string;
        status: string;
        program_id: string;
        start_date: string | null;
        end_date: string | null;
      };
    }
  | { ok: false; error: string };

async function gateCertificate(certificateId: string): Promise<CertGate> {
  if (!uuid.safeParse(certificateId).success) {
    return { ok: false, error: "Invalid certificate id." };
  }
  const svc = await createServiceClient();
  const { data: cert } = await svc
    .from("certificates")
    .select(
      "id, certificate_no, enrollment_id, pdf_storage_path, revoked, issued_at"
    )
    .eq("id", certificateId)
    .maybeSingle();
  if (!cert) return { ok: false, error: "Certificate not found." };

  const { data: enrollment } = await svc
    .from("enrollments")
    .select("id, person_id, run_id")
    .eq("id", cert.enrollment_id)
    .maybeSingle();
  if (!enrollment) return { ok: false, error: "Enrollment not found." };

  const { data: run } = await svc
    .from("runs")
    .select("id, academy_id, chapter, status, program_id, start_date, end_date")
    .eq("id", enrollment.run_id)
    .maybeSingle();
  if (!run) return { ok: false, error: "Run not found." };

  const access = await getYuvaAccess();
  if (
    !access.canManageRun({ academy_id: run.academy_id, chapter: run.chapter })
  ) {
    return {
      ok: false,
      error: `Only a run manager can do this. Your access: ${access.reason}`,
    };
  }

  return { ok: true, svc, personId: access.personId, cert, enrollment, run };
}

// ─── PDF context assembly (academy / program / student names) ─────────────

async function loadPdfContext(
  svc: Svc,
  run: { id: string; academy_id: string; program_id: string },
  personIds: string[]
): Promise<{
  academyName: string;
  logoUrl: string | null;
  programTitle: string;
  signatories: { label: string; name?: string | null }[];
  nameByPersonId: Map<string, string>;
  emailByPersonId: Map<string, string>;
  institutionByPersonId: Map<string, string>;
}> {
  const [academyRes, programRes] = await Promise.all([
    svc
      .from("academies")
      // `signatories` is post-types-regen; loose-read it (see cast below).
      .select("display_name, logo_storage_path, signatories")
      .eq("id", run.academy_id)
      .maybeSingle(),
    svc
      .from("programs")
      .select("title")
      .eq("id", run.program_id)
      .maybeSingle(),
  ]);

  const nameByPersonId = new Map<string, string>();
  const emailByPersonId = new Map<string, string>();
  const institutionByPersonId = new Map<string, string>();
  if (personIds.length > 0) {
    const dir = await createDirService();
    const { data: people } = await dir
      .schema("yi_directory")
      .from("people")
      .select("id, full_name, email")
      .in("id", personIds);
    for (const p of people ?? []) {
      if (p.full_name) nameByPersonId.set(p.id, p.full_name);
      if (p.email) emailByPersonId.set(p.id, p.email);
    }

    // Institution name (certificate "of [Institution]" clause): each student's
    // application in this run carries either institution_id (→ yi.institutions)
    // or free-text institution_other. Resilient — absent ⇒ clause omitted.
    const { data: apps } = await svc
      .from("applications")
      .select("person_id, institution_id, institution_other")
      .eq("run_id", run.id)
      .in("person_id", personIds);
    const instIds = [
      ...new Set(
        (apps ?? [])
          .map((a) => a.institution_id)
          .filter((v): v is string => !!v)
      ),
    ];
    const instNameById = new Map<string, string>();
    if (instIds.length > 0) {
      const { data: insts } = await dir
        .schema("yi")
        .from("institutions")
        .select("id, name")
        .in("id", instIds);
      for (const i of insts ?? []) if (i.name) instNameById.set(i.id, i.name);
    }
    for (const a of apps ?? []) {
      if (!a.person_id) continue;
      const name =
        (a.institution_id && instNameById.get(a.institution_id)) ||
        a.institution_other ||
        null;
      if (name) institutionByPersonId.set(a.person_id, name);
    }
  }

  return {
    academyName: academyRes.data?.display_name ?? "Yi Youth Academy",
    logoUrl: academyRes.data?.logo_storage_path
      ? publicUrl(academyRes.data.logo_storage_path)
      : null,
    programTitle: programRes.data?.title ?? "Program",
    // `signatories` is a jsonb column added 2026-06-11 (post-types-regen);
    // read via a loose cast and normalize to the PDF prop shape. Null/garbage
    // → [], which makes the renderer fall back to the generic blocks.
    signatories: coerceSignatories(
      (academyRes.data as { signatories?: unknown } | null)?.signatories
    ),
    nameByPersonId,
    emailByPersonId,
    institutionByPersonId,
  };
}

/**
 * Normalize the academy.signatories jsonb into the PDF prop shape. Defensive:
 * any non-array / malformed value collapses to [] (renderer then falls back
 * to the two generic signature blocks).
 */
function coerceSignatories(
  raw: unknown
): { label: string; name?: string | null }[] {
  if (!Array.isArray(raw)) return [];
  const out: { label: string; name?: string | null }[] = [];
  for (const item of raw) {
    if (!item || typeof item !== "object") continue;
    const rec = item as { label?: unknown; name?: unknown };
    const label = typeof rec.label === "string" ? rec.label.trim() : "";
    if (!label) continue;
    const name = typeof rec.name === "string" ? rec.name.trim() || null : null;
    out.push({ label, name });
    if (out.length === 3) break;
  }
  return out;
}

// ─── issueCertificates (manager-only, idempotent batch) ───────────────────

export async function issueCertificates(
  runId: string,
  overrides: { enrollment_id: string; include: boolean }[]
): Promise<
  ActionResult<{
    issued: number;
    skippedAlreadyCertified: number;
    excluded: number;
    failures: { enrollment_id: string; error: string }[];
    emailsQueued: number;
    runCertified: boolean;
  }>
> {
  if (!uuid.safeParse(runId).success) {
    return { success: false, error: "Invalid run id." };
  }
  const parsedOverrides = overridesSchema.safeParse(overrides);
  if (!parsedOverrides.success) {
    return {
      success: false,
      error: parsedOverrides.error.issues[0]?.message ?? "Invalid overrides.",
    };
  }

  const svc = await createServiceClient();
  const { data: run } = await svc
    .from("runs")
    .select("id, academy_id, chapter, status, program_id, start_date, end_date")
    .eq("id", runId)
    .maybeSingle();
  if (!run) return { success: false, error: "Run not found." };

  // Gate: run manager (chapter admin / coordinator / national).
  const access = await getYuvaAccess();
  if (
    !access.canManageRun({ academy_id: run.academy_id, chapter: run.chapter })
  ) {
    return {
      success: false,
      error: `Only a run manager can issue certificates. Your access: ${access.reason}`,
    };
  }

  // Blocked unless the run is completed (or certified — issuing stragglers).
  if (run.status !== "completed" && run.status !== "certified") {
    return {
      success: false,
      error: `Certificates can only be issued after the run is completed (this run is ${runStatusLabel(run.status as never).toLowerCase()}).`,
    };
  }

  // Live roster + attendance (never trust client-supplied percentages).
  const [sessionsRes, enrollmentsRes] = await Promise.all([
    svc
      .from("run_sessions")
      .select("id, status, expects_submission")
      .eq("run_id", run.id),
    svc
      .from("enrollments")
      .select("id, person_id, status, certificate_id, application_id")
      .eq("run_id", run.id),
  ]);
  const sessions = sessionsRes.data ?? [];
  const enrollments = enrollmentsRes.data ?? [];
  if (enrollments.length === 0) {
    return { success: false, error: "This run has no cohort to certify." };
  }

  // Per-student overrides are gated on ≥1 completed session (pure decision).
  if (parsedOverrides.data.length > 0) {
    const overrideGate = canOverrideEligibility(
      sessions.map((s) => ({ status: s.status }))
    );
    if (!overrideGate.allowed) {
      return {
        success: false,
        error: overrideGate.reason ?? "Per-student override is not allowed.",
      };
    }
  }

  const sessionIds = sessions.map((s) => s.id);
  let attendance: AttendanceRow[] = [];
  if (sessionIds.length > 0) {
    const { data } = await svc
      .from("attendance")
      .select("enrollment_id, run_session_id, present")
      .in("run_session_id", sessionIds);
    attendance = data ?? [];
  }

  const progressSessions: ProgressSession[] = sessions.map((s) => ({
    id: s.id,
    status: s.status,
    expects_submission: s.expects_submission,
  }));

  const attendanceByEnrollment = new Map<string, number>();
  for (const e of enrollments) {
    const single: ProgressEnrollment[] = [{ id: e.id, status: e.status }];
    attendanceByEnrollment.set(
      e.id,
      attendancePct(
        single,
        progressSessions,
        attendance.filter((a) => a.enrollment_id === e.id)
      )
    );
  }

  // Pure plan: already-certified skipped BEFORE any number is allocated.
  const rosterEntries: IssuePlanEntry[] = enrollments.map((e) => ({
    enrollment_id: e.id,
    attendance_pct: attendanceByEnrollment.get(e.id) ?? 0,
    certificate_id: e.certificate_id,
    enrollment_status: e.status,
  }));
  const plan = buildIssuePlan(
    rosterEntries,
    CERT_ATTENDANCE_DEFAULT,
    parsedOverrides.data
  );

  const enrollmentById = new Map(enrollments.map((e) => [e.id, e]));
  const personIds = [
    ...new Set(
      plan.toIssue
        .map((id) => enrollmentById.get(id)?.person_id)
        .filter((v): v is string => !!v)
    ),
  ];
  const ctx = await loadPdfContext(svc, run, personIds);

  // Email fallback: the application the enrollment came from.
  const applicationIds = plan.toIssue
    .map((id) => enrollmentById.get(id)?.application_id)
    .filter((v): v is string => !!v);
  const emailByApplication = new Map<string, string>();
  if (applicationIds.length > 0) {
    const { data: applications } = await svc
      .from("applications")
      .select("id, email")
      .in("id", applicationIds);
    for (const a of applications ?? []) {
      if (a.email) emailByApplication.set(a.id, a.email);
    }
  }

  const issuedOn = formatDate(new Date().toISOString()) ?? "";
  const startDate = formatDate(run.start_date);
  const endDate = formatDate(run.end_date);

  // Sequential issue loop — per-row failures collected, never abort batch.
  let issued = 0;
  let raceSkipped = 0;
  let emailsQueued = 0;
  const failures: { enrollment_id: string; error: string }[] = [];

  for (const enrollmentId of plan.toIssue) {
    const enrollment = enrollmentById.get(enrollmentId);
    if (!enrollment) continue;
    try {
      // 1. Atomic, year-internal number (yuva.next_certificate_no()).
      const { data: certificateNo, error: rpcError } = await svc.rpc(
        "next_certificate_no"
      );
      if (rpcError || !certificateNo) {
        throw new Error(
          rpcError?.message ?? "Could not allocate a certificate number."
        );
      }

      // 2. Render the PDF (dummy design — Director's file pending).
      const studentName =
        ctx.nameByPersonId.get(enrollment.person_id) ?? "Student";
      const buffer = await renderCertificatePdfBuffer({
        studentName,
        institutionName:
          ctx.institutionByPersonId.get(enrollment.person_id) ?? null,
        programName: ctx.programTitle,
        academyName: ctx.academyName,
        logoUrl: ctx.logoUrl,
        chapter: run.chapter,
        startDate,
        endDate,
        certificateNo,
        issuedOn,
      });

      // 3. Upload to the private bucket.
      const path = `runs/${run.id}/${certificateNo}.pdf`;
      const uploaded = await uploadBase64(
        "yuva-certificates",
        path,
        buffer.toString("base64"),
        "application/pdf"
      );
      if (!uploaded.ok) throw new Error(uploaded.error);

      // 4. INSERT the certificate row (attendance_pct SNAPSHOT at issue).
      const { data: certRow, error: insertError } = await svc
        .from("certificates")
        .insert({
          enrollment_id: enrollment.id,
          certificate_no: certificateNo,
          pdf_storage_path: path,
          attendance_pct: attendanceByEnrollment.get(enrollment.id) ?? 0,
          issued_by: access.personId,
        })
        .select("id")
        .single();
      if (insertError || !certRow) {
        // UNIQUE violation on enrollment_id ⇒ a concurrent issue won the
        // race — idempotency holds at the DB layer. Clean up our PDF
        // (best-effort) and count as skipped, not failed.
        if ((insertError as { code?: string } | null)?.code === "23505") {
          await removeObject("yuva-certificates", path);
          raceSkipped++;
          continue;
        }
        throw new Error(insertError?.message ?? "certificates insert failed");
      }

      // 5. Backfill enrollments.certificate_id.
      const { error: backfillError } = await svc
        .from("enrollments")
        .update({ certificate_id: certRow.id })
        .eq("id", enrollment.id);
      if (backfillError) {
        // The certificate EXISTS — record but don't roll back a published fact.
        console.error(
          "[yuva-certificates] certificate_id backfill failed:",
          backfillError.message
        );
      }

      issued++;

      // 6. Enqueue the certificate email (durable queue; deduped).
      const recipient =
        ctx.emailByPersonId.get(enrollment.person_id) ??
        (enrollment.application_id
          ? emailByApplication.get(enrollment.application_id)
          : undefined);
      if (recipient) {
        const rendered = certificateEmail({
          studentName,
          programName: ctx.programTitle,
          certificateNo,
          downloadUrl: CERTIFICATE_PAGE_URL,
        });
        const emailResult = await sendYuvaEmail({
          to: recipient,
          emailType: "certificate",
          subject: rendered.subject,
          html: rendered.html,
          text: rendered.text,
          dedupeKey: `certificate:${enrollment.id}`,
          meta: { certificate_no: certificateNo, run_id: run.id },
        });
        if (emailResult.ok) emailsQueued++;
      } else {
        console.error(
          "[yuva-certificates] no email on file for person",
          enrollment.person_id
        );
      }
    } catch (e) {
      failures.push({
        enrollment_id: enrollmentId,
        error: e instanceof Error ? e.message : "Unknown issue failure",
      });
    }
  }

  // First successful issue transitions completed → certified (validated).
  let runCertified = run.status === "certified";
  if (
    issued > 0 &&
    run.status === "completed" &&
    canTransitionRun("completed", "certified")
  ) {
    const { data: updated } = await svc
      .from("runs")
      .update({ status: "certified", updated_at: new Date().toISOString() })
      .eq("id", run.id)
      .eq("status", "completed")
      .select("id");
    runCertified = !!updated && updated.length > 0;
  }

  await logYuvaAudit({
    action: "issue_certificates",
    entity: "runs",
    entity_id: run.id,
    chapter: run.chapter,
    actor_person_id: access.personId,
    meta: {
      planned: plan.toIssue.length,
      issued,
      skipped_already_certified:
        plan.skippedAlreadyCertified.length + raceSkipped,
      excluded: plan.excluded.length,
      failures: failures.length,
      overrides: parsedOverrides.data.length,
      emails_queued: emailsQueued,
      run_certified: runCertified,
    },
  });
  revalidateCertificatePaths(run.id);

  return {
    success: true,
    data: {
      issued,
      skippedAlreadyCertified: plan.skippedAlreadyCertified.length + raceSkipped,
      excluded: plan.excluded.length,
      failures,
      emailsQueued,
      runCertified,
    },
  };
}

// ─── reissueCertificate (same number, fresh PDF) ──────────────────────────

export async function reissueCertificate(
  certificateId: string
): Promise<ActionResult<{ certificateNo: string }>> {
  const gate = await gateCertificate(certificateId);
  if (!gate.ok) return { success: false, error: gate.error };
  const { svc, cert, enrollment, run } = gate;

  if (cert.revoked) {
    return {
      success: false,
      error: "This certificate is revoked — it cannot be reissued.",
    };
  }

  const ctx = await loadPdfContext(svc, run, [enrollment.person_id]);
  const studentName =
    ctx.nameByPersonId.get(enrollment.person_id) ?? "Student";

  let buffer: Buffer;
  try {
    buffer = await renderCertificatePdfBuffer({
      studentName,
      institutionName:
        ctx.institutionByPersonId.get(enrollment.person_id) ?? null,
      programName: ctx.programTitle,
      academyName: ctx.academyName,
      logoUrl: ctx.logoUrl,
      chapter: run.chapter,
      startDate: formatDate(run.start_date),
      endDate: formatDate(run.end_date),
      certificateNo: cert.certificate_no,
      issuedOn: formatDate(cert.issued_at) ?? "",
    });
  } catch (e) {
    return {
      success: false,
      error: e instanceof Error ? e.message : "PDF render failed.",
    };
  }

  // SAME number, canonical path; overwrite the storage object (upsert).
  const oldPath = cert.pdf_storage_path;
  const newPath = `runs/${run.id}/${cert.certificate_no}.pdf`;
  const uploaded = await uploadBase64(
    "yuva-certificates",
    newPath,
    buffer.toString("base64"),
    "application/pdf"
  );
  if (!uploaded.ok) return { success: false, error: uploaded.error };

  if (newPath !== oldPath) {
    const { error } = await svc
      .from("certificates")
      .update({ pdf_storage_path: newPath })
      .eq("id", cert.id);
    if (error) return { success: false, error: error.message };
    // Old object is now orphaned — best-effort cleanup.
    await removeObject("yuva-certificates", oldPath);
  }

  await logYuvaAudit({
    action: "reissue_certificate",
    entity: "certificates",
    entity_id: cert.id,
    chapter: run.chapter,
    actor_person_id: gate.personId,
    meta: {
      certificate_no: cert.certificate_no,
      enrollment_id: enrollment.id,
      old_path: oldPath,
      new_path: newPath,
      student_name: studentName,
    },
  });
  revalidateCertificatePaths(run.id);
  return { success: true, data: { certificateNo: cert.certificate_no } };
}

// ─── getCertificateSignedUrl (manager download) ───────────────────────────

export async function getCertificateSignedUrl(
  certificateId: string
): Promise<ActionResult<{ url: string; certificateNo: string }>> {
  const gate = await gateCertificate(certificateId);
  if (!gate.ok) return { success: false, error: gate.error };

  const signed = await createSignedUrl(
    "yuva-certificates",
    gate.cert.pdf_storage_path
  );
  if (!signed.ok) {
    console.error("[yuva-certificates] sign failed:", signed.error);
    return {
      success: false,
      error: "Could not prepare the download. Try again.",
    };
  }
  return {
    success: true,
    data: { url: signed.url, certificateNo: gate.cert.certificate_no },
  };
}

// ─── revokeCertificate (manager, rare) ────────────────────────────────────

export async function revokeCertificate(
  certificateId: string
): Promise<ActionResult<{ certificateNo: string }>> {
  const gate = await gateCertificate(certificateId);
  if (!gate.ok) return { success: false, error: gate.error };
  const { svc, cert, run } = gate;

  if (cert.revoked) {
    return { success: false, error: "This certificate is already revoked." };
  }

  const { data: updated, error } = await svc
    .from("certificates")
    .update({ revoked: true })
    .eq("id", cert.id)
    .eq("revoked", false)
    .select("id");
  if (error) return { success: false, error: error.message };
  if (!updated || updated.length === 0) {
    return {
      success: false,
      error: "The certificate changed meanwhile — reload and try again.",
    };
  }

  await logYuvaAudit({
    action: "revoke_certificate",
    entity: "certificates",
    entity_id: cert.id,
    chapter: run.chapter,
    actor_person_id: gate.personId,
    meta: {
      certificate_no: cert.certificate_no,
      enrollment_id: cert.enrollment_id,
    },
  });
  revalidateCertificatePaths(run.id);
  return { success: true, data: { certificateNo: cert.certificate_no } };
}

// ─── getMyCertificateUrl (student download — ownership-gated) ─────────────

export async function getMyCertificateUrl(
  enrollmentId: string
): Promise<ActionResult<{ url: string; certificateNo: string }>> {
  const session = await getStudentSession();
  if (!session) {
    return {
      success: false,
      error: "Your session has expired. Please sign in again.",
    };
  }
  if (!uuid.safeParse(enrollmentId).success) {
    return { success: false, error: "Certificate not found." };
  }

  const svc = await createServiceClient();

  // Ownership gate: the enrollment must belong to the cookie's person.
  // (Indistinguishable from missing — no enumeration of other students.)
  const { data: enrollment } = await svc
    .from("enrollments")
    .select("id, person_id")
    .eq("id", enrollmentId)
    .maybeSingle();
  if (!enrollment || enrollment.person_id !== session.personId) {
    return { success: false, error: "Certificate not found." };
  }

  const { data: cert } = await svc
    .from("certificates")
    .select("id, certificate_no, pdf_storage_path, revoked")
    .eq("enrollment_id", enrollment.id)
    .maybeSingle();
  if (!cert) {
    return {
      success: false,
      error: "Your certificate has not been issued yet.",
    };
  }
  if (cert.revoked) {
    return {
      success: false,
      error:
        "This certificate has been revoked. Please contact your chapter team for details.",
    };
  }

  const signed = await createSignedUrl(
    "yuva-certificates",
    cert.pdf_storage_path
  );
  if (!signed.ok) {
    console.error("[yuva-certificates] student sign failed:", signed.error);
    return {
      success: false,
      error: "Could not prepare the download. Try again.",
    };
  }
  return {
    success: true,
    data: { url: signed.url, certificateNo: cert.certificate_no },
  };
}
