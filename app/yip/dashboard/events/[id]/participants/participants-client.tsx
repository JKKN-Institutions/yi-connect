"use client";

import { useState, useMemo } from "react";
import { useRouter } from "next/navigation";
import {
  addParticipant,
  deleteParticipant,
  checkInParticipant,
  checkOutParticipant,
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
} from "lucide-react";
import { CsvImport } from "@/components/yip/csv-import";

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
  parliament_role: string | null;
  committee_name: string | null;
  access_code: string;
  checked_in: boolean | null;
  checked_in_at: string | null;
};

type SortKey = "full_name" | "school_name" | "class";

export function ParticipantsClient({
  eventId,
  participants: initialParticipants,
  allocationLocked,
  canDelete = true,
}: {
  eventId: string;
  participants: Participant[];
  allocationLocked: boolean;
  /** Chair/national/regional only. Organisers cannot delete records. */
  canDelete?: boolean;
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

  // Derived: checked-in count
  const checkedInCount = initialParticipants.filter((p) => p.checked_in).length;

  // Form state
  const [formData, setFormData] = useState({
    full_name: "",
    school_name: "",
    class: 10,
    phone: "",
    email: "",
    city: "",
    home_state: "",
  });

  // Filtered & sorted list
  const displayedParticipants = useMemo(() => {
    let filtered = initialParticipants;

    // Search filter
    if (search.trim()) {
      const q = search.toLowerCase();
      filtered = filtered.filter(
        (p) =>
          p.full_name.toLowerCase().includes(q) ||
          p.school_name.toLowerCase().includes(q)
      );
    }

    // Sort
    return [...filtered].sort((a, b) => {
      let cmp = 0;
      if (sortKey === "class") {
        cmp = a.class - b.class;
      } else {
        cmp = (a[sortKey] || "").localeCompare(b[sortKey] || "");
      }
      return sortAsc ? cmp : -cmp;
    });
  }, [initialParticipants, search, sortKey, sortAsc]);

  function handleSort(key: SortKey) {
    if (sortKey === key) {
      setSortAsc(!sortAsc);
    } else {
      setSortKey(key);
      setSortAsc(true);
    }
  }

  async function handleAddParticipant() {
    if (!formData.full_name.trim() || !formData.school_name.trim()) {
      setError("Name and school are required");
      return;
    }

    setLoading(true);
    setError("");

    const result = await addParticipant(eventId, {
      full_name: formData.full_name.trim(),
      school_name: formData.school_name.trim(),
      class: formData.class,
      phone: formData.phone.trim() || undefined,
      email: formData.email.trim() || undefined,
      city: formData.city.trim() || undefined,
      home_state: formData.home_state.trim() || undefined,
    });

    if (result.success) {
      setDialogOpen(false);
      setFormData({
        full_name: "",
        school_name: "",
        class: 10,
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

  async function handleToggleCheckIn(participant: Participant) {
    setCheckingIn((prev) => new Set(prev).add(participant.id));

    const result = participant.checked_in
      ? await checkOutParticipant(participant.id, eventId)
      : await checkInParticipant(participant.id, eventId);

    if (result.success) {
      router.refresh();
    } else {
      alert(result.error);
    }

    setCheckingIn((prev) => {
      const next = new Set(prev);
      next.delete(participant.id);
      return next;
    });
  }

  async function handleBulkCheckInAll() {
    const unchecked = initialParticipants
      .filter((p) => !p.checked_in)
      .map((p) => p.id);

    if (unchecked.length === 0) return;

    setLoading(true);
    const result = await bulkCheckIn(unchecked, eventId);
    if (result.success) {
      router.refresh();
    } else {
      alert(result.error);
    }
    setLoading(false);
  }

  function handleExportCsv() {
    const headers = [
      "Name",
      "School",
      "Class",
      "Phone",
      "Email",
      "City",
      "State",
      "Party",
      "Role",
      "Committee",
      "Access Code",
      "Checked In",
      "Checked In At",
    ];
    const rows = initialParticipants.map((p) => [
      p.full_name,
      p.school_name,
      p.class.toString(),
      p.phone || "",
      p.email || "",
      p.city || "",
      p.home_state || "",
      p.party_side || "",
      p.parliament_role || "",
      p.committee_name || "",
      p.access_code,
      p.checked_in ? "Yes" : "No",
      p.checked_in_at || "",
    ]);

    const csv = [headers, ...rows].map((r) => r.map((c) => `"${c}"`).join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `participants-${eventId}.csv`;
    a.click();
    URL.revokeObjectURL(url);
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
            {checkedInCount} of {initialParticipants.length} checked in
          </span>
        </div>
        <div className="flex items-center gap-2">
          {checkedInCount < initialParticipants.length && initialParticipants.length > 0 && (
            <Button
              variant="outline"
              size="sm"
              onClick={handleBulkCheckInAll}
              disabled={loading}
            >
              <UserCheck className="size-4" />
              Check In All
            </Button>
          )}

          <CsvImport eventId={eventId} onImported={() => router.refresh()} />

          <Button variant="outline" size="sm" onClick={handleExportCsv}>
            <Download className="size-4" />
            Export CSV
          </Button>

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
                  />
                </div>
                <div>
                  <Label htmlFor="add-school">School Name *</Label>
                  <Input
                    id="add-school"
                    value={formData.school_name}
                    onChange={(e) =>
                      setFormData((prev) => ({
                        ...prev,
                        school_name: e.target.value,
                      }))
                    }
                    placeholder="School name"
                  />
                </div>
                <div>
                  <Label htmlFor="add-class">Class *</Label>
                  <select
                    id="add-class"
                    value={formData.class}
                    onChange={(e) =>
                      setFormData((prev) => ({
                        ...prev,
                        class: Number(e.target.value),
                      }))
                    }
                    className="flex h-8 w-full rounded-lg border border-input bg-transparent px-2.5 py-1 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
                  >
                    {[9, 10, 11, 12].map((c) => (
                      <option key={c} value={c}>
                        Class {c}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <Label htmlFor="add-phone">Phone</Label>
                    <Input
                      id="add-phone"
                      value={formData.phone}
                      onChange={(e) =>
                        setFormData((prev) => ({
                          ...prev,
                          phone: e.target.value,
                        }))
                      }
                      placeholder="Phone number"
                    />
                  </div>
                  <div>
                    <Label htmlFor="add-email">Email</Label>
                    <Input
                      id="add-email"
                      type="email"
                      value={formData.email}
                      onChange={(e) =>
                        setFormData((prev) => ({
                          ...prev,
                          email: e.target.value,
                        }))
                      }
                      placeholder="Email"
                    />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <Label htmlFor="add-city">City</Label>
                    <Input
                      id="add-city"
                      value={formData.city}
                      onChange={(e) =>
                        setFormData((prev) => ({
                          ...prev,
                          city: e.target.value,
                        }))
                      }
                      placeholder="City"
                    />
                  </div>
                  <div>
                    <Label htmlFor="add-state">State</Label>
                    <Input
                      id="add-state"
                      value={formData.home_state}
                      onChange={(e) =>
                        setFormData((prev) => ({
                          ...prev,
                          home_state: e.target.value,
                        }))
                      }
                      placeholder="State"
                    />
                  </div>
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
        </div>
      </div>

      {/* Search bar */}
      <div className="relative max-w-sm">
        <Search className="absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-gray-400" />
        <Input
          placeholder="Search by name or school..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="pl-8"
        />
      </div>

      {/* Table */}
      {displayedParticipants.length > 0 ? (
        <div className="rounded-lg border bg-white">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-20">Check-in</TableHead>
                <TableHead>
                  <button
                    onClick={() => handleSort("full_name")}
                    className="flex items-center gap-1 hover:text-gray-900"
                  >
                    Name
                    <ArrowUpDown className="size-3" />
                  </button>
                </TableHead>
                <TableHead>
                  <button
                    onClick={() => handleSort("school_name")}
                    className="flex items-center gap-1 hover:text-gray-900"
                  >
                    School
                    <ArrowUpDown className="size-3" />
                  </button>
                </TableHead>
                <TableHead>
                  <button
                    onClick={() => handleSort("class")}
                    className="flex items-center gap-1 hover:text-gray-900"
                  >
                    Class
                    <ArrowUpDown className="size-3" />
                  </button>
                </TableHead>
                <TableHead>Party</TableHead>
                <TableHead>Role</TableHead>
                <TableHead>Committee</TableHead>
                <TableHead>Access Code</TableHead>
                <TableHead className="w-10" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {displayedParticipants.map((p) => (
                <TableRow key={p.id}>
                  <TableCell>
                    <button
                      onClick={() => handleToggleCheckIn(p)}
                      disabled={checkingIn.has(p.id)}
                      className="flex items-center gap-1.5 rounded-md px-2 py-1 text-xs font-medium transition-colors hover:bg-gray-50 disabled:opacity-50"
                      title={p.checked_in ? "Click to check out" : "Click to check in"}
                    >
                      {checkingIn.has(p.id) ? (
                        <Loader2 className="size-3.5 animate-spin text-gray-400" />
                      ) : p.checked_in ? (
                        <span className="size-2.5 rounded-full bg-green-500" />
                      ) : (
                        <span className="size-2.5 rounded-full bg-gray-300" />
                      )}
                      <span className={p.checked_in ? "text-green-700" : "text-gray-500"}>
                        {p.checked_in ? "In" : "Out"}
                      </span>
                    </button>
                  </TableCell>
                  <TableCell className="font-medium">{p.full_name}</TableCell>
                  <TableCell>{p.school_name}</TableCell>
                  <TableCell>{p.class}</TableCell>
                  <TableCell>
                    {p.party_side ? (
                      <Badge
                        variant="secondary"
                        className={
                          PARTY_COLORS[p.party_side as keyof typeof PARTY_COLORS]
                            ?.badge ?? "bg-gray-100 text-gray-700"
                        }
                      >
                        {p.party_side === "ruling" ? "Ruling" : "Opposition"}
                      </Badge>
                    ) : (
                      <span className="text-gray-400">--</span>
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
                    {p.committee_name ? (
                      <span className="text-xs">{p.committee_name}</span>
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
                        onClick={() => handleCopy(p.access_code, p.id)}
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
                        onClick={() => handleDelete(p.id)}
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
            {search ? "No participants match your search" : "No participants yet"}
          </h3>
          <p className="mt-1 text-xs text-gray-500">
            {search
              ? "Try a different search term"
              : "Add students individually or import from CSV"}
          </p>
        </div>
      )}
    </div>
  );
}
