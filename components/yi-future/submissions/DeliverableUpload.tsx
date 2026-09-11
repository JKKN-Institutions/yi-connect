"use client";

/**
 * One deliverable slot: paste a share link or upload a file. A new upload
 * replaces the link and any earlier file (see finishSubmissionUpload).
 *
 * WHY BOTH
 * Until now this accepted a LINK only, and every one of the 734 URLs on file is
 * a Google Drive or Docs link. That means a moderator or juror has to request
 * access from the student and wait, per submission and per person, before they
 * can read anything — and the chapter's work can never be gathered in one place.
 *
 * An uploaded file removes both problems: the jury opens it immediately, and
 * the white-paper export can collect it. The link is kept because it is the
 * only way to hand over a 200MB video or a living Google Doc, and taking it
 * away would strand a team at a deadline with no fallback.
 *
 * The upload runs on its own, NOT with the surrounding form: a file crossing
 * the phase form would have to survive every draft save, and a failed upload
 * would take the typed link down with it. The bytes go straight from the
 * browser to storage through a one-time link (see startSubmissionUpload) —
 * never through a server action, which Vercel caps at ~4.5 MB.
 */

import { useRef, useState, useTransition } from "react";
import {
  startSubmissionUpload,
  finishSubmissionUpload,
  deleteSubmissionFile,
} from "@/app/yi-future/actions/submission-files";
import { createClient } from "@/lib/yi-future/supabase/client";
import {
  ACCEPT_ATTRIBUTE,
  MAX_UPLOAD_BYTES,
  SUBMISSION_BUCKET,
  formatBytes,
  type SubmissionFileRow,
} from "@/lib/yi-future/submission-files";

export function DeliverableUpload({
  label,
  name,
  defaultValue,
  hint,
  required = false,
  submissionId,
  slot,
  files = [],
  readOnly = false,
}: {
  label: string;
  name: string;
  defaultValue?: string;
  hint?: string;
  required?: boolean;
  /** Absent until the phase row exists — save a draft first, then upload. */
  submissionId?: string | null;
  slot?: string;
  files?: SubmissionFileRow[];
  readOnly?: boolean;
}): React.JSX.Element {
  const inputRef = useRef<HTMLInputElement | null>(null);
  const [pending, startTransition] = useTransition();
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);

  const canUpload = !!submissionId && !!slot && !readOnly;

  function onPick(file: File | undefined) {
    if (!file || !submissionId || !slot) return;
    setMsg(null);

    // Checked here as well as on the server, so a too-big file is named before
    // anything is sent.
    if (file.size > MAX_UPLOAD_BYTES) {
      setMsg({
        ok: false,
        text: `That file is ${formatBytes(file.size)}; the limit is ${formatBytes(
          MAX_UPLOAD_BYTES
        )}. Compress it, or paste a share link instead.`,
      });
      if (inputRef.current) inputRef.current.value = "";
      return;
    }

    startTransition(async () => {
      try {
        // 1. Permission and a one-time upload link — the file is not sent yet.
        const start = await startSubmissionUpload({
          submissionId,
          slot,
          fileName: file.name,
          size: file.size,
          type: file.type,
        });
        if (!start.ok) {
          setMsg({ ok: false, text: start.error });
          return;
        }

        // 2. The bytes go straight to storage. Sending them through a server
        //    action hit Vercel's ~4.5 MB request limit and failed silently.
        const { error: upErr } = await createClient()
          .storage.from(SUBMISSION_BUCKET)
          .uploadToSignedUrl(start.path, start.token, file, {
            contentType: start.contentType,
          });
        if (upErr) {
          setMsg({
            ok: false,
            text: "The file could not be uploaded. Check your connection and try again.",
          });
          return;
        }

        // 3. Record it. The server checks the stored file, not what we claimed.
        const done = await finishSubmissionUpload({
          submissionId,
          slot,
          path: start.path,
        });
        setMsg(
          done.ok
            ? { ok: true, text: done.message ?? "Attached." }
            : { ok: false, text: done.error }
        );
      } catch {
        // A dropped connection or a deploy mid-upload rejects the call instead
        // of returning a result — it must still produce a sentence.
        setMsg({
          ok: false,
          text: "The upload did not finish. Check your connection and try again.",
        });
      } finally {
        if (inputRef.current) inputRef.current.value = "";
      }
    });
  }

  function onRemove(fileId: string) {
    setMsg(null);
    const fd = new FormData();
    fd.set("fileId", fileId);
    startTransition(async () => {
      try {
        const res = await deleteSubmissionFile(fd);
        setMsg(
          res.ok
            ? { ok: true, text: res.message ?? "Removed." }
            : { ok: false, text: res.error }
        );
      } catch {
        setMsg({
          ok: false,
          text: "That did not go through. Check your connection and try again.",
        });
      }
    });
  }

  return (
    <div className="space-y-1.5">
      <label
        htmlFor={name}
        className="block text-xs font-semibold uppercase tracking-widest text-navy/70"
      >
        {label} {required && <span className="text-red-500">*</span>}
      </label>

      {/* ── Option 1: a share link (unchanged) ───────────────────── */}
      <div className="flex items-start gap-2">
        <input
          id={name}
          name={name}
          type="url"
          defaultValue={defaultValue ?? ""}
          required={required && files.length === 0}
          placeholder="https://drive.google.com/file/d/…"
          className="flex-1 px-3 py-2 border border-navy/20 rounded-md text-sm font-mono"
        />
        {defaultValue && (
          <a
            href={defaultValue}
            target="_blank"
            rel="noopener"
            className="flex-shrink-0 px-3 py-2 text-xs font-semibold text-navy/70 border border-navy/20 rounded-md hover:bg-navy/5"
          >
            Open
          </a>
        )}
      </div>

      {/* ── Option 2: the actual file ────────────────────────────── */}
      {files.length > 0 && (
        <ul className="space-y-1">
          {files.map((f) => (
            <li
              key={f.id}
              className="flex items-center justify-between gap-2 px-3 py-2 rounded-md bg-yi-green/5 border border-yi-green/30"
            >
              <span className="text-xs text-navy truncate">
                <span className="font-semibold">{f.file_name}</span>
                <span className="text-navy/50"> · {formatBytes(f.size_bytes)}</span>
              </span>
              {!readOnly && (
                <button
                  type="button"
                  onClick={() => onRemove(f.id)}
                  disabled={pending}
                  className="flex-shrink-0 text-xs font-semibold text-red-600 hover:underline disabled:opacity-40 min-h-[44px] px-2"
                >
                  Remove
                </button>
              )}
            </li>
          ))}
        </ul>
      )}

      {canUpload && (
        <div className="flex items-center gap-2">
          <input
            ref={inputRef}
            type="file"
            accept={ACCEPT_ATTRIBUTE}
            disabled={pending}
            onChange={(e) => onPick(e.target.files?.[0])}
            className="block w-full text-xs text-navy/70 file:mr-3 file:py-2 file:px-3 file:rounded-md file:border file:border-navy/20 file:text-xs file:font-semibold file:bg-white file:text-navy hover:file:bg-navy/5"
          />
          {pending && (
            <span className="text-xs font-semibold text-navy/50 whitespace-nowrap">
              Uploading…
            </span>
          )}
        </div>
      )}

      {!submissionId && !readOnly && (
        <p className="text-xs text-navy/50">
          Save this phase once and the file upload appears here.
        </p>
      )}

      {msg && (
        <p
          role={msg.ok ? undefined : "alert"}
          className={`text-xs font-semibold ${
            msg.ok ? "text-yi-green" : "text-red-600"
          }`}
        >
          {msg.text}
        </p>
      )}

      {hint && <p className="text-xs text-navy/50">{hint}</p>}
      {canUpload && files.length === 0 && (
        <p className="text-xs text-navy/50">
          Uploading the file means the jury can open it straight away, with no
          access request. PDF, Word or PowerPoint, up to{" "}
          {formatBytes(MAX_UPLOAD_BYTES)}.
        </p>
      )}
    </div>
  );
}
