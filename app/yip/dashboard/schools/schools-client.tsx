"use client";

import { useState, useTransition } from "react";
import { Badge } from "@/components/yip/ui/badge";
import { Button } from "@/components/yip/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/yip/ui/card";
import { Input } from "@/components/yip/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/yip/ui/table";
import {
  Plus,
  Pencil,
  Trash2,
  School,
  Leaf,
  Search,
  Loader2,
  CheckCircle2,
} from "lucide-react";
import {
  createSchool,
  updateSchool,
  deleteSchool,
  type School as SchoolRow,
} from "@/app/yip/actions/schools";

type EnrichedSchool = SchoolRow & {
  total_participations: number;
  events_count: number;
};

type FormState = Omit<SchoolRow, "id" | "created_at">;

const EMPTY_FORM: FormState = {
  name: "",
  city: null,
  state: null,
  is_thalir: false,
  contact_person: null,
  contact_phone: null,
  contact_email: null,
  notes: null,
};

export function SchoolsClient({
  initialSchools,
}: {
  initialSchools: EnrichedSchool[];
}) {
  const [schools, setSchools] = useState(initialSchools);
  const [query, setQuery] = useState("");
  const [editing, setEditing] = useState<EnrichedSchool | null>(null);
  const [creating, setCreating] = useState(false);
  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [flash, setFlash] = useState<string | null>(null);

  const filtered = schools.filter((s) => {
    if (!query.trim()) return true;
    const q = query.toLowerCase();
    return (
      s.name.toLowerCase().includes(q) ||
      s.city?.toLowerCase().includes(q) ||
      s.state?.toLowerCase().includes(q)
    );
  });

  const thalirCount = schools.filter((s) => s.is_thalir).length;
  const totalParticipations = schools.reduce(
    (sum, s) => sum + s.total_participations,
    0
  );

  function openCreate() {
    setForm(EMPTY_FORM);
    setEditing(null);
    setCreating(true);
    setError(null);
  }

  function openEdit(s: EnrichedSchool) {
    setForm({
      name: s.name,
      city: s.city,
      state: s.state,
      is_thalir: s.is_thalir,
      contact_person: s.contact_person,
      contact_phone: s.contact_phone,
      contact_email: s.contact_email,
      notes: s.notes,
    });
    setEditing(s);
    setCreating(false);
    setError(null);
  }

  function closeForm() {
    setEditing(null);
    setCreating(false);
    setError(null);
  }

  function submit() {
    setError(null);
    if (!form.name.trim()) {
      setError("School name is required.");
      return;
    }

    startTransition(async () => {
      if (editing) {
        const result = await updateSchool(editing.id, form);
        if (!result.success) {
          setError(result.error);
          return;
        }
        setSchools((prev) =>
          prev.map((s) =>
            s.id === editing.id ? { ...s, ...result.data } : s
          )
        );
        setFlash(`Updated ${form.name}`);
      } else {
        const result = await createSchool(form);
        if (!result.success) {
          setError(result.error);
          return;
        }
        setSchools((prev) => [
          { ...result.data, total_participations: 0, events_count: 0 },
          ...prev,
        ]);
        setFlash(`Added ${form.name}`);
      }
      closeForm();
      setTimeout(() => setFlash(null), 2500);
    });
  }

  function handleDelete(s: EnrichedSchool) {
    if (!confirm(`Delete "${s.name}"? Participants will keep their existing school_name text.`))
      return;
    startTransition(async () => {
      const result = await deleteSchool(s.id);
      if (!result.success) {
        setError(result.error);
        return;
      }
      setSchools((prev) => prev.filter((x) => x.id !== s.id));
      setFlash(`Removed ${s.name}`);
      setTimeout(() => setFlash(null), 2500);
    });
  }

  const showForm = creating || editing !== null;

  return (
    <div className="max-w-[1400px] mx-auto px-6 py-8 space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between gap-6">
        <div>
          <h1 className="text-3xl font-bold text-[#1a1a3e] tracking-tight">Schools</h1>
          <p className="text-sm text-[#1a1a3e]/60 mt-1">
            Thalir &amp; partner schools across all YIP events
          </p>
        </div>
        <Button
          onClick={openCreate}
          className="bg-[#FF9933] hover:bg-[#FF9933]/90 text-white shadow-sm"
        >
          <Plus className="size-4 mr-2" /> Add School
        </Button>
      </div>

      {/* Stat row */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardContent className="pt-5">
            <div className="flex items-center gap-3">
              <div className="size-9 rounded-lg bg-[#FF9933]/10 flex items-center justify-center">
                <School className="size-5 text-[#FF9933]" />
              </div>
              <div>
                <div className="text-2xl font-bold text-[#1a1a3e]">{schools.length}</div>
                <div className="text-xs text-[#1a1a3e]/60">Total Schools</div>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-5">
            <div className="flex items-center gap-3">
              <div className="size-9 rounded-lg bg-[#138808]/10 flex items-center justify-center">
                <Leaf className="size-5 text-[#138808]" />
              </div>
              <div>
                <div className="text-2xl font-bold text-[#1a1a3e]">{thalirCount}</div>
                <div className="text-xs text-[#1a1a3e]/60">Thalir-affiliated</div>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-5">
            <div className="flex items-center gap-3">
              <div className="size-9 rounded-lg bg-[#1a1a3e]/10 flex items-center justify-center">
                <CheckCircle2 className="size-5 text-[#1a1a3e]" />
              </div>
              <div>
                <div className="text-2xl font-bold text-[#1a1a3e]">{totalParticipations}</div>
                <div className="text-xs text-[#1a1a3e]/60">Nominations sent</div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Flash */}
      {flash && (
        <div className="rounded-lg bg-[#138808]/8 border border-[#138808]/15 px-4 py-2 text-sm text-[#138808]">
          {flash}
        </div>
      )}

      {/* Search */}
      <div className="relative max-w-sm">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-[#1a1a3e]/40" />
        <Input
          placeholder="Search by name, city, state…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          className="pl-9"
        />
      </div>

      {/* Create/Edit form */}
      {showForm && (
        <Card className="border-[#FF9933]/30">
          <CardHeader>
            <CardTitle className="text-lg">
              {editing ? `Edit: ${editing.name}` : "Add a School"}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="text-xs font-medium text-[#1a1a3e]/70">Name *</label>
                <Input
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  placeholder="Bharathidasan Higher Sec."
                />
              </div>
              <div>
                <label className="text-xs font-medium text-[#1a1a3e]/70">City</label>
                <Input
                  value={form.city ?? ""}
                  onChange={(e) => setForm({ ...form, city: e.target.value || null })}
                  placeholder="Erode"
                />
              </div>
              <div>
                <label className="text-xs font-medium text-[#1a1a3e]/70">State</label>
                <Input
                  value={form.state ?? ""}
                  onChange={(e) => setForm({ ...form, state: e.target.value || null })}
                  placeholder="Tamil Nadu"
                />
              </div>
              <div className="flex items-center gap-2 pt-5">
                <input
                  type="checkbox"
                  id="is_thalir"
                  checked={form.is_thalir}
                  onChange={(e) => setForm({ ...form, is_thalir: e.target.checked })}
                  className="size-4"
                />
                <label htmlFor="is_thalir" className="text-sm">
                  Thalir-affiliated school
                </label>
              </div>
              <div>
                <label className="text-xs font-medium text-[#1a1a3e]/70">Contact Person</label>
                <Input
                  value={form.contact_person ?? ""}
                  onChange={(e) =>
                    setForm({ ...form, contact_person: e.target.value || null })
                  }
                />
              </div>
              <div>
                <label className="text-xs font-medium text-[#1a1a3e]/70">Contact Phone</label>
                <Input
                  value={form.contact_phone ?? ""}
                  onChange={(e) =>
                    setForm({ ...form, contact_phone: e.target.value || null })
                  }
                />
              </div>
              <div className="md:col-span-2">
                <label className="text-xs font-medium text-[#1a1a3e]/70">Contact Email</label>
                <Input
                  type="email"
                  value={form.contact_email ?? ""}
                  onChange={(e) =>
                    setForm({ ...form, contact_email: e.target.value || null })
                  }
                />
              </div>
            </div>

            {error && (
              <div className="rounded-lg bg-red-50 border border-red-200 px-3 py-2 text-sm text-red-700">
                {error}
              </div>
            )}

            <div className="flex gap-2 justify-end">
              <Button variant="outline" onClick={closeForm} disabled={pending}>
                Cancel
              </Button>
              <Button
                onClick={submit}
                disabled={pending}
                className="bg-[#FF9933] hover:bg-[#FF9933]/90 text-white"
              >
                {pending && <Loader2 className="size-4 mr-2 animate-spin" />}
                {editing ? "Save Changes" : "Add School"}
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Table */}
      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>School</TableHead>
                <TableHead>Location</TableHead>
                <TableHead>Contact</TableHead>
                <TableHead className="text-right">Events</TableHead>
                <TableHead className="text-right">Nominations</TableHead>
                <TableHead className="w-24"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.length === 0 && (
                <TableRow>
                  <TableCell colSpan={6} className="text-center text-sm text-[#1a1a3e]/50 py-12">
                    {schools.length === 0
                      ? "No schools yet. Click Add School to start."
                      : "No schools match your search."}
                  </TableCell>
                </TableRow>
              )}
              {filtered.map((s) => (
                <TableRow key={s.id}>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <span className="font-medium text-[#1a1a3e]">{s.name}</span>
                      {s.is_thalir && (
                        <Badge className="bg-[#138808]/10 text-[#138808] border border-[#138808]/20">
                          <Leaf className="size-3 mr-1" /> Thalir
                        </Badge>
                      )}
                    </div>
                  </TableCell>
                  <TableCell className="text-sm text-[#1a1a3e]/70">
                    {[s.city, s.state].filter(Boolean).join(", ") || "—"}
                  </TableCell>
                  <TableCell className="text-sm">
                    <div>{s.contact_person ?? "—"}</div>
                    <div className="text-xs text-[#1a1a3e]/60">{s.contact_phone ?? ""}</div>
                  </TableCell>
                  <TableCell className="text-right font-mono text-sm">
                    {s.events_count}
                  </TableCell>
                  <TableCell className="text-right font-mono text-sm">
                    {s.total_participations}
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-1 justify-end">
                      <Button
                        size="icon"
                        variant="ghost"
                        onClick={() => openEdit(s)}
                        disabled={pending}
                      >
                        <Pencil className="size-4" />
                      </Button>
                      <Button
                        size="icon"
                        variant="ghost"
                        onClick={() => handleDelete(s)}
                        disabled={pending}
                        className="text-red-600 hover:bg-red-50"
                      >
                        <Trash2 className="size-4" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
