"use client";

import { useState, useEffect, useRef, useCallback, useTransition } from "react";
import { Card, CardContent } from "@/components/yip/ui/card";
import { Button } from "@/components/yip/ui/button";
import { Input } from "@/components/yip/ui/input";
import { Textarea } from "@/components/yip/ui/textarea";
import { Label } from "@/components/yip/ui/label";
import { Badge } from "@/components/yip/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/yip/ui/dialog";
import {
  FileText,
  Save,
  Send,
  CheckCircle2,
  XCircle,
  Clock,
  AlertTriangle,
  Users,
  Shield,
  Loader2,
  Upload,
  Download,
  Trash2,
  FolderOpen,
} from "lucide-react";
import { toast } from "sonner";
import { PARTY_COLORS } from "@/lib/yip/constants";
import { formatBytes } from "@/lib/yip/media";
import {
  saveBillDraft,
  submitBill,
  getBillForParty,
  getBillCommitteeMembers,
  type BillCommitteeMember,
} from "@/app/yip/actions/bills";
import {
  uploadBillDocument,
  listMyCommitteeBillDocuments,
  participantBillDocumentUrl,
  deleteMyBillDocument,
  type BillDocumentRow,
} from "@/app/yip/actions/bill-documents";
import type { Tables } from "@/types/yip/database";

type Bill = Tables<{ schema: "yip" }, "bills">;

// ─── Session (server-provided) ──────────────────────────────────
// The yip_session cookie is httpOnly, so it CANNOT be read from
// document.cookie — the server page parses it and passes it down.

export interface ParticipantSession {
  type: "participant";
  id: string;
  name: string;
  eventId: string;
}

// ─── Status Config ──────────────────────────────────────────────

const STATUS_CONFIG: Record<
  string,
  { label: string; className: string; icon: typeof Clock }
> = {
  drafting: {
    label: "Draft",
    className: "bg-gray-100 text-gray-700",
    icon: FileText,
  },
  submitted: {
    label: "Submitted",
    className: "bg-blue-100 text-blue-700",
    icon: Clock,
  },
  approved: {
    label: "Approved",
    className: "bg-green-100 text-green-700",
    icon: CheckCircle2,
  },
  rejected: {
    label: "Rejected",
    className: "bg-red-100 text-red-700",
    icon: XCircle,
  },
  presented: {
    label: "Presented",
    className: "bg-purple-100 text-purple-700",
    icon: FileText,
  },
  passed: {
    label: "Passed",
    className: "bg-emerald-100 text-emerald-700",
    icon: CheckCircle2,
  },
};

// ─── Form Data ──────────────────────────────────────────────────

interface BillFormData {
  title: string;
  objective: string;
  problem_statement: string;
  provision_1: string;
  provision_2: string;
  provision_3: string;
  expected_impact: string;
  implementation: string;
}

const EMPTY_FORM: BillFormData = {
  title: "",
  objective: "",
  problem_statement: "",
  provision_1: "",
  provision_2: "",
  provision_3: "",
  expected_impact: "",
  implementation: "",
};

// ─── Page Component ──────────────────────────────────────────────

export function BillClient({
  initialSession,
}: {
  initialSession: ParticipantSession;
}) {
  const session: ParticipantSession | null = initialSession;
  const [participant, setParticipant] = useState<{
    parliament_role: string | null;
    party_side: string | null;
  } | null>(null);
  const [bill, setBill] = useState<Bill | null>(null);
  const [members, setMembers] = useState<BillCommitteeMember[]>([]);
  const [form, setForm] = useState<BillFormData>(EMPTY_FORM);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [confirmSubmit, setConfirmSubmit] = useState(false);
  const [isPending, startTransition] = useTransition();

  // Debounce timer ref
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Load data for the server-provided session on mount
  useEffect(() => {
    loadParticipantAndBill(initialSession);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function loadParticipantAndBill(s: ParticipantSession) {
    try {
      // Fetch participant details via a simple fetch (we need parliament_role and party_side)
      const { createClient } = await import("@/lib/yip/supabase/client");
      const supabase = createClient();

      const { data: p } = await supabase
        .from("participants")
        .select("parliament_role, party_side")
        .eq("id", s.id)
        .single();

      setParticipant(p);

      if (p?.parliament_role !== "bill_committee" || !p.party_side) {
        setLoading(false);
        return;
      }

      const partySide = p.party_side as "ruling" | "opposition";

      // Load existing bill
      const existingBill = await getBillForParty(s.eventId, partySide);
      if (existingBill) {
        setBill(existingBill);
        const provisions = (existingBill.provisions as string[]) ?? [];
        setForm({
          title: existingBill.title || "",
          objective: existingBill.objective || "",
          problem_statement: existingBill.problem_statement || "",
          provision_1: provisions[0] || "",
          provision_2: provisions[1] || "",
          provision_3: provisions[2] || "",
          expected_impact: existingBill.expected_impact || "",
          implementation: existingBill.implementation || "",
        });
      }

      // Load committee members
      const committeeMembers = await getBillCommitteeMembers(
        s.eventId,
        partySide
      );
      setMembers(committeeMembers);
    } catch {
      toast.error("Failed to load bill data");
    }
    setLoading(false);
  }

  // Auto-save with debounce
  const autoSave = useCallback(
    (newForm: BillFormData) => {
      if (!session || !participant?.party_side) return;
      if (bill && bill.status !== "drafting") return;

      if (debounceRef.current) clearTimeout(debounceRef.current);

      debounceRef.current = setTimeout(async () => {
        setSaving(true);
        const result = await saveBillDraft(
          session.eventId,
          participant.party_side as "ruling" | "opposition",
          {
            title: newForm.title,
            objective: newForm.objective,
            problem_statement: newForm.problem_statement,
            provisions: [
              newForm.provision_1,
              newForm.provision_2,
              newForm.provision_3,
            ].filter(Boolean),
            expected_impact: newForm.expected_impact,
            implementation: newForm.implementation,
          }
        );
        setSaving(false);

        if (result.success && !bill) {
          // Reload to get the bill id
          const existingBill = await getBillForParty(
            session.eventId,
            participant.party_side as "ruling" | "opposition"
          );
          if (existingBill) setBill(existingBill);
        }
      }, 1000);
    },
    [session, participant, bill]
  );

  function handleChange(field: keyof BillFormData, value: string) {
    const newForm = { ...form, [field]: value };
    setForm(newForm);
    autoSave(newForm);
  }

  function handleManualSave() {
    if (!session || !participant?.party_side) return;
    if (bill && bill.status !== "drafting") return;

    if (debounceRef.current) clearTimeout(debounceRef.current);

    startTransition(async () => {
      const result = await saveBillDraft(
        session.eventId,
        participant.party_side as "ruling" | "opposition",
        {
          title: form.title,
          objective: form.objective,
          problem_statement: form.problem_statement,
          provisions: [
            form.provision_1,
            form.provision_2,
            form.provision_3,
          ].filter(Boolean),
          expected_impact: form.expected_impact,
          implementation: form.implementation,
        }
      );

      if (result.success) {
        toast.success("Draft saved");
        if (!bill) {
          const existingBill = await getBillForParty(
            session.eventId,
            participant.party_side as "ruling" | "opposition"
          );
          if (existingBill) setBill(existingBill);
        }
      } else {
        toast.error(result.error);
      }
    });
  }

  function handleSubmitBill() {
    if (!bill) {
      toast.error("Save the bill draft first");
      return;
    }
    setConfirmSubmit(true);
  }

  function confirmSubmitBill() {
    if (!bill) return;

    startTransition(async () => {
      const result = await submitBill(bill.id);
      if (result.success) {
        toast.success("Bill submitted successfully!");
        setBill((prev) => (prev ? { ...prev, status: "submitted" } : prev));
        setConfirmSubmit(false);
      } else {
        toast.error(result.error);
        setConfirmSubmit(false);
      }
    });
  }

  // ─── Loading & Auth States ────────────────────────────────────

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-12">
        <Loader2 className="size-8 text-[#FF9933] animate-spin mb-3" />
        <p className="text-sm text-gray-500">Loading bill workspace...</p>
      </div>
    );
  }

  if (!session) {
    return (
      <div className="flex flex-col items-center justify-center py-12">
        <AlertTriangle className="size-10 text-amber-400 mb-3" />
        <p className="text-gray-600">
          Session not found. Please rejoin the event.
        </p>
      </div>
    );
  }

  if (participant?.parliament_role !== "bill_committee") {
    // Bill DRAFTING is bill-committee-only, but the Committee Documents
    // repository is for every participant with a committee assignment — so
    // the documents card still renders below the restricted notice.
    return (
      <div className="space-y-5">
        <div className="flex flex-col items-center justify-center py-12">
          <Shield className="size-10 text-gray-300 mb-3" />
          <p className="font-medium text-gray-700">Access Restricted</p>
          <p className="text-sm text-gray-500 mt-1 text-center">
            Only Bill Committee members can access bill drafting.
            <br />
            Your role:{" "}
            {participant?.parliament_role?.replace(/_/g, " ") || "Not assigned"}
          </p>
        </div>
        <CommitteeDocumentsSection session={session} />
      </div>
    );
  }

  const side = participant.party_side as "ruling" | "opposition";
  const partyLabel = side === "ruling" ? "Ruling Party" : "Opposition Party";
  const billStatus = bill?.status ?? "drafting";
  const isDraft = billStatus === "drafting";
  const statusConfig = STATUS_CONFIG[billStatus] ?? STATUS_CONFIG.drafting;
  const StatusIcon = statusConfig.icon;

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-gray-900 flex items-center gap-2">
            <FileText className="size-5 text-[#FF9933]" />
            Bill Drafting
          </h1>
          <p className="text-sm text-gray-500 mt-1">
            Draft your party&apos;s bill for the Parliament session
          </p>
        </div>
        <div className="flex items-center gap-2">
          {saving && (
            <span className="text-xs text-gray-400 flex items-center gap-1">
              <Loader2 className="size-3 animate-spin" />
              Saving...
            </span>
          )}
          <Badge variant="secondary" className={statusConfig.className}>
            <StatusIcon className="size-3 mr-0.5" />
            {statusConfig.label}
          </Badge>
        </div>
      </div>

      {/* Party Badge */}
      <div
        className={`rounded-lg border p-3 ${
          side === "ruling"
            ? "border-blue-200 bg-blue-50"
            : "border-red-200 bg-red-50"
        }`}
      >
        <div className="flex items-center gap-2">
          <span
            className={`inline-flex items-center rounded-full px-3 py-1 text-sm font-medium ${PARTY_COLORS[side].badge}`}
          >
            {partyLabel}
          </span>
          <span className="text-sm text-gray-600">Bill</span>
        </div>
      </div>

      {/* Committee Members */}
      {members.length > 0 && (
        <Card>
          <CardContent className="pt-4 pb-4">
            <h3 className="text-sm font-semibold text-gray-700 mb-2 flex items-center gap-1.5">
              <Users className="size-4 text-purple-500" />
              Bill Committee Members
            </h3>
            <div className="grid grid-cols-2 gap-2">
              {members.map((m, idx) => {
                const roleLabels = [
                  "Lead Drafter",
                  "Presenter 1",
                  "Presenter 2",
                  "Policy Researcher",
                ];
                return (
                  <div
                    key={m.id}
                    className="rounded-md bg-gray-50 px-3 py-2"
                  >
                    <p className="text-xs text-gray-400">
                      {roleLabels[idx] || `Member ${idx + 1}`}
                    </p>
                    <p className="text-sm font-medium text-gray-800 truncate">
                      {m.full_name}
                    </p>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Bill Form */}
      {isDraft ? (
        <Card>
          <CardContent className="pt-5 space-y-4">
            {/* Bill Title */}
            <div>
              <Label htmlFor="title" className="text-sm font-medium">
                Bill Title *
              </Label>
              <Input
                id="title"
                value={form.title}
                onChange={(e) => handleChange("title", e.target.value)}
                placeholder="e.g., The Youth Digital Literacy Bill, 2026"
                className="mt-1.5"
              />
            </div>

            {/* Objective */}
            <div>
              <Label htmlFor="objective" className="text-sm font-medium">
                Objective *
              </Label>
              <Textarea
                id="objective"
                value={form.objective}
                onChange={(e) => handleChange("objective", e.target.value)}
                placeholder="What does this bill aim to achieve?"
                className="mt-1.5"
                rows={2}
              />
            </div>

            {/* Problem Statement */}
            <div>
              <Label htmlFor="problem" className="text-sm font-medium">
                Problem Statement
              </Label>
              <p className="text-xs text-gray-400 mt-0.5">1-2 lines</p>
              <Textarea
                id="problem"
                value={form.problem_statement}
                onChange={(e) =>
                  handleChange("problem_statement", e.target.value)
                }
                placeholder="What problem does this bill address?"
                className="mt-1.5"
                rows={2}
              />
            </div>

            {/* Key Provisions */}
            <div>
              <Label className="text-sm font-medium">
                3 Key Provisions *
              </Label>
              <div className="mt-1.5 space-y-2">
                <Input
                  value={form.provision_1}
                  onChange={(e) => handleChange("provision_1", e.target.value)}
                  placeholder="Provision 1"
                />
                <Input
                  value={form.provision_2}
                  onChange={(e) => handleChange("provision_2", e.target.value)}
                  placeholder="Provision 2"
                />
                <Input
                  value={form.provision_3}
                  onChange={(e) => handleChange("provision_3", e.target.value)}
                  placeholder="Provision 3"
                />
              </div>
            </div>

            {/* Expected Impact */}
            <div>
              <Label htmlFor="impact" className="text-sm font-medium">
                Expected Impact
              </Label>
              <Textarea
                id="impact"
                value={form.expected_impact}
                onChange={(e) =>
                  handleChange("expected_impact", e.target.value)
                }
                placeholder="What positive impact will this bill have?"
                className="mt-1.5"
                rows={2}
              />
            </div>

            {/* Implementation Mechanism */}
            <div>
              <Label htmlFor="implementation" className="text-sm font-medium">
                Implementation Mechanism
              </Label>
              <Textarea
                id="implementation"
                value={form.implementation}
                onChange={(e) =>
                  handleChange("implementation", e.target.value)
                }
                placeholder="How will this bill be implemented?"
                className="mt-1.5"
                rows={2}
              />
            </div>

            {/* Action Buttons */}
            <div className="flex gap-2 pt-2">
              <Button
                variant="outline"
                onClick={handleManualSave}
                disabled={isPending}
                className="flex-1"
              >
                <Save className="size-4 mr-1.5" />
                Save Draft
              </Button>
              <Button
                onClick={handleSubmitBill}
                disabled={isPending || !form.title || !form.objective}
                className="flex-1 bg-[#FF9933] hover:bg-[#E68A2E]"
              >
                <Send className="size-4 mr-1.5" />
                Submit Bill
              </Button>
            </div>
          </CardContent>
        </Card>
      ) : (
        /* Read-only view for submitted/approved bills */
        <Card>
          <CardContent className="pt-5 space-y-4">
            <div>
              <p className="text-xs text-gray-400 uppercase tracking-wider">
                Bill Title
              </p>
              <p className="text-lg font-bold text-gray-900">{form.title}</p>
            </div>

            {form.objective && (
              <div>
                <p className="text-xs text-gray-400 uppercase tracking-wider">
                  Objective
                </p>
                <p className="text-sm text-gray-700">{form.objective}</p>
              </div>
            )}

            {form.problem_statement && (
              <div>
                <p className="text-xs text-gray-400 uppercase tracking-wider">
                  Problem Statement
                </p>
                <p className="text-sm text-gray-700">
                  {form.problem_statement}
                </p>
              </div>
            )}

            {(form.provision_1 || form.provision_2 || form.provision_3) && (
              <div>
                <p className="text-xs text-gray-400 uppercase tracking-wider">
                  Key Provisions
                </p>
                <ul className="mt-1 space-y-1">
                  {[form.provision_1, form.provision_2, form.provision_3]
                    .filter(Boolean)
                    .map((p, i) => (
                      <li
                        key={i}
                        className="flex items-start gap-2 text-sm text-gray-700"
                      >
                        <span className="mt-1 size-1.5 shrink-0 rounded-full bg-[#FF9933]" />
                        {p}
                      </li>
                    ))}
                </ul>
              </div>
            )}

            {form.expected_impact && (
              <div>
                <p className="text-xs text-gray-400 uppercase tracking-wider">
                  Expected Impact
                </p>
                <p className="text-sm text-gray-700">
                  {form.expected_impact}
                </p>
              </div>
            )}

            {form.implementation && (
              <div>
                <p className="text-xs text-gray-400 uppercase tracking-wider">
                  Implementation Mechanism
                </p>
                <p className="text-sm text-gray-700">
                  {form.implementation}
                </p>
              </div>
            )}

            {billStatus === "rejected" && (
              <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-center">
                <XCircle className="mx-auto size-6 text-red-400 mb-1" />
                <p className="text-sm font-medium text-red-700">
                  Bill was rejected by the organizer
                </p>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Committee Documents */}
      <CommitteeDocumentsSection session={session} />

      {/* Submit Confirmation Dialog */}
      <Dialog open={confirmSubmit} onOpenChange={setConfirmSubmit}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Submit Bill</DialogTitle>
            <DialogDescription>
              Once submitted, the bill cannot be edited. The organizer will
              review and approve or reject your bill before it can be presented
              in the House. Are you sure you want to submit?
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setConfirmSubmit(false)}
            >
              Cancel
            </Button>
            <Button
              disabled={isPending}
              onClick={confirmSubmitBill}
              className="bg-[#FF9933] hover:bg-[#E68A2E]"
            >
              {isPending ? "Submitting..." : "Yes, Submit Bill"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// ─── Committee Documents (supporting docs / drawings for the bill) ──────────
// Server-gated repository: uploads/list/downloads all go through the actions
// in app/yip/actions/bill-documents.ts (private bucket, signed URLs). Delete
// is uploader-self-only. Mirror of the server's limits for early feedback.

const DOC_MAX_FILE_BYTES = 4 * 1024 * 1024; // server + bucket enforce too
const DOC_MAX_DESCRIPTION_CHARS = 500;
const DOC_ACCEPT =
  "application/pdf,image/png,image/jpeg,image/webp,image/heic,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document,application/vnd.ms-powerpoint,application/vnd.openxmlformats-officedocument.presentationml.presentation";

function CommitteeDocumentsSection({
  session,
}: {
  session: ParticipantSession;
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
    const result = await listMyCommitteeBillDocuments(
      session.eventId,
      session.id
    );
    if (result.success) {
      setCommitteeName(result.data.committeeName);
      setDocs(result.data.docs);
    } else {
      toast.error(result.error);
    }
    setDocsLoading(false);
  }

  // Load on mount for the server-provided session (same idiom as the bill
  // loader above).
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
        // readAsDataURL → "data:<mime>;base64,<data>" — keep only the data.
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
      toast.error(`Description is too long — ${DOC_MAX_DESCRIPTION_CHARS} characters max.`);
      return;
    }

    setUploading(true);
    try {
      const fileBase64 = await readAsBase64(file);
      const result = await uploadBillDocument(session.eventId, session.id, {
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
    const result = await participantBillDocumentUrl(docId, session.id);
    setBusyDocId(null);
    if (result.success) {
      window.open(result.data.url, "_blank", "noopener,noreferrer");
    } else {
      toast.error(result.error);
    }
  }

  async function handleDelete(docId: string) {
    setBusyDocId(docId);
    const result = await deleteMyBillDocument(docId, session.id);
    setBusyDocId(null);
    if (result.success) {
      toast.success("Document deleted");
      setDocs((prev) => prev.filter((d) => d.id !== docId));
    } else {
      toast.error(result.error);
    }
  }

  return (
    <Card>
      <CardContent className="pt-4 pb-5 space-y-4">
        <div>
          <h3 className="text-sm font-semibold text-gray-700 flex items-center gap-1.5">
            <FolderOpen className="size-4 text-[#FF9933]" />
            Committee Documents
          </h3>
          <p className="text-xs text-gray-400 mt-0.5">
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
            {/* Document list */}
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
                        {doc.uploader_name} · {formatBytes(doc.file_size_bytes)}{" "}
                        · {new Date(doc.created_at).toLocaleDateString()}
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
                      {doc.uploaded_by === session.id && (
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

            {/* Upload form */}
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
                className="w-full bg-[#FF9933] hover:bg-[#E68A2E]"
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
      </CardContent>
    </Card>
  );
}
