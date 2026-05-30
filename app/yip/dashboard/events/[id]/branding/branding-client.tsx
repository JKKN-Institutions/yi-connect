"use client";

import { useMemo, useState, useTransition } from "react";
import { Badge } from "@/components/yip/ui/badge";
import { Button } from "@/components/yip/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/yip/ui/card";
import { Input } from "@/components/yip/ui/input";
import { Textarea } from "@/components/yip/ui/textarea";
import {
  Award,
  BadgeCheck,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  CircleDashed,
  Clock,
  ExternalLink,
  FileText,
  Image as ImageIcon,
  Loader2,
  Mail,
  MinusCircle,
  Palette,
  Plus,
  Printer,
  ShieldAlert,
  ShieldCheck,
  Trash2,
  XCircle,
} from "lucide-react";
import {
  BRANDING_CATEGORY_LABEL,
  BRANDING_CATEGORY_ORDER,
  INVITATION_CATEGORIES,
  type BrandingCategory,
} from "@/lib/yip/branding-rules";
import {
  approveInvitation,
  deleteInvitation,
  recordInvitation,
  rejectInvitation,
  setComplianceStatus,
  type BrandingCheckRow,
  type ComplianceScore,
  type ComplianceStatus,
  type InvitationRow,
} from "@/app/yip/actions/branding";

// ─────────────────────────────────────────────────────────────────────────
// Display helpers
// ─────────────────────────────────────────────────────────────────────────

const STATUS_META: Record<
  ComplianceStatus,
  { label: string; icon: typeof CheckCircle2; badge: string; dot: string }
> = {
  not_checked: {
    label: "Not checked",
    icon: CircleDashed,
    badge: "bg-[#1a1a3e]/5 text-[#1a1a3e]/60 border-[#1a1a3e]/10",
    dot: "bg-[#1a1a3e]/20",
  },
  pending_evidence: {
    label: "Pending evidence",
    icon: Clock,
    badge: "bg-amber-50 text-amber-800 border-amber-200",
    dot: "bg-amber-500",
  },
  verified: {
    label: "Verified",
    icon: CheckCircle2,
    badge: "bg-[#138808]/10 text-[#138808] border-[#138808]/30",
    dot: "bg-[#138808]",
  },
  violation: {
    label: "Violation",
    icon: XCircle,
    badge: "bg-red-50 text-red-700 border-red-200",
    dot: "bg-red-500",
  },
  waived: {
    label: "Waived",
    icon: MinusCircle,
    badge: "bg-[#1a1a3e]/5 text-[#1a1a3e]/60 border-[#1a1a3e]/20",
    dot: "bg-[#1a1a3e]/30",
  },
};

const SEVERITY_META: Record<
  "blocker" | "warning" | "advisory",
  { label: string; badge: string }
> = {
  blocker: {
    label: "Blocker",
    badge: "bg-red-50 text-red-700 border-red-200",
  },
  warning: {
    label: "Warning",
    badge: "bg-amber-50 text-amber-800 border-amber-200",
  },
  advisory: {
    label: "Advisory",
    badge: "bg-[#1a1a3e]/5 text-[#1a1a3e]/60 border-[#1a1a3e]/10",
  },
};

const CATEGORY_ICON: Record<BrandingCategory, typeof ImageIcon> = {
  logo: ImageIcon,
  backdrop: Palette,
  collateral: FileText,
  fund: BadgeCheck,
  invitation: Mail,
  recognition: Award,
};

const CATEGORY_ACCENT: Record<BrandingCategory, string> = {
  logo: "bg-[#FF9933]",
  backdrop: "bg-[#1a1a3e]",
  collateral: "bg-blue-500",
  fund: "bg-[#138808]",
  invitation: "bg-violet-500",
  recognition: "bg-amber-500",
};

const STATUS_CYCLE: ComplianceStatus[] = [
  "not_checked",
  "pending_evidence",
  "verified",
  "violation",
  "waived",
];

// ─────────────────────────────────────────────────────────────────────────

type InvitationForm = {
  invitee_name: string;
  invitee_role: string;
  invitation_category: string;
  draft_url: string;
};

const EMPTY_INVITE: InvitationForm = {
  invitee_name: "",
  invitee_role: "",
  invitation_category: "mp_cabinet",
  draft_url: "",
};

export function BrandingClient({
  eventId,
  eventName,
  initialChecks,
  initialInvitations,
  initialScore,
  canDelete = true,
}: {
  eventId: string;
  eventName: string;
  initialChecks: BrandingCheckRow[];
  initialInvitations: InvitationRow[];
  initialScore: ComplianceScore;
  /** Chair/national/regional only. Organisers cannot delete records. */
  canDelete?: boolean;
}) {
  const [checks, setChecks] = useState<BrandingCheckRow[]>(initialChecks);
  const [invitations, setInvitations] =
    useState<InvitationRow[]>(initialInvitations);
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});
  void initialScore; // score is recomputed client-side from `checks`
  const [inviteForm, setInviteForm] = useState<InvitationForm>(EMPTY_INVITE);
  const [showInviteForm, setShowInviteForm] = useState(false);
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [flash, setFlash] = useState<string | null>(null);

  // Re-compute score client-side whenever `checks` mutates so the hero card
  // stays in sync without a round-trip.
  const liveScore = useMemo<ComplianceScore>(() => {
    const total = checks.length;
    let verified = 0;
    let violations = 0;
    let pendingCount = 0;
    let notChecked = 0;
    let waived = 0;
    let blockerViolations = 0;
    let blockerUnchecked = 0;
    for (const c of checks) {
      if (c.status === "verified") verified += 1;
      else if (c.status === "violation") {
        violations += 1;
        if (c.rule.severity === "blocker") blockerViolations += 1;
      } else if (c.status === "pending_evidence") pendingCount += 1;
      else if (c.status === "waived") waived += 1;
      else {
        notChecked += 1;
        if (c.rule.severity === "blocker") blockerUnchecked += 1;
      }
    }
    const pct =
      total > 0 ? Math.round(((verified + waived) / total) * 100) : 0;
    return {
      total_rules: total,
      verified,
      violations,
      pending: pendingCount,
      not_checked: notChecked,
      waived,
      score_pct: pct,
      blocker_violations: blockerViolations,
      blocker_unchecked: blockerUnchecked,
    };
  }, [checks]);

  const grouped = BRANDING_CATEGORY_ORDER.map((cat) => ({
    category: cat,
    rows: checks.filter((c) => c.rule.category === cat),
  })).filter((g) => g.rows.length > 0);

  // ─────────────────────────────────────────────────────────────────────
  // Hero tone
  // ─────────────────────────────────────────────────────────────────────
  const heroTone = (() => {
    if (liveScore.blocker_violations > 0)
      return {
        label: "Blocker violations",
        accent: "bg-red-500",
        icon: ShieldAlert,
        subtle: "bg-red-50 text-red-700 border-red-200",
        strip: "from-red-500 to-red-600",
      };
    if (liveScore.violations > 0 || liveScore.blocker_unchecked > 0)
      return {
        label: "Needs attention",
        accent: "bg-amber-500",
        icon: ShieldAlert,
        subtle: "bg-amber-50 text-amber-800 border-amber-200",
        strip: "from-amber-400 to-amber-500",
      };
    if (liveScore.score_pct === 100)
      return {
        label: "All branding verified",
        accent: "bg-[#138808]",
        icon: ShieldCheck,
        subtle: "bg-[#138808]/10 text-[#138808] border-[#138808]/30",
        strip: "from-[#FF9933] via-white to-[#138808]",
      };
    return {
      label: "In progress",
      accent: "bg-[#1a1a3e]/30",
      icon: ShieldCheck,
      subtle: "bg-[#1a1a3e]/5 text-[#1a1a3e]/60 border-[#1a1a3e]/10",
      strip: "from-[#FF9933] to-[#138808]",
    };
  })();

  // ─────────────────────────────────────────────────────────────────────
  // Mutations
  // ─────────────────────────────────────────────────────────────────────
  function applyStatus(
    ruleKey: string,
    status: ComplianceStatus,
    patch?: Partial<BrandingCheckRow>
  ) {
    setChecks((prev) =>
      prev.map((c) =>
        c.rule_key === ruleKey
          ? {
              ...c,
              status,
              ...patch,
              checked_at:
                status === "not_checked"
                  ? null
                  : patch?.checked_at ?? new Date().toISOString(),
            }
          : c
      )
    );
  }

  function cycleStatus(row: BrandingCheckRow) {
    const idx = STATUS_CYCLE.indexOf(row.status);
    const next = STATUS_CYCLE[(idx + 1) % STATUS_CYCLE.length];
    const before = row.status;
    applyStatus(row.rule_key, next);
    startTransition(async () => {
      const res = await setComplianceStatus(eventId, row.rule_key, next, {
        evidenceUrl: row.evidence_url,
        notes: row.notes,
        violationAction: row.violation_action,
      });
      if (!res.success) {
        setError(res.error);
        applyStatus(row.rule_key, before);
      }
    });
  }

  function setStatusExplicit(row: BrandingCheckRow, next: ComplianceStatus) {
    if (row.status === next) return;
    const before = row.status;
    applyStatus(row.rule_key, next);
    startTransition(async () => {
      const res = await setComplianceStatus(eventId, row.rule_key, next, {
        evidenceUrl: row.evidence_url,
        notes: row.notes,
        violationAction: row.violation_action,
      });
      if (!res.success) {
        setError(res.error);
        applyStatus(row.rule_key, before);
      }
    });
  }

  function saveRow(row: BrandingCheckRow) {
    startTransition(async () => {
      const res = await setComplianceStatus(eventId, row.rule_key, row.status, {
        evidenceUrl: row.evidence_url,
        notes: row.notes,
        violationAction: row.violation_action,
      });
      if (!res.success) {
        setError(res.error);
      } else {
        setFlash("Saved");
        setTimeout(() => setFlash(null), 1500);
      }
    });
  }

  function updateRowLocal(
    ruleKey: string,
    patch: Partial<Pick<BrandingCheckRow, "evidence_url" | "notes" | "violation_action">>
  ) {
    setChecks((prev) =>
      prev.map((c) => (c.rule_key === ruleKey ? { ...c, ...patch } : c))
    );
  }

  function submitInvitation() {
    const name = inviteForm.invitee_name.trim();
    if (!name) {
      setError("Invitee name is required");
      return;
    }
    setError(null);
    startTransition(async () => {
      const res = await recordInvitation(
        eventId,
        { name, role: inviteForm.invitee_role || null },
        inviteForm.invitation_category,
        inviteForm.draft_url || null
      );
      if (!res.success) {
        setError(res.error);
        return;
      }
      setInvitations((prev) => [res.data, ...prev]);
      setInviteForm(EMPTY_INVITE);
      setShowInviteForm(false);
      setFlash("Invitation recorded");
      setTimeout(() => setFlash(null), 1500);
    });
  }

  function decideInvitation(
    id: string,
    decision: "approve" | "reject",
    note?: string
  ) {
    const before = invitations;
    setInvitations((prev) =>
      prev.map((i) =>
        i.id === id
          ? {
              ...i,
              approval_status: decision === "approve" ? "approved" : "rejected",
              approved_by_national: decision === "approve",
              approval_note: note ?? i.approval_note,
              approved_at: new Date().toISOString(),
            }
          : i
      )
    );
    startTransition(async () => {
      const res =
        decision === "approve"
          ? await approveInvitation(id, note)
          : await rejectInvitation(id, note);
      if (!res.success) {
        setError(res.error);
        setInvitations(before);
      }
    });
  }

  function removeInvitation(id: string) {
    const before = invitations;
    setInvitations((prev) => prev.filter((i) => i.id !== id));
    startTransition(async () => {
      const res = await deleteInvitation(id, eventId);
      if (!res.success) {
        setError(res.error);
        setInvitations(before);
      }
    });
  }

  // ─────────────────────────────────────────────────────────────────────
  // Render
  // ─────────────────────────────────────────────────────────────────────
  return (
    <div className="max-w-[1100px] mx-auto px-6 py-8 space-y-6 print:py-4">
      {/* Header */}
      <div className="flex items-start justify-between gap-4 print:mb-2">
        <div>
          <h1 className="text-3xl font-bold text-[#1a1a3e] tracking-tight flex items-center gap-2">
            <ShieldCheck className="size-7 text-[#FF9933]" />
            Branding Compliance
          </h1>
          <p className="text-sm text-[#1a1a3e]/60 mt-1">
            {eventName} · Handbook p.13 · Self-attestation with photo evidence
          </p>
        </div>
        <Button
          variant="outline"
          onClick={() => window.print()}
          className="print:hidden"
        >
          <Printer className="size-4 mr-2" />
          Print
        </Button>
      </div>

      {/* Hero score card */}
      <Card className="overflow-hidden">
        <div className={`h-1 bg-gradient-to-r ${heroTone.strip}`} />
        <CardContent className="p-6 print:p-4">
          <div className="grid grid-cols-1 md:grid-cols-[auto_1fr_auto] gap-6 items-center">
            <div
              className={`size-24 rounded-full ${heroTone.accent} text-white flex items-center justify-center shrink-0`}
            >
              <heroTone.icon className="size-10" />
            </div>
            <div className="min-w-0">
              <div className="flex items-baseline gap-3">
                <div className="text-5xl font-bold text-[#1a1a3e] tabular-nums">
                  {liveScore.score_pct}%
                </div>
                <Badge
                  variant="outline"
                  className={`${heroTone.subtle} font-medium`}
                >
                  {heroTone.label}
                </Badge>
              </div>
              <p className="text-sm text-[#1a1a3e]/60 mt-1">
                {liveScore.verified} verified · {liveScore.waived} waived ·{" "}
                {liveScore.pending} pending · {liveScore.not_checked} not
                checked · {liveScore.violations} violations
              </p>
              <div className="relative h-2 mt-3 rounded-full bg-[#1a1a3e]/5 overflow-hidden">
                <div
                  className={`absolute inset-y-0 left-0 bg-gradient-to-r ${heroTone.strip} transition-all duration-500`}
                  style={{ width: `${liveScore.score_pct}%` }}
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3 shrink-0">
              <StatTile
                label="Blocker violations"
                value={liveScore.blocker_violations}
                tone={
                  liveScore.blocker_violations > 0 ? "red" : "green"
                }
              />
              <StatTile
                label="Blocker unchecked"
                value={liveScore.blocker_unchecked}
                tone={
                  liveScore.blocker_unchecked > 0 ? "amber" : "green"
                }
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {(error || flash) && (
        <div className="print:hidden space-y-2">
          {error && (
            <div className="rounded-lg bg-red-50 border border-red-200 px-3 py-2 text-sm text-red-700 flex items-center justify-between">
              <span>{error}</span>
              <button
                onClick={() => setError(null)}
                className="text-red-700/70 hover:text-red-700 text-xs"
              >
                dismiss
              </button>
            </div>
          )}
          {flash && (
            <div className="rounded-lg bg-[#138808]/10 border border-[#138808]/30 px-3 py-2 text-sm text-[#138808]">
              {flash}
            </div>
          )}
        </div>
      )}

      {/* Rules by category */}
      {grouped.map(({ category, rows }) => {
        const Icon = CATEGORY_ICON[category];
        const accent = CATEGORY_ACCENT[category];
        const verifiedCount = rows.filter(
          (r) => r.status === "verified" || r.status === "waived"
        ).length;
        return (
          <Card key={category} className="overflow-hidden">
            <div className={`h-1 ${accent}`} />
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-base text-[#1a1a3e] flex items-center gap-2">
                  <Icon className="size-4 text-[#1a1a3e]/60" />
                  {BRANDING_CATEGORY_LABEL[category]}
                </CardTitle>
                <Badge
                  variant="secondary"
                  className="text-[11px] font-mono"
                >
                  {verifiedCount}/{rows.length}
                </Badge>
              </div>
            </CardHeader>
            <CardContent className="pt-0 pb-3 space-y-2">
              {rows.map((row) => (
                <RuleRow
                  key={row.rule_key}
                  row={row}
                  expanded={!!expanded[row.rule_key]}
                  onToggleExpand={() =>
                    setExpanded((p) => ({
                      ...p,
                      [row.rule_key]: !p[row.rule_key],
                    }))
                  }
                  onCycleStatus={() => cycleStatus(row)}
                  onSetStatus={(s) => setStatusExplicit(row, s)}
                  onUpdate={(patch) => updateRowLocal(row.rule_key, patch)}
                  onSave={() => saveRow(row)}
                  pending={pending}
                />
              ))}
            </CardContent>
          </Card>
        );
      })}

      {/* Invitations */}
      <Card className="overflow-hidden">
        <div className="h-1 bg-violet-500" />
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-base text-[#1a1a3e] flex items-center gap-2">
              <Mail className="size-4 text-[#1a1a3e]/60" />
              Dignitary Invitations (Approval Log)
            </CardTitle>
            <Button
              size="sm"
              variant="outline"
              className="print:hidden"
              onClick={() => setShowInviteForm((s) => !s)}
            >
              <Plus className="size-3.5 mr-1" />
              Record invitation
            </Button>
          </div>
          <p className="text-xs text-[#1a1a3e]/60">
            Handbook p.13 — Every MP / Cabinet invitation needs national
            approval before outreach.
          </p>
        </CardHeader>
        <CardContent className="pt-0 space-y-2">
          {showInviteForm && (
            <div className="rounded-lg border border-[#1a1a3e]/10 bg-[#FF9933]/5 p-4 space-y-3 print:hidden">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div>
                  <label className="text-xs text-[#1a1a3e]/60 font-medium">
                    Invitee name *
                  </label>
                  <Input
                    value={inviteForm.invitee_name}
                    onChange={(e) =>
                      setInviteForm((f) => ({
                        ...f,
                        invitee_name: e.target.value,
                      }))
                    }
                    placeholder="Hon. Shri ABC"
                  />
                </div>
                <div>
                  <label className="text-xs text-[#1a1a3e]/60 font-medium">
                    Role / designation
                  </label>
                  <Input
                    value={inviteForm.invitee_role}
                    onChange={(e) =>
                      setInviteForm((f) => ({
                        ...f,
                        invitee_role: e.target.value,
                      }))
                    }
                    placeholder="Sitting MP / Cabinet Minister"
                  />
                </div>
                <div>
                  <label className="text-xs text-[#1a1a3e]/60 font-medium">
                    Category
                  </label>
                  <select
                    value={inviteForm.invitation_category}
                    onChange={(e) =>
                      setInviteForm((f) => ({
                        ...f,
                        invitation_category: e.target.value,
                      }))
                    }
                    className="flex h-9 w-full rounded-md border border-[#1a1a3e]/15 bg-white px-3 py-1 text-sm"
                  >
                    {INVITATION_CATEGORIES.map((c) => (
                      <option key={c.value} value={c.value}>
                        {c.label}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="text-xs text-[#1a1a3e]/60 font-medium">
                    Draft URL (optional)
                  </label>
                  <Input
                    value={inviteForm.draft_url}
                    onChange={(e) =>
                      setInviteForm((f) => ({
                        ...f,
                        draft_url: e.target.value,
                      }))
                    }
                    placeholder="https://drive.google.com/..."
                  />
                </div>
              </div>
              <div className="flex gap-2 justify-end">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    setShowInviteForm(false);
                    setInviteForm(EMPTY_INVITE);
                  }}
                >
                  Cancel
                </Button>
                <Button
                  size="sm"
                  disabled={pending}
                  onClick={submitInvitation}
                  className="bg-[#FF9933] hover:bg-[#FF9933]/90 text-white"
                >
                  {pending && (
                    <Loader2 className="size-3.5 mr-1 animate-spin" />
                  )}
                  Submit for approval
                </Button>
              </div>
            </div>
          )}

          {invitations.length === 0 ? (
            <p className="text-sm text-[#1a1a3e]/50 py-4 text-center">
              No invitations recorded yet.
            </p>
          ) : (
            <div className="space-y-2">
              {invitations.map((inv) => (
                <InvitationItem
                  key={inv.id}
                  invitation={inv}
                  onApprove={(note) => decideInvitation(inv.id, "approve", note)}
                  onReject={(note) => decideInvitation(inv.id, "reject", note)}
                  onDelete={() => removeInvitation(inv.id)}
                  canDelete={canDelete}
                  pending={pending}
                />
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────
// Subcomponents
// ─────────────────────────────────────────────────────────────────────────

function StatTile({
  label,
  value,
  tone,
}: {
  label: string;
  value: number;
  tone: "red" | "amber" | "green";
}) {
  const toneClass =
    tone === "red"
      ? "bg-red-50 text-red-700 border-red-200"
      : tone === "amber"
      ? "bg-amber-50 text-amber-800 border-amber-200"
      : "bg-[#138808]/10 text-[#138808] border-[#138808]/30";
  return (
    <div className={`rounded-lg border px-3 py-2 ${toneClass}`}>
      <div className="text-2xl font-bold tabular-nums leading-none">{value}</div>
      <div className="text-[10px] uppercase tracking-wide mt-1 opacity-80">
        {label}
      </div>
    </div>
  );
}

function RuleRow({
  row,
  expanded,
  onToggleExpand,
  onCycleStatus,
  onSetStatus,
  onUpdate,
  onSave,
  pending,
}: {
  row: BrandingCheckRow;
  expanded: boolean;
  onToggleExpand: () => void;
  onCycleStatus: () => void;
  onSetStatus: (status: ComplianceStatus) => void;
  onUpdate: (patch: {
    evidence_url?: string | null;
    notes?: string | null;
    violation_action?: string | null;
  }) => void;
  onSave: () => void;
  pending: boolean;
}) {
  const statusMeta = STATUS_META[row.status];
  const sevMeta = SEVERITY_META[row.rule.severity];
  const StatusIcon = statusMeta.icon;

  return (
    <div className="rounded-lg border border-[#1a1a3e]/10 overflow-hidden bg-white">
      <div className="px-3 py-2.5 flex items-start gap-3">
        <button
          onClick={onCycleStatus}
          disabled={pending}
          title="Click to cycle status"
          className={`shrink-0 size-7 rounded-full border ${statusMeta.badge} flex items-center justify-center hover:opacity-80 transition-opacity print:hidden`}
        >
          <StatusIcon className="size-4" />
        </button>
        {/* Print-only status dot */}
        <div
          className={`hidden print:block size-3 rounded-full ${statusMeta.dot} mt-1 shrink-0`}
        />
        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <p className="text-sm font-medium text-[#1a1a3e]">
                  {row.rule.title}
                </p>
                <Badge
                  variant="outline"
                  className={`text-[10px] font-medium ${sevMeta.badge}`}
                >
                  {sevMeta.label}
                </Badge>
                <span className="text-[10px] text-[#1a1a3e]/40">
                  p.{row.rule.handbook_page}
                </span>
              </div>
              <p className="text-xs text-[#1a1a3e]/60 mt-0.5">
                {row.rule.description}
              </p>
            </div>
            <button
              onClick={onToggleExpand}
              className="shrink-0 text-[#1a1a3e]/40 hover:text-[#1a1a3e] print:hidden"
            >
              {expanded ? (
                <ChevronDown className="size-4" />
              ) : (
                <ChevronRight className="size-4" />
              )}
            </button>
          </div>

          {/* Status pill row */}
          <div className="flex items-center gap-1.5 mt-2 flex-wrap print:hidden">
            {STATUS_CYCLE.map((s) => {
              const meta = STATUS_META[s];
              const Icon = meta.icon;
              const active = row.status === s;
              return (
                <button
                  key={s}
                  onClick={() => onSetStatus(s)}
                  disabled={pending}
                  className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] border transition-all ${
                    active
                      ? meta.badge
                      : "bg-white text-[#1a1a3e]/50 border-[#1a1a3e]/10 hover:border-[#1a1a3e]/30"
                  }`}
                >
                  <Icon className="size-3" />
                  {meta.label}
                </button>
              );
            })}
            {row.evidence_url && (
              <a
                href={row.evidence_url}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] border bg-blue-50 text-blue-700 border-blue-200 hover:bg-blue-100"
              >
                <ExternalLink className="size-3" />
                Evidence
              </a>
            )}
          </div>

          {/* Expanded panel */}
          {expanded && (
            <div className="mt-3 space-y-2 print:hidden">
              {row.rule.requires_evidence && (
                <div>
                  <label className="text-[11px] text-[#1a1a3e]/60 font-medium">
                    Evidence URL (photo / doc)
                  </label>
                  <Input
                    value={row.evidence_url ?? ""}
                    onChange={(e) =>
                      onUpdate({ evidence_url: e.target.value })
                    }
                    onBlur={onSave}
                    placeholder="https://..."
                    className="h-8 text-xs"
                  />
                </div>
              )}
              <div>
                <label className="text-[11px] text-[#1a1a3e]/60 font-medium">
                  Notes
                </label>
                <Textarea
                  value={row.notes ?? ""}
                  onChange={(e) => onUpdate({ notes: e.target.value })}
                  onBlur={onSave}
                  placeholder="Any context, caveats, or supplier notes"
                  rows={2}
                  className="text-xs"
                />
              </div>
              {row.status === "violation" && (
                <div>
                  <label className="text-[11px] text-red-700 font-medium">
                    Remediation action
                  </label>
                  <Textarea
                    value={row.violation_action ?? ""}
                    onChange={(e) =>
                      onUpdate({ violation_action: e.target.value })
                    }
                    onBlur={onSave}
                    placeholder="What has been done / will be done to fix this?"
                    rows={2}
                    className="text-xs border-red-200"
                  />
                </div>
              )}
            </div>
          )}

          {/* Print-only details */}
          <div className="hidden print:block mt-2 text-xs text-[#1a1a3e]/70 space-y-1">
            <div>
              <span className="font-medium">Status:</span> {statusMeta.label}
            </div>
            {row.evidence_url && (
              <div>
                <span className="font-medium">Evidence:</span>{" "}
                {row.evidence_url}
              </div>
            )}
            {row.notes && (
              <div>
                <span className="font-medium">Notes:</span> {row.notes}
              </div>
            )}
            {row.violation_action && (
              <div>
                <span className="font-medium">Action:</span>{" "}
                {row.violation_action}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function InvitationItem({
  invitation,
  onApprove,
  onReject,
  onDelete,
  canDelete = true,
  pending,
}: {
  invitation: InvitationRow;
  onApprove: (note?: string) => void;
  onReject: (note?: string) => void;
  onDelete: () => void;
  canDelete?: boolean;
  pending: boolean;
}) {
  const [note, setNote] = useState("");
  const [showNoteInput, setShowNoteInput] = useState(false);

  const statusTone =
    invitation.approval_status === "approved"
      ? "bg-[#138808]/10 text-[#138808] border-[#138808]/30"
      : invitation.approval_status === "rejected"
      ? "bg-red-50 text-red-700 border-red-200"
      : "bg-amber-50 text-amber-800 border-amber-200";

  const categoryLabel =
    INVITATION_CATEGORIES.find(
      (c) => c.value === invitation.invitation_category
    )?.label ?? invitation.invitation_category ?? "—";

  return (
    <div className="rounded-lg border border-[#1a1a3e]/10 bg-white p-3">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 flex-wrap">
            <p className="text-sm font-medium text-[#1a1a3e]">
              {invitation.invitee_name}
            </p>
            <Badge
              variant="outline"
              className={`text-[10px] ${statusTone}`}
            >
              {invitation.approval_status}
            </Badge>
            {invitation.approved_by_national && (
              <Badge
                variant="outline"
                className="text-[10px] bg-[#138808]/10 text-[#138808] border-[#138808]/30"
              >
                National-approved
              </Badge>
            )}
          </div>
          <p className="text-xs text-[#1a1a3e]/60 mt-0.5">
            {invitation.invitee_role ?? "—"} · {categoryLabel}
          </p>
          {invitation.draft_url && (
            <a
              href={invitation.draft_url}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-1 text-[11px] text-blue-600 hover:underline mt-1"
            >
              <ExternalLink className="size-3" />
              Draft
            </a>
          )}
          {invitation.approval_note && (
            <p className="text-[11px] text-[#1a1a3e]/60 mt-1 italic">
              &ldquo;{invitation.approval_note}&rdquo;
            </p>
          )}
        </div>

        <div className="flex items-center gap-1 print:hidden shrink-0">
          {invitation.approval_status === "pending" && (
            <>
              <Button
                size="sm"
                variant="outline"
                disabled={pending}
                onClick={() => onApprove(note || undefined)}
                className="h-7 text-xs text-[#138808] border-[#138808]/30 hover:bg-[#138808]/10"
              >
                <CheckCircle2 className="size-3.5 mr-1" />
                Approve
              </Button>
              <Button
                size="sm"
                variant="outline"
                disabled={pending}
                onClick={() => onReject(note || undefined)}
                className="h-7 text-xs text-red-700 border-red-200 hover:bg-red-50"
              >
                <XCircle className="size-3.5 mr-1" />
                Reject
              </Button>
              <Button
                size="sm"
                variant="ghost"
                onClick={() => setShowNoteInput((v) => !v)}
                className="h-7 text-xs"
              >
                Note
              </Button>
            </>
          )}
          {canDelete && (
            <Button
              size="sm"
              variant="ghost"
              onClick={onDelete}
              disabled={pending}
              className="h-7 w-7 p-0 text-[#1a1a3e]/40 hover:text-red-600"
            >
              <Trash2 className="size-3.5" />
            </Button>
          )}
        </div>
      </div>
      {showNoteInput && invitation.approval_status === "pending" && (
        <div className="mt-2 print:hidden">
          <Input
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="Approval note (optional)"
            className="h-8 text-xs"
          />
        </div>
      )}
    </div>
  );
}
