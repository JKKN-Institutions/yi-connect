"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { clauseTexts } from "@/lib/yip/bill-provisions";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/yip/ui/card";
import { Button } from "@/components/yip/ui/button";
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
  Plus,
  CheckCircle2,
  XCircle,
  Clock,
  Users,
  ThumbsUp,
  ThumbsDown,
  Landmark,
  FolderOpen,
  Download,
  Trash2,
  Loader2,
} from "lucide-react";
import { cn } from "@/lib/yip/utils";
import { PARTY_COLORS } from "@/lib/yip/constants";
import { Input } from "@/components/yip/ui/input";
import { Label } from "@/components/yip/ui/label";
import { Textarea } from "@/components/yip/ui/textarea";
import { Switch } from "@/components/yip/ui/switch";
import { formatBytes } from "@/lib/yip/media";
import { toast } from "sonner";
import {
  approveBill,
  rejectBill,
  adminCreateBill,
  type BillWithMembers,
} from "@/app/yip/actions/bills";
import {
  organiserBillDocumentUrl,
  organiserDeleteBillDocument,
  type BillDocumentRow,
} from "@/app/yip/actions/bill-documents";

// ─── Status Config ──────────────────────────────────────────────

const STATUS_CONFIG: Record<
  string,
  { label: string; className: string; icon: typeof Clock }
> = {
  drafting: {
    label: "Drafting",
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
    icon: Landmark,
  },
  passed: {
    label: "Passed",
    className: "bg-emerald-100 text-emerald-700",
    icon: CheckCircle2,
  },
};

// ─── Component ──────────────────────────────────────────────────

interface BillsClientProps {
  eventId: string;
  initialBills: BillWithMembers[];
  initialDocuments: BillDocumentRow[];
  /** Chair-only (getYipEventAccess.canDelete) — gates the Delete buttons. */
  canDelete: boolean;
  /** Chair + organiser (canManage) — gates the manual Add Bill action. */
  canManage: boolean;
  /** Committee names in this event, for the Add Bill picker. */
  committees: string[];
}

export function BillsClient({
  eventId,
  initialBills,
  initialDocuments,
  canDelete,
  canManage,
  committees,
}: BillsClientProps) {
  const router = useRouter();
  const [bills, setBills] = useState(initialBills);
  const [isPending, startTransition] = useTransition();
  const [confirmDialog, setConfirmDialog] = useState<{
    open: boolean;
    title: string;
    description: string;
    action: () => void;
  }>({ open: false, title: "", description: "", action: () => {} });

  // Manual Add-Bill (admin shortcut) — bypasses the committee draft/report flow.
  const [addOpen, setAddOpen] = useState(false);
  const [adding, setAdding] = useState(false);
  const [form, setForm] = useState({
    committeeName: "",
    title: "",
    objective: "",
    provisions: "",
    approved: true,
  });

  async function handleAddBill() {
    if (!form.committeeName) {
      toast.error("Pick a committee.");
      return;
    }
    if (!form.title.trim()) {
      toast.error("Enter a bill title.");
      return;
    }
    setAdding(true);
    const result = await adminCreateBill(eventId, {
      committeeName: form.committeeName,
      title: form.title,
      objective: form.objective || undefined,
      provisions: form.provisions
        ? form.provisions
            .split("\n")
            .map((p) => p.trim())
            .filter(Boolean)
        : undefined,
      approved: form.approved,
    });
    setAdding(false);
    if (result.success) {
      toast.success("Bill added — it's now available in the Bill Presentation session.");
      setAddOpen(false);
      setForm({
        committeeName: "",
        title: "",
        objective: "",
        provisions: "",
        approved: true,
      });
      router.refresh();
    } else {
      toast.error(result.error);
    }
  }

  // Bills sorted committee-first so the columns read in a stable order. Benchless
  // events identify bills by committee_name (party_side null); legacy benched
  // events keep ruling first, then opposition.
  const sortedBills = [...bills].sort((a, b) => {
    const rank = (s: string | null) =>
      s === "ruling" ? 0 : s === "opposition" ? 1 : 2;
    const sideDelta = rank(a.party_side) - rank(b.party_side);
    if (sideDelta !== 0) return sideDelta;
    return (a.committee_name ?? "").localeCompare(b.committee_name ?? "");
  });

  function handleApprove(billId: string, title: string) {
    setConfirmDialog({
      open: true,
      title: "Approve Bill",
      description: `Approve "${title}"? This will allow the bill to be presented in the House.`,
      action: () => {
        startTransition(async () => {
          const result = await approveBill(billId);
          if (result.success) {
            toast.success("Bill approved");
            setBills((prev) =>
              prev.map((b) =>
                b.id === billId ? { ...b, status: "approved" } : b
              )
            );
          } else {
            toast.error(result.error);
          }
          setConfirmDialog((prev) => ({ ...prev, open: false }));
        });
      },
    });
  }

  function handleReject(billId: string, title: string) {
    setConfirmDialog({
      open: true,
      title: "Reject Bill",
      description: `Reject "${title}"? The bill committee will need to revise and resubmit.`,
      action: () => {
        startTransition(async () => {
          const result = await rejectBill(billId);
          if (result.success) {
            toast.success("Bill rejected");
            setBills((prev) =>
              prev.map((b) =>
                b.id === billId ? { ...b, status: "rejected" } : b
              )
            );
          } else {
            toast.error(result.error);
          }
          setConfirmDialog((prev) => ({ ...prev, open: false }));
        });
      },
    });
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-bold text-gray-900 flex items-center gap-2">
            <FileText className="size-5 text-[#FF9933]" />
            Bill Management
          </h2>
          <p className="text-sm text-gray-500 mt-0.5">
            Review and manage bills drafted by each committee
          </p>
        </div>
        <div className="flex items-center gap-2">
          {canManage && (
            <Button size="sm" onClick={() => setAddOpen(true)}>
              <Plus className="size-4 mr-1" />
              Add Bill
            </Button>
          )}
          <Button variant="outline" size="sm" onClick={() => router.refresh()}>
            Refresh
          </Button>
        </div>
      </div>

      {/* Committee Rooms — direct entry to every committee's Room, independent of
          whether a bill exists yet. The Room itself is gated by canManage. */}
      {committees.length > 0 && (
        <Card>
          <CardContent className="py-4">
            <div className="mb-1 flex items-center gap-2">
              <Landmark className="size-5 text-[#FF9933]" />
              <h2 className="text-base font-bold text-gray-900">Committee Rooms</h2>
            </div>
            <p className="mb-3 text-sm text-gray-500">
              Open any committee&apos;s Room to help draft the bill, assign roles
              or resolve amendments — even before they&apos;ve started.
            </p>
            <div className="grid gap-2 sm:grid-cols-2">
              {committees.map((c) => (
                <Link
                  key={c}
                  href={`/yip/dashboard/events/${eventId}/committee/${encodeURIComponent(c)}`}
                  className="flex items-center gap-2 rounded-lg border border-gray-200 px-3 py-2.5 transition-colors hover:border-[#FF9933]/40 hover:bg-[#FF9933]/5"
                >
                  <span className="truncate text-sm font-medium text-gray-900">
                    {c}
                  </span>
                  <span className="ml-auto shrink-0 text-xs font-semibold text-[#FF9933]">
                    Open Room →
                  </span>
                </Link>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* One card per committee bill (benchless), or per party (legacy benched). */}
      {sortedBills.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <FileText className="mx-auto size-10 text-gray-200 mb-3" />
            <p className="text-sm text-gray-500">No bills drafted yet</p>
            <p className="text-xs text-gray-400 mt-1">
              Committees draft their bills during the Bill Drafting session.
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-6 lg:grid-cols-2">
          {sortedBills.map((b) => (
            <BillColumn
              key={b.id}
              eventId={eventId}
              bill={b}
              onApprove={handleApprove}
              onReject={handleReject}
              isPending={isPending}
            />
          ))}
        </div>
      )}

      {/* Committee Documents */}
      <CommitteeDocumentsSection
        initialDocuments={initialDocuments}
        canDelete={canDelete}
      />

      {/* Confirmation Dialog */}
      <Dialog
        open={confirmDialog.open}
        onOpenChange={(open) =>
          setConfirmDialog((prev) => ({ ...prev, open }))
        }
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{confirmDialog.title}</DialogTitle>
            <DialogDescription>
              {confirmDialog.description}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() =>
                setConfirmDialog((prev) => ({ ...prev, open: false }))
              }
            >
              Cancel
            </Button>
            <Button disabled={isPending} onClick={confirmDialog.action}>
              {isPending ? "Processing..." : "Confirm"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Manual Add Bill (admin shortcut — bypasses the committee draft flow) */}
      <Dialog
        open={addOpen}
        onOpenChange={(open) => {
          if (!adding) setAddOpen(open);
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add a bill manually</DialogTitle>
            <DialogDescription>
              Enter a committee&apos;s bill directly so it can be presented and
              voted on — no need for the full draft → report → submit flow. It
              appears immediately in the Control panel&apos;s Bill Presentation
              session.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1.5">
              <Label htmlFor="add-bill-committee">Committee</Label>
              <select
                id="add-bill-committee"
                value={form.committeeName}
                onChange={(e) =>
                  setForm((f) => ({ ...f, committeeName: e.target.value }))
                }
                className="w-full rounded-md border border-gray-200 bg-white px-3 py-2 text-sm text-gray-800 focus:border-[#1a1a3e]/40 focus:outline-none"
              >
                <option value="">Select committee…</option>
                {committees.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="add-bill-title">Bill title</Label>
              <Input
                id="add-bill-title"
                value={form.title}
                onChange={(e) =>
                  setForm((f) => ({ ...f, title: e.target.value }))
                }
                placeholder="e.g. The Clean Water Access Bill"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="add-bill-objective">Objective (optional)</Label>
              <Textarea
                id="add-bill-objective"
                rows={2}
                value={form.objective}
                onChange={(e) =>
                  setForm((f) => ({ ...f, objective: e.target.value }))
                }
                placeholder="One line on what the bill aims to achieve"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="add-bill-provisions">
                Key provisions (optional, one per line)
              </Label>
              <Textarea
                id="add-bill-provisions"
                rows={3}
                value={form.provisions}
                onChange={(e) =>
                  setForm((f) => ({ ...f, provisions: e.target.value }))
                }
                placeholder={"Provision 1\nProvision 2\nProvision 3"}
              />
            </div>
            <div className="flex items-center justify-between rounded-md border px-3 py-2">
              <div className="pr-3">
                <p className="text-sm font-medium text-gray-900">
                  Ready to present
                </p>
                <p className="text-xs text-gray-500">
                  On: present &amp; vote straight away. Off: needs Approve first.
                </p>
              </div>
              <Switch
                checked={form.approved}
                onCheckedChange={(v) =>
                  setForm((f) => ({ ...f, approved: v }))
                }
              />
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              disabled={adding}
              onClick={() => setAddOpen(false)}
            >
              Cancel
            </Button>
            <Button disabled={adding} onClick={handleAddBill}>
              {adding ? "Adding…" : "Add Bill"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// Neutral (saffron) accent for benchless committee bills that carry no side.
const NEUTRAL_BILL = {
  border: "border-[#FF9933]/40",
  badge: "bg-[#FF9933]/15 text-[#9a5212]",
} as const;

// ─── Bill Column Component ──────────────────────────────────────

function BillColumn({
  eventId,
  bill,
  onApprove,
  onReject,
  isPending,
}: {
  eventId: string;
  bill: BillWithMembers | null;
  onApprove: (billId: string, title: string) => void;
  onReject: (billId: string, title: string) => void;
  isPending: boolean;
}) {
  const side =
    bill?.party_side === "ruling" || bill?.party_side === "opposition"
      ? bill.party_side
      : null;
  const label =
    bill?.committee_name ??
    (side === "ruling"
      ? "Ruling Party Bill"
      : side === "opposition"
        ? "Opposition Party Bill"
        : "Committee Bill");
  const colors = side ? PARTY_COLORS[side] : NEUTRAL_BILL;
  const status = bill?.status ?? "drafting";
  const statusConfig = STATUS_CONFIG[status] ?? STATUS_CONFIG.drafting;
  const StatusIcon = statusConfig.icon;
  const provisions = clauseTexts(bill?.provisions);

  return (
    <Card className={cn("overflow-hidden", colors.border, "border")}>
      {/* Committee / party header bar */}
      <div
        className={cn(
          "px-4 py-2.5 flex items-center justify-between",
          side === "ruling"
            ? "bg-blue-50"
            : side === "opposition"
              ? "bg-red-50"
              : "bg-[#FF9933]/10"
        )}
      >
        <span
          className={cn(
            "inline-flex items-center rounded-full px-3 py-1 text-sm font-medium",
            colors.badge
          )}
        >
          {label}
        </span>
        {bill && (
          <Badge variant="secondary" className={statusConfig.className}>
            <StatusIcon className="size-3 mr-0.5" />
            {statusConfig.label}
          </Badge>
        )}
      </div>

      {bill?.committee_name && (
        <Link
          href={`/yip/dashboard/events/${eventId}/committee/${encodeURIComponent(
            bill.committee_name
          )}`}
          className="flex items-center justify-between gap-2 border-b border-gray-100 bg-gray-50/60 px-4 py-2 text-xs font-medium text-[#FF9933] hover:bg-[#FF9933]/5"
        >
          Open Committee Room — edit clauses, roles &amp; amendments
          <span aria-hidden>→</span>
        </Link>
      )}

      <CardContent className="pt-4 pb-5">
        {!bill ? (
          <div className="py-8 text-center">
            <FileText className="mx-auto size-10 text-gray-200 mb-3" />
            <p className="text-sm text-gray-500">No bill submitted yet</p>
            <p className="text-xs text-gray-400 mt-1">
              The bill committee has not started drafting
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            {/* Title */}
            <div>
              <p className="text-xs text-gray-400 uppercase tracking-wider">
                Bill Title
              </p>
              <p className="text-lg font-bold text-gray-900">{bill.title}</p>
            </div>

            {/* Objective */}
            {bill.objective && (
              <div>
                <p className="text-xs text-gray-400 uppercase tracking-wider">
                  Objective
                </p>
                <p className="text-sm text-gray-700">{bill.objective}</p>
              </div>
            )}

            {/* Problem Statement */}
            {bill.problem_statement && (
              <div>
                <p className="text-xs text-gray-400 uppercase tracking-wider">
                  Problem Statement
                </p>
                <p className="text-sm text-gray-700">
                  {bill.problem_statement}
                </p>
              </div>
            )}

            {/* Key Provisions */}
            {provisions.length > 0 && (
              <div>
                <p className="text-xs text-gray-400 uppercase tracking-wider">
                  Key Provisions
                </p>
                <ul className="mt-1 space-y-1">
                  {provisions.map((p, i) => (
                    <li
                      key={i}
                      className="flex items-start gap-2 text-sm text-gray-700"
                    >
                      <span className="mt-1.5 size-1.5 shrink-0 rounded-full bg-[#FF9933]" />
                      {p}
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {/* Expected Impact */}
            {bill.expected_impact && (
              <div>
                <p className="text-xs text-gray-400 uppercase tracking-wider">
                  Expected Impact
                </p>
                <p className="text-sm text-gray-700">
                  {bill.expected_impact}
                </p>
              </div>
            )}

            {/* Implementation */}
            {bill.implementation && (
              <div>
                <p className="text-xs text-gray-400 uppercase tracking-wider">
                  Implementation Mechanism
                </p>
                <p className="text-sm text-gray-700">
                  {bill.implementation}
                </p>
              </div>
            )}

            {/* Committee Members */}
            <div>
              <p className="text-xs text-gray-400 uppercase tracking-wider flex items-center gap-1">
                <Users className="size-3" />
                Committee Members
              </p>
              <div className="mt-1.5 grid grid-cols-2 gap-1.5">
                {bill.lead_drafter_name && (
                  <div className="rounded bg-gray-50 px-2 py-1.5">
                    <p className="text-[10px] text-gray-400">Lead Drafter</p>
                    <p className="text-xs font-medium text-gray-700 truncate">
                      {bill.lead_drafter_name}
                    </p>
                  </div>
                )}
                {bill.presenter_1_name && (
                  <div className="rounded bg-gray-50 px-2 py-1.5">
                    <p className="text-[10px] text-gray-400">Presenter 1</p>
                    <p className="text-xs font-medium text-gray-700 truncate">
                      {bill.presenter_1_name}
                    </p>
                  </div>
                )}
                {bill.presenter_2_name && (
                  <div className="rounded bg-gray-50 px-2 py-1.5">
                    <p className="text-[10px] text-gray-400">Presenter 2</p>
                    <p className="text-xs font-medium text-gray-700 truncate">
                      {bill.presenter_2_name}
                    </p>
                  </div>
                )}
                {bill.policy_researcher_name && (
                  <div className="rounded bg-gray-50 px-2 py-1.5">
                    <p className="text-[10px] text-gray-400">
                      Policy Researcher
                    </p>
                    <p className="text-xs font-medium text-gray-700 truncate">
                      {bill.policy_researcher_name}
                    </p>
                  </div>
                )}
              </div>
            </div>

            {/* Vote Results (if bill has been voted on) */}
            {(bill.votes_for !== null || bill.votes_against !== null) && (
              <div className="rounded-lg border p-3">
                <p className="text-xs text-gray-400 uppercase tracking-wider mb-2">
                  Vote Results
                </p>
                <div className="flex items-center gap-4 text-sm">
                  <span className="text-green-700 font-medium">
                    Aye: {bill.votes_for ?? 0}
                  </span>
                  <span className="text-red-700 font-medium">
                    Nay: {bill.votes_against ?? 0}
                  </span>
                  <span className="text-gray-500">
                    Abstain: {bill.votes_abstain ?? 0}
                  </span>
                </div>
              </div>
            )}

            {/* Action Buttons — only for submitted bills */}
            {status === "submitted" && (
              <div className="flex gap-2 pt-2 border-t">
                <Button
                  size="sm"
                  disabled={isPending}
                  onClick={() => onApprove(bill.id, bill.title)}
                  className="flex-1 bg-green-600 hover:bg-green-700"
                >
                  <ThumbsUp className="size-3.5 mr-1" />
                  Approve
                </Button>
                <Button
                  size="sm"
                  variant="destructive"
                  disabled={isPending}
                  onClick={() => onReject(bill.id, bill.title)}
                  className="flex-1"
                >
                  <ThumbsDown className="size-3.5 mr-1" />
                  Reject
                </Button>
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

// ─── Committee Documents Section ────────────────────────────────
// All committees' supporting documents, grouped by committee. Downloads go
// through organiserBillDocumentUrl (signed URL on the private bucket).
// Delete renders ONLY when the viewer canDelete (chair-only capability) and
// is re-gated server-side in organiserDeleteBillDocument.

function CommitteeDocumentsSection({
  initialDocuments,
  canDelete,
}: {
  initialDocuments: BillDocumentRow[];
  canDelete: boolean;
}) {
  const [documents, setDocuments] = useState(initialDocuments);
  const [busyDocId, setBusyDocId] = useState<string | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<BillDocumentRow | null>(
    null
  );
  const [isPending, startTransition] = useTransition();

  // Group by committee_name (rows arrive committee-sorted from the server).
  const grouped = new Map<string, BillDocumentRow[]>();
  for (const doc of documents) {
    const list = grouped.get(doc.committee_name) ?? [];
    list.push(doc);
    grouped.set(doc.committee_name, list);
  }

  async function handleDownload(docId: string) {
    setBusyDocId(docId);
    const result = await organiserBillDocumentUrl(docId);
    setBusyDocId(null);
    if (result.success) {
      window.open(result.data.url, "_blank", "noopener,noreferrer");
    } else {
      toast.error(result.error);
    }
  }

  function confirmDelete() {
    const target = deleteTarget;
    if (!target) return;
    startTransition(async () => {
      const result = await organiserDeleteBillDocument(target.id);
      if (result.success) {
        toast.success("Document deleted");
        setDocuments((prev) => prev.filter((d) => d.id !== target.id));
      } else {
        toast.error(result.error);
      }
      setDeleteTarget(null);
    });
  }

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-base flex items-center gap-2">
          <FolderOpen className="size-4 text-[#FF9933]" />
          Committee Documents
        </CardTitle>
        <p className="text-sm text-gray-500">
          Supporting documents and drawings uploaded by committee members
        </p>
      </CardHeader>
      <CardContent className="pb-5">
        {documents.length === 0 ? (
          <div className="py-6 text-center">
            <FolderOpen className="mx-auto size-8 text-gray-200 mb-2" />
            <p className="text-sm text-gray-500">No documents uploaded yet</p>
          </div>
        ) : (
          <div className="space-y-5">
            {[...grouped.entries()].map(([committee, docs]) => (
              <div key={committee}>
                <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider flex items-center gap-1.5 mb-2">
                  <Users className="size-3" />
                  {committee}
                  <span className="font-normal normal-case tracking-normal text-gray-400">
                    · {docs.length} {docs.length === 1 ? "file" : "files"}
                  </span>
                </p>
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
                          {doc.uploader_name} ·{" "}
                          {formatBytes(doc.file_size_bytes)} ·{" "}
                          {new Date(doc.created_at).toLocaleDateString()}
                        </p>
                      </div>
                      <div className="flex items-center gap-1 shrink-0">
                        <Button
                          size="sm"
                          variant="ghost"
                          disabled={busyDocId === doc.id}
                          onClick={() => handleDownload(doc.id)}
                          className="h-7 px-2"
                        >
                          {busyDocId === doc.id ? (
                            <Loader2 className="size-3.5 animate-spin" />
                          ) : (
                            <Download className="size-3.5" />
                          )}
                        </Button>
                        {canDelete && (
                          <Button
                            size="sm"
                            variant="ghost"
                            disabled={isPending}
                            onClick={() => setDeleteTarget(doc)}
                            className="h-7 px-2 text-red-500 hover:text-red-600"
                          >
                            <Trash2 className="size-3.5" />
                          </Button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>

      {/* Delete confirmation (chair-only path) */}
      <Dialog
        open={deleteTarget !== null}
        onOpenChange={(open) => {
          if (!open) setDeleteTarget(null);
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete Document</DialogTitle>
            <DialogDescription>
              Delete &quot;{deleteTarget?.file_name}&quot; uploaded by{" "}
              {deleteTarget?.uploader_name}? This cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteTarget(null)}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              disabled={isPending}
              onClick={confirmDelete}
            >
              {isPending ? "Deleting..." : "Delete"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
}
