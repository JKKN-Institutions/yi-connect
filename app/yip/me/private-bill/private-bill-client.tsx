"use client";

/**
 * Write and hand in a Private Member's Bill.
 *
 * A Member writes this alone — there is no drafting committee behind it, which
 * is what separates it from the Committee Room's bill. Handing it in puts it on
 * the organiser's bills board at `submitted`, exactly where an organiser-typed
 * one lands, so it picks up the same Approve / Reject controls with no special
 * handling.
 *
 * Editing the bill's TEXT stops at hand-in on purpose: an organiser may
 * already have read it. The attached DOCUMENT is different — see
 * lib/yip/bill-document-window.ts (Director ruling 2026-08-26): it stays
 * attachable/replaceable/removable through 'submitted' too, right up until
 * an organiser judges the bill.
 */

import { useRef, useState, useTransition } from "react";
import {
  Download,
  FileText,
  Loader2,
  Plus,
  Send,
  Trash2,
  Upload,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/yip/ui/button";
import { Card, CardContent } from "@/components/yip/ui/card";
import { Input } from "@/components/yip/ui/input";
import { Label } from "@/components/yip/ui/label";
import { Textarea } from "@/components/yip/ui/textarea";
import { formatBytes } from "@/lib/yip/media";
import {
  getMyPrivateMemberBill,
  saveMyPrivateMemberBillDraft,
  submitMyPrivateMemberBill,
} from "@/app/yip/actions/bills";
import {
  uploadPrivateBillDocument,
  participantBillDocumentUrl,
  deleteMyBillDocument,
  type BillDocumentRow,
} from "@/app/yip/actions/bill-documents";
import { canEditBillDocument } from "@/lib/yip/bill-document-window";

const INK = "#1a1a3e";
const SAFFRON = "#C2691A";

// Same 4 MB cap + mime allowlist bill-documents.ts enforces server-side
// (BILL_DOC_CONTENT_TYPES) — this is only the advisory client-side check.
const DOC_MAX_FILE_BYTES = 4 * 1024 * 1024;
const DOC_ACCEPT =
  "application/pdf,image/png,image/jpeg,image/webp,image/heic,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document,application/vnd.ms-powerpoint,application/vnd.openxmlformats-officedocument.presentationml.presentation";

export type MyPrivateBill = {
  id: string;
  title: string;
  objective: string | null;
  problemStatement: string | null;
  provisions: string[];
  status: string;
};

export function PrivateBillClient({
  eventId,
  participantId,
  participantName,
  initialBill,
  initialError,
  initialDocument,
}: {
  eventId: string;
  participantId: string;
  participantName: string;
  initialBill: MyPrivateBill | null;
  initialError: string | null;
  initialDocument: BillDocumentRow | null;
}) {
  // Seeded from the server render — no load-on-mount effect, and no spinner on
  // a phone in a hall.
  // Never changes after the server render — the action re-checks on every call.
  const denied = initialError;
  const [status, setStatus] = useState(initialBill?.status ?? "drafting");
  const [title, setTitle] = useState(initialBill?.title ?? "");
  const [objective, setObjective] = useState(initialBill?.objective ?? "");
  const [problem, setProblem] = useState(initialBill?.problemStatement ?? "");
  const [provisions, setProvisions] = useState<string[]>(
    initialBill && initialBill.provisions.length > 0 ? initialBill.provisions : [""]
  );
  const [isPending, startTransition] = useTransition();
  const [saving, setSaving] = useState(false);

  // Attached document — a solo bill carries at most one; uploading again
  // replaces it (see uploadPrivateBillDocument).
  const [doc, setDoc] = useState<BillDocumentRow | null>(initialDocument);
  const [pickedFile, setPickedFile] = useState<File | null>(null);
  const [docUploading, setDocUploading] = useState(false);
  const [docBusy, setDocBusy] = useState(false); // download / remove in flight
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const handedIn = status !== "drafting";
  // The document window is WIDER than the bill-text edit window (Director
  // ruling 2026-08-26, lib/yip/bill-document-window.ts): a Member may still
  // attach, replace or remove their document while the bill sits at
  // 'submitted' — only approved/presented/voting/passed/rejected locks it.
  const canAttachDoc = canEditBillDocument(status);

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const selected = e.target.files?.[0] ?? null;
    if (selected && selected.size > DOC_MAX_FILE_BYTES) {
      toast.error("4 MB max — compress the file and try again.");
      e.target.value = "";
      setPickedFile(null);
      return;
    }
    setPickedFile(selected);
  }

  function readAsBase64(f: File): Promise<string> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => {
        const result = reader.result as string;
        const comma = result.indexOf(",");
        resolve(comma >= 0 ? result.slice(comma + 1) : result);
      };
      reader.onerror = () => reject(reader.error);
      reader.readAsDataURL(f);
    });
  }

  async function handleUploadDoc() {
    if (!pickedFile) {
      toast.error("Choose a file first.");
      return;
    }
    setDocUploading(true);
    try {
      const fileBase64 = await readAsBase64(pickedFile);
      const res = await uploadPrivateBillDocument(eventId, participantId, {
        fileBase64,
        fileName: pickedFile.name,
        contentType: pickedFile.type,
      });
      if (!res.success) {
        toast.error(res.error);
      } else {
        toast.success(doc ? "Document replaced." : "Document attached.");
        setPickedFile(null);
        if (fileInputRef.current) fileInputRef.current.value = "";
        setDoc({
          id: res.data.id,
          file_name: pickedFile.name,
          description: "",
          content_type: pickedFile.type,
          file_size_bytes: pickedFile.size,
          created_at: new Date().toISOString(),
          uploaded_by: participantId,
          committee_name: null,
          bill_id: null,
          uploader_name: participantName,
        });
      }
    } catch {
      toast.error("Could not read the file. Try again.");
    }
    setDocUploading(false);
  }

  function handleDownloadDoc() {
    if (!doc) return;
    // NO "noopener" / "noreferrer" here, deliberately — per the HTML spec
    // window.open() returns NULL whenever either is passed, so the tab handle
    // below would always be null and the signed URL would never be delivered.
    // Opened synchronously (before the await) because Safari treats a
    // window.open after an async gap as a popup and swallows it.
    const tab = window.open("", "_blank");
    if (tab) {
      try {
        tab.opener = null; // sever it by hand — what "noopener" was for
      } catch {
        // Read-only in some browsers; not fatal, the tab only ever shows a
        // signed URL from our own storage.
      }
    }
    setDocBusy(true);
    void (async () => {
      const res = await participantBillDocumentUrl(doc.id, participantId);
      setDocBusy(false);
      if (!res.success) {
        tab?.close();
        toast.error(res.error);
        return;
      }
      if (tab) {
        tab.location.href = res.data.url;
      } else {
        toast.error(
          "Your browser blocked the new tab. Allow pop-ups for this site, then try again.",
          { duration: 10000 }
        );
      }
    })();
  }

  function handleRemoveDoc() {
    if (!doc) return;
    setDocBusy(true);
    startTransition(async () => {
      const res = await deleteMyBillDocument(doc.id, participantId);
      setDocBusy(false);
      if (!res.success) {
        toast.error(res.error);
        return;
      }
      toast.success("Document removed.");
      setDoc(null);
    });
  }

  function save(then?: () => void) {
    if (!title.trim()) {
      toast.error("Give your bill a title first.");
      return;
    }
    setSaving(true);
    startTransition(async () => {
      const res = await saveMyPrivateMemberBillDraft(eventId, participantId, {
        title,
        objective,
        problemStatement: problem,
        provisions,
      });
      setSaving(false);
      if (!res.success) {
        toast.error(res.error);
        return;
      }
      toast.success("Saved.");
      then?.();
    });
  }

  function handIn() {
    // Save first, so what is handed in is always what is on screen — a Member
    // who edits and taps Hand in without saving must not submit an older draft.
    save(() => {
      startTransition(async () => {
        const res = await submitMyPrivateMemberBill(eventId, participantId);
        if (!res.success) {
          toast.error(res.error);
          return;
        }
        toast.success("Handed in. An organiser will review it.");
        setStatus(res.data.status);
      });
    });
  }

  if (denied) {
    return (
      <div className="mx-auto max-w-2xl px-4 py-10">
        <Card>
          <CardContent className="p-6">
            <h1 className="text-lg font-semibold" style={{ color: INK }}>
              Private Member&apos;s Bill
            </h1>
            <p className="mt-2 text-sm text-[#1a1a3e]/70">{denied}</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-2xl px-4 py-6 pb-24">
      <p
        className="text-[10px] font-bold uppercase tracking-[0.16em]"
        style={{ color: SAFFRON }}
      >
        {participantName}
      </p>
      <h1 className="mt-1 text-2xl font-semibold" style={{ color: INK }}>
        Your Private Member&apos;s Bill
      </h1>
      <p className="mt-1.5 text-sm text-[#1a1a3e]/70">
        A bill you bring to the House yourself, without a committee behind it.
        Write it here and hand it in — an organiser reads every bill before it
        reaches the floor.
      </p>

      {handedIn && (
        <div
          className="mt-4 rounded-xl border px-4 py-3"
          style={{ borderColor: "#1a1a3e26", background: "#1a1a3e08" }}
        >
          <p className="text-sm font-medium" style={{ color: INK }}>
            Handed in — waiting for an organiser.
          </p>
          <p className="mt-0.5 text-xs text-[#1a1a3e]/60">
            You can still read it below. Ask an organiser if something needs
            changing.
          </p>
        </div>
      )}

      <div className="mt-5 space-y-5">
        <div className="space-y-1.5">
          <Label htmlFor="pmb-title">Title of the bill</Label>
          <Input
            id="pmb-title"
            value={title}
            disabled={handedIn}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="e.g. The School Road Safety Bill"
          />
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="pmb-problem">What problem does it solve?</Label>
          <Textarea
            id="pmb-problem"
            rows={4}
            value={problem}
            disabled={handedIn}
            onChange={(e) => setProblem(e.target.value)}
            placeholder="What is wrong today, and who does it affect?"
          />
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="pmb-objective">What is the bill trying to do?</Label>
          <Textarea
            id="pmb-objective"
            rows={3}
            value={objective}
            disabled={handedIn}
            onChange={(e) => setObjective(e.target.value)}
            placeholder="In a sentence or two."
          />
        </div>

        <div className="space-y-2">
          <Label>What the bill provides for</Label>
          <p className="text-xs text-[#1a1a3e]/55">
            One clause per line — the specific things the bill would do.
          </p>
          {provisions.map((p, i) => (
            <div key={i} className="flex items-start gap-2">
              <span className="mt-2.5 w-5 shrink-0 text-right font-mono text-xs text-[#1a1a3e]/45">
                {i + 1}.
              </span>
              <Textarea
                rows={2}
                value={p}
                disabled={handedIn}
                aria-label={`Clause ${i + 1}`}
                onChange={(e) =>
                  setProvisions((prev) =>
                    prev.map((x, j) => (j === i ? e.target.value : x))
                  )
                }
              />
              {!handedIn && provisions.length > 1 && (
                <button
                  type="button"
                  aria-label={`Remove clause ${i + 1}`}
                  onClick={() =>
                    setProvisions((prev) => prev.filter((_, j) => j !== i))
                  }
                  className="mt-1.5 inline-flex size-8 shrink-0 items-center justify-center rounded-xl text-[#1a1a3e]/50"
                >
                  <Trash2 className="size-4" />
                </button>
              )}
            </div>
          ))}
          {!handedIn && (
            <Button
              type="button"
              size="sm"
              variant="outline"
              onClick={() => setProvisions((prev) => [...prev, ""])}
            >
              <Plus className="size-4" /> Add a clause
            </Button>
          )}
        </div>
      </div>

      <div
        className="mt-7 rounded-xl border border-dashed p-4 space-y-3"
        style={{ borderColor: "#1a1a3e26" }}
      >
        <div>
          <Label className="text-sm font-medium">
            Attach a document (optional)
          </Label>
          <p className="mt-0.5 text-xs text-[#1a1a3e]/55">
            A PDF, scan or slide deck of your bill, if you have one written up
            elsewhere — PDF, image, Word or PowerPoint, 4 MB max.
          </p>
          {canAttachDoc && handedIn && (
            <p className="mt-1 text-xs text-[#1a1a3e]/55">
              You&apos;ve already handed this bill in, but you can still
              attach, replace or remove its document until an organiser
              approves or rejects it — doing so won&apos;t change what you
              handed in.
            </p>
          )}
          {!canAttachDoc && (
            <p className="mt-1 text-xs text-[#1a1a3e]/55">
              This bill has been judged, so its document can no longer be
              changed.
            </p>
          )}
        </div>

        {doc ? (
          <div className="flex items-start gap-2 rounded-md border border-gray-100 bg-gray-50 px-3 py-2">
            <FileText className="mt-0.5 size-4 shrink-0 text-gray-400" />
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium text-gray-800">
                {doc.file_name}
              </p>
              <p className="mt-0.5 text-[11px] text-gray-400">
                {formatBytes(doc.file_size_bytes)} ·{" "}
                {new Date(doc.created_at).toLocaleDateString()}
              </p>
            </div>
            <div className="flex shrink-0 items-center gap-1">
              <Button
                type="button"
                size="sm"
                variant="ghost"
                disabled={docBusy}
                onClick={handleDownloadDoc}
                className="h-7 px-2"
              >
                {docBusy ? (
                  <Loader2 className="size-3.5 animate-spin" />
                ) : (
                  <Download className="size-3.5" />
                )}
              </Button>
              {canAttachDoc && (
                <Button
                  type="button"
                  size="sm"
                  variant="ghost"
                  disabled={docBusy}
                  onClick={handleRemoveDoc}
                  className="h-7 px-2 text-red-500 hover:text-red-600"
                >
                  <Trash2 className="size-3.5" />
                </Button>
              )}
            </div>
          </div>
        ) : (
          <p className="text-sm text-[#1a1a3e]/45">
            {canAttachDoc
              ? "Nothing attached yet."
              : "Nothing was attached before this bill was judged."}
          </p>
        )}

        {canAttachDoc && (
          <div className="flex flex-wrap items-center gap-2">
            <Input
              ref={fileInputRef}
              type="file"
              accept={DOC_ACCEPT}
              disabled={docUploading}
              onChange={handleFileChange}
              className="max-w-xs"
            />
            <Button
              type="button"
              size="sm"
              variant="outline"
              disabled={docUploading || !pickedFile}
              onClick={handleUploadDoc}
            >
              {docUploading ? (
                <Loader2 className="size-4 animate-spin" />
              ) : (
                <Upload className="size-4" />
              )}
              {doc ? "Replace" : "Attach"}
            </Button>
          </div>
        )}
      </div>

      {!handedIn && (
        <div className="mt-7 flex flex-wrap items-center gap-3">
          <Button
            type="button"
            variant="outline"
            disabled={saving || isPending}
            onClick={() => save()}
          >
            {saving ? <Loader2 className="size-4 animate-spin" /> : "Save draft"}
          </Button>
          <Button type="button" disabled={saving || isPending} onClick={handIn}>
            <Send className="size-4" /> Hand it in
          </Button>
          <span className="text-xs text-[#1a1a3e]/55">
            You can keep editing until you hand it in.
          </span>
        </div>
      )}
    </div>
  );
}
