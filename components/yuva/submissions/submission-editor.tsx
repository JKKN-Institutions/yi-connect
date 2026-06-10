"use client";

/**
 * Per-session work editor (Phase 13) — text area + file upload inside a
 * dialog, with save-draft and submit-with-confirm. Versioning follows
 * lib/yuva/submission-rules: a draft overwrites in place; editing after
 * submitted/reviewed creates a NEW version (messaging below reflects it).
 * 10 MB file cap mirrors the server-side guard.
 */

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Pencil, Send } from "lucide-react";
import toast from "react-hot-toast";
import {
  saveSubmissionDraft,
  submitSubmission,
} from "@/app/youth-academy/actions/submissions";
import { Button } from "@/components/ui/button";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import type { MyWorkSubmission } from "./data";

const MAX_FILE_BYTES = 10 * 1024 * 1024; // 10 MB (server caps base64 length)

const ACCEPT = ".pdf,.doc,.docx,.ppt,.pptx,.xls,.xlsx,.png,.jpg,.jpeg,.zip";

function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result as string;
      resolve(result.slice(result.indexOf(",") + 1));
    };
    reader.onerror = () => reject(new Error("Could not read the file."));
    reader.readAsDataURL(file);
  });
}

export function SubmissionEditor({
  runSessionId,
  sessionName,
  current,
}: {
  runSessionId: string;
  sessionName: string;
  /** Latest version of my work for this session; null = nothing yet. */
  current: MyWorkSubmission | null;
}) {
  const router = useRouter();
  const fileRef = useRef<HTMLInputElement>(null);
  const [open, setOpen] = useState(false);
  const [text, setText] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [busy, setBusy] = useState<"save" | "submit" | null>(null);

  // Editing a draft continues in place; anything else starts a new version.
  const isNewVersion = !!current && current.status !== "draft";
  const startLabel = !current
    ? "Add your work"
    : current.status === "draft"
      ? "Continue draft"
      : "Resubmit";

  const onOpenChange = (next: boolean) => {
    setOpen(next);
    if (next) {
      // Prefill from the latest version so resubmission iterates on it.
      setText(current?.textBody ?? "");
      setFile(null);
      if (fileRef.current) fileRef.current.value = "";
    }
  };

  async function buildDraftInput() {
    const input: {
      textBody?: string;
      fileBase64?: string;
      fileName?: string;
      contentType?: string;
    } = { textBody: text };
    if (file) {
      if (file.size > MAX_FILE_BYTES) {
        throw new Error("File is too large — 10 MB max.");
      }
      input.fileBase64 = await fileToBase64(file);
      input.fileName = file.name;
      input.contentType = file.type || "application/octet-stream";
    }
    return input;
  }

  async function onSaveDraft() {
    setBusy("save");
    try {
      const result = await saveSubmissionDraft(
        runSessionId,
        await buildDraftInput()
      );
      if (!result.success) {
        toast.error(result.error);
        return;
      }
      toast.success(`Draft saved (version ${result.data.version}).`);
      setOpen(false);
      router.refresh();
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setBusy(null);
    }
  }

  async function onSubmitConfirmed() {
    setBusy("submit");
    try {
      // Save what is on screen first — what you see is what you submit.
      const saved = await saveSubmissionDraft(
        runSessionId,
        await buildDraftInput()
      );
      if (!saved.success) {
        toast.error(saved.error);
        return;
      }
      const result = await submitSubmission(runSessionId);
      if (!result.success) {
        toast.error(result.error);
        return;
      }
      toast.success(
        result.data.isLate
          ? `Submitted (version ${result.data.version}) — marked late.`
          : `Submitted (version ${result.data.version}).`
      );
      setOpen(false);
      router.refresh();
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setBusy(null);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogTrigger asChild>
        <Button type="button" variant="outline" size="sm">
          <Pencil className="size-3.5" />
          {startLabel}
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{sessionName}</DialogTitle>
          <DialogDescription>
            {isNewVersion
              ? `Your version ${current.version} is ${current.status} — saving here creates version ${current.version + 1}. Attach the file again if your new version needs one.`
              : "Write your work below and/or attach a file. Save as a draft to keep editing, or submit when you are done."}
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-4">
          <div className="grid gap-1.5">
            <Label htmlFor={`work-text-${runSessionId}`}>Your work</Label>
            <Textarea
              id={`work-text-${runSessionId}`}
              value={text}
              onChange={(e) => setText(e.target.value)}
              rows={7}
              maxLength={20000}
              placeholder="Type or paste your work here…"
              disabled={busy !== null}
            />
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor={`work-file-${runSessionId}`}>
              Attachment (optional)
            </Label>
            <Input
              id={`work-file-${runSessionId}`}
              ref={fileRef}
              type="file"
              accept={ACCEPT}
              disabled={busy !== null}
              onChange={(e) => setFile(e.target.files?.[0] ?? null)}
            />
            <p className="text-xs text-slate-500">
              PDF, Word, PowerPoint, Excel, image or ZIP — 10 MB max.
              {current?.status === "draft" && current.hasFile && !file
                ? " Your draft's current file is kept unless you choose a new one."
                : ""}
            </p>
          </div>
        </div>

        <DialogFooter className="gap-2 sm:gap-0">
          <Button
            type="button"
            variant="outline"
            onClick={onSaveDraft}
            disabled={busy !== null}
          >
            {busy === "save" ? (
              <Loader2 className="size-4 animate-spin" />
            ) : null}
            Save draft
          </Button>
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button
                type="button"
                disabled={busy !== null}
                className="bg-slate-900 hover:bg-slate-800"
              >
                {busy === "submit" ? (
                  <Loader2 className="size-4 animate-spin" />
                ) : (
                  <Send className="size-4" />
                )}
                Submit
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Submit this work?</AlertDialogTitle>
                <AlertDialogDescription>
                  Your mentor will see it for review. Once submitted you can
                  no longer edit this version — resubmitting later creates a
                  new version.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Keep editing</AlertDialogCancel>
                <AlertDialogAction onClick={onSubmitConfirmed}>
                  Submit
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
