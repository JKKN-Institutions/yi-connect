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
  updateParticipant,
} from "@/app/yip/actions/participants";
import { ROLE_LABELS, PARTY_COLORS } from "@/lib/yip/constants";
import { CONSTITUENCIES } from "@/lib/yip/data/constituencies";
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
  Pencil,
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

type SortKey =
  | "full_name"
  | "party_number"
  | "parliament_role"
  | "constituency_number"
  | "constituency_name"
  | "constituency_state"
  | "committee_number"
  | "checkin";

type CheckInFilter = "all" | "in" | "out";
// Which day the Checked-in / Not-checked-in chips count. "any" = either day.
type CheckInDay = "any" | "1" | "2";

// Every editable field on a participant. Strings so they bind to <input>; the
// server action parses + validates (numbers, class range, access-code uniqueness).
type EditFields = {
  full_name: string;
  class: string;
  school_name: string;
  constituency_name: string;
  constituency_number: string;
  constituency_state: string;
  party_number: string;
  committee_number: string;
  committee_name: string;
  parliament_role: string;
  ministry: string;
  serial_no: string;
  access_code: string;
};

// Parliament-role options for the edit dropdown (value → label from ROLE_LABELS).
const ROLE_OPTIONS = Object.entries(ROLE_LABELS) as Array<[string, string]>;

// Ministry options (mirrors the ministry_type enum). Only meaningful for the
// cabinet_minister / shadow_minister roles.
const MINISTRY_OPTIONS: Array<[string, string]> = [
  ["home", "Home"],
  ["finance", "Finance"],
  ["education", "Education"],
  ["health", "Health"],
  ["women_child", "Women & Child"],
  ["disaster_management", "Disaster Management"],
  ["youth_sports", "Youth & Sports"],
  ["it_digital", "IT & Digital"],
];

// Canonical Lok Sabha constituencies (543), grouped by state for the edit
// picker. Picking a constituency auto-fills its state, so a chair can never
// type "Bhopal" in one place and "Gwalior" in another — the pair is locked.
const STATE_OPTIONS = Array.from(
  new Set(CONSTITUENCIES.map((c) => c.state))
).sort();
const STATE_BY_CONSTITUENCY = new Map(
  CONSTITUENCIES.map((c) => [c.name, c.state] as const)
);
const CONSTITUENCIES_BY_STATE = STATE_OPTIONS.map((state) => ({
  state,
  names: CONSTITUENCIES.filter((c) => c.state === state).map((c) => c.name),
}));

// Shared <select> styling — matches the existing Role / Ministry dropdowns.
const SELECT_CLASS =
  "mt-1 w-full rounded-md border border-gray-200 bg-white px-2.5 py-2 text-sm focus:border-[#1a1a3e]/40 focus:outline-none";

export function ParticipantsClient({
  eventId,
  participants: initialParticipants,
  allocationLocked,
  canDelete = true,
  canManage = false,
  canEdit = false,
}: {
  eventId: string;
  participants: Participant[];
  allocationLocked: boolean;
  /** Chair/national/regional only. Organisers cannot delete records. */
  canDelete?: boolean;
  /** Organiser+ — gates the roster download and the full-roster reset. */
  canManage?: boolean;
  /** Chair/national/super-admin only — gates Add + Edit of participant fields. */
  canEdit?: boolean;
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
  // Day the in/out chips are scoped to. Default Day 1 so the counts line up
  // with the per-day header rather than an "either day" total that matches
  // neither day (the count that confused Directors during the live event).
  const [checkInDay, setCheckInDay] = useState<CheckInDay>("1");
  // Column filters (all = no filter). Party/committee match by number; role
  // matches the parliament_role value; state matches constituency_state.
  const [partyFilter, setPartyFilter] = useState<string>("all");
  const [roleFilter, setRoleFilter] = useState<string>("all");
  const [committeeFilter, setCommitteeFilter] = useState<string>("all");
  const [stateFilter, setStateFilter] = useState<string>("all");
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

  // Pick-lists scoped to THIS event so editing can only reassign within the
  // committees / parties that actually exist here — committee_number ↔ name
  // stay paired, parties stay valid. Derived from the roster, no extra fetch.
  const eventCommittees = useMemo(() => {
    const byNumber = new Map<number, string>();
    for (const p of participants) {
      if (p.committee_number != null && p.committee_name) {
        byNumber.set(p.committee_number, p.committee_name);
      }
    }
    return Array.from(byNumber.entries())
      .sort((a, b) => a[0] - b[0])
      .map(([number, name]) => ({ number, name }));
  }, [participants]);
  const eventParties = useMemo(() => {
    const nums = new Set<number>();
    for (const p of participants) {
      if (p.party_number != null) nums.add(p.party_number);
    }
    return Array.from(nums).sort((a, b) => a - b);
  }, [participants]);
  // Distinct roles & states present in this roster — drive the filter dropdowns.
  const eventRoles = useMemo(() => {
    const s = new Set<string>();
    for (const p of participants) if (p.parliament_role) s.add(p.parliament_role);
    return Array.from(s).sort((a, b) =>
      (ROLE_LABELS[a] ?? a).localeCompare(ROLE_LABELS[b] ?? b)
    );
  }, [participants]);
  const eventStates = useMemo(() => {
    const s = new Set<string>();
    for (const p of participants)
      if (p.constituency_state) s.add(p.constituency_state);
    return Array.from(s).sort();
  }, [participants]);

  const partyLabel = (n: number) =>
    n >= 1 && n <= 26 ? `Party ${String.fromCharCode(64 + n)}` : `Party ${n}`;

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

  // Edit participant (chair only) — full-field edit dialog. Works even when
  // allocation is locked (shows a "save anyway?" confirm instead of blocking).
  const [editOpen, setEditOpen] = useState(false);
  const [editLoading, setEditLoading] = useState(false);
  const [editError, setEditError] = useState("");
  const [editId, setEditId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState<EditFields>({
    full_name: "",
    class: "",
    school_name: "",
    constituency_name: "",
    constituency_number: "",
    constituency_state: "",
    party_number: "",
    committee_number: "",
    committee_name: "",
    parliament_role: "",
    ministry: "",
    serial_no: "",
    access_code: "",
  });

  function openEdit(p: Participant) {
    setEditId(p.id);
    setEditError("");
    setEditForm({
      full_name: p.full_name ?? "",
      class: p.class != null ? String(p.class) : "",
      school_name: p.school_name ?? "",
      constituency_name: p.constituency_name ?? "",
      constituency_number:
        p.constituency_number != null ? String(p.constituency_number) : "",
      constituency_state: p.constituency_state ?? "",
      party_number: p.party_number != null ? String(p.party_number) : "",
      committee_number:
        p.committee_number != null ? String(p.committee_number) : "",
      committee_name: p.committee_name ?? "",
      parliament_role: p.parliament_role ?? "",
      ministry: (p as { ministry?: string | null }).ministry ?? "",
      serial_no: (p as { serial_no?: number | null }).serial_no != null
        ? String((p as { serial_no?: number | null }).serial_no)
        : "",
      access_code: p.access_code ?? "",
    });
    setEditOpen(true);
  }

  async function handleSaveEdit() {
    if (!editId) return;
    if (!editForm.full_name.trim()) {
      setEditError("Student name is required");
      return;
    }
    // Allocation lock is a soft gate for the chair — confirm, don't block.
    if (
      allocationLocked &&
      !confirm("Allocation is locked — save anyway?")
    ) {
      return;
    }

    setEditLoading(true);
    setEditError("");

    const toIntOrNull = (s: string): number | null => {
      const t = s.trim();
      if (t === "") return null;
      const n = parseInt(t, 10);
      return Number.isFinite(n) ? n : null;
    };

    const result = await updateParticipant(editId, eventId, {
      full_name: editForm.full_name.trim(),
      class: toIntOrNull(editForm.class),
      school_name: editForm.school_name.trim(),
      constituency_name: editForm.constituency_name.trim(),
      constituency_number: toIntOrNull(editForm.constituency_number),
      constituency_state: editForm.constituency_state.trim(),
      party_number: toIntOrNull(editForm.party_number),
      committee_number: toIntOrNull(editForm.committee_number),
      committee_name: editForm.committee_name.trim(),
      parliament_role: (editForm.parliament_role || null) as never,
      ministry: (editForm.ministry || null) as never,
      serial_no: toIntOrNull(editForm.serial_no),
      access_code: editForm.access_code.trim(),
    });

    if (result.success) {
      setEditOpen(false);
      setEditId(null);
      toast.success("Participant updated.");
      router.refresh();
    } else {
      setEditError(result.error);
    }
    setEditLoading(false);
  }

  const filtersActive =
    checkInFilter !== "all" ||
    partyFilter !== "all" ||
    roleFilter !== "all" ||
    committeeFilter !== "all" ||
    stateFilter !== "all" ||
    search.trim() !== "";

  function clearFilters() {
    setCheckInFilter("all");
    setPartyFilter("all");
    setRoleFilter("all");
    setCommitteeFilter("all");
    setStateFilter("all");
    setSearch("");
  }

  // Filtered & sorted list
  const displayedParticipants = useMemo(() => {
    let filtered = participants;

    // Check-in filter
    if (checkInFilter === "in") {
      filtered = filtered.filter((p) => p.checked_in);
    } else if (checkInFilter === "out") {
      filtered = filtered.filter((p) => !p.checked_in);
    }
    // Column filters
    if (partyFilter !== "all")
      filtered = filtered.filter(
        (p) => String(p.party_number ?? "") === partyFilter
      );
    if (roleFilter !== "all")
      filtered = filtered.filter((p) => (p.parliament_role ?? "") === roleFilter);
    if (committeeFilter !== "all")
      filtered = filtered.filter(
        (p) => String(p.committee_number ?? "") === committeeFilter
      );
    if (stateFilter !== "all")
      filtered = filtered.filter(
        (p) => (p.constituency_state ?? "") === stateFilter
      );

    // Search filter (by name only — school is not shown or searchable)
    if (search.trim()) {
      const q = search.toLowerCase();
      filtered = filtered.filter((p) => p.full_name.toLowerCase().includes(q));
    }

    // Sort — type-aware: numbers numeric (nulls last), text alphabetical,
    // check-in by present-days score.
    const dir = sortAsc ? 1 : -1;
    const numCmp = (
      a: number | null | undefined,
      b: number | null | undefined
    ) => {
      const an = a == null;
      const bn = b == null;
      if (an && bn) return 0;
      if (an) return 1; // nulls always last, regardless of direction
      if (bn) return -1;
      return (a - b) * dir;
    };
    const strCmp = (a: string, b: string) => a.localeCompare(b) * dir;
    const checkScore = (p: Participant) =>
      (p.checked_in_day1 ? 2 : 0) + (p.checked_in_day2 ? 1 : 0);

    return [...filtered].sort((a, b) => {
      switch (sortKey) {
        case "party_number":
          return numCmp(a.party_number, b.party_number);
        case "constituency_number":
          return numCmp(a.constituency_number, b.constituency_number);
        case "committee_number":
          return numCmp(a.committee_number, b.committee_number);
        case "parliament_role":
          return strCmp(
            ROLE_LABELS[a.parliament_role ?? ""] ?? a.parliament_role ?? "",
            ROLE_LABELS[b.parliament_role ?? ""] ?? b.parliament_role ?? ""
          );
        case "constituency_name":
          return strCmp(a.constituency_name ?? "", b.constituency_name ?? "");
        case "constituency_state":
          return strCmp(a.constituency_state ?? "", b.constituency_state ?? "");
        case "checkin":
          return (checkScore(a) - checkScore(b)) * dir;
        case "full_name":
        default:
          return strCmp(a.full_name ?? "", b.full_name ?? "");
      }
    });
  }, [
    participants,
    checkInFilter,
    partyFilter,
    roleFilter,
    committeeFilter,
    stateFilter,
    search,
    sortKey,
    sortAsc,
  ]);

  function handleSort(key: SortKey) {
    if (sortKey === key) {
      setSortAsc(!sortAsc);
    } else {
      setSortKey(key);
      setSortAsc(true);
    }
  }

  // Clickable, sort-aware column header. Highlights the active column and shows
  // the current direction.
  function sortHead(label: string, key: SortKey, className?: string) {
    const active = sortKey === key;
    return (
      <TableHead className={className}>
        <button
          onClick={() => handleSort(key)}
          className={`flex items-center gap-1 hover:text-gray-900 ${
            active ? "font-semibold text-gray-900" : ""
          }`}
        >
          {label}
          <ArrowUpDown
            className={`size-3 ${active ? "opacity-100" : "opacity-40"}`}
          />
        </button>
      </TableHead>
    );
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

          {canEdit && (
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
          )}

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

      {/* Column filters */}
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-xs font-medium text-[#1a1a3e]/50">Filter:</span>
        <select
          value={partyFilter}
          onChange={(e) => setPartyFilter(e.target.value)}
          className="rounded-md border border-gray-200 bg-white px-2 py-1 text-xs text-[#1a1a3e]/80 focus:border-[#1a1a3e]/40 focus:outline-none"
        >
          <option value="all">All parties</option>
          {eventParties.map((n) => (
            <option key={n} value={String(n)}>
              {partyLabel(n)}
            </option>
          ))}
        </select>
        <select
          value={roleFilter}
          onChange={(e) => setRoleFilter(e.target.value)}
          className="rounded-md border border-gray-200 bg-white px-2 py-1 text-xs text-[#1a1a3e]/80 focus:border-[#1a1a3e]/40 focus:outline-none"
        >
          <option value="all">All roles</option>
          {eventRoles.map((r) => (
            <option key={r} value={r}>
              {ROLE_LABELS[r] ?? r}
            </option>
          ))}
        </select>
        <select
          value={committeeFilter}
          onChange={(e) => setCommitteeFilter(e.target.value)}
          className="rounded-md border border-gray-200 bg-white px-2 py-1 text-xs text-[#1a1a3e]/80 focus:border-[#1a1a3e]/40 focus:outline-none"
        >
          <option value="all">All committees</option>
          {eventCommittees.map((c) => (
            <option key={c.number} value={String(c.number)}>
              {c.number} · {c.name.replace(/^Ministry of /i, "")}
            </option>
          ))}
        </select>
        <select
          value={stateFilter}
          onChange={(e) => setStateFilter(e.target.value)}
          className="rounded-md border border-gray-200 bg-white px-2 py-1 text-xs text-[#1a1a3e]/80 focus:border-[#1a1a3e]/40 focus:outline-none"
        >
          <option value="all">All states</option>
          {eventStates.map((s) => (
            <option key={s} value={s}>
              {s}
            </option>
          ))}
        </select>
        <span className="text-xs text-[#1a1a3e]/50">
          {displayedParticipants.length} shown
        </span>
        {filtersActive && (
          <button
            onClick={clearFilters}
            className="text-xs text-[#1a1a3e]/60 underline-offset-2 hover:underline"
          >
            Clear filters
          </button>
        )}
      </div>

      {/* Table */}
      {displayedParticipants.length > 0 ? (
        <div className="rounded-lg border bg-white">
          <Table>
            <TableHeader>
              <TableRow>
                {sortHead("Check-in (D1 / D2)", "checkin", "w-32")}
                {sortHead("Name", "full_name")}
                {sortHead("Party", "party_number", "w-16")}
                {sortHead("Role", "parliament_role")}
                {sortHead("Const. No.", "constituency_number", "w-20")}
                {sortHead("Constituency", "constituency_name")}
                {sortHead("State", "constituency_state")}
                {sortHead("Committee", "committee_number")}
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
                    <div className="flex items-center gap-0.5">
                      {canEdit && (
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            openEdit(p);
                          }}
                          className="rounded p-1 text-gray-400 hover:bg-[#1a1a3e]/5 hover:text-[#1a1a3e]"
                          title="Edit participant"
                        >
                          <Pencil className="size-4" />
                        </button>
                      )}
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
                    </div>
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
            {filtersActive
              ? "No participants match your filters"
              : "No participants yet"}
          </h3>
          <p className="mt-1 text-xs text-gray-500">
            {filtersActive
              ? "Try a different search term or filter"
              : "Add students individually or import from CSV"}
          </p>
        </div>
      )}

      {/* Edit participant — chair only. Edits every field of the participants
          row (the one the jury, student app, Allocation and Results all read).
          Works even when allocation is locked: a "save anyway?" confirm is shown
          on save rather than blocking the edit. */}
      {canEdit && (
        <Dialog
          open={editOpen}
          onOpenChange={(open) => {
            setEditOpen(open);
            if (!open) {
              setEditId(null);
              setEditError("");
            }
          }}
        >
          <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-lg">
            <DialogHeader>
              <DialogTitle>Edit participant</DialogTitle>
              <DialogDescription>
                Change any field. Updates apply everywhere — jury, student app,
                allocation and results — automatically.
              </DialogDescription>
            </DialogHeader>

            {allocationLocked && (
              <div className="rounded-lg border border-amber-200 bg-amber-50 p-2 text-xs text-amber-800">
                Allocation is locked. You can still save — you&apos;ll be asked
                to confirm.
              </div>
            )}

            {editError && (
              <div className="rounded-lg border border-red-200 bg-red-50 p-2 text-xs text-red-700">
                {editError}
              </div>
            )}

            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div className="sm:col-span-2">
                <Label htmlFor="edit-name">Full Name *</Label>
                <Input
                  id="edit-name"
                  value={editForm.full_name}
                  onChange={(e) =>
                    setEditForm((p) => ({ ...p, full_name: e.target.value }))
                  }
                  placeholder="Student full name"
                />
              </div>

              <div>
                <Label htmlFor="edit-class">Class (9–12)</Label>
                <Input
                  id="edit-class"
                  type="number"
                  value={editForm.class}
                  onChange={(e) =>
                    setEditForm((p) => ({ ...p, class: e.target.value }))
                  }
                  placeholder="10"
                />
              </div>
              <div>
                <Label htmlFor="edit-school">School</Label>
                <Input
                  id="edit-school"
                  value={editForm.school_name}
                  onChange={(e) =>
                    setEditForm((p) => ({ ...p, school_name: e.target.value }))
                  }
                  placeholder="Hidden for privacy — type only to change"
                />
                <p className="mt-1 text-xs text-muted-foreground">
                  Left blank keeps the current school; type a value to replace it.
                </p>
              </div>

              <div>
                <Label htmlFor="edit-const-name">Constituency</Label>
                <select
                  id="edit-const-name"
                  value={editForm.constituency_name}
                  onChange={(e) => {
                    const name = e.target.value;
                    setEditForm((p) => ({
                      ...p,
                      constituency_name: name,
                      // Auto-fill the state from the canonical list so the two
                      // can never drift apart. Keep the old state if cleared.
                      constituency_state:
                        STATE_BY_CONSTITUENCY.get(name) ?? p.constituency_state,
                    }));
                  }}
                  className={SELECT_CLASS}
                >
                  <option value="">— Select constituency —</option>
                  {/* Preserve a current value that isn't in the canonical list
                      (legacy data) so editing never silently changes it. */}
                  {editForm.constituency_name &&
                    !STATE_BY_CONSTITUENCY.has(editForm.constituency_name) && (
                      <option value={editForm.constituency_name}>
                        {editForm.constituency_name} (current)
                      </option>
                    )}
                  {CONSTITUENCIES_BY_STATE.map((g) => (
                    <optgroup key={g.state} label={g.state}>
                      {g.names.map((name) => (
                        <option key={name} value={name}>
                          {name}
                        </option>
                      ))}
                    </optgroup>
                  ))}
                </select>
              </div>
              <div>
                <Label htmlFor="edit-const-no">Constituency No.</Label>
                <Input
                  id="edit-const-no"
                  type="number"
                  value={editForm.constituency_number}
                  onChange={(e) =>
                    setEditForm((p) => ({
                      ...p,
                      constituency_number: e.target.value,
                    }))
                  }
                  placeholder="101"
                />
              </div>
              <div>
                <Label htmlFor="edit-const-state">Constituency State/UT</Label>
                <select
                  id="edit-const-state"
                  value={editForm.constituency_state}
                  onChange={(e) =>
                    setEditForm((p) => ({
                      ...p,
                      constituency_state: e.target.value,
                    }))
                  }
                  className={SELECT_CLASS}
                >
                  <option value="">— Select state/UT —</option>
                  {editForm.constituency_state &&
                    !STATE_OPTIONS.includes(editForm.constituency_state) && (
                      <option value={editForm.constituency_state}>
                        {editForm.constituency_state} (current)
                      </option>
                    )}
                  {STATE_OPTIONS.map((s) => (
                    <option key={s} value={s}>
                      {s}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <Label htmlFor="edit-party-no">Party</Label>
                <select
                  id="edit-party-no"
                  value={editForm.party_number}
                  onChange={(e) =>
                    setEditForm((p) => ({ ...p, party_number: e.target.value }))
                  }
                  className={SELECT_CLASS}
                >
                  <option value="">— Select party —</option>
                  {editForm.party_number &&
                    !eventParties.includes(Number(editForm.party_number)) && (
                      <option value={editForm.party_number}>
                        {(() => {
                          const n = Number(editForm.party_number);
                          return n >= 1 && n <= 26
                            ? `Party ${String.fromCharCode(64 + n)}`
                            : `Party ${editForm.party_number}`;
                        })()} (current)
                      </option>
                    )}
                  {eventParties.map((n) => (
                    <option key={n} value={String(n)}>
                      {n >= 1 && n <= 26
                        ? `Party ${String.fromCharCode(64 + n)}`
                        : `Party ${n}`}
                    </option>
                  ))}
                </select>
              </div>

              <div className="sm:col-span-2">
                <Label htmlFor="edit-cmte-name">Committee</Label>
                <select
                  id="edit-cmte-name"
                  // Bound to the committee NUMBER; picking one sets the matching
                  // name too, so number ↔ name can never disagree.
                  value={editForm.committee_number}
                  onChange={(e) => {
                    const num = e.target.value;
                    const found = eventCommittees.find(
                      (c) => String(c.number) === num
                    );
                    setEditForm((p) => ({
                      ...p,
                      committee_number: num,
                      committee_name: found?.name ?? p.committee_name,
                    }));
                  }}
                  className={SELECT_CLASS}
                >
                  <option value="">— Select committee —</option>
                  {editForm.committee_number &&
                    !eventCommittees.some(
                      (c) => String(c.number) === editForm.committee_number
                    ) && (
                      <option value={editForm.committee_number}>
                        {editForm.committee_number} · {editForm.committee_name}{" "}
                        (current)
                      </option>
                    )}
                  {eventCommittees.map((c) => (
                    <option key={c.number} value={String(c.number)}>
                      {c.number} · {c.name}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <Label htmlFor="edit-role">Parliament Role</Label>
                <select
                  id="edit-role"
                  value={editForm.parliament_role}
                  onChange={(e) =>
                    setEditForm((p) => ({
                      ...p,
                      parliament_role: e.target.value,
                      // Clear ministry when leaving a minister role.
                      ministry:
                        e.target.value === "cabinet_minister" ||
                        e.target.value === "shadow_minister"
                          ? p.ministry
                          : "",
                    }))
                  }
                  className="mt-1 w-full rounded-md border border-gray-200 bg-white px-2.5 py-2 text-sm focus:border-[#1a1a3e]/40 focus:outline-none"
                >
                  <option value="">— None —</option>
                  {ROLE_OPTIONS.map(([value, label]) => (
                    <option key={value} value={value}>
                      {label}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <Label htmlFor="edit-ministry">Ministry</Label>
                <select
                  id="edit-ministry"
                  value={editForm.ministry}
                  disabled={
                    editForm.parliament_role !== "cabinet_minister" &&
                    editForm.parliament_role !== "shadow_minister"
                  }
                  onChange={(e) =>
                    setEditForm((p) => ({ ...p, ministry: e.target.value }))
                  }
                  className="mt-1 w-full rounded-md border border-gray-200 bg-white px-2.5 py-2 text-sm focus:border-[#1a1a3e]/40 focus:outline-none disabled:bg-gray-50 disabled:text-gray-400"
                >
                  <option value="">— None —</option>
                  {MINISTRY_OPTIONS.map(([value, label]) => (
                    <option key={value} value={value}>
                      {label}
                    </option>
                  ))}
                </select>
              </div>

              {/* Serial No. is the roster's auto row-counter, not an identity —
                  it's never chair-editable. The current value is preserved on
                  save (carried unchanged in editForm.serial_no). */}
              <div>
                <Label htmlFor="edit-code">Access Code</Label>
                <Input
                  id="edit-code"
                  value={editForm.access_code}
                  onChange={(e) =>
                    setEditForm((p) => ({ ...p, access_code: e.target.value }))
                  }
                  placeholder="Access code"
                />
              </div>
            </div>

            <DialogFooter>
              <DialogClose render={<Button variant="outline" />}>
                Cancel
              </DialogClose>
              <Button
                className="bg-[#FF9933] text-white hover:bg-[#E68A2E]"
                onClick={handleSaveEdit}
                disabled={editLoading}
              >
                {editLoading ? (
                  <Loader2 className="size-4 animate-spin" />
                ) : (
                  <Check className="size-4" />
                )}
                {editLoading ? "Saving..." : "Save changes"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}
