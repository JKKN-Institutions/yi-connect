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
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/yip/ui/dialog";
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
import { MINISTRIES } from "@/lib/yip/constants";
import {
  approveQuestion,
  rejectQuestion,
  filterQuestion,
  setQueueOrder,
  bulkApprove,
  bulkReject,
  setQuestionsDeadline,
  setQuestionsOpen,
} from "@/app/yip/actions/questions";
import type { QuestionWithSubmitter } from "@/app/yip/actions/questions";
import { INK, SAFFRON, SERIF, SectionShell } from "@/app/yip/me/credential-ui";
import { toast } from "sonner";

// ─── Types & Helpers ────────────────────────────────────────────

type FilterTab = "all" | "submitted" | "approved" | "starred" | "rejected";

type Bench = "ruling" | "opposition";
type BenchFilter = "all" | Bench;

function getMinistryLabel(key: string): string {
  const found = MINISTRIES.find((m) => m.key === key);
  return found ? found.label : key;
}

/** Which bench the question came from (null = unknown/no submitter). */
function getBench(q: QuestionWithSubmitter): Bench | null {
  const side = q.submitter?.party_side;
  return side === "ruling" || side === "opposition" ? side : null;
}

const STATUS_BADGES: Record<string, { label: string; className: string }> = {
  submitted: { label: "Submitted", className: "bg-blue-100 text-blue-700" },
  approved: { label: "Approved", className: "bg-green-100 text-green-700" },
  rejected: { label: "Rejected", className: "bg-red-100 text-red-700" },
  asked: { label: "Asked", className: "bg-amber-100 text-amber-700" },
  answered: { label: "Answered", className: "bg-emerald-100 text-emerald-700" },
  skipped: { label: "Skipped", className: "bg-gray-100 text-gray-500" },
};

// Bench colors deliberately distinct from the STATUS_BADGES palette
// (green/red/blue/amber): saffron-orange for Ruling, indigo for Opposition.
const BENCH_BADGES: Record<Bench, { label: string; className: string }> = {
  ruling: {
    label: "Ruling",
    className: "bg-orange-100 text-orange-800 border border-orange-200",
  },
  opposition: {
    label: "Opposition",
    className: "bg-indigo-100 text-indigo-700 border border-indigo-200",
  },
};

// ─── Component ──────────────────────────────────────────────────

interface QuestionsClientProps {
  eventId: string;
  initialQuestions: QuestionWithSubmitter[];
  /** events.questions_open_at — student submissions open at this time. */
  initialOpenAt: string | null;
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
  initialOpenAt,
  initialCloseAt,
}: QuestionsClientProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [openAt, setOpenAt] = useState<string | null>(initialOpenAt);
  const [openAtDraft, setOpenAtDraft] = useState<string>(
    toLocalInputValue(initialOpenAt)
  );
  const [savingOpen, setSavingOpen] = useState(false);
  const [closeAt, setCloseAt] = useState<string | null>(initialCloseAt);
  const [closeAtDraft, setCloseAtDraft] = useState<string>(
    toLocalInputValue(initialCloseAt)
  );
  const [savingDeadline, setSavingDeadline] = useState(false);

  async function saveOpen(nextIso: string | null) {
    setSavingOpen(true);
    const result = await setQuestionsOpen(eventId, nextIso);
    setSavingOpen(false);
    if (result.success) {
      setOpenAt(nextIso);
      setOpenAtDraft(toLocalInputValue(nextIso));
      toast.success(
        nextIso
          ? "Submission open time saved"
          : "Open time removed — submissions open from the start"
      );
    } else {
      toast.error(result.error);
    }
  }

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
  const [benchFilter, setBenchFilter] = useState<BenchFilter>("all");
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [viewing, setViewing] = useState<QuestionWithSubmitter | null>(null);

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

  // Status and bench are independent dimensions — both must match.
  const filtered = questions.filter((q) => {
    if (benchFilter !== "all" && getBench(q) !== benchFilter) return false;
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

  const BENCH_TABS: { key: BenchFilter; label: string; count: number }[] = [
    { key: "all", label: "All benches", count: stats.total },
    {
      key: "ruling",
      label: "Ruling",
      count: questions.filter((q) => getBench(q) === "ruling").length,
    },
    {
      key: "opposition",
      label: "Opposition",
      count: questions.filter((q) => getBench(q) === "opposition").length,
    },
  ];

  return (
    <div className="space-y-4">
      {/* Question-submission OPEN time (event-days only). Pairs with the
          deadline below; submitQuestion enforces open_at <= now() <= close_at. */}
      <Card>
        <CardContent className="flex flex-col gap-2 pt-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-2">
            <CalendarClock className="size-4 text-green-600" />
            <div>
              <p className="text-sm font-medium text-gray-800">
                Question submissions open
              </p>
              <p className="text-xs text-gray-500">
                {openAt
                  ? `Students can submit from ${new Date(openAt).toLocaleString()}`
                  : "No open time set — submissions open from the start"}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Input
              type="datetime-local"
              value={openAtDraft}
              onChange={(e) => setOpenAtDraft(e.target.value)}
              className="h-8 w-52 text-xs"
              aria-label="Question submission open time"
            />
            <Button
              size="sm"
              disabled={savingOpen || !openAtDraft}
              onClick={() => {
                const d = new Date(openAtDraft);
                if (Number.isNaN(d.getTime())) {
                  toast.error("Pick a valid date and time");
                  return;
                }
                saveOpen(d.toISOString());
              }}
            >
              Save
            </Button>
            {openAt && (
              <Button
                size="sm"
                variant="outline"
                disabled={savingOpen}
                onClick={() => saveOpen(null)}
              >
                Clear
              </Button>
            )}
          </div>
        </CardContent>
      </Card>

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

      {/* Filter Tabs — status (row 1) × bench (row 2) compose */}
      <div className="space-y-2">
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
        <div
          className="flex gap-1 overflow-x-auto"
          aria-label="Filter questions by bench"
        >
          {BENCH_TABS.map((tab) => (
            <button
              key={tab.key}
              onClick={() => setBenchFilter(tab.key)}
              className={cn(
                "shrink-0 rounded-md px-3 py-1.5 text-sm font-medium transition-colors",
                benchFilter === tab.key
                  ? "bg-gray-900 text-white"
                  : "bg-gray-100 text-gray-600 hover:bg-gray-200"
              )}
            >
              {tab.label}
              <span className="ml-1.5 text-xs opacity-70">{tab.count}</span>
            </button>
          ))}
        </div>
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
                  <TableHead>Bench</TableHead>
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
                  const bench = getBench(q);

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

                      {/* Bench Badge */}
                      <TableCell>
                        {bench ? (
                          <Badge
                            variant="secondary"
                            className={`text-[10px] ${BENCH_BADGES[bench].className}`}
                          >
                            {BENCH_BADGES[bench].label}
                          </Badge>
                        ) : (
                          <span className="text-xs text-gray-400">—</span>
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

                      {/* Question Text — click to read in full */}
                      <TableCell className="text-sm text-gray-700 max-w-[300px]">
                        <button
                          type="button"
                          onClick={() => setViewing(q)}
                          className="text-left w-full group/q cursor-pointer"
                          title="Click to read the full question"
                        >
                          <p className="line-clamp-2 group-hover/q:text-blue-700 group-hover/q:underline decoration-dotted underline-offset-2">
                            {q.question_text}
                          </p>
                        </button>
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
        <SectionShell accent={SAFFRON} className="py-12 text-center">
          <Inbox className="mx-auto size-12 text-gray-300 mb-3" />
          <p className="text-gray-500 font-medium">
            {activeTab === "all" && benchFilter === "all"
              ? "No questions submitted yet"
              : `No ${activeTab === "all" ? "" : `${activeTab} `}questions${
                  benchFilter === "all"
                    ? ""
                    : ` from the ${BENCH_BADGES[benchFilter].label} bench`
                }`}
          </p>
          {activeTab === "all" && benchFilter === "all" && (
            <p className="text-sm text-gray-400 mt-1">
              Share the link with participants to collect questions.
            </p>
          )}
        </SectionShell>
      )}

      {/* Full-question drill-down */}
      <QuestionDetailDialog
        question={
          viewing ? questions.find((x) => x.id === viewing.id) ?? viewing : null
        }
        onClose={() => setViewing(null)}
        onApprove={(id) => {
          handleApprove(id);
        }}
        onReject={(id) => {
          handleReject(id);
        }}
        isPending={isPending}
      />
    </div>
  );
}

// ─── Question Detail Dialog ─────────────────────────────────────

function QuestionDetailDialog({
  question,
  onClose,
  onApprove,
  onReject,
  isPending,
}: {
  question: QuestionWithSubmitter | null;
  onClose: () => void;
  onApprove: (id: string) => void;
  onReject: (id: string) => void;
  isPending: boolean;
}) {
  const q = question;
  const status = q?.status ?? "submitted";
  const statusBadge = STATUS_BADGES[status] ?? STATUS_BADGES.submitted;
  const bench = q ? getBench(q) : null;
  const canApprove =
    status !== "approved" && status !== "answered" && status !== "asked";
  const canReject =
    status !== "rejected" && status !== "answered" && status !== "asked";

  return (
    <Dialog open={!!q} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-2xl">
        {q && (
          <>
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                Question
                <Badge
                  variant="secondary"
                  className={`text-[10px] ${statusBadge.className}`}
                >
                  {statusBadge.label}
                </Badge>
                {q.question_type === "starred" && (
                  <Star className="size-4 fill-amber-400 text-amber-400" />
                )}
              </DialogTitle>
            </DialogHeader>

            {/* Submitter meta */}
            <div className="grid grid-cols-2 gap-x-4 gap-y-2 text-sm border-b pb-3">
              <div>
                <span className="text-gray-400 text-xs block">Student</span>
                <span className="font-medium">
                  {q.submitter?.full_name ?? "Unknown"}
                </span>
              </div>
              <div>
                <span className="text-gray-400 text-xs block">Bench</span>
                {bench ? (
                  <Badge
                    variant="secondary"
                    className={`text-[10px] ${BENCH_BADGES[bench].className}`}
                  >
                    {BENCH_BADGES[bench].label}
                  </Badge>
                ) : (
                  <span className="text-gray-400">—</span>
                )}
              </div>
              <div>
                <span className="text-gray-400 text-xs block">Constituency</span>
                <span>{q.submitter?.constituency_name ?? "—"}</span>
              </div>
              <div>
                <span className="text-gray-400 text-xs block">
                  Directed to ministry
                </span>
                <span>{getMinistryLabel(q.directed_to_ministry)}</span>
              </div>
              {q.submitter?.school_name && (
                <div className="col-span-2">
                  <span className="text-gray-400 text-xs block">School</span>
                  <span>{q.submitter.school_name}</span>
                </div>
              )}
            </div>

            {/* Full question text */}
            <div className="py-1">
              <span className="text-gray-400 text-xs block mb-1">
                Full question
              </span>
              <p className="text-sm text-gray-800 whitespace-pre-wrap leading-relaxed">
                {q.question_text}
              </p>
            </div>

            {/* Actions */}
            {(canApprove || canReject) && (
              <div className="flex items-center justify-end gap-2 pt-2 border-t">
                {canReject && (
                  <Button
                    variant="outline"
                    disabled={isPending}
                    onClick={() => {
                      onReject(q.id);
                      onClose();
                    }}
                    className="text-red-700 border-red-200 hover:bg-red-50"
                  >
                    <X className="size-4 mr-1" />
                    Reject
                  </Button>
                )}
                {canApprove && (
                  <Button
                    disabled={isPending}
                    onClick={() => {
                      onApprove(q.id);
                      onClose();
                    }}
                    className="bg-green-600 hover:bg-green-700 text-white"
                  >
                    <Check className="size-4 mr-1" />
                    Approve
                  </Button>
                )}
              </div>
            )}
          </>
        )}
      </DialogContent>
    </Dialog>
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
        <p className="mt-1 text-2xl font-bold" style={{ ...SERIF, color: INK }}>{value}</p>
      </CardContent>
    </Card>
  );
}
