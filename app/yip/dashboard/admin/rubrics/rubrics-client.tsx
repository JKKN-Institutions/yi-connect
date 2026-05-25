"use client";

import { Fragment, useMemo, useState, useTransition } from "react";
import { Badge } from "@/components/yip/ui/badge";
import { Button } from "@/components/yip/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/yip/ui/card";
import { Input } from "@/components/yip/ui/input";
import { Textarea } from "@/components/yip/ui/textarea";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/yip/ui/table";
import {
  Ruler,
  Plus,
  Star,
  Copy,
  Pencil,
  EyeOff,
  Eye,
  Trash2,
  Loader2,
  Save,
  X,
  AlertTriangle,
} from "lucide-react";
import {
  PARLIAMENT_ROLES,
  ROLE_LABELS,
  ROLE_COLORS,
  type ParliamentRole,
} from "@/lib/yip/constants";
import {
  createRubric,
  updateRubric,
  cloneRubric,
  deactivateRubric,
  reactivateRubric,
  setAsDefault,
  type Rubric,
  type RubricCriterion,
  type SubCriterion,
} from "@/app/yip/actions/admin-rubrics";

type FilterMode = "active" | "inactive" | "all";

type DraftSubCriterion = {
  childKey: string; // just the suffix after "parent." — merged at save time
  label: string;
  max_score: string;
};

type DraftCriterion = {
  key: string;
  label: string;
  max_score: string; // string so input stays controlled while typing
  description: string;
  sub_criteria: DraftSubCriterion[];
};

type DraftState = {
  id: string | null; // null => creating
  name: string;
  target_role: ParliamentRole;
  is_default: boolean;
  criteria: DraftCriterion[];
};

const KEY_PATTERN = /^[a-z][a-z0-9_]*$/;

function subCriterionToDraft(sc: SubCriterion, parentKey: string): DraftSubCriterion {
  // The DB stores dotted keys; the editor splits them so admins type only the
  // short child key and the parent is merged in at save time.
  const prefix = `${parentKey}.`;
  const childKey = sc.key.startsWith(prefix) ? sc.key.slice(prefix.length) : sc.key;
  return {
    childKey,
    label: sc.label,
    max_score: String(sc.max_score),
  };
}

function criterionToDraft(c: RubricCriterion): DraftCriterion {
  return {
    key: c.key,
    label: c.label,
    max_score: String(c.max_score),
    description: c.description ?? "",
    sub_criteria: Array.isArray(c.sub_criteria)
      ? c.sub_criteria.map((sc) => subCriterionToDraft(sc, c.key))
      : [],
  };
}

function emptyDraft(): DraftState {
  return {
    id: null,
    name: "",
    target_role: "mp",
    is_default: false,
    criteria: [
      { key: "", label: "", max_score: "10", description: "", sub_criteria: [] },
    ],
  };
}

function draftFromRubric(r: Rubric): DraftState {
  return {
    id: r.id,
    name: r.name,
    target_role: r.target_role,
    is_default: r.is_default,
    criteria: r.criteria.map(criterionToDraft),
  };
}

/** Effective parent max for a row — derived from sub_criteria when present. */
function rowEffectiveMax(row: DraftCriterion): number {
  if (row.sub_criteria.length > 0) {
    return row.sub_criteria.reduce((sum, sc) => {
      const n = Number(sc.max_score);
      return Number.isFinite(n) && n > 0 ? sum + Math.round(n) : sum;
    }, 0);
  }
  const n = Number(row.max_score);
  return Number.isFinite(n) && n > 0 ? Math.round(n) : 0;
}

function draftTotal(draft: DraftState): number {
  return draft.criteria.reduce((sum, row) => sum + rowEffectiveMax(row), 0);
}

function validateDraft(draft: DraftState): string | null {
  if (draft.name.trim().length < 3) return "Name must be at least 3 characters";
  if (draft.criteria.length === 0) return "At least one criterion is required";

  const keys = new Set<string>();
  const allChildKeys = new Set<string>();
  for (let i = 0; i < draft.criteria.length; i++) {
    const row = draft.criteria[i];
    const key = row.key.trim();
    const label = row.label.trim();

    if (!key) return `Row ${i + 1}: key is required`;
    if (!KEY_PATTERN.test(key)) {
      return `Row ${i + 1}: key "${key}" must be lowercase_snake_case`;
    }
    if (keys.has(key)) return `Duplicate key: "${key}"`;
    keys.add(key);

    if (!label) return `Row ${i + 1}: label is required`;

    if (row.sub_criteria.length > 0) {
      const parentChildKeys = new Set<string>();
      for (let j = 0; j < row.sub_criteria.length; j++) {
        const sc = row.sub_criteria[j];
        const childKey = sc.childKey.trim();
        const scLabel = sc.label.trim();
        const scMax = Number(sc.max_score);

        if (!childKey) return `Row ${i + 1} · sub-row ${j + 1}: key is required`;
        if (!KEY_PATTERN.test(childKey)) {
          return `Row ${i + 1} · sub-row ${j + 1}: key "${childKey}" must be lowercase_snake_case`;
        }
        const dotted = `${key}.${childKey}`;
        if (parentChildKeys.has(dotted)) {
          return `Duplicate sub-criterion key within "${key}": "${childKey}"`;
        }
        parentChildKeys.add(dotted);
        if (allChildKeys.has(dotted)) {
          return `Duplicate sub-criterion key across rubric: "${dotted}"`;
        }
        allChildKeys.add(dotted);

        if (!scLabel) return `Row ${i + 1} · sub-row ${j + 1}: label is required`;
        if (!Number.isFinite(scMax) || scMax < 1) {
          return `Row ${i + 1} · sub-row ${j + 1}: max_score must be >= 1`;
        }
      }
      // Parent max is derived — no need to validate row.max_score when nested.
    } else {
      const n = Number(row.max_score);
      if (!Number.isFinite(n) || n < 1) {
        return `Row ${i + 1}: max_score must be >= 1`;
      }
    }
  }
  return null;
}

function draftToInput(draft: DraftState) {
  return {
    name: draft.name.trim(),
    target_role: draft.target_role,
    is_default: draft.is_default,
    is_active: true,
    criteria: draft.criteria.map((row) => {
      const key = row.key.trim();
      const hasSubs = row.sub_criteria.length > 0;
      const derivedMax = rowEffectiveMax(row);
      return {
        key,
        label: row.label.trim(),
        max_score: hasSubs ? derivedMax : Math.round(Number(row.max_score)),
        description: row.description.trim() || null,
        sub_criteria: hasSubs
          ? row.sub_criteria.map((sc) => ({
              key: `${key}.${sc.childKey.trim()}`,
              label: sc.label.trim(),
              max_score: Math.round(Number(sc.max_score)),
            }))
          : null,
      };
    }),
  };
}

export function RubricsClient({
  initialRubrics,
}: {
  initialRubrics: Rubric[];
}) {
  const [rubrics, setRubrics] = useState<Rubric[]>(initialRubrics);
  const [filter, setFilter] = useState<FilterMode>("active");
  const [draft, setDraft] = useState<DraftState | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [flash, setFlash] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const visible = useMemo(() => {
    if (filter === "all") return rubrics;
    if (filter === "active") return rubrics.filter((r) => r.is_active);
    return rubrics.filter((r) => !r.is_active);
  }, [rubrics, filter]);

  const grouped = useMemo(() => {
    const map = new Map<ParliamentRole, Rubric[]>();
    for (const role of PARLIAMENT_ROLES) map.set(role, []);
    for (const r of visible) {
      const arr = map.get(r.target_role) ?? [];
      arr.push(r);
      map.set(r.target_role, arr);
    }
    return map;
  }, [visible]);

  const defaultSummary = useMemo(() => {
    return PARLIAMENT_ROLES.map((role) => {
      const def = rubrics.find(
        (r) => r.target_role === role && r.is_default && r.is_active
      );
      return { role, def };
    });
  }, [rubrics]);

  function showFlash(msg: string) {
    setFlash(msg);
    setTimeout(() => setFlash(null), 2500);
  }

  function openCreate() {
    setDraft(emptyDraft());
    setError(null);
  }

  function openEdit(r: Rubric) {
    setDraft(draftFromRubric(r));
    setError(null);
  }

  function closeEditor() {
    setDraft(null);
    setError(null);
  }

  function addCriterion() {
    if (!draft) return;
    setDraft({
      ...draft,
      criteria: [
        ...draft.criteria,
        { key: "", label: "", max_score: "10", description: "", sub_criteria: [] },
      ],
    });
  }

  function removeCriterion(index: number) {
    if (!draft) return;
    if (draft.criteria.length <= 1) {
      setError("At least one criterion is required");
      return;
    }
    setDraft({
      ...draft,
      criteria: draft.criteria.filter((_, i) => i !== index),
    });
  }

  function updateCriterion(index: number, patch: Partial<DraftCriterion>) {
    if (!draft) return;
    setDraft({
      ...draft,
      criteria: draft.criteria.map((row, i) =>
        i === index ? { ...row, ...patch } : row
      ),
    });
  }

  function addSubCriterion(parentIndex: number) {
    if (!draft) return;
    setDraft({
      ...draft,
      criteria: draft.criteria.map((row, i) =>
        i === parentIndex
          ? {
              ...row,
              sub_criteria: [
                ...row.sub_criteria,
                { childKey: "", label: "", max_score: "5" },
              ],
            }
          : row
      ),
    });
  }

  function removeSubCriterion(parentIndex: number, subIndex: number) {
    if (!draft) return;
    setDraft({
      ...draft,
      criteria: draft.criteria.map((row, i) =>
        i === parentIndex
          ? {
              ...row,
              sub_criteria: row.sub_criteria.filter((_, j) => j !== subIndex),
            }
          : row
      ),
    });
  }

  function updateSubCriterion(
    parentIndex: number,
    subIndex: number,
    patch: Partial<DraftSubCriterion>
  ) {
    if (!draft) return;
    setDraft({
      ...draft,
      criteria: draft.criteria.map((row, i) =>
        i === parentIndex
          ? {
              ...row,
              sub_criteria: row.sub_criteria.map((sc, j) =>
                j === subIndex ? { ...sc, ...patch } : sc
              ),
            }
          : row
      ),
    });
  }

  function submitDraft() {
    if (!draft) return;
    const err = validateDraft(draft);
    if (err) {
      setError(err);
      return;
    }
    setError(null);
    const payload = draftToInput(draft);

    startTransition(async () => {
      const res = draft.id
        ? await updateRubric(draft.id, payload)
        : await createRubric(payload);

      if (!res.success) {
        setError(res.error);
        return;
      }

      const saved = res.data;

      setRubrics((prev) => {
        // If this rubric is now default, strip default from the other rubrics in the same role.
        const next = saved.is_default
          ? prev.map((r) =>
              r.target_role === saved.target_role && r.id !== saved.id
                ? { ...r, is_default: false }
                : r
            )
          : [...prev];

        const idx = next.findIndex((r) => r.id === saved.id);
        if (idx >= 0) next[idx] = saved;
        else next.push(saved);
        return next;
      });

      showFlash(draft.id ? "Rubric updated" : "Rubric created");
      setDraft(null);
    });
  }

  function handleClone(r: Rubric) {
    const suggested = `${r.name} (copy)`;
    const newName = typeof window !== "undefined"
      ? window.prompt("Name for the cloned rubric?", suggested)
      : suggested;
    if (!newName) return;

    startTransition(async () => {
      const res = await cloneRubric(r.id, { newName: newName.trim() });
      if (!res.success) {
        setError(res.error);
        return;
      }
      setRubrics((prev) => [...prev, res.data]);
      showFlash(`Cloned as "${res.data.name}"`);
    });
  }

  function handleSetDefault(r: Rubric) {
    // Optimistic swap.
    const prev = rubrics;
    setRubrics(
      rubrics.map((x) =>
        x.target_role === r.target_role
          ? { ...x, is_default: x.id === r.id, is_active: x.id === r.id ? true : x.is_active }
          : x
      )
    );

    startTransition(async () => {
      const res = await setAsDefault(r.id);
      if (!res.success) {
        setRubrics(prev);
        setError(res.error);
        return;
      }
      showFlash(`"${r.name}" is now the default for ${ROLE_LABELS[r.target_role]}`);
    });
  }

  function handleDeactivate(r: Rubric) {
    if (
      typeof window !== "undefined" &&
      !window.confirm(
        `Deactivate "${r.name}"? Existing scores keep working; jurors just won't see it for new scoring.`
      )
    ) {
      return;
    }

    const prev = rubrics;
    setRubrics(
      rubrics.map((x) =>
        x.id === r.id ? { ...x, is_active: false, is_default: false } : x
      )
    );

    startTransition(async () => {
      const res = await deactivateRubric(r.id);
      if (!res.success) {
        setRubrics(prev);
        setError(res.error);
        return;
      }
      showFlash("Rubric deactivated");
    });
  }

  function handleReactivate(r: Rubric) {
    const prev = rubrics;
    setRubrics(
      rubrics.map((x) => (x.id === r.id ? { ...x, is_active: true } : x))
    );

    startTransition(async () => {
      const res = await reactivateRubric(r.id);
      if (!res.success) {
        setRubrics(prev);
        setError(res.error);
        return;
      }
      showFlash("Rubric reactivated");
    });
  }

  const draftTotalValue = draft ? draftTotal(draft) : 0;
  const draftError = draft ? validateDraft(draft) : null;
  const existingDefaultForDraftRole = draft
    ? rubrics.find(
        (r) =>
          r.target_role === draft.target_role &&
          r.is_default &&
          r.is_active &&
          r.id !== draft.id
      )
    : null;

  return (
    <div className="max-w-[1400px] mx-auto px-6 py-8 space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between gap-6">
        <div>
          <h1 className="text-3xl font-bold text-[#1a1a3e] tracking-tight flex items-center gap-2">
            <Ruler className="size-7 text-[#FF9933]" />
            Scoring Rubrics
          </h1>
          <p className="text-sm text-[#1a1a3e]/60 mt-1">
            Evaluation criteria jurors use during Parliament · Handbook p.20
          </p>
        </div>
        <Button
          onClick={openCreate}
          className="bg-[#FF9933] hover:bg-[#FF9933]/90 text-white"
          disabled={draft !== null}
        >
          <Plus className="size-4 mr-2" /> New Rubric
        </Button>
      </div>

      {/* Flash */}
      {flash && (
        <div className="rounded-lg bg-[#138808]/8 border border-[#138808]/15 px-4 py-2 text-sm text-[#138808]">
          {flash}
        </div>
      )}

      {/* Error banner (outside editor) */}
      {error && !draft && (
        <div className="rounded-lg bg-red-50 border border-red-200 px-4 py-2 text-sm text-red-700 flex items-center gap-2">
          <AlertTriangle className="size-4" /> {error}
          <button
            className="ml-auto text-red-700/70 hover:text-red-700"
            onClick={() => setError(null)}
            aria-label="Dismiss"
          >
            <X className="size-4" />
          </button>
        </div>
      )}

      {/* Per-role default summary */}
      <Card className="border-[#1a1a3e]/10">
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-semibold text-[#1a1a3e]/80">
            Defaults by Role
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-2">
            {defaultSummary.map(({ role, def }) => (
              <div
                key={role}
                className="rounded-md border border-[#1a1a3e]/10 bg-white px-3 py-2 text-xs flex items-center justify-between gap-2"
              >
                <span
                  className={`px-2 py-0.5 rounded-full text-[10px] font-semibold ${ROLE_COLORS[role] ?? "bg-gray-500 text-white"}`}
                >
                  {ROLE_LABELS[role]}
                </span>
                <span className="text-[#1a1a3e]/70 text-right">
                  {def ? (
                    <>
                      <span className="font-medium text-[#1a1a3e]">/{def.total_max}</span>
                    </>
                  ) : (
                    <span className="text-red-600">No default</span>
                  )}
                </span>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Filter */}
      <div className="flex gap-2 flex-wrap items-center">
        <span className="text-xs text-[#1a1a3e]/60 mr-1">Show:</span>
        {(
          [
            { key: "active", label: "Active" },
            { key: "inactive", label: "Inactive" },
            { key: "all", label: "All" },
          ] as { key: FilterMode; label: string }[]
        ).map((opt) => (
          <button
            key={opt.key}
            onClick={() => setFilter(opt.key)}
            className={`text-xs px-3 py-1.5 rounded-full border transition-all ${
              filter === opt.key
                ? "bg-[#1a1a3e] text-white border-[#1a1a3e]"
                : "bg-white text-[#1a1a3e]/70 border-[#1a1a3e]/10 hover:border-[#1a1a3e]/30"
            }`}
          >
            {opt.label}
          </button>
        ))}
        <span className="ml-auto text-xs text-[#1a1a3e]/50">
          {visible.length} of {rubrics.length} rubric{rubrics.length === 1 ? "" : "s"}
        </span>
      </div>

      {/* Editor panel */}
      {draft && (
        <Card className="border-[#FF9933]/40 shadow-sm">
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              {draft.id ? (
                <>
                  <Pencil className="size-5 text-[#FF9933]" /> Edit Rubric
                </>
              ) : (
                <>
                  <Plus className="size-5 text-[#FF9933]" /> New Rubric
                </>
              )}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-5">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="text-xs font-medium text-[#1a1a3e]/70">Name *</label>
                <Input
                  value={draft.name}
                  onChange={(e) => setDraft({ ...draft, name: e.target.value })}
                  placeholder="e.g. Speaker Evaluation"
                />
              </div>
              <div>
                <label className="text-xs font-medium text-[#1a1a3e]/70">Target Role *</label>
                <select
                  value={draft.target_role}
                  onChange={(e) =>
                    setDraft({
                      ...draft,
                      target_role: e.target.value as ParliamentRole,
                    })
                  }
                  className="w-full border border-input rounded-md px-3 py-2 text-sm h-9"
                >
                  {PARLIAMENT_ROLES.map((role) => (
                    <option key={role} value={role}>
                      {ROLE_LABELS[role]}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {/* Criteria editor */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <label className="text-xs font-medium text-[#1a1a3e]/70">
                  Criteria * (at least one)
                </label>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={addCriterion}
                  type="button"
                >
                  <Plus className="size-3.5 mr-1" /> Add row
                </Button>
              </div>

              <div className="rounded-md border border-[#1a1a3e]/10 overflow-hidden">
                <Table>
                  <TableHeader>
                    <TableRow className="bg-[#1a1a3e]/[0.03]">
                      <TableHead className="w-[20%]">key</TableHead>
                      <TableHead className="w-[25%]">label</TableHead>
                      <TableHead className="w-[10%]">max</TableHead>
                      <TableHead>description</TableHead>
                      <TableHead className="w-[40px]"></TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {draft.criteria.map((row, i) => {
                      const keyInvalid =
                        row.key.trim().length > 0 && !KEY_PATTERN.test(row.key.trim());
                      const dupKey =
                        row.key.trim().length > 0 &&
                        draft.criteria.filter(
                          (c, j) => j !== i && c.key.trim() === row.key.trim()
                        ).length > 0;
                      const maxNum = Number(row.max_score);
                      const hasSubs = row.sub_criteria.length > 0;
                      const derivedMax = rowEffectiveMax(row);
                      const maxInvalid =
                        !hasSubs &&
                        row.max_score !== "" &&
                        (!Number.isFinite(maxNum) || maxNum < 1);
                      return (
                        <Fragment key={i}>
                          <TableRow>
                            <TableCell className="align-top">
                              <Input
                                value={row.key}
                                onChange={(e) =>
                                  updateCriterion(i, { key: e.target.value })
                                }
                                placeholder="impartiality"
                                className={`font-mono text-xs ${keyInvalid || dupKey ? "border-red-500" : ""}`}
                              />
                              {keyInvalid && (
                                <p className="text-[10px] text-red-600 mt-1">
                                  lowercase_snake_case only
                                </p>
                              )}
                              {dupKey && (
                                <p className="text-[10px] text-red-600 mt-1">
                                  duplicate key
                                </p>
                              )}
                            </TableCell>
                            <TableCell className="align-top">
                              <Input
                                value={row.label}
                                onChange={(e) =>
                                  updateCriterion(i, { label: e.target.value })
                                }
                                placeholder="Impartiality"
                              />
                            </TableCell>
                            <TableCell className="align-top">
                              {hasSubs ? (
                                <div
                                  className="w-20 h-9 px-3 flex items-center rounded-md border border-[#1a1a3e]/10 bg-[#1a1a3e]/[0.04] text-sm font-semibold text-[#FF9933]"
                                  title="Derived from sub-criteria sum"
                                >
                                  {derivedMax}
                                </div>
                              ) : (
                                <Input
                                  type="number"
                                  min={1}
                                  value={row.max_score}
                                  onChange={(e) =>
                                    updateCriterion(i, { max_score: e.target.value })
                                  }
                                  className={`w-20 ${maxInvalid ? "border-red-500" : ""}`}
                                />
                              )}
                            </TableCell>
                            <TableCell className="align-top">
                              <Textarea
                                value={row.description}
                                onChange={(e) =>
                                  updateCriterion(i, { description: e.target.value })
                                }
                                rows={2}
                                placeholder="What jurors should look for"
                                className="text-xs"
                              />
                            </TableCell>
                            <TableCell className="align-top text-right">
                              <Button
                                variant="ghost"
                                size="icon-sm"
                                onClick={() => removeCriterion(i)}
                                type="button"
                                className="text-red-600 hover:text-red-700 hover:bg-red-50"
                                aria-label="Remove row"
                                disabled={draft.criteria.length <= 1}
                              >
                                <Trash2 className="size-4" />
                              </Button>
                            </TableCell>
                          </TableRow>
                          <TableRow className="bg-[#1a1a3e]/[0.015]">
                            <TableCell colSpan={5} className="py-2.5">
                              <SubCriteriaEditor
                                parentKey={row.key.trim()}
                                subs={row.sub_criteria}
                                derivedMax={derivedMax}
                                onAdd={() => addSubCriterion(i)}
                                onRemove={(subIdx) => removeSubCriterion(i, subIdx)}
                                onUpdate={(subIdx, patch) =>
                                  updateSubCriterion(i, subIdx, patch)
                                }
                              />
                            </TableCell>
                          </TableRow>
                        </Fragment>
                      );
                    })}
                  </TableBody>
                </Table>
              </div>

              <div className="flex items-center justify-between mt-3">
                <p className="text-[11px] text-[#1a1a3e]/60 italic">
                  Total is auto-calculated from the max_score column and cannot be edited directly.
                </p>
                <div className="text-sm font-semibold text-[#1a1a3e]">
                  Total: <span className="text-[#FF9933]">/{draftTotalValue}</span>
                </div>
              </div>
            </div>

            {/* Default flag */}
            <div className="flex items-start gap-3 rounded-md border border-[#1a1a3e]/10 bg-[#FFF9EF] px-3 py-2.5">
              <input
                id="is_default"
                type="checkbox"
                checked={draft.is_default}
                onChange={(e) =>
                  setDraft({ ...draft, is_default: e.target.checked })
                }
                className="mt-0.5 size-4 accent-[#FF9933]"
              />
              <div className="flex-1">
                <label htmlFor="is_default" className="text-sm font-medium text-[#1a1a3e]">
                  Use as default for {ROLE_LABELS[draft.target_role]}
                </label>
                {draft.is_default && existingDefaultForDraftRole && (
                  <p className="text-[11px] text-[#c65400] mt-1 flex items-center gap-1">
                    <AlertTriangle className="size-3" />
                    This will replace the current default &quot;
                    {existingDefaultForDraftRole.name}&quot; for{" "}
                    {ROLE_LABELS[draft.target_role]}.
                  </p>
                )}
              </div>
            </div>

            {/* Validation / server error */}
            {(draftError || error) && (
              <div className="rounded-lg bg-red-50 border border-red-200 px-3 py-2 text-sm text-red-700 flex items-center gap-2">
                <AlertTriangle className="size-4" /> {error ?? draftError}
              </div>
            )}

            <div className="flex gap-2 justify-end pt-2">
              <Button variant="outline" onClick={closeEditor} disabled={pending}>
                Cancel
              </Button>
              <Button
                onClick={submitDraft}
                disabled={pending || !!draftError}
                className="bg-[#FF9933] hover:bg-[#FF9933]/90 text-white"
              >
                {pending ? (
                  <Loader2 className="size-4 mr-2 animate-spin" />
                ) : (
                  <Save className="size-4 mr-2" />
                )}
                {draft.id ? "Save changes" : "Create rubric"}
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Rubric list */}
      {visible.length === 0 ? (
        <Card className="border-dashed border-[#1a1a3e]/15">
          <CardContent className="py-12 text-center text-sm text-[#1a1a3e]/60">
            No rubrics match the current filter.
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-6">
          {PARLIAMENT_ROLES.map((role) => {
            const list = grouped.get(role) ?? [];
            if (list.length === 0) return null;
            return (
              <section key={role} className="space-y-3">
                <div className="flex items-center gap-2">
                  <span
                    className={`px-2.5 py-1 rounded-full text-xs font-semibold ${ROLE_COLORS[role] ?? "bg-gray-500 text-white"}`}
                  >
                    {ROLE_LABELS[role]}
                  </span>
                  <span className="text-xs text-[#1a1a3e]/50">
                    {list.length} rubric{list.length === 1 ? "" : "s"}
                  </span>
                </div>

                <div className="grid grid-cols-1 gap-4">
                  {list.map((r) => (
                    <RubricCard
                      key={r.id}
                      rubric={r}
                      pending={pending}
                      onEdit={() => openEdit(r)}
                      onClone={() => handleClone(r)}
                      onSetDefault={() => handleSetDefault(r)}
                      onDeactivate={() => handleDeactivate(r)}
                      onReactivate={() => handleReactivate(r)}
                    />
                  ))}
                </div>
              </section>
            );
          })}
        </div>
      )}
    </div>
  );
}

function RubricCard({
  rubric,
  pending,
  onEdit,
  onClone,
  onSetDefault,
  onDeactivate,
  onReactivate,
}: {
  rubric: Rubric;
  pending: boolean;
  onEdit: () => void;
  onClone: () => void;
  onSetDefault: () => void;
  onDeactivate: () => void;
  onReactivate: () => void;
}) {
  const muted = !rubric.is_active;
  return (
    <Card
      className={`border-[#1a1a3e]/10 ${muted ? "opacity-70 bg-[#1a1a3e]/[0.02]" : "bg-white"}`}
    >
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div className="min-w-0">
            <CardTitle className="text-lg text-[#1a1a3e] flex items-center gap-2 flex-wrap">
              <span className="truncate">{rubric.name}</span>
              {rubric.is_default && (
                <Badge className="bg-[#FF9933]/15 text-[#b0561a] border-[#FF9933]/30 border">
                  <Star className="size-3 mr-1 fill-[#FF9933] text-[#FF9933]" />
                  Default
                </Badge>
              )}
              {!rubric.is_active && (
                <Badge className="bg-[#1a1a3e]/10 text-[#1a1a3e]/70 border-[#1a1a3e]/15 border">
                  Inactive
                </Badge>
              )}
            </CardTitle>
            <p className="text-xs text-[#1a1a3e]/60 mt-1">
              Total <span className="font-semibold text-[#1a1a3e]">/{rubric.total_max}</span>
              {" · "}
              {rubric.criteria.length} criteri{rubric.criteria.length === 1 ? "on" : "a"}
              {(() => {
                const subCount = rubric.criteria.reduce(
                  (n, c) => n + (Array.isArray(c.sub_criteria) ? c.sub_criteria.length : 0),
                  0
                );
                return subCount > 0 ? (
                  <>
                    {" · "}
                    <span className="font-semibold text-[#FF9933]">
                      {subCount} sub-criteria
                    </span>
                  </>
                ) : null;
              })()}
            </p>
            {rubric.target_role === "mp" &&
              rubric.is_default &&
              rubric.criteria.some(
                (c) => Array.isArray(c.sub_criteria) && c.sub_criteria.length > 0
              ) && (
                <p className="text-[11px] text-[#138808] font-semibold mt-1">
                  Handbook p.20 — 17 sub-criteria
                </p>
              )}
          </div>

          <div className="flex flex-wrap gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={onEdit}
              disabled={pending}
            >
              <Pencil className="size-3.5 mr-1" /> Edit
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={onClone}
              disabled={pending}
            >
              <Copy className="size-3.5 mr-1" /> Clone
            </Button>
            {!rubric.is_default && rubric.is_active && (
              <Button
                variant="outline"
                size="sm"
                onClick={onSetDefault}
                disabled={pending}
                className="border-[#FF9933]/30 text-[#b0561a] hover:bg-[#FF9933]/10"
              >
                <Star className="size-3.5 mr-1" /> Set as default
              </Button>
            )}
            {rubric.is_active ? (
              <Button
                variant="outline"
                size="sm"
                onClick={onDeactivate}
                disabled={pending}
                className="border-red-200 text-red-700 hover:bg-red-50"
              >
                <EyeOff className="size-3.5 mr-1" /> Deactivate
              </Button>
            ) : (
              <Button
                variant="outline"
                size="sm"
                onClick={onReactivate}
                disabled={pending}
                className="border-[#138808]/30 text-[#138808] hover:bg-[#138808]/10"
              >
                <Eye className="size-3.5 mr-1" /> Reactivate
              </Button>
            )}
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <div className="rounded-md border border-[#1a1a3e]/10 overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow className="bg-[#1a1a3e]/[0.03]">
                <TableHead className="w-[18%]">key</TableHead>
                <TableHead className="w-[22%]">label</TableHead>
                <TableHead className="w-[8%]">max</TableHead>
                <TableHead>description</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rubric.criteria.map((c) => {
                const hasSubs = Array.isArray(c.sub_criteria) && c.sub_criteria.length > 0;
                return (
                  <Fragment key={c.key}>
                    <TableRow>
                      <TableCell className="font-mono text-xs text-[#1a1a3e]/80">
                        {c.key}
                      </TableCell>
                      <TableCell className="text-sm font-medium text-[#1a1a3e]">
                        {c.label}
                      </TableCell>
                      <TableCell className="text-sm font-semibold text-[#FF9933]">
                        {c.max_score}
                      </TableCell>
                      <TableCell className="text-xs text-[#1a1a3e]/70">
                        {c.description ?? ""}
                      </TableCell>
                    </TableRow>
                    {hasSubs && (
                      <TableRow className="bg-[#1a1a3e]/[0.02]">
                        <TableCell colSpan={4} className="py-2">
                          <div className="pl-4 space-y-1">
                            {c.sub_criteria!.map((sc) => (
                              <div
                                key={sc.key}
                                className="flex items-center gap-3 text-xs"
                              >
                                <span className="font-mono text-[#1a1a3e]/60 w-[24%] truncate">
                                  {sc.key}
                                </span>
                                <span className="flex-1 text-[#1a1a3e]/80 truncate">
                                  {sc.label}
                                </span>
                                <span className="font-semibold text-[#FF9933] shrink-0">
                                  /{sc.max_score}
                                </span>
                              </div>
                            ))}
                          </div>
                        </TableCell>
                      </TableRow>
                    )}
                  </Fragment>
                );
              })}
            </TableBody>
          </Table>
        </div>
      </CardContent>
    </Card>
  );
}

// ─── SubCriteriaEditor ────────────────────────────────────────────
// Inline editor nested inside a parent criterion row. Admin types only the
// short child key (e.g. "relevance") — the parent key is merged at save time.

function SubCriteriaEditor({
  parentKey,
  subs,
  derivedMax,
  onAdd,
  onRemove,
  onUpdate,
}: {
  parentKey: string;
  subs: DraftSubCriterion[];
  derivedMax: number;
  onAdd: () => void;
  onRemove: (index: number) => void;
  onUpdate: (index: number, patch: Partial<DraftSubCriterion>) => void;
}) {
  const hasAny = subs.length > 0;
  return (
    <div className="pl-4">
      <div className="flex items-center justify-between mb-2">
        <div className="text-[11px] font-semibold text-[#1a1a3e]/70 uppercase tracking-wide">
          Sub-criteria {hasAny ? `(${subs.length})` : "— optional"}
        </div>
        <div className="flex items-center gap-3">
          {hasAny && (
            <span className="text-[11px] text-[#1a1a3e]/60">
              Parent max derived: <span className="font-semibold text-[#FF9933]">{derivedMax}</span>
            </span>
          )}
          <Button
            variant="outline"
            size="sm"
            onClick={onAdd}
            type="button"
            className="h-7 text-[11px] px-2"
            disabled={!parentKey}
            title={!parentKey ? "Enter a parent key first" : ""}
          >
            <Plus className="size-3 mr-1" /> Add sub-criterion
          </Button>
        </div>
      </div>

      {hasAny && (
        <div className="space-y-1.5">
          {subs.map((sc, j) => {
            const childKeyInvalid =
              sc.childKey.trim().length > 0 && !KEY_PATTERN.test(sc.childKey.trim());
            const dupChild =
              sc.childKey.trim().length > 0 &&
              subs.filter(
                (s, k) => k !== j && s.childKey.trim() === sc.childKey.trim()
              ).length > 0;
            const scMax = Number(sc.max_score);
            const scMaxInvalid =
              sc.max_score !== "" && (!Number.isFinite(scMax) || scMax < 1);
            return (
              <div
                key={j}
                className="flex items-start gap-2 bg-white rounded border border-[#1a1a3e]/10 px-2 py-1.5"
              >
                <div className="flex items-center gap-1 shrink-0 w-[28%]">
                  <span className="font-mono text-[11px] text-[#1a1a3e]/50">
                    {parentKey || "…"}.
                  </span>
                  <Input
                    value={sc.childKey}
                    onChange={(e) => onUpdate(j, { childKey: e.target.value })}
                    placeholder="relevance"
                    className={`font-mono text-xs h-8 flex-1 ${childKeyInvalid || dupChild ? "border-red-500" : ""}`}
                  />
                </div>
                <Input
                  value={sc.label}
                  onChange={(e) => onUpdate(j, { label: e.target.value })}
                  placeholder="Relevance to topic"
                  className="text-xs h-8 flex-1"
                />
                <Input
                  type="number"
                  min={1}
                  value={sc.max_score}
                  onChange={(e) => onUpdate(j, { max_score: e.target.value })}
                  className={`w-16 text-xs h-8 ${scMaxInvalid ? "border-red-500" : ""}`}
                  placeholder="max"
                />
                <Button
                  variant="ghost"
                  size="icon-sm"
                  onClick={() => onRemove(j)}
                  type="button"
                  className="text-red-600 hover:text-red-700 hover:bg-red-50 h-8 w-8 shrink-0"
                  aria-label="Remove sub-criterion"
                >
                  <Trash2 className="size-3.5" />
                </Button>
              </div>
            );
          })}
          <p className="text-[10px] text-[#1a1a3e]/50 italic mt-1">
            Parent max becomes read-only and is auto-derived from the sum of sub-criteria above.
            Remove all sub-criteria to make the parent flat again.
          </p>
        </div>
      )}
    </div>
  );
}
