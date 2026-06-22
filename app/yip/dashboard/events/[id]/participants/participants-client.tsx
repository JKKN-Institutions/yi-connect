"use client";

import { useState, useMemo, useEffect } from "react";
import { useRouter } from "next/navigation";
import {
  addParticipant,
  quickAddWalkIn,
  deleteParticipant,
  deleteAllParticipants,
  setDayCheckIn,
  bulkCheckIn,
} from "@/app/yip/actions/participants";
import { ROLE_LABELS, PARTY_COLORS } from "@/lib/yip/constants";
import { Button } from "@/components/yip/ui/button";
import { Input } from "@/components/yip/ui/input";
import { Label } from "@/components/yip/ui/label";
import { Badge } from "@/components/yip/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogDescription,
  DialogFooter,
  DialogClose,
} from "@/components/yip/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/yip/ui/table";
import {
  UserPlus,
  Users,
  Trash2,
  Search,
  ArrowUpDown,
  Copy,
  Check,
  Download,
  Loader2,
  UserCheck,
  Zap,
} from "lucide-react";
import { CsvImport } from "@/components/yip/csv-import";
import { EmailSendCodes } from "@/components/yip/email-send-codes";
import { exportAllocationRoster } from "@/app/yip/actions/school-export";
import { toast } from "sonner";

type Participant = {
  id: string;
  full_name: string;
  school_name: string;
  class: number;
  phone: string | null;
  email: string | null;
  city: string | null;
  home_state: string | null;
  party_side: string | null;
  party_number: number | null;
  parliament_role: string | null;
  constituency_name: string | null;
  constituency_number: number | null;
  constituency_state: string | null;
  committee_name: string | null;
  committee_number: number | null;
  access_code: string;
  checked_in: boolean | null;
  checked_in_at: string | null;
  checked_in_day1?: boolean | null;
  checked_in_day2?: boolean | null;
  // Not in generated DB types yet; present at runtime via getEventParticipants
  // (.select("*") on the service client). Read defensively.
  speech_finished?: boolean | null;
};

type SortKey = "full_name";

type CheckInFilter = "all" | "in" | "out";

export function ParticipantsClient({
  eventId,
  participants: initialParticipants,
  allocationLocked,
  canDelete = true,
  canManage = false,
}: {
  eventId: string;
  participants: Participant[];
  allocationLocked: boolean;
  /** Chair/national/regional only. Organisers cannot delete records. */
  canDelete?: boolean;
  /** Organiser+ — gates the roster download and the full-roster reset. */
  canManage?: boolean;
}) {
  const router = useRouter();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");
  const [sortKey, setSortKey] = useState<SortKey>("full_name");
  const [sortAsc, setSortAsc] = useState(true);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [checkingIn, setCheckingIn] = useState<Set<string>>(new Set());
  const [checkInFilter, setCheckInFilter] = useState<CheckInFilter>("all");
  const [rosterLoading, setRosterLoading] = useState(false);
  // Full-roster reset (chair only) — two-step type-to-confirm.
  const [deleteAllOpen, setDeleteAllOpen] = useState(false);
  const [deleteStage, setDeleteStage] = useState<1 | 2>(1);
  const [deleteConfirmText, setDeleteConfirmText] = useState("");
  const [deletingAll, setDeletingAll] = useState(false);
  // Optimistic check-in overrides: applied instantly on click so the row
  // flips without waiting for the server action + route refresh (BUG-399/387).
  // Per-day (YA2); the derived `checked_in` is recomputed in the merge below.
  const [checkInOverrides, setCheckInOverrides] = useState<
    Record<string, { checked_in_day1: boolean; checked_in_day2: boolean }>
  >({});
  // Roster with optimistic check-in state applied
  const participants = useMemo(
    () =>
      initialParticipants.map((p) => {
        let row = p;
        const o = checkInOverrides[p.id];
        if (o) {
          row = {
            ...row,
            checked_in_day1: o.checked_in_day1,
            checked_in_day2: o.checked_in_day2,
            checked_in: o.checked_in_day1 || o.checked_in_day2,
          };
        }
        return row;
      }),
    [initialParticipants, checkInOverrides]
  );

  // Prune overrides once the refreshed server roster confirms them, so a
  // later change made elsewhere isn't masked by stale optimistic state.
  useEffect(() => {
    setCheckInOverrides((prev) => {
      const entries = Object.entries(prev);
      if (entries.length === 0) return prev;
      const next: typeof prev = {};
      let changed = false;
      for (const [id, o] of entries) {
        const server = initialParticipants.find((p) => p.id === id);
        if (
          server &&
          !!server.checked_in_day1 === o.checked_in_day1 &&
          !!server.checked_in_day2 === o.checked_in_day2
        ) {
          changed = true; // server caught up — drop the override
        } else {
          next[id] = o;
        }
      }
      return changed ? next : prev;
    });
  }, [initialParticipants]);

  // Derived: checked-in counts (present = either day; plus per-day)
  const checkedInCount = participants.filter((p) => p.checked_in).length;
  const day1Count = participants.filter((p) => p.checked_in_day1).length;
  const day2Count = participants.filter((p) => p.checked_in_day2).length;

  // Form state
  const [formData, setFormData] = useState({
    full_name: "",
    school_name: "",
    phone: "",
    email: "",
    city: "",
    home_state: "",
  });

  // Quick Add Walk-in: a single late arrival, auto-assigned party + seat +
  // committee server-side (works even when allocation is locked).
  const [quickOpen, setQuickOpen] = useState(false);
  const [quickLoading, setQuickLoading] = useState(false);
  const [quickError, setQuickError] = useState("");
  const [quickResult, setQuickResult] = useState<{
    party_side: string;
    party_name: string | null;
    constituency_name: string;
    constituency_state: string;
    committee_name: string;
    access_code: string;
  } | null>(null);
  const [quickForm, setQuickForm] = useState({
    full_name: "",
    school_name: "",
    phone: "",
    email: "",
    city: "",
    home_state: "",
  });

  // Filtered & sorted list
  const displayedParticipants = useMemo(() => {
    let filtered = participants;

    // Check-in filter
    if (checkInFilter === "in") {
      filtered = filtered.filter((p) => p.checked_in);
    } else if (checkInFilter === "out") {
      filtered = filtered.filter((p) => !p.checked_in);
    }

    // Search filter (by name only — school is not shown or searchable)
    if (search.trim()) {
      const q = search.toLowerCase();
      filtered = filtered.filter((p) => p.full_name.toLowerCase().includes(q));
    }

    // Sort
    return [...filtered].sort((a, b) => {
      const cmp = (a[sortKey] || "").localeCompare(b[sortKey] || "");
      return sortAsc ? cmp : -cmp;
    });
  }, [participants, checkInFilter, search, sortKey, sortAsc]);

  function handleSort(key: SortKey) {
    if (sortKey === key) {
      setSortAsc(!sortAsc);
    } else {
      setSortKey(key);
      setSortAsc(true);
    }
  }

  async function handleAddParticipant() {
    if (!formData.full_name.trim()) {
      setError("Student name is required");
      return;
    }

    setLoading(true);
    setError("");

    // Name-only registration — the student's name is the only PII collected
    // (with consent; see the privacy notice on the student login).
    const result = await addParticipant(eventId, {
      full_name: formData.full_name.trim(),
    });

    if (result.success) {
      setDialogOpen(false);
      setFormData({
        full_name: "",
        school_name: "",
        phone: "",
        email: "",
        city: "",
        home_state: "",
      });
      router.refresh();
    } else {
      setError(result.error);
    }
    setLoading(false);
  }

  async function handleQuickAdd() {
    if (!quickForm.full_name.trim()) {
      setQuickError("Student name is required");
      return;
    }

    setQuickLoading(true);
    setQuickError("");
    setQuickResult(null);

    const result = await quickAddWalkIn(eventId, {
      full_name: quickForm.full_name.trim(),
    });

    if (result.success) {
      // Keep the dialog open to show what was auto-assigned; reset the form so
      // the organizer can immediately add the next walk-in.
      setQuickResult({
        ...result.data.assignment,
        access_code: result.data.access_code,
      });
      setQuickForm({
        full_name: "",
        school_name: "",
        phone: "",
        email: "",
        city: "",
        home_state: "",
      });
      router.refresh();
    } else {
      setQuickError(result.error);
    }
    setQuickLoading(false);
  }

  async function handleDelete(participantId: string) {
    if (!confirm("Are you sure you want to remove this participant?")) return;

    const result = await deleteParticipant(participantId, eventId);
    if (result.success) {
      router.refresh();
    } else {
      alert(result.error);
    }
  }

  function handleCopy(code: string, id: string) {
    navigator.clipboard.writeText(code);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  }

  async function handleToggleDay(participant: Participant, day: 1 | 2) {
    // Guard against rapid double-clicks while a toggle is in flight —
    // without this a second click would immediately undo the first (BUG-387).
    // Keyed per participant (both day writes touch the same row).
    if (checkingIn.has(participant.id)) return;
    setCheckingIn((prev) => new Set(prev).add(participant.id));

    const curD1 = !!participant.checked_in_day1;
    const curD2 = !!participant.checked_in_day2;
    const nextD1 = day === 1 ? !curD1 : curD1;
    const nextD2 = day === 2 ? !curD2 : curD2;

    // Optimistic flip: the row responds instantly; reverted on error.
    setCheckInOverrides((prev) => ({
      ...prev,
      [participant.id]: { checked_in_day1: nextD1, checked_in_day2: nextD2 },
    }));

    const result = await setDayCheckIn(
      participant.id,
      eventId,
      day,
      day === 1 ? nextD1 : nextD2
    );

    if (result.success) {
      router.refresh();
    } else {
      setCheckInOverrides((prev) => {
        const next = { ...prev };
        delete next[participant.id];
        return next;
      });
      alert(result.error);
    }

    setCheckingIn((prev) => {
      const next = new Set(prev);
      next.delete(participant.id);
      return next;
    });
  }

  async function handleBulkCheckInDay(day: 1 | 2) {
    const targets = participants.filter((p) =>
      day === 1 ? !p.checked_in_day1 : !p.checked_in_day2
    );
    const ids = targets.map((p) => p.id);
    if (ids.length === 0) return;

    setLoading(true);

    // Optimistic: mark all targeted rows present for this day immediately.
    setCheckInOverrides((prev) => {
      const next = { ...prev };
      for (const p of targets) {
        const cur = next[p.id] ?? {
          checked_in_day1: !!p.checked_in_day1,
          checked_in_day2: !!p.checked_in_day2,
        };
        next[p.id] =
          day === 1
            ? { ...cur, checked_in_day1: true }
            : { ...cur, checked_in_day2: true };
      }
      return next;
    });

    const result = await bulkCheckIn(ids, eventId, day);
    if (result.success) {
      router.refresh();
    } else {
      // Revert the optimistic bulk flip
      setCheckInOverrides((prev) => {
        const next = { ...prev };
        for (const id of ids) {
          delete next[id];
        }
        return next;
      });
      alert(result.error);
    }
    setLoading(false);
  }

  // Download the current allocation roster (name + party + side + constituency
  // + committee + role). Re-runnable: re-download after adding late registrants
  // and re-running allocation. Non-destructive.
  async function handleDownloadRoster() {
    setRosterLoading(true);
    const res = await exportAllocationRoster(eventId);
    setRosterLoading(false);
    if (!res.success) {
      toast.error(res.error);
      return;
    }
    const blob = new Blob([res.data.csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = res.data.filename;
    a.click();
    URL.revokeObjectURL(url);
    toast.success(`Downloaded roster for ${res.data.count} registrants.`);
  }

  // Full-roster reset (chair only). Deletes every registrant for this event so a
  // corrected roster can be re-imported. Behind a two-step type-to-confirm.
  async function handleDeleteAll() {
    setDeletingAll(true);
    const res = await deleteAllParticipants(eventId);
    setDeletingAll(false);
    if (!res.success) {
      toast.error(res.error);
      return;
    }
    setDeleteAllOpen(false);
    setDeleteStage(1);
    setDeleteConfirmText("");
    toast.success(`Deleted all ${res.data.deleted} registrants.`);
    router.refresh();
  }

  return (
    <div className="space-y-4">
      {/* Header row */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <h2 className="text-lg font-semibold">
            Participants ({initialParticipants.length})
          </h2>
          <span className="flex items-center gap-1.5 rounded-full bg-green-50 px-2.5 py-1 text-xs font-medium text-green-700">
            <UserCheck className="size-3.5" />
            Day 1: {day1Count} · Day 2: {day2Count} of {initialParticipants.length}
          </span>
        </div>
        <div className="flex items-center gap-2">
          {day1Count < initialParticipants.length && initialParticipants.length > 0 && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => handleBulkCheckInDay(1)}
              disabled={loading}
            >
              <UserCheck className="size-4" />
              Check In All · Day 1
            </Button>
          )}
          {day2Count < initialParticipants.length && initialParticipants.length > 0 && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => handleBulkCheckInDay(2)}
              disabled={loading}
            >
              <UserCheck className="size-4" />
              Check In All · Day 2
            </Button>
          )}

          <CsvImport eventId={eventId} onImported={() => router.refresh()} />

          {/* Download the current allocation roster (organiser+). Re-runnable
              any time — re-download after adding late registrants and re-running
              allocation. */}
          {canManage && initialParticipants.length > 0 && (
            <Button
              variant="outline"
              size="sm"
              onClick={handleDownloadRoster}
              disabled={rosterLoading}
            >
              {rosterLoading ? (
                <Loader2 className="size-4 animate-spin" />
              ) : (
                <Download className="size-4" />
              )}
              Download Auto-Allocated List
            </Button>
          )}

          {/* Email each student's access code via Resend — the reliable channel
              (every participant has an email; no bridge to connect). The
              WhatsApp Codes button was removed 2026-06-13 while the Railway
              bridge is down (headless-Chrome crash after scan); the
              WhatsAppSendCodes component is kept for when the bridge is fixed. */}
          <EmailSendCodes eventId={eventId} />

          {/* Quick Add Walk-in — create a single late arrival and auto-assign
              party + constituency + committee in one click. Works even after
              allocation is locked (writes one row; never re-runs the engine). */}
          <Dialog
            open={quickOpen}
            onOpenChange={(open) => {
              setQuickOpen(open);
              if (!open) {
                setQuickError("");
                setQuickResult(null);
              }
            }}
          >
            <DialogTrigger
              render={<Button variant="outline" size="sm" />}
            >
              <Zap className="size-4" />
              Quick Add Walk-in
            </DialogTrigger>
            <DialogContent className="sm:max-w-md">
              <DialogHeader>
                <DialogTitle>Quick Add Walk-in</DialogTitle>
                <DialogDescription>
                  Add a late arrival. Party, constituency and committee are
                  assigned automatically — no need to unlock allocation.
                </DialogDescription>
              </DialogHeader>

              {quickError && (
                <div className="rounded-lg border border-red-200 bg-red-50 p-2 text-xs text-red-700">
                  {quickError}
                </div>
              )}

              {quickResult && (
                <div className="rounded-lg border border-green-200 bg-green-50 p-3 text-xs text-green-800">
                  <p className="font-medium">Walk-in added &amp; auto-assigned:</p>
                  <ul className="mt-1.5 space-y-0.5">
                    <li>
                      Bench:{" "}
                      <span className="font-medium">
                        {quickResult.party_side === "ruling" ? "Ruling" : "Opposition"}
                      </span>
                      {quickResult.party_name ? ` — ${quickResult.party_name}` : ""}
                    </li>
                    <li>
                      Constituency:{" "}
                      <span className="font-medium">
                        {quickResult.constituency_name}
                        {quickResult.constituency_state
                          ? `, ${quickResult.constituency_state}`
                          : ""}
                      </span>
                    </li>
                    <li>
                      Committee:{" "}
                      <span className="font-medium">{quickResult.committee_name}</span>
                    </li>
                    <li>
                      Access code:{" "}
                      <code className="rounded bg-white px-1 py-0.5 font-mono">
                        {quickResult.access_code}
                      </code>
                    </li>
                  </ul>
                </div>
              )}

              <div className="space-y-3">
                <div>
                  <Label htmlFor="quick-name">Full Name *</Label>
                  <Input
                    id="quick-name"
                    value={quickForm.full_name}
                    onChange={(e) =>
                      setQuickForm((prev) => ({ ...prev, full_name: e.target.value }))
                    }
                    placeholder="Student full name"
                  />
                </div>
                <p className="text-xs text-gray-400">
                  Name only — party, constituency and committee are assigned
                  automatically.
                </p>
              </div>

              <DialogFooter>
                <DialogClose render={<Button variant="outline" />}>
                  Done
                </DialogClose>
                <Button
                  className="bg-[#FF9933] text-white hover:bg-[#E68A2E]"
                  onClick={handleQuickAdd}
                  disabled={quickLoading}
                >
                  {quickLoading ? (
                    <Loader2 className="size-4 animate-spin" />
                  ) : (
                    <Zap className="size-4" />
                  )}
                  {quickLoading ? "Adding..." : "Add & Auto-assign"}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>

          <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
            <DialogTrigger
              render={
                <Button className="bg-[#FF9933] text-white hover:bg-[#E68A2E]" size="sm" />
              }
            >
              <UserPlus className="size-4" />
              Add Student
            </DialogTrigger>
            <DialogContent className="sm:max-w-md">
              <DialogHeader>
                <DialogTitle>Add Student</DialogTitle>
                <DialogDescription>
                  Add a new participant to this event
                </DialogDescription>
              </DialogHeader>

              {error && (
                <div className="rounded-lg border border-red-200 bg-red-50 p-2 text-xs text-red-700">
                  {error}
                </div>
              )}

              <div className="space-y-3">
                <div>
                  <Label htmlFor="add-name">Full Name *</Label>
                  <Input
                    id="add-name"
                    value={formData.full_name}
                    onChange={(e) =>
                      setFormData((prev) => ({
                        ...prev,
                        full_name: e.target.value,
                      }))
                    }
                    placeholder="Student full name"
                    autoFocus
                  />
                  <p className="mt-1.5 text-[11px] text-gray-400">
                    The name is the only detail collected. An access code is
                    generated automatically.
                  </p>
                </div>
              </div>

              <DialogFooter>
                <DialogClose
                  render={<Button variant="outline" />}
                >
                  Cancel
                </DialogClose>
                <Button
                  className="bg-[#FF9933] text-white hover:bg-[#E68A2E]"
                  onClick={handleAddParticipant}
                  disabled={loading}
                >
                  {loading ? (
                    <Loader2 className="size-4 animate-spin" />
                  ) : (
                    <UserPlus className="size-4" />
                  )}
                  {loading ? "Adding..." : "Add Student"}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>

          {/* Full-roster reset — chair only, hidden once allocation is locked
              (mirrors the per-row delete). Two-step type-to-confirm dialog. */}
          {canDelete && !allocationLocked && initialParticipants.length > 0 && (
            <Dialog
              open={deleteAllOpen}
              onOpenChange={(open) => {
                setDeleteAllOpen(open);
                if (!open) {
                  setDeleteStage(1);
                  setDeleteConfirmText("");
                }
              }}
            >
              <DialogTrigger
                render={
                  <Button
                    variant="outline"
                    size="sm"
                    className="border-red-300 text-red-700 hover:bg-red-50"
                  />
                }
              >
                <Trash2 className="size-4" />
                Delete all
              </DialogTrigger>
              <DialogContent className="sm:max-w-md">
                {deleteStage === 1 ? (
                  <>
                    <DialogHeader>
                      <DialogTitle>
                        Delete all {initialParticipants.length} registrants?
                      </DialogTitle>
                      <DialogDescription>
                        This permanently removes <strong>every registrant</strong>{" "}
                        from this event, along with their party, constituency and
                        committee allocation. This cannot be undone. Use it to clear
                        the list before re-importing a corrected roster.
                      </DialogDescription>
                    </DialogHeader>
                    <DialogFooter>
                      <DialogClose render={<Button variant="outline" />}>
                        Cancel
                      </DialogClose>
                      <Button
                        className="bg-red-600 text-white hover:bg-red-700"
                        onClick={() => setDeleteStage(2)}
                      >
                        Continue
                      </Button>
                    </DialogFooter>
                  </>
                ) : (
                  <>
                    <DialogHeader>
                      <DialogTitle>Final confirmation</DialogTitle>
                      <DialogDescription>
                        This will permanently delete all{" "}
                        {initialParticipants.length} registrants. Type{" "}
                        <strong>{initialParticipants.length}</strong> below to
                        confirm.
                      </DialogDescription>
                    </DialogHeader>
                    <div>
                      <Label htmlFor="delete-confirm">
                        Type {initialParticipants.length} to confirm
                      </Label>
                      <Input
                        id="delete-confirm"
                        value={deleteConfirmText}
                        onChange={(e) => setDeleteConfirmText(e.target.value)}
                        placeholder={String(initialParticipants.length)}
                        autoFocus
                      />
                    </div>
                    <DialogFooter>
                      <Button
                        variant="outline"
                        onClick={() => {
                          setDeleteStage(1);
                          setDeleteConfirmText("");
                        }}
                      >
                        Back
                      </Button>
                      <Button
                        className="bg-red-600 text-white hover:bg-red-700"
                        onClick={handleDeleteAll}
                        disabled={
                          deletingAll ||
                          deleteConfirmText.trim() !==
                            String(initialParticipants.length)
                        }
                      >
                        {deletingAll ? (
                          <Loader2 className="size-4 animate-spin" />
                        ) : (
                          <Trash2 className="size-4" />
                        )}
                        Permanently delete all
                      </Button>
                    </DialogFooter>
                  </>
                )}
              </DialogContent>
            </Dialog>
          )}
        </div>
      </div>

      {/* Search bar + check-in filter */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="relative max-w-sm flex-1 basis-64">
          <Search className="absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-gray-400" />
          <Input
            placeholder="Search by name..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-8"
          />
        </div>
        <div className="flex items-center gap-2">
          {(
            [
              { key: "all", label: "All", count: participants.length },
              { key: "in", label: "Checked in", count: checkedInCount },
              {
                key: "out",
                label: "Not checked in",
                count: participants.length - checkedInCount,
              },
            ] as const
          ).map((opt) => (
            <button
              key={opt.key}
              onClick={() => setCheckInFilter(opt.key)}
              className={`text-xs px-3 py-1.5 rounded-full border transition-all ${
                checkInFilter === opt.key
                  ? "bg-[#1a1a3e] text-white border-[#1a1a3e]"
                  : "bg-white text-[#1a1a3e]/70 border-[#1a1a3e]/10 hover:border-[#1a1a3e]/30"
              }`}
            >
              {opt.label} ({opt.count})
            </button>
          ))}
        </div>
      </div>

      {/* Table */}
      {displayedParticipants.length > 0 ? (
        <div className="rounded-lg border bg-white">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-32">Check-in (D1 / D2)</TableHead>
                <TableHead>
                  <button
                    onClick={() => handleSort("full_name")}
                    className="flex items-center gap-1 hover:text-gray-900"
                  >
                    Name
                    <ArrowUpDown className="size-3" />
                  </button>
                </TableHead>
                <TableHead className="w-16">Party</TableHead>
                <TableHead>Role</TableHead>
                <TableHead className="w-20">Const. No.</TableHead>
                <TableHead>Constituency</TableHead>
                <TableHead>State</TableHead>
                <TableHead>Committee</TableHead>
                <TableHead>Access Code</TableHead>
                <TableHead className="w-10" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {displayedParticipants.map((p) => (
                <TableRow
                  key={p.id}
                  onClick={() =>
                    router.push(
                      `/yip/dashboard/events/${eventId}/participants/${p.id}`
                    )
                  }
                  className="cursor-pointer hover:bg-[#1a1a3e]/[0.025]"
                >
                  <TableCell>
                    <div className="flex items-center gap-1.5">
                      {([1, 2] as const).map((day) => {
                        const on =
                          day === 1 ? !!p.checked_in_day1 : !!p.checked_in_day2;
                        return (
                          <button
                            key={day}
                            onClick={(e) => {
                              e.stopPropagation();
                              handleToggleDay(p, day);
                            }}
                            disabled={checkingIn.has(p.id)}
                            className={`flex items-center gap-1 rounded-md border px-1.5 py-1 text-xs font-medium transition-colors disabled:opacity-50 ${
                              on
                                ? "border-green-200 bg-green-50 text-green-700"
                                : "border-gray-200 text-gray-500 hover:bg-gray-50"
                            }`}
                            title={`Day ${day}: click to ${on ? "remove" : "mark present"}`}
                          >
                            <span
                              className={`size-2 rounded-full ${
                                on ? "bg-green-500" : "bg-gray-300"
                              }`}
                            />
                            D{day}
                          </button>
                        );
                      })}
                    </div>
                  </TableCell>
                  <TableCell className="font-medium">{p.full_name}</TableCell>
                  <TableCell>
                    {p.party_number != null ? (
                      <span className="text-xs font-medium">
                        {String.fromCharCode(64 + p.party_number)}
                      </span>
                    ) : (
                      <span className="text-gray-400">—</span>
                    )}
                  </TableCell>
                  <TableCell>
                    {p.parliament_role ? (
                      <Badge variant="secondary" className="bg-gray-100 text-gray-700">
                        {ROLE_LABELS[p.parliament_role] ?? p.parliament_role}
                      </Badge>
                    ) : (
                      <span className="text-gray-400">--</span>
                    )}
                  </TableCell>
                  <TableCell>
                    {p.constituency_number != null ? (
                      <span className="font-mono text-xs text-[#1a1a3e]/60">
                        {p.constituency_number}
                      </span>
                    ) : (
                      <span className="text-gray-400">—</span>
                    )}
                  </TableCell>
                  <TableCell>
                    {p.constituency_name ? (
                      <span className="text-xs">{p.constituency_name}</span>
                    ) : (
                      <span className="text-gray-400">—</span>
                    )}
                  </TableCell>
                  <TableCell>
                    {p.constituency_state ? (
                      <span className="text-xs">{p.constituency_state}</span>
                    ) : (
                      <span className="text-gray-400">—</span>
                    )}
                  </TableCell>
                  <TableCell>
                    {p.committee_number != null ? (
                      <span className="text-xs">
                        {p.committee_number}
                        {p.committee_name
                          ? ` · ${p.committee_name.replace(/^Ministry of /i, "")}`
                          : ""}
                      </span>
                    ) : (
                      <span className="text-gray-400">--</span>
                    )}
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-1">
                      <code className="rounded bg-gray-100 px-1.5 py-0.5 text-xs font-mono">
                        {p.access_code}
                      </code>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleCopy(p.access_code, p.id);
                        }}
                        className="rounded p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-600"
                        title="Copy code"
                      >
                        {copiedId === p.id ? (
                          <Check className="size-3 text-green-500" />
                        ) : (
                          <Copy className="size-3" />
                        )}
                      </button>
                    </div>
                  </TableCell>
                  <TableCell>
                    {!allocationLocked && canDelete && (
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleDelete(p.id);
                        }}
                        className="rounded p-1 text-gray-400 hover:bg-red-50 hover:text-red-600"
                        title="Remove participant"
                      >
                        <Trash2 className="size-4" />
                      </button>
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      ) : (
        <div className="flex flex-col items-center justify-center rounded-lg border border-dashed bg-white py-16 text-center">
          <Users className="mb-4 size-12 text-gray-300" />
          <h3 className="text-sm font-medium text-gray-700">
            {search || checkInFilter !== "all"
              ? "No participants match your filters"
              : "No participants yet"}
          </h3>
          <p className="mt-1 text-xs text-gray-500">
            {search || checkInFilter !== "all"
              ? "Try a different search term or filter"
              : "Add students individually or import from CSV"}
          </p>
        </div>
      )}
    </div>
  );
}
