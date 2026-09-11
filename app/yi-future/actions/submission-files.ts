"use server";

// ═══════════════════════════════════════════════════════════════════════
// UPLOADED SUBMISSION FILES
//
// Submissions have only ever accepted a link. Every one of the 734 URLs on
// file is a Google Drive or Docs link, which means a moderator or juror has to
// REQUEST ACCESS from the student and wait — per submission, per person — and
// the chapter's work can never be gathered in one place.
//
// This adds a real upload alongside the link: a slot takes a link or a file,
// so a team with a 200MB video or a living Google Doc can still paste a link.
// Once a file is uploaded it REPLACES whatever the slot held before — the old
// link and any earlier file — so nobody opens a rejected version by mistake.
//
// FOUR PROPERTIES
//
// 1. PERMISSION IS CHECKED HERE; THE BYTES GO STRAIGHT TO STORAGE. Students
//    hold an access-code session, not a Supabase Auth session, so the bucket
//    cannot simply be opened to the browser — anyone on the internet could
//    write into it. Instead startSubmissionUpload proves team membership and
//    issues a one-time upload link for ONE path it chose, and
//    finishSubmissionUpload records the file only after storage confirms it.
//    The file never crosses a server action: Vercel refuses request bodies
//    over ~4.5 MB before the function runs.
//
// 2. THE BUCKET IS PRIVATE. Reads are short-lived signed URLs minted
//    server-side, so a leaked link cannot be replayed forever — unlike a Drive
//    link set to "anyone with the link".
//
// 3. IT FAILS CLOSED. resolveTeamMemberSession proves the caller is on the
//    team before a byte is written; a submitted or approved phase is locked;
//    the slot name is checked against a fixed list, never trusted.
//
// 4. THE OBJECT AND THE ROW ARE KEPT HONEST. The row is written only after the
//    object lands, and if the row write fails the object is removed again — so
//    storage never accumulates files nothing points at.
// ═══════════════════════════════════════════════════════════════════════

import { revalidatePath } from "next/cache";
import { createServiceClient } from "@/lib/yi-future/supabase/server";
import { readSession } from "@/app/yi-future/actions/auth";
import { safeError } from "@/lib/yi-future/db-error";
import {
  ACCEPTED_UPLOAD_TYPES,
  MAX_UPLOAD_BYTES,
  SUBMISSION_BUCKET,
  formatBytes,
  isSubmissionSlot,
  mimeForFile,
  safeFileName,
} from "@/lib/yi-future/submission-files";

type ActionResult = { ok: true; message?: string } | { ok: false; error: string };

// The storage client and future.submission_files sit outside the generated
// types (as with every table added after the last regen) → loose client, the
// established pattern in this codebase.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyClient = any;

/** Best-effort private-bucket creation; a repeat call is a no-op. */
async function ensureBucket(): Promise<void> {
  try {
    const svc = await createServiceClient();
    const { error } = await (svc as AnyClient).storage.createBucket(
      SUBMISSION_BUCKET,
      { public: false }
    );
    if (error && !/already exists|duplicate/i.test(error.message ?? "")) {
      console.warn("[submission-files] createBucket:", error.message);
    }
  } catch (err) {
    console.warn("[submission-files] ensureBucket failed (non-fatal):", err);
  }
}

/**
 * Prove the caller is on this team, and return the submission row for the
 * phase. Mirrors resolveTeamMemberSession in submissions.ts — the delegate
 * identity comes from the signed session cookie, never from the caller.
 */
async function resolveMemberAndSubmission(
  submissionId: string
): Promise<
  | { delegateId: string; teamId: string; status: string }
  | { error: string }
> {
  const session = await readSession();
  if (!session || session.type !== "delegate") {
    return { error: "Sign in as a delegate first." };
  }

  const svc = await createServiceClient();
  const { data: subRaw } = await svc
    .schema("future")
    .from("submissions")
    .select("id, team_id, status")
    .eq("id", submissionId)
    .maybeSingle();
  const sub = subRaw as { id: string; team_id: string; status: string } | null;
  if (!sub) return { error: "That submission no longer exists — reload the page." };

  const { data: teamRaw } = await svc
    .schema("future")
    .from("teams")
    .select("id, captain_id, leader_delegate_id")
    .eq("id", sub.team_id)
    .maybeSingle();
  const team = teamRaw as unknown as {
    id: string;
    captain_id: string | null;
    leader_delegate_id: string | null;
  } | null;
  if (!team) return { error: "Team not found." };

  if (team.captain_id !== session.id && team.leader_delegate_id !== session.id) {
    const { data: member } = await svc
      .schema("future")
      .from("team_members")
      .select("delegate_id")
      .eq("team_id", sub.team_id)
      .eq("delegate_id", session.id)
      .maybeSingle();
    if (!member) {
      return { error: "You must be on this team to attach a file." };
    }
  }

  return { delegateId: session.id, teamId: sub.team_id, status: sub.status };
}

/** Every rule an upload must meet, shared by both steps so the two checks can
 *  never drift apart. Returns a sentence, or null when the upload is fine. */
function uploadProblem(slot: string, size: number, type: string): string | null {
  if (!isSubmissionSlot(slot)) {
    return "Nothing was uploaded. That is not a deliverable this phase accepts.";
  }
  if (!Number.isFinite(size) || size <= 0) {
    return "Nothing was uploaded. Choose a file first.";
  }
  if (size > MAX_UPLOAD_BYTES) {
    return `Nothing was uploaded. That file is ${formatBytes(size)}; the limit is ${formatBytes(
      MAX_UPLOAD_BYTES
    )}. Compress it, or paste a share link instead.`;
  }
  if (!type || !(type in ACCEPTED_UPLOAD_TYPES)) {
    return "Nothing was uploaded. Upload a PDF, Word or PowerPoint file — for anything else (video, a live Google Doc) paste a share link instead.";
  }
  return null;
}

const LOCKED_PHASE =
  "Nothing was uploaded. This phase is already submitted — ask your chapter admin to reopen it if something needs changing.";

type StartUploadResult =
  | { ok: true; path: string; token: string; contentType: string }
  | { ok: false; error: string };

/**
 * Upload, step 1 of 2: prove the caller may attach this file, then give the
 * browser a one-time upload link for ONE storage path chosen here.
 *
 * WHY THE FILE NO LONGER CROSSES A SERVER ACTION
 * Vercel refuses a request body over ~4.5 MB with 413
 * FUNCTION_PAYLOAD_TOO_LARGE before any function code runs — measured against
 * production on 2026-09-11: a 3 MB POST reached the app, a 6 MB POST got 413.
 * The first version sent the whole file through a server action, so every file
 * over that line failed with no message on a screen that promised 8 MB. Of the
 * first 162 files uploaded, the largest was 4.04 MB, and a team whose
 * submission had been rejected could not upload its revised document at all.
 *
 * Now only the file's name, size and type come here. The bytes go from the
 * browser straight to storage, and the link works for exactly one path inside
 * this team's own folder. The bucket stays private.
 */
export async function startSubmissionUpload(input: {
  submissionId: string;
  slot: string;
  fileName: string;
  size: number;
  type: string;
}): Promise<StartUploadResult> {
  const submissionId = String(input.submissionId ?? "").trim();
  const slot = String(input.slot ?? "").trim();
  const fileName = String(input.fileName ?? "");
  if (!submissionId) {
    return { ok: false, error: "Nothing was uploaded. No submission was named." };
  }

  const contentType = mimeForFile(fileName, String(input.type ?? ""));
  const problem = uploadProblem(slot, Number(input.size), contentType);
  if (problem) return { ok: false, error: problem };

  const auth = await resolveMemberAndSubmission(submissionId);
  if ("error" in auth) return { ok: false, error: auth.error };
  if (auth.status === "submitted" || auth.status === "approved") {
    return { ok: false, error: LOCKED_PHASE };
  }

  await ensureBucket();
  const svc = await createServiceClient();

  // Team-first path so everything for one team sits together in storage, which
  // is also the order the chapter-wise export walks.
  const path = `${auth.teamId}/${submissionId}/${slot}/${Date.now()}-${safeFileName(fileName)}`;

  const { data, error } = await (svc as AnyClient).storage
    .from(SUBMISSION_BUCKET)
    .createSignedUploadUrl(path);
  const token = (data as { token?: string } | null)?.token;
  if (error || !token) {
    return {
      ok: false,
      error: `Nothing was uploaded. ${safeError(error?.message, "submission-files.signUpload")}`,
    };
  }
  return { ok: true, path, token, contentType };
}

/**
 * Upload, step 2 of 2: the browser reports the bytes have landed. Nothing it
 * says about the file is trusted — the object is looked up in storage and its
 * real size and type are checked before a row is written.
 */
export async function finishSubmissionUpload(input: {
  submissionId: string;
  slot: string;
  path: string;
}): Promise<ActionResult> {
  const submissionId = String(input.submissionId ?? "").trim();
  const slot = String(input.slot ?? "").trim();
  const path = String(input.path ?? "").trim();
  if (!submissionId || !path || !isSubmissionSlot(slot)) {
    return { ok: false, error: "Nothing was attached. The upload was incomplete — try again." };
  }

  const auth = await resolveMemberAndSubmission(submissionId);
  if ("error" in auth) return { ok: false, error: auth.error };
  if (auth.status === "submitted" || auth.status === "approved") {
    return { ok: false, error: LOCKED_PHASE };
  }

  // Only a path of the exact shape step 1 produces, inside this team's folder
  // for this submission and slot, may be recorded. Fails closed.
  const folder = `${auth.teamId}/${submissionId}/${slot}`;
  const base = path.startsWith(`${folder}/`) ? path.slice(folder.length + 1) : "";
  if (!base || base.includes("/")) {
    return {
      ok: false,
      error: "Nothing was attached. That upload does not belong to this deliverable.",
    };
  }

  const svc = await createServiceClient();
  const bucket = (svc as AnyClient).storage.from(SUBMISSION_BUCKET);

  const { data: listed, error: listErr } = await bucket.list(folder, {
    limit: 100,
    search: base,
  });
  const stored = (
    (listed as { name: string; metadata?: { size?: number; mimetype?: string } | null }[] | null) ?? []
  ).find((o) => o.name === base);
  if (listErr || !stored) {
    return {
      ok: false,
      error: "Nothing was attached. The file did not reach storage — try uploading it again.",
    };
  }

  const size = Number(stored.metadata?.size ?? 0);
  const contentType = String(stored.metadata?.mimetype ?? "");
  const problem = uploadProblem(slot, size, contentType);
  if (problem) {
    await bucket.remove([path]).catch(() => null);
    return { ok: false, error: problem };
  }

  // Stored as "<timestamp>-<safe name>"; students see the name they chose.
  const name = base.replace(/^\d+-/, "");

  const { error: rowErr } = await (svc as AnyClient)
    .schema("future")
    .from("submission_files")
    .insert({
      submission_id: submissionId,
      slot,
      file_path: path,
      file_name: name,
      size_bytes: size,
      content_type: contentType,
      uploaded_by_delegate_id: auth.delegateId,
    });

  // 23505 means this exact path is already recorded — a repeated step 2. That
  // object belongs to the existing row, so it must NOT be removed.
  if (rowErr && rowErr.code !== "23505") {
    // Otherwise put storage back rather than leave an object nothing points at.
    await bucket.remove([path]).catch(() => null);
    return {
      ok: false,
      error: `Nothing was attached. ${safeError(rowErr.message, "submission-files.insert")}`,
    };
  }

  // THE NEW FILE REPLACES WHAT THE SLOT HELD BEFORE.
  // A team uploading a revised document after a rejection still had the
  // rejected link, and any earlier file, on the same deliverable — and the link
  // is what the chair's "Open link" and the team's own "Open" button opened, so
  // everyone kept reading the rejected version. The Director's rule
  // (2026-09-11): a new upload replaces the old link and older files in that
  // slot. This runs only after the new row exists, so a failure here can never
  // lose the new file, and a repeated step 2 finds nothing left to replace.
  const replaced: string[] = [];
  const problems: string[] = [];

  const { data: olderRaw } = await (svc as AnyClient)
    .schema("future")
    .from("submission_files")
    .select("id, file_path")
    .eq("submission_id", submissionId)
    .eq("slot", slot)
    .neq("file_path", path);
  const older = (olderRaw as { id: string; file_path: string }[] | null) ?? [];
  if (older.length > 0) {
    const { error: olderErr } = await (svc as AnyClient)
      .schema("future")
      .from("submission_files")
      .delete()
      .in("id", older.map((o) => o.id));
    if (olderErr) {
      problems.push("the earlier file is still listed — use Remove on it");
    } else {
      // Row first, object second, as in deleteSubmissionFile.
      await bucket.remove(older.map((o) => o.file_path)).catch(() => null);
      replaced.push(older.length === 1 ? "the earlier file" : "the earlier files");
    }
  }

  // Slots mirror the *_url columns on submissions (see SUBMISSION_SLOTS).
  const linkColumn = `${slot}_url`;
  const { data: clearedRaw, error: linkErr } = await (svc as AnyClient)
    .schema("future")
    .from("submissions")
    .update({ [linkColumn]: null, updated_at: new Date().toISOString() })
    .eq("id", submissionId)
    .not(linkColumn, "is", null)
    .select("id");
  if (linkErr) {
    problems.push("the old link is still in the box — clear it before you submit");
  } else if (((clearedRaw as unknown[] | null) ?? []).length > 0) {
    replaced.push("the earlier link");
  }

  revalidatePath("/yi-future/me/submissions");
  revalidatePath("/yi-future/chapter/submissions");

  if (problems.length > 0) {
    return { ok: false, error: `${name} attached, but ${problems.join(", and ")}.` };
  }
  return {
    ok: true,
    message: replaced.length
      ? `${name} attached. It replaces ${replaced.join(" and ")}.`
      : `${name} attached.`,
  };
}

/** Remove a file the team attached. */
export async function deleteSubmissionFile(
  formData: FormData
): Promise<ActionResult> {
  const fileId = String(formData.get("fileId") ?? "").trim();
  if (!fileId) return { ok: false, error: "Nothing was removed. No file was named." };

  const svc = await createServiceClient();
  const { data: rowRaw } = await (svc as AnyClient)
    .schema("future")
    .from("submission_files")
    .select("id, submission_id, file_path, file_name")
    .eq("id", fileId)
    .maybeSingle();
  const row = rowRaw as {
    id: string;
    submission_id: string;
    file_path: string;
    file_name: string;
  } | null;
  if (!row) return { ok: false, error: "Nothing was removed. That file is already gone." };

  const auth = await resolveMemberAndSubmission(row.submission_id);
  if ("error" in auth) return { ok: false, error: auth.error };
  if (auth.status === "submitted" || auth.status === "approved") {
    return {
      ok: false,
      error:
        "Nothing was removed. This phase is already submitted — ask your chapter admin to reopen it first.",
    };
  }

  const { error: delErr } = await (svc as AnyClient)
    .schema("future")
    .from("submission_files")
    .delete()
    .eq("id", fileId);
  if (delErr) {
    return {
      ok: false,
      error: `Nothing was removed. ${safeError(delErr.message, "submission-files.delete")}`,
    };
  }

  // Row first, object second: an orphaned object is invisible clutter, whereas
  // a row pointing at a deleted object is a broken link in the jury's face.
  await (svc as AnyClient).storage
    .from(SUBMISSION_BUCKET)
    .remove([row.file_path])
    .catch(() => null);

  revalidatePath("/yi-future/me/submissions");
  revalidatePath("/yi-future/chapter/submissions");
  return { ok: true, message: `${row.file_name} removed.` };
}
