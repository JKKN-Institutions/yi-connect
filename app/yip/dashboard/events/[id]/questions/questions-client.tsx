"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/yip/ui/card";
import { Button } from "@/components/yip/ui/button";
import { Badge } from "@/components/yip/ui/badge";
import { Input } from "@/components/yip/ui/input";
import {
  Table,
  TableHeader,
  TableBody,
  TableHead,
  TableRow,
  TableCell,
} from "@/components/yip/ui/table";
import {
  MessageSquare,
  CheckCircle2,
  XCircle,
  Star,
  Filter,
  Check,
  X,
  Inbox,
  CalendarClock,
} from "lucide-react";
import { cn } from "@/lib/yip/utils";
import { MINISTRIES, PARTY_COLORS } from "@/lib/yip/constants";
import {
  approveQuestion,
  rejectQuestion,
  filterQuestion,
  setQueueOrder,
  bulkApprove,
  bulkReject,
  setQuestionsDeadline,
} from "@/app/yip/actions/questions";
import type { QuestionWithSubmitter } from "@/app/yip/actions/questions";
import { toast } from "sonner";

// ─── Types & Helpers ────────────────────────────────────────────

type FilterTab = "all" | "submitted" | "approved" | "starred" | "rejected";

function getMinistryLabel(key: string): string {
  const found = MINISTRIES.find((m) => m.key === key);
  return found ? found.label : key;
}

const STATUS_BADGES: Record<string, { label: string; className: string }> = {
  submitted: { label: "Submitted", className: "bg-blue-100 text-blue-700" },
  approved: { label: "Approved", className: "bg-green-100 text-green-700" },
  rejected: { label: "Rejected", className: "bg-red-100 text-red-700" },
  asked: { label: "Asked", className: "bg-amber-100 text-amber-700" },
  answered: { label: "Answered", className: "bg-emerald-100 text-emerald-700" },
  skipped: { label: "Skipped", className: "bg-gray-100 text-gray-500" },
};

// ─── Component ──────────────────────────────────────────────────

interface QuestionsClientProps {
  eventId: string;
  initialQuestions: QuestionWithSubmitter[];
  /** events.questions_close_at — student submissions close at this time. */
  initialCloseAt: string | null;
}

/** ISO (UTC) → value for <input type="datetime-local"> in the viewer's zone. */
function toLocalInputValue(iso: string | null): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export function QuestionsClient({
  eventId,
  initialQuestions,
  initialCloseAt,
}: QuestionsClientProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [closeAt, setCloseAt] = useState<string | null>(initialCloseAt);
  const [closeAtDraft, setCloseAtDraft] = useState<string>(
    toLocalInputValue(initialCloseAt)
  );
  const [savingDeadline, setSavingDeadline] = useState(false);

  async function saveDeadline(nextIso: string | null) {
    setSavingDeadline(true);
    const result = await setQuestionsDeadline(eventId, nextIso);
    setSavingDeadline(false);
    if (result.success) {
      setCloseAt(nextIso);
      setCloseAtDraft(toLocalInputValue(nextIso));
      toast.success(
        nextIso
          ? "Submission deadline saved"
          : "Deadline removed — submissions stay open"
      );
    } else {
      toast.error(result.error);
    }
  }
  const [questions, setQuestions] =
    useState<QuestionWithSubmitter[]>(initialQuestions);
  const [activeTab, setActiveTab] = useState<FilterTab>("all");
  const [selected, setSelected] = useState<Set<string>>(new Set());

  // ─── Stats ──────────────────────────────────────────────────

  const stats = {
    total: questions.length,
    approved: questions.filter((q) => q.status === "approved").length,
    starred: questions.filter((q) => q.question_type === "starred").length,
    queued: questions.filter(
      (q) => q.status === "approved" && q.queue_order != null
    ).length,
  };

  // ─── Filtered list ──────────────────────────────────────────

  const filtered = questions.filter((q) => {
    if (activeTab === "all") return true;
    if (activeTab === "starred") return q.question_type === "starred";
    return q.status === activeTab;
  });

  // ─── Action handlers ───────────────────────────────────────

  function handleApprove(questionId: string) {
    startTransition(async () => {
      const result = await approveQuestion(questionId);
      if (result.success) {
        setQuestions((prev) =>
          prev.map((q) =>
            q.id === questionId ? { ...q, status: "approved" } : q
          )
        );
        toast.success("Question approved");
      } else {
        toast.error(result.error);
      }
    });
  }

  function handleReject(questionId: string) {
    startTransition(async () => {
      const result = await rejectQuestion(questionId);
      if (result.success) {
        setQuestions((prev) =>
          prev.map((q) =>
            q.id === questionId ? { ...q, status: "rejected" } : q
          )
        );
        toast.success("Question rejected");
      } else {
        toast.error(result.error);
      }
    });
  }

  function handleToggleStar(
    questionId: string,
    currentType: string | null
  ) {
    const newType = currentType === "starred" ? "unstarred" : "starred";
    startTransition(async () => {
      const result = await filterQuestion(questionId, newType);
      if (result.success) {
        setQuestions((prev) =>
          prev.map((q) =>
            q.id === questionId ? { ...q, question_type: newType } : q
          )
        );
        toast.success(
          newType === "starred" ? "Question starred" : "Star removed"
        );
      } else {
        toast.error(result.error);
      }
    });
  }

  function handleQueueOrder(questionId: string, value: string) {
    const order = parseInt(value, 10);
    if (isNaN(order) || order < 0) return;

    // Optimistic update
    setQuestions((prev) =>
      prev.map((q) =>
        q.id === questionId ? { ...q, queue_order: order || null } : q
      )
    );

    startTransition(async () => {
      const result = await setQueueOrder(questionId, order);
      if (!result.success) {
        toast.error(result.error);
        // Revert on failure
        router.refresh();
      }
    });
  }

  function handleBulkApprove() {
    const ids = Array.from(selected);
    if (ids.length === 0) return;
    startTransition(async () => {
      const result = await bulkApprove(ids);
      if (result.success) {
        setQuestions((prev) =>
          prev.map((q) =>
            ids.includes(q.id) ? { ...q, status: "approved" } : q
          )
        );
        setSelected(new Set());
        toast.success(`${ids.length} questions approved`);
      } else {
        toast.error(result.error);
      }
    });
  }

  function handleBulkReject() {
    const ids = Array.from(selected);
    if (ids.length === 0) return;
    startTransition(async () => {
      const result = await bulkReject(ids);
      if (result.success) {
        setQuestions((prev) =>
          prev.map((q) =>
            ids.includes(q.id) ? { ...q, status: "rejected" } : q
          )
        );
        setSelected(new Set());
        toast.success(`${ids.length} questions rejected`);
      } else {
        toast.error(result.error);
      }
    });
  }

  function toggleSelect(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function toggleSelectAll() {
    if (selected.size === filtered.length) {
      setSelected(new Set());
    } else {
      setSelected(new Set(filtered.map((q) => q.id)));
    }
  }

  // ─── Render ─────────────────────────────────────────────────

  const TABS: { key: FilterTab; label: string; count?: number }[] = [
    { key: "all", label: "All", count: stats.total },
    {
      key: "submitted",
      label: "Submitted",
      count: questions.filter((q) => q.status === "submitted").length,
    },
    { key: "approved", label: "Approved", count: stats.approved },
    { key: "starred", label: "Starred", count: stats.starred },
    {
      key: "rejected",
      label: "Rejected",
      count: questions.filter((q) => q.status === "rejected").length,
    },
  ];

  return (
    <div className="space-y-4">
      {/* Question-submission deadline (handbook: collect questions ≥4 days
          before the session). submitQuestion enforces this cutoff. */}
      <Card>
        <CardContent className="flex flex-col gap-2 pt-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-2">
            <CalendarClock className="size-4 text-[#FF9933]" />
            <div>
              <p className="text-sm font-medium text-gray-800">
                Question submission deadline
              </p>
              <p className="text-xs text-gray-500">
                {closeAt
                  ? `Students can submit until ${new Date(closeAt).toLocaleString()}`
                  : "No deadline set — students can submit any time"}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Input
              type="datetime-local"
              value={closeAtDraft}
              onChange={(e) => setCloseAtDraft(e.target.value)}
              className="h-8 w-52 text-xs"
              aria-label="Question submission deadline"
            />
            <Button
              size="sm"
              disabled={savingDeadline || !closeAtDraft}
              onClick={() => {
                const d = new Date(closeAtDraft);
                if (Number.isNaN(d.getTime())) {
                  toast.error("Pick a valid date and time");
                  return;
                }
                saveDeadline(d.toISOString());
              }}
            >
              Save
            </Button>
            {closeAt && (
              <Button
                size="sm"
                variant="outline"
                disabled={savingDeadline}
                onClick={() => saveDeadline(null)}
              >
                Clear
              </Button>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Stats Bar */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <StatCard
          label="Total Submitted"
          value={stats.total}
          icon={MessageSquare}
          color="text-blue-600"
        />
        <StatCard
          label="Approved"
          value={stats.approved}
          icon={CheckCircle2}
          color="text-green-600"
        />
        <StatCard
          label="Starred"
          value={stats.starred}
          icon={Star}
          color="text-amber-500"
        />
        <StatCard
          label="Queued"
          value={stats.queued}
          icon={Filter}
          color="text-purple-600"
        />
      </div>

      {/* Filter Tabs */}
      <div className="flex gap-1 overflow-x-auto">
        {TABS.map((tab) => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key)}
            className={cn(
              "shrink-0 rounded-md px-3 py-1.5 text-sm font-medium transition-colors",
              activeTab === tab.key
                ? "bg-gray-900 text-white"
                : "bg-gray-100 text-gray-600 hover:bg-gray-200"
            )}
          >
            {tab.label}
            {tab.count !== undefined && (
              <span className="ml-1.5 text-xs opacity-70">{tab.count}</span>
            )}
          </button>
        ))}
      </div>

      {/* Bulk Actions */}
      {selected.size > 0 && (
        <div className="flex items-center gap-2 rounded-lg bg-blue-50 px-3 py-2">
          <span className="text-sm text-blue-700 font-medium">
            {selected.size} selected
          </span>
          <Button
            size="sm"
            variant="outline"
            disabled={isPending}
            onClick={handleBulkApprove}
            className="text-green-700 border-green-300 hover:bg-green-50"
          >
            <Check className="size-3.5 mr-1" />
            Approve Selected
          </Button>
          <Button
            size="sm"
            variant="outline"
            disabled={isPending}
            onClick={handleBulkReject}
            className="text-red-700 border-red-300 hover:bg-red-50"
          >
            <X className="size-3.5 mr-1" />
            Reject Selected
          </Button>
          <Button
            size="sm"
            variant="outline"
            onClick={() => setSelected(new Set())}
          >
            Clear
          </Button>
        </div>
      )}

      {/* Questions Table */}
      {filtered.length > 0 ? (
        <Card>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-10">
                    <input
                      type="checkbox"
                      checked={
                        filtered.length > 0 &&
                        selected.size === filtered.length
                      }
                      onChange={toggleSelectAll}
                      className="size-4 rounded border-gray-300"
                    />
                  </TableHead>
                  <TableHead className="w-8">#</TableHead>
                  <TableHead>Student</TableHead>
                  <TableHead>Party</TableHead>
                  <TableHead>Constituency</TableHead>
                  <TableHead>Ministry</TableHead>
                  <TableHead className="min-w-[200px]">Question</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="w-20">Queue</TableHead>
                  <TableHead>Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map((q, idx) => {
                  const status = q.status ?? "submitted";
                  const statusBadge =
                    STATUS_BADGES[status] ?? STATUS_BADGES.submitted;
                  const partySide = q.submitter?.party_side as
                    | "ruling"
                    | "opposition"
                    | null;

                  return (
                    <TableRow key={q.id}>
                      {/* Checkbox */}
                      <TableCell>
                        <input
                          type="checkbox"
                          checked={selected.has(q.id)}
                          onChange={() => toggleSelect(q.id)}
                          className="size-4 rounded border-gray-300"
                        />
                      </TableCell>

                      {/* Number */}
                      <TableCell className="text-xs text-gray-400">
                        {idx + 1}
                      </TableCell>

                      {/* Student Name */}
                      <TableCell className="font-medium text-sm">
                        {q.submitter?.full_name ?? "Unknown"}
                      </TableCell>

                      {/* Party Badge */}
                      <TableCell>
                        {partySide && (
                          <span
                            className={cn(
                              "inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-medium",
                              PARTY_COLORS[partySide]?.badge ??
                                "bg-gray-500 text-white"
                            )}
                          >
                            {partySide === "ruling" ? "Ruling" : "Opp."}
                          </span>
                        )}
                      </TableCell>

                      {/* Constituency */}
                      <TableCell className="text-xs text-gray-500">
                        {q.submitter?.constituency_name ?? "-"}
                      </TableCell>

                      {/* Ministry */}
                      <TableCell>
                        <span className="inline-flex items-center rounded-md bg-gray-100 px-2 py-0.5 text-[10px] font-medium text-gray-600">
                          {getMinistryLabel(q.directed_to_ministry)}
                        </span>
                      </TableCell>

                      {/* Question Text */}
                      <TableCell className="text-sm text-gray-700 max-w-[300px]">
                        <p className="line-clamp-2">{q.question_text}</p>
                      </TableCell>

                      {/* Type (starred/unstarred) */}
                      <TableCell>
                        <button
                          onClick={() =>
                            handleToggleStar(q.id, q.question_type)
                          }
                          disabled={isPending}
                          className="p-1 rounded hover:bg-gray-100 transition-colors"
                          title={
                            q.question_type === "starred"
                              ? "Remove star"
                              : "Star question"
                          }
                        >
                          <Star
                            className={cn(
                              "size-4",
                              q.question_type === "starred"
                                ? "fill-amber-400 text-amber-400"
                                : "text-gray-300"
                            )}
                          />
                        </button>
                      </TableCell>

                      {/* Status */}
                      <TableCell>
                        <Badge
                          variant="secondary"
                          className={`text-[10px] ${statusBadge.className}`}
                        >
                          {statusBadge.label}
                        </Badge>
                      </TableCell>

                      {/* Queue Order */}
                      <TableCell>
                        {status === "approved" && (
                          <Input
                            type="number"
                            min={1}
                            value={q.queue_order ?? ""}
                            onChange={(e) =>
                              handleQueueOrder(q.id, e.target.value)
                            }
                            placeholder="-"
                            className="w-16 h-7 text-xs text-center"
                          />
                        )}
                      </TableCell>

                      {/* Actions */}
                      <TableCell>
                        <div className="flex items-center gap-1">
                          {status !== "approved" &&
                            status !== "answered" &&
                            status !== "asked" && (
                              <Button
                                size="sm"
                                variant="outline"
                                disabled={isPending}
                                onClick={() => handleApprove(q.id)}
                                className="h-7 px-2 text-xs text-green-700 border-green-200 hover:bg-green-50"
                              >
                                <Check className="size-3" />
                              </Button>
                            )}
                          {status !== "rejected" &&
                            status !== "answered" &&
                            status !== "asked" && (
                              <Button
                                size="sm"
                                variant="outline"
                                disabled={isPending}
                                onClick={() => handleReject(q.id)}
                                className="h-7 px-2 text-xs text-red-700 border-red-200 hover:bg-red-50"
                              >
                                <X className="size-3" />
                              </Button>
                            )}
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardContent className="py-12 text-center">
            <Inbox className="mx-auto size-12 text-gray-300 mb-3" />
            <p className="text-gray-500 font-medium">
              {activeTab === "all"
                ? "No questions submitted yet"
                : `No ${activeTab} questions`}
            </p>
            {activeTab === "all" && (
              <p className="text-sm text-gray-400 mt-1">
                Share the link with participants to collect questions.
              </p>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}

// ─── Stat Card ──────────────────────────────────────────────────

function StatCard({
  label,
  value,
  icon: Icon,
  color,
}: {
  label: string;
  value: number;
  icon: typeof MessageSquare;
  color: string;
}) {
  return (
    <Card>
      <CardContent className="pt-4 pb-3">
        <div className="flex items-center gap-2">
          <Icon className={cn("size-4", color)} />
          <span className="text-xs text-gray-500">{label}</span>
        </div>
        <p className="text-2xl font-bold text-gray-900 mt-1">{value}</p>
      </CardContent>
    </Card>
  );
}
