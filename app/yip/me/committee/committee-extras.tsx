"use client";

// Extras carried over from the old /yip/me/bill page so the Committee Room is a
// true single source (locked decision 2026-06-27): the offline Word template
// download (#685) and the per-committee supporting-documents repository. Both
// were previously embedded in bill-client.tsx; extracted here, re-keyed on
// {eventId, participantId} instead of a session object.

import { useState, useEffect, useRef } from "react";
import { Button } from "@/components/yip/ui/button";
import { Input } from "@/components/yip/ui/input";
import { Textarea } from "@/components/yip/ui/textarea";
import { Label } from "@/components/yip/ui/label";
import {
  FileText,
  Loader2,
  Upload,
  Download,
  Trash2,
  FolderOpen,
} from "lucide-react";
import { toast } from "sonner";
import { formatBytes } from "@/lib/yip/media";
import { buildBillTemplateDoc } from "@/lib/yip/bill-template";
import {
  uploadBillDocument,
  listMyCommitteeBillDocuments,
  participantBillDocumentUrl,
  deleteMyBillDocument,
  type BillDocumentRow,
} from "@/app/yip/actions/bill-documents";
import { SectionShell, SectionHeading, SAFFRON, inkA } from "../credential-ui";

const ORANGE = "#FF9933";

export function BillTemplateButton({
  committeeName,
  topic,
  scheme,
}: {
  committeeName: string | null;
  topic: string | null;
  scheme: string | null;
}) {
  function handleDownload() {
    const html = buildBillTemplateDoc({ committeeName, topic, scheme });
    const blob = new Blob([html], { type: "application/msword" });
    const url = URL.createObjectURL(blob);
    const slug = (committeeName ?? "committee")
      .replace(/[^a-z0-9]+/gi, "-")
      .replace(/^-+|-+$/g, "")
      .toLowerCase();
    const a = document.createElement("a");
    a.href = url;
    a.download = `bill-template-${slug || "committee"}.doc`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  }
  return (
    <Button variant="outline" onClick={handleDownload} className="w-full">
      <Download className="size-4 mr-1.5" />
      Download bill template (Word)
    </Button>
  );
}

const DOC_MAX_FILE_BYTES = 4 * 1024 * 1024;
const DOC_MAX_DESCRIPTION_CHARS = 500;
const DOC_ACCEPT =
  "application/pdf,image/png,image/jpeg,image/webp,image/heic,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document,application/vnd.ms-powerpoint,application/vnd.openxmlformats-officedocument.presentationml.presentation";

export function CommitteeDocumentsSection({
  eventId,
  participantId,
}: {
  eventId: string;
  participantId: string;
}) {
  const [docsLoading, setDocsLoading] = useState(true);
  const [committeeName, setCommitteeName] = useState<string | null>(null);
  const [docs, setDocs] = useState<BillDocumentRow[]>([]);
  const [file, setFile] = useState<File | null>(null);
  const [description, setDescription] = useState("");
  const [uploading, setUploading] = useState(false);
  const [busyDocId, setBusyDocId] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  async function loadDocs() {
    const result = await listMyCommitteeBillDocuments(eventId, participantId);
    if (result.success) {
      setCommitteeName(result.data.committeeName);
      setDocs(result.data.docs);
    } else {
      toast.error(result.error);
    }
    setDocsLoading(false);
  }

  useEffect(() => {
    loadDocs();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const selected = e.target.files?.[0] ?? null;
    if (selected && selected.size > DOC_MAX_FILE_BYTES) {
      toast.error("4 MB max — compress the photo or PDF and try again.");
      e.target.value = "";
      setFile(null);
      return;
    }
    setFile(selected);
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

  async function handleUpload() {
    if (!file) {
      toast.error("Choose a file to upload");
      return;
    }
    if (file.size > DOC_MAX_FILE_BYTES) {
      toast.error("4 MB max — compress the photo or PDF and try again.");
      return;
    }
    if (description.trim().length > DOC_MAX_DESCRIPTION_CHARS) {
      toast.error(
        `Description is too long — ${DOC_MAX_DESCRIPTION_CHARS} characters max.`
      );
      return;
    }
    setUploading(true);
    try {
      const fileBase64 = await readAsBase64(file);
      const result = await uploadBillDocument(eventId, participantId, {
        fileBase64,
        fileName: file.name,
        contentType: file.type,
        description: description.trim(),
      });
      if (result.success) {
        toast.success("Document uploaded");
        setFile(null);
        setDescription("");
        if (fileInputRef.current) fileInputRef.current.value = "";
        await loadDocs();
      } else {
        toast.error(result.error);
      }
    } catch {
      toast.error("Could not read the file. Try again.");
    }
    setUploading(false);
  }

  async function handleView(docId: string) {
    setBusyDocId(docId);
    const result = await participantBillDocumentUrl(docId, participantId);
    setBusyDocId(null);
    if (result.success) {
      window.open(result.data.url, "_blank", "noopener,noreferrer");
    } else {
      toast.error(result.error);
    }
  }

  async function handleDelete(docId: string) {
    setBusyDocId(docId);
    const result = await deleteMyBillDocument(docId, participantId);
    setBusyDocId(null);
    if (result.success) {
      toast.success("Document deleted");
      setDocs((prev) => prev.filter((d) => d.id !== docId));
    } else {
      toast.error(result.error);
    }
  }

  return (
    <SectionShell accent={SAFFRON}>
      <div className="px-5 pt-4 pb-5 space-y-4">
        <div>
          <SectionHeading
            eyebrow="The Repository"
            title="Committee Documents"
            icon={FolderOpen}
            accent={SAFFRON}
          />
          <p className="text-xs mt-1.5" style={{ color: inkA(0.5) }}>
            Supporting documents and drawings for your committee&apos;s bill
            {committeeName ? ` — ${committeeName}` : ""}
          </p>
        </div>

        {docsLoading ? (
          <div className="flex items-center justify-center py-6">
            <Loader2 className="size-5 text-gray-300 animate-spin" />
          </div>
        ) : !committeeName ? (
          <p className="text-sm text-gray-400 py-2">
            You&apos;ll see this once you&apos;re assigned to a committee.
          </p>
        ) : (
          <>
            {docs.length === 0 ? (
              <p className="text-sm text-gray-400 py-1">
                No documents yet — upload the first one below.
              </p>
            ) : (
              <div className="space-y-2">
                {docs.map((doc) => (
                  <div
                    key={doc.id}
                    className="rounded-md border border-gray-100 bg-gray-50 px-3 py-2 flex items-start gap-2"
                  >
                    <FileText className="size-4 text-gray-400 mt-0.5 shrink-0" />
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium text-gray-800 truncate">
                        {doc.file_name}
                      </p>
                      {doc.description && (
                        <p className="text-xs text-gray-500 mt-0.5">
                          {doc.description}
                        </p>
                      )}
                      <p className="text-[11px] text-gray-400 mt-0.5">
                        {doc.uploader_name} · {formatBytes(doc.file_size_bytes)} ·{" "}
                        {new Date(doc.created_at).toLocaleDateString()}
                      </p>
                    </div>
                    <div className="flex items-center gap-1 shrink-0">
                      <Button
                        size="sm"
                        variant="ghost"
                        disabled={busyDocId === doc.id}
                        onClick={() => handleView(doc.id)}
                        className="h-7 px-2"
                      >
                        {busyDocId === doc.id ? (
                          <Loader2 className="size-3.5 animate-spin" />
                        ) : (
                          <Download className="size-3.5" />
                        )}
                      </Button>
                      {doc.uploaded_by === participantId && (
                        <Button
                          size="sm"
                          variant="ghost"
                          disabled={busyDocId === doc.id}
                          onClick={() => handleDelete(doc.id)}
                          className="h-7 px-2 text-red-500 hover:text-red-600"
                        >
                          <Trash2 className="size-3.5" />
                        </Button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}

            <div className="rounded-lg border border-dashed border-gray-200 p-3 space-y-3">
              <div>
                <Label htmlFor="doc-file" className="text-sm font-medium">
                  Upload a document
                </Label>
                <p className="text-xs text-gray-400 mt-0.5">
                  PDF, image (PNG/JPG/WebP/HEIC), Word or PowerPoint — 4 MB max
                </p>
                <Input
                  id="doc-file"
                  ref={fileInputRef}
                  type="file"
                  accept={DOC_ACCEPT}
                  onChange={handleFileChange}
                  disabled={uploading}
                  className="mt-1.5"
                />
              </div>
              <div>
                <Label htmlFor="doc-description" className="text-sm font-medium">
                  Short description
                </Label>
                <Textarea
                  id="doc-description"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="What is this document? (e.g., poster draft, research notes)"
                  maxLength={DOC_MAX_DESCRIPTION_CHARS}
                  disabled={uploading}
                  className="mt-1.5"
                  rows={2}
                />
              </div>
              <Button
                onClick={handleUpload}
                disabled={uploading || !file}
                style={{ backgroundColor: ORANGE }}
                className="w-full text-white"
              >
                {uploading ? (
                  <>
                    <Loader2 className="size-4 mr-1.5 animate-spin" />
                    Uploading...
                  </>
                ) : (
                  <>
                    <Upload className="size-4 mr-1.5" />
                    Upload Document
                  </>
                )}
              </Button>
            </div>
          </>
        )}
      </div>
    </SectionShell>
  );
}
