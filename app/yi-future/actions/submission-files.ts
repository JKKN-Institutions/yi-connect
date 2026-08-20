"use server";

// ═══════════════════════════════════════════════════════════════════════
// UPLOADED SUBMISSION FILES
//
// Submissions have only ever accepted a link. Every one of the 734 URLs on
// file is a Google Drive or Docs link, which means a moderator or juror has to
// REQUEST ACCESS from the student and wait — per submission, per person — and
// the chapter's work can never be gathered in one place.
//
// This adds a real upload ALONGSIDE the link. Neither replaces the other: a
// slot may hold a link, a file, or both, so a team with a 200MB video or a
// living Google Doc keeps working exactly as it does today.
//
// FOUR PROPERTIES
//
// 1. THE UPLOAD GOES THROUGH THIS ACTION, not the browser. Students hold an
//    access-code session, not a Supabase Auth session, so a client-side upload
//    would need an anonymous-writable bucket — meaning anyone on the internet
//    could write into it. The file crosses the server action instead, where
//    team membership has already been proved.
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

/** Attach one uploaded file to a deliverable slot. */
export async function uploadSubmissionFile(
  formData: FormData
): Promise<ActionResult> {
  const submissionId = String(formData.get("submissionId") ?? "").trim();
  const slot = String(formData.get("slot") ?? "").trim();
  const file = formData.get("file");

  if (!submissionId) return { ok: false, error: "Nothing was uploaded. No submission was named." };
  if (!isSubmissionSlot(slot)) {
    return { ok: false, error: "Nothing was uploaded. That is not a deliverable this phase accepts." };
  }
  if (!(file instanceof File) || file.size === 0) {
    return { ok: false, error: "Nothing was uploaded. Choose a file first." };
  }

  const auth = await resolveMemberAndSubmission(submissionId);
  if ("error" in auth) return { ok: false, error: auth.error };

  // A phase the team has already submitted is locked, matching the read-only
  // behaviour of the rest of the form.
  if (auth.status === "submitted" || auth.status === "approved") {
    return {
      ok: false,
      error:
        "Nothing was uploaded. This phase is already submitted — ask your chapter admin to reopen it if something needs changing.",
    };
  }

  if (file.size > MAX_UPLOAD_BYTES) {
    return {
      ok: false,
      error: `Nothing was uploaded. That file is ${formatBytes(file.size)}; the limit is ${formatBytes(
        MAX_UPLOAD_BYTES
      )}. Compress it, or paste a share link instead.`,
    };
  }

  const known = Object.keys(ACCEPTED_UPLOAD_TYPES);
  if (file.type && !known.includes(file.type)) {
    return {
      ok: false,
      error:
        "Nothing was uploaded. Upload a PDF, Word or PowerPoint file — for anything else (video, a live Google Doc) paste a share link instead.",
    };
  }

  await ensureBucket();
  const svc = await createServiceClient();

  const name = safeFileName(file.name);
  // Team-first path so everything for one team sits together in storage, which
  // is also the order the chapter-wise export walks.
  const path = `${auth.teamId}/${submissionId}/${slot}/${Date.now()}-${name}`;

  const { error: upErr } = await (svc as AnyClient).storage
    .from(SUBMISSION_BUCKET)
    .upload(path, file, {
      upsert: false,
      contentType: file.type || "application/octet-stream",
    });
  if (upErr) {
    return {
      ok: false,
      error: `Nothing was uploaded. ${safeError(upErr.message, "submission-files.upload")}`,
    };
  }

  const { error: rowErr } = await (svc as AnyClient)
    .schema("future")
    .from("submission_files")
    .insert({
      submission_id: submissionId,
      slot,
      file_path: path,
      file_name: name,
      size_bytes: file.size,
      content_type: file.type || null,
      uploaded_by_delegate_id: auth.delegateId,
    });

  if (rowErr) {
    // Put storage back the way it was rather than leaving an object nothing
    // points at.
    await (svc as AnyClient).storage
      .from(SUBMISSION_BUCKET)
      .remove([path])
      .catch(() => null);
    return {
      ok: false,
      error: `Nothing was uploaded. ${safeError(rowErr.message, "submission-files.insert")}`,
    };
  }

  revalidatePath("/yi-future/me/submissions");
  revalidatePath("/yi-future/chapter/submissions");
  return { ok: true, message: `${name} attached.` };
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
