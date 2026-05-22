"use client";

import { useMemo, useState, useTransition } from "react";
import {
  AlertCircle,
  AlertTriangle,
  BookOpen,
  Camera,
  CheckCircle2,
  ExternalLink,
  FileText,
  GripVertical,
  Image as ImageIcon,
  Info,
  Loader2,
  Pencil,
  Plus,
  RotateCcw,
  ShieldAlert,
  ShieldCheck,
  Sparkles,
  Trash2,
  X,
} from "lucide-react";
import { Badge } from "@/components/yip/ui/badge";
import { Button } from "@/components/yip/ui/button";
import { Card, CardContent } from "@/components/yip/ui/card";
import { Input } from "@/components/yip/ui/input";
import { Label } from "@/components/yip/ui/label";
import { Textarea } from "@/components/yip/ui/textarea";
import {
  adminCreateBrandingRule,
  adminDeactivateBrandingRule,
  adminReactivateBrandingRule,
  adminReorderBrandingRules,
  adminUpdateBrandingRule,
  type AdminBrandingCategory,
  type AdminBrandingRule,
  type AdminBrandingSeverity,
  type BrandingRuleInput,
} from "@/app/actions/yip/admin-branding-rules";

// ─── Display meta ─────────────────────────────────────────────────

const CATEGORY_META: Record<
  AdminBrandingCategory,
  { label: string; icon: typeof ShieldCheck; accent: string }
> = {
  logo: {
    label: "Logos",
    icon: ImageIcon,
    accent: "text-[#FF9933] border-[#FF9933]/30",
  },
  backdrop: {
    label: "Backdrop & Stage",
    icon: Sparkles,
    accent: "text-[#1a1a3e] border-[#1a1a3e]/20",
  },
  collateral: {
    label: "Collaterals & Creatives",
    icon: FileText,
    accent: "text-blue-700 border-blue-300",
  },
  fund: {
    label: "Fundraising & Sponsors",
    icon: ShieldAlert,
    accent: "text-amber-700 border-amber-300",
  },
  invitation: {
    label: "Invitations & Dignitaries",
    icon: Camera,
    accent: "text-purple-700 border-purple-300",
  },
  recognition: {
    label: "Recognitions",
    icon: ShieldCheck,
    accent: "text-[#138808] border-[#138808]/30",
  },
};

const CATEGORY_ORDER: AdminBrandingCategory[] = [
  "logo",
  "backdrop",
  "collateral",
  "fund",
  "invitation",
  "recognition",
];

const SEVERITY_META: Record<
  AdminBrandingSeverity,
  { label: string; badge: string; dot: string; icon: typeof ShieldAlert }
> = {
  blocker: {
    label: "Blocker",
    badge: "bg-red-50 text-red-700 border border-red-200",
    dot: "bg-red-500",
    icon: ShieldAlert,
  },
  warning: {
    label: "Warning",
    badge: "bg-amber-50 text-amber-700 border border-amber-200",
    dot: "bg-amber-500",
    icon: AlertTriangle,
  },
  advisory: {
    label: "Advisory",
    badge: "bg-gray-50 text-gray-600 border border-gray-200",
    dot: "bg-gray-400",
    icon: Info,
  },
};

const RULE_KEY_RE = /^[a-z][a-z0-9_]*$/;

// ─── Component ────────────────────────────────────────────────────

export function BrandingRulesClient({
  initialRules,
}: {
  initialRules: AdminBrandingRule[];
}) {
  const [rules, setRules] = useState<AdminBrandingRule[]>(initialRules);
  const [isPending, startTransition] = useTransition();
  const [editorOpen, setEditorOpen] = useState(false);
  const [editing, setEditing] = useState<AdminBrandingRule | null>(null);
  const [message, setMessage] = useState<{
    type: "success" | "error";
    text: string;
  } | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  // Show/hide inactive rules
  const [showInactive, setShowInactive] = useState(true);

  // Drag state
  const [dragId, setDragId] = useState<string | null>(null);
  const [dragOverId, setDragOverId] = useState<string | null>(null);

  const grouped = useMemo(() => {
    const map: Record<AdminBrandingCategory, AdminBrandingRule[]> = {
      logo: [],
      backdrop: [],
      collateral: [],
      fund: [],
      invitation: [],
      recognition: [],
    };
    const filtered = showInactive ? rules : rules.filter((r) => r.is_active);
    for (const r of filtered) {
      map[r.category].push(r);
    }
    for (const cat of CATEGORY_ORDER) {
      map[cat].sort((a, b) => a.sort_order - b.sort_order);
    }
    return map;
  }, [rules, showInactive]);

  function openCreate() {
    setEditing(null);
    setEditorOpen(true);
  }

  function openEdit(rule: AdminBrandingRule) {
    setEditing(rule);
    setEditorOpen(true);
  }

  async function handleSubmit(input: BrandingRuleInput) {
    setMessage(null);
    if (editing) {
      const res = await adminUpdateBrandingRule(editing.id, input);
      if (!res.success) {
        setMessage({ type: "error", text: res.error });
        return false;
      }
      setRules((prev) =>
        prev.map((r) => (r.id === res.data.id ? res.data : r))
      );
      setMessage({ type: "success", text: `Updated "${res.data.title}"` });
    } else {
      const res = await adminCreateBrandingRule(input);
      if (!res.success) {
        setMessage({ type: "error", text: res.error });
        return false;
      }
      setRules((prev) => [...prev, res.data]);
      setMessage({ type: "success", text: `Created "${res.data.title}"` });
    }
    setEditorOpen(false);
    setEditing(null);
    return true;
  }

  async function handleToggleActive(rule: AdminBrandingRule) {
    setBusyId(rule.id);
    setMessage(null);
    const res = rule.is_active
      ? await adminDeactivateBrandingRule(rule.id)
      : await adminReactivateBrandingRule(rule.id);
    setBusyId(null);
    if (!res.success) {
      setMessage({ type: "error", text: res.error });
      return;
    }
    setRules((prev) =>
      prev.map((r) =>
        r.id === rule.id ? { ...r, is_active: !rule.is_active } : r
      )
    );
    setMessage({
      type: "success",
      text: rule.is_active
        ? `Deactivated — "${rule.title}" will no longer appear on chapter Branding checklists. Existing compliance rows keep the rule_key reference for history.`
        : `Reactivated "${rule.title}"`,
    });
  }

  // ─── Drag-to-reorder (HTML5, within a category) ───────────────
  function onDragStart(e: React.DragEvent, id: string) {
    setDragId(id);
    e.dataTransfer.effectAllowed = "move";
    try {
      e.dataTransfer.setData("text/plain", id);
    } catch {
      /* some browsers throw */
    }
  }
  function onDragOver(e: React.DragEvent, id: string) {
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
    setDragOverId(id);
  }
  function onDragEnd() {
    setDragId(null);
    setDragOverId(null);
  }
  async function onDrop(
    e: React.DragEvent,
    category: AdminBrandingCategory,
    dropId: string
  ) {
    e.preventDefault();
    const sourceId = dragId;
    setDragId(null);
    setDragOverId(null);
    if (!sourceId || sourceId === dropId) return;

    const list = grouped[category].map((r) => r.id);
    const from = list.indexOf(sourceId);
    const to = list.indexOf(dropId);
    if (from < 0 || to < 0) return;

    const next = [...list];
    next.splice(from, 1);
    next.splice(to, 0, sourceId);

    // Optimistic update
    const oldRules = rules;
    setRules((prev) => {
      const indexMap = new Map(next.map((id, idx) => [id, (idx + 1) * 10]));
      return prev.map((r) =>
        r.category === category && indexMap.has(r.id)
          ? { ...r, sort_order: indexMap.get(r.id) ?? r.sort_order }
          : r
      );
    });

    startTransition(async () => {
      const res = await adminReorderBrandingRules(next);
      if (!res.success) {
        setRules(oldRules);
        setMessage({ type: "error", text: res.error });
      }
    });
  }

  // ─── Stats ────────────────────────────────────────────────────
  const totalActive = rules.filter((r) => r.is_active).length;
  const totalBlockers = rules.filter(
    (r) => r.is_active && r.severity === "blocker"
  ).length;

  // ─── Render ───────────────────────────────────────────────────
  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-[#1a1a3e]">Branding Rules</h1>
          <p className="mt-1 text-sm text-[#1a1a3e]/60">
            DB-backed rule catalogue for the Chapter Branding Checklist. Every
            change takes effect on the next compliance-list load.
          </p>
          <a
            href="#"
            onClick={(e) => e.preventDefault()}
            className="mt-2 inline-flex items-center gap-1.5 text-xs font-medium text-[#FF9933] hover:underline"
          >
            <BookOpen className="size-3.5" />
            Handbook p.13 — Branding & Chapter Communications
            <ExternalLink className="size-3" />
          </a>
        </div>
        <div className="flex items-center gap-2">
          <label className="flex items-center gap-2 text-xs text-[#1a1a3e]/60">
            <input
              type="checkbox"
              checked={showInactive}
              onChange={(e) => setShowInactive(e.target.checked)}
              className="rounded border-gray-300 text-[#FF9933] focus:ring-[#FF9933]"
            />
            Show inactive
          </label>
          <Button
            size="sm"
            className="bg-[#FF9933] text-white hover:bg-[#E68A2E]"
            onClick={openCreate}
          >
            <Plus className="size-4" />
            New Rule
          </Button>
        </div>
      </div>

      {/* Message */}
      {message && (
        <div
          className={`flex items-start gap-2 rounded-lg border px-4 py-3 text-sm ${
            message.type === "success"
              ? "border-[#138808]/30 bg-[#138808]/5 text-[#138808]"
              : "border-red-200 bg-red-50 text-red-700"
          }`}
        >
          {message.type === "success" ? (
            <CheckCircle2 className="size-4 mt-0.5 shrink-0" />
          ) : (
            <AlertCircle className="size-4 mt-0.5 shrink-0" />
          )}
          <div className="flex-1">{message.text}</div>
          <button
            onClick={() => setMessage(null)}
            className="text-current opacity-60 hover:opacity-100"
          >
            <X className="size-4" />
          </button>
        </div>
      )}

      {/* Summary bar */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <Card className="border-[#1a1a3e]/10">
          <CardContent className="pt-5">
            <p className="text-[11px] font-medium uppercase tracking-wide text-[#1a1a3e]/50">
              Active Rules
            </p>
            <p className="mt-1 text-2xl font-bold text-[#1a1a3e]">
              {totalActive}
            </p>
          </CardContent>
        </Card>
        <Card className="border-red-100">
          <CardContent className="pt-5">
            <p className="text-[11px] font-medium uppercase tracking-wide text-red-600/70">
              Blockers
            </p>
            <p className="mt-1 text-2xl font-bold text-red-700">
              {totalBlockers}
            </p>
          </CardContent>
        </Card>
        <Card className="border-[#FF9933]/20">
          <CardContent className="pt-5">
            <p className="text-[11px] font-medium uppercase tracking-wide text-[#FF9933]">
              Categories
            </p>
            <p className="mt-1 text-2xl font-bold text-[#1a1a3e]">
              {CATEGORY_ORDER.length}
            </p>
          </CardContent>
        </Card>
        <Card className="border-[#138808]/20">
          <CardContent className="pt-5">
            <p className="text-[11px] font-medium uppercase tracking-wide text-[#138808]">
              Total (incl. inactive)
            </p>
            <p className="mt-1 text-2xl font-bold text-[#1a1a3e]">
              {rules.length}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Grouped by category */}
      <div className="space-y-6">
        {CATEGORY_ORDER.map((cat) => {
          const list = grouped[cat];
          const meta = CATEGORY_META[cat];
          const CatIcon = meta.icon;

          if (list.length === 0) return null;

          return (
            <section key={cat}>
              <div
                className={`flex items-center gap-2 border-b pb-2 mb-3 ${meta.accent}`}
              >
                <CatIcon className="size-4" />
                <h2 className="text-sm font-semibold uppercase tracking-wide">
                  {meta.label}
                </h2>
                <span className="ml-auto text-xs text-[#1a1a3e]/50">
                  {list.filter((r) => r.is_active).length} active /{" "}
                  {list.length} total
                </span>
              </div>

              <div className="space-y-2">
                {list.map((r) => (
                  <RuleRow
                    key={r.id}
                    rule={r}
                    busy={busyId === r.id || isPending}
                    dragging={dragId === r.id}
                    dragOver={dragOverId === r.id && dragId !== r.id}
                    onEdit={() => openEdit(r)}
                    onToggleActive={() => handleToggleActive(r)}
                    onDragStart={(e) => onDragStart(e, r.id)}
                    onDragOver={(e) => onDragOver(e, r.id)}
                    onDrop={(e) => onDrop(e, r.category, r.id)}
                    onDragEnd={onDragEnd}
                  />
                ))}
              </div>
            </section>
          );
        })}

        {rules.length === 0 && (
          <Card className="border-dashed">
            <CardContent className="flex flex-col items-center justify-center py-16 text-center">
              <ShieldCheck className="mb-3 size-10 text-gray-300" />
              <h3 className="text-sm font-semibold text-[#1a1a3e]">
                No branding rules yet
              </h3>
              <p className="mt-1 text-xs text-[#1a1a3e]/50 max-w-sm">
                Create your first rule to populate the Chapter Branding
                Checklist.
              </p>
              <Button
                size="sm"
                className="mt-4 bg-[#FF9933] text-white hover:bg-[#E68A2E]"
                onClick={openCreate}
              >
                <Plus className="size-4" />
                New Rule
              </Button>
            </CardContent>
          </Card>
        )}
      </div>

      {/* Editor modal */}
      {editorOpen && (
        <RuleEditorDialog
          rule={editing}
          onClose={() => {
            setEditorOpen(false);
            setEditing(null);
          }}
          onSubmit={handleSubmit}
        />
      )}
    </div>
  );
}

// ─── Rule Row ─────────────────────────────────────────────────────

function RuleRow({
  rule,
  busy,
  dragging,
  dragOver,
  onEdit,
  onToggleActive,
  onDragStart,
  onDragOver,
  onDrop,
  onDragEnd,
}: {
  rule: AdminBrandingRule;
  busy: boolean;
  dragging: boolean;
  dragOver: boolean;
  onEdit: () => void;
  onToggleActive: () => void;
  onDragStart: (e: React.DragEvent) => void;
  onDragOver: (e: React.DragEvent) => void;
  onDrop: (e: React.DragEvent) => void;
  onDragEnd: () => void;
}) {
  const sev = SEVERITY_META[rule.severity];
  const SevIcon = sev.icon;

  return (
    <div
      draggable
      onDragStart={onDragStart}
      onDragOver={onDragOver}
      onDrop={onDrop}
      onDragEnd={onDragEnd}
      className={`group flex items-start gap-3 rounded-lg border bg-white p-3 transition-all ${
        rule.is_active
          ? "border-[#1a1a3e]/10 shadow-[0_1px_2px_0_rgba(26,26,62,0.04)]"
          : "border-dashed border-gray-200 bg-gray-50/50 opacity-70"
      } ${dragging ? "opacity-40" : ""} ${
        dragOver ? "border-[#FF9933] border-2 bg-[#FF9933]/5" : ""
      }`}
    >
      {/* Drag handle */}
      <div className="mt-1 cursor-move text-gray-300 group-hover:text-gray-500">
        <GripVertical className="size-4" />
      </div>

      {/* Severity dot */}
      <div className={`mt-1.5 size-2.5 shrink-0 rounded-full ${sev.dot}`} />

      {/* Main */}
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2 mb-1">
          <code className="rounded bg-[#1a1a3e]/5 px-1.5 py-0.5 text-[11px] font-mono text-[#1a1a3e]/70">
            {rule.rule_key}
          </code>
          <Badge variant="secondary" className={`text-[10px] ${sev.badge}`}>
            <SevIcon className="size-3 mr-0.5" />
            {sev.label}
          </Badge>
          {rule.requires_evidence && (
            <Badge
              variant="secondary"
              className="text-[10px] bg-blue-50 text-blue-700 border border-blue-200"
            >
              <Camera className="size-3 mr-0.5" />
              Evidence
            </Badge>
          )}
          {rule.handbook_page && (
            <span className="text-[10px] text-[#1a1a3e]/40">
              Handbook p.{rule.handbook_page}
            </span>
          )}
          {!rule.is_active && (
            <Badge
              variant="secondary"
              className="text-[10px] bg-gray-100 text-gray-500"
            >
              Inactive
            </Badge>
          )}
        </div>
        <h3 className="text-sm font-semibold text-[#1a1a3e] leading-tight">
          {rule.title}
        </h3>
        <p className="mt-1 text-xs text-[#1a1a3e]/60 line-clamp-2">
          {rule.description}
        </p>
      </div>

      {/* Actions */}
      <div className="flex items-center gap-1 shrink-0">
        <Button
          size="sm"
          variant="outline"
          onClick={onEdit}
          disabled={busy}
          className="h-8 text-xs"
        >
          <Pencil className="size-3" />
          Edit
        </Button>
        <Button
          size="sm"
          variant="outline"
          onClick={onToggleActive}
          disabled={busy}
          className={`h-8 text-xs ${
            rule.is_active
              ? "text-red-600 hover:bg-red-50"
              : "text-[#138808] hover:bg-[#138808]/5"
          }`}
          title={
            rule.is_active
              ? "Deactivate (soft delete)"
              : "Reactivate this rule"
          }
        >
          {busy ? (
            <Loader2 className="size-3 animate-spin" />
          ) : rule.is_active ? (
            <Trash2 className="size-3" />
          ) : (
            <RotateCcw className="size-3" />
          )}
          {rule.is_active ? "Deactivate" : "Reactivate"}
        </Button>
      </div>
    </div>
  );
}

// ─── Editor Dialog ────────────────────────────────────────────────

function RuleEditorDialog({
  rule,
  onClose,
  onSubmit,
}: {
  rule: AdminBrandingRule | null;
  onClose: () => void;
  onSubmit: (input: BrandingRuleInput) => Promise<boolean>;
}) {
  const isEdit = !!rule;

  const [ruleKey, setRuleKey] = useState(rule?.rule_key ?? "");
  const [category, setCategory] = useState<AdminBrandingCategory>(
    rule?.category ?? "logo"
  );
  const [title, setTitle] = useState(rule?.title ?? "");
  const [description, setDescription] = useState(rule?.description ?? "");
  const [handbookPage, setHandbookPage] = useState<string>(
    rule?.handbook_page != null ? String(rule.handbook_page) : ""
  );
  const [severity, setSeverity] = useState<AdminBrandingSeverity>(
    rule?.severity ?? "warning"
  );
  const [requiresEvidence, setRequiresEvidence] = useState(
    rule?.requires_evidence ?? false
  );
  const [isActive, setIsActive] = useState(rule?.is_active ?? true);
  const [saving, setSaving] = useState(false);
  const [localError, setLocalError] = useState<string | null>(null);

  const keyInvalid =
    ruleKey.length > 0 && !RULE_KEY_RE.test(ruleKey);

  async function submit() {
    setLocalError(null);

    if (!ruleKey) {
      setLocalError("rule_key is required");
      return;
    }
    if (keyInvalid) {
      setLocalError(
        "rule_key must be lowercase_snake_case (e.g. no_sponsor_logos_on_backdrop)"
      );
      return;
    }
    if (title.trim().length < 3) {
      setLocalError("Title must be at least 3 characters");
      return;
    }
    if (description.trim().length < 10) {
      setLocalError("Description must be at least 10 characters");
      return;
    }

    setSaving(true);
    const ok = await onSubmit({
      rule_key: ruleKey,
      category,
      title: title.trim(),
      description: description.trim(),
      handbook_page: handbookPage ? Number(handbookPage) : null,
      requires_evidence: requiresEvidence,
      severity,
      is_active: isActive,
      sort_order: rule?.sort_order ?? 0,
    });
    setSaving(false);
    if (!ok) return; // parent sets error message
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="w-full max-w-2xl max-h-[90vh] overflow-y-auto rounded-xl bg-white shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between border-b px-6 py-4">
          <div>
            <h3 className="text-lg font-semibold text-[#1a1a3e]">
              {isEdit ? "Edit Branding Rule" : "New Branding Rule"}
            </h3>
            <p className="mt-0.5 text-xs text-[#1a1a3e]/50">
              {isEdit
                ? "Changes take effect on the next compliance-list load."
                : "Creates a new rule for every event's Chapter Branding Checklist."}
            </p>
          </div>
          <button
            onClick={onClose}
            className="rounded-md p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-600"
          >
            <X className="size-5" />
          </button>
        </div>

        {/* Body */}
        <div className="space-y-5 px-6 py-5">
          {/* rule_key */}
          <div>
            <Label className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-[#1a1a3e]/60">
              Rule Key
            </Label>
            <Input
              value={ruleKey}
              onChange={(e) => setRuleKey(e.target.value.toLowerCase())}
              disabled={isEdit}
              placeholder="e.g. yi_logo_present"
              className={`font-mono text-sm ${
                isEdit ? "bg-gray-50 cursor-not-allowed" : ""
              } ${keyInvalid ? "border-red-300" : ""}`}
            />
            <p className="mt-1 text-[11px] text-[#1a1a3e]/50">
              {isEdit
                ? "rule_key is read-only after creation — existing compliance rows reference it."
                : "lowercase_snake_case. Starts with a letter. Used by branding_compliance_checks.rule_key."}
            </p>
          </div>

          {/* Title */}
          <div>
            <Label className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-[#1a1a3e]/60">
              Title
            </Label>
            <Input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Short, action-oriented rule title"
            />
          </div>

          {/* Description */}
          <div>
            <Label className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-[#1a1a3e]/60">
              Description
            </Label>
            <Textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={4}
              placeholder="What chapters need to do, in plain language."
            />
          </div>

          {/* Category */}
          <div>
            <Label className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-[#1a1a3e]/60">
              Category
            </Label>
            <select
              value={category}
              onChange={(e) =>
                setCategory(e.target.value as AdminBrandingCategory)
              }
              className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-[#FF9933] focus:outline-none focus:ring-1 focus:ring-[#FF9933]"
            >
              {CATEGORY_ORDER.map((c) => (
                <option key={c} value={c}>
                  {CATEGORY_META[c].label}
                </option>
              ))}
            </select>
          </div>

          {/* Severity radio */}
          <div>
            <Label className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-[#1a1a3e]/60">
              Severity
            </Label>
            <div className="grid grid-cols-3 gap-2">
              {(Object.keys(SEVERITY_META) as AdminBrandingSeverity[]).map(
                (s) => {
                  const meta = SEVERITY_META[s];
                  const Icon = meta.icon;
                  const active = severity === s;
                  return (
                    <button
                      key={s}
                      type="button"
                      onClick={() => setSeverity(s)}
                      className={`flex items-center gap-2 rounded-md border px-3 py-2 text-sm transition-colors ${
                        active
                          ? "border-[#FF9933] bg-[#FF9933]/5 text-[#1a1a3e]"
                          : "border-gray-200 text-[#1a1a3e]/60 hover:border-gray-300"
                      }`}
                    >
                      <Icon className="size-4" />
                      <span className="font-medium">{meta.label}</span>
                    </button>
                  );
                }
              )}
            </div>
          </div>

          {/* Handbook page + requires_evidence */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-[#1a1a3e]/60">
                Handbook Page (optional)
              </Label>
              <Input
                type="number"
                min={1}
                value={handbookPage}
                onChange={(e) => setHandbookPage(e.target.value)}
                placeholder="e.g. 13"
              />
            </div>
            <div>
              <Label className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-[#1a1a3e]/60">
                Evidence
              </Label>
              <label className="flex items-center gap-2 rounded-md border border-gray-200 px-3 py-2 text-sm cursor-pointer hover:border-gray-300">
                <input
                  type="checkbox"
                  checked={requiresEvidence}
                  onChange={(e) => setRequiresEvidence(e.target.checked)}
                  className="rounded border-gray-300 text-[#FF9933] focus:ring-[#FF9933]"
                />
                Requires photo/doc URL
              </label>
            </div>
          </div>

          {/* is_active */}
          <div>
            <label className="flex items-center gap-2 text-sm text-[#1a1a3e]/80 cursor-pointer">
              <input
                type="checkbox"
                checked={isActive}
                onChange={(e) => setIsActive(e.target.checked)}
                className="rounded border-gray-300 text-[#138808] focus:ring-[#138808]"
              />
              Active (appears on every event's Branding Checklist)
            </label>
            {!isActive && (
              <p className="mt-1 text-[11px] text-amber-600">
                Inactive rules are hidden from the checklist. Existing
                compliance rows remain in the database for history.
              </p>
            )}
          </div>

          {/* Local error */}
          {localError && (
            <div className="flex items-center gap-2 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">
              <AlertCircle className="size-4 shrink-0" />
              {localError}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-2 border-t px-6 py-4">
          <Button variant="outline" size="sm" onClick={onClose} disabled={saving}>
            Cancel
          </Button>
          <Button
            size="sm"
            onClick={submit}
            disabled={saving}
            className="bg-[#FF9933] text-white hover:bg-[#E68A2E]"
          >
            {saving && <Loader2 className="size-4 animate-spin" />}
            {isEdit ? "Save Changes" : "Create Rule"}
          </Button>
        </div>
      </div>
    </div>
  );
}
