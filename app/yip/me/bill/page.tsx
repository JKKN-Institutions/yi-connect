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
} from "lucide-react";
import { toast } from "sonner";
import { PARTY_COLORS } from "@/lib/yip/constants";
import {
  saveBillDraft,
  submitBill,
  getBillForParty,
  getBillCommitteeMembers,
  type BillCommitteeMember,
} from "@/app/yip/actions/bills";
import type { Tables } from "@/types/yip/database";

type Bill = Tables<{ schema: "yip" }, "bills">;

// ─── Session parsing (client-side) ──────────────────────────────

interface ParticipantSession {
  type: "participant";
  id: string;
  name: string;
  eventId: string;
}

function getSession(): ParticipantSession | null {
  if (typeof document === "undefined") return null;
  const match = document.cookie
    .split("; ")
    .find((c) => c.startsWith("yip_session="));
  if (!match) return null;
  try {
    const decoded = decodeURIComponent(match.split("=").slice(1).join("="));
    const parsed = JSON.parse(decoded);
    if (parsed.type === "participant" && parsed.id && parsed.eventId) {
      return parsed as ParticipantSession;
    }
    return null;
  } catch {
    return null;
  }
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

export default function BillDraftingPage() {
  const [session, setSession] = useState<ParticipantSession | null>(null);
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

  // Parse session on mount
  useEffect(() => {
    const s = getSession();
    setSession(s);
    if (s) {
      loadParticipantAndBill(s);
    } else {
      setLoading(false);
    }
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
    return (
      <div className="flex flex-col items-center justify-center py-12">
        <Shield className="size-10 text-gray-300 mb-3" />
        <p className="font-medium text-gray-700">Access Restricted</p>
        <p className="text-sm text-gray-500 mt-1 text-center">
          Only Bill Committee members can access this page.
          <br />
          Your role:{" "}
          {participant?.parliament_role?.replace(/_/g, " ") || "Not assigned"}
        </p>
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
