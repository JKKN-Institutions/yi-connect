"use client";

import { useState, useTransition, useMemo } from "react";
import Link from "next/link";
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
  Users,
  Plus,
  Pencil,
  Archive,
  RotateCcw,
  Merge,
  Loader2,
  Search,
  ArrowUpRight,
} from "lucide-react";
import {
  createPerson,
  updatePerson,
  archivePerson,
  restorePerson,
  mergePeople,
  type Person,
} from "@/app/actions/yip/people";

type FormState = {
  full_name: string;
  phone: string;
  email: string;
  parent_phone: string;
  class: string;
  section: string;
  school_name: string;
  home_state: string;
  city: string;
  photo_url: string;
  bio: string;
  notes: string;
};

const EMPTY: FormState = {
  full_name: "",
  phone: "",
  email: "",
  parent_phone: "",
  class: "",
  section: "",
  school_name: "",
  home_state: "",
  city: "",
  photo_url: "",
  bio: "",
  notes: "",
};

export function PeopleAdminClient({
  initialPeople,
}: {
  initialPeople: Person[];
}) {
  const [people, setPeople] = useState(initialPeople);
  const [query, setQuery] = useState("");
  const [showInactive, setShowInactive] = useState(false);
  const [editing, setEditing] = useState<Person | null>(null);
  const [creating, setCreating] = useState(false);
  const [form, setForm] = useState<FormState>(EMPTY);
  const [merging, setMerging] = useState<Person | null>(null);
  const [mergeTargetId, setMergeTargetId] = useState<string>("");
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [flash, setFlash] = useState<string | null>(null);

  const filtered = useMemo(() => {
    return people.filter((p) => {
      if (!showInactive && !p.is_active) return false;
      if (!query.trim()) return true;
      const q = query.toLowerCase();
      return (
        p.full_name.toLowerCase().includes(q) ||
        (p.phone ?? "").includes(q) ||
        (p.email ?? "").toLowerCase().includes(q) ||
        (p.school_name ?? "").toLowerCase().includes(q) ||
        (p.home_state ?? "").toLowerCase().includes(q)
      );
    });
  }, [people, query, showInactive]);

  const stats = {
    total: people.length,
    active: people.filter((p) => p.is_active).length,
    with_phone: people.filter((p) => p.phone).length,
    with_email: people.filter((p) => p.email).length,
  };

  function openCreate() {
    setForm(EMPTY);
    setEditing(null);
    setCreating(true);
    setError(null);
  }

  function openEdit(p: Person) {
    setForm({
      full_name: p.full_name,
      phone: p.phone ?? "",
      email: p.email ?? "",
      parent_phone: p.parent_phone ?? "",
      class: p.class?.toString() ?? "",
      section: p.section ?? "",
      school_name: p.school_name ?? "",
      home_state: p.home_state ?? "",
      city: p.city ?? "",
      photo_url: p.photo_url ?? "",
      bio: p.bio ?? "",
      notes: p.notes ?? "",
    });
    setEditing(p);
    setCreating(false);
    setError(null);
  }

  function submit() {
    if (form.full_name.trim().length < 2) {
      setError("Name required");
      return;
    }
    const payload = {
      full_name: form.full_name.trim(),
      phone: form.phone.trim() || null,
      email: form.email.trim() || null,
      parent_phone: form.parent_phone.trim() || null,
      class: form.class ? parseInt(form.class) : null,
      section: form.section.trim() || null,
      school_name: form.school_name.trim() || null,
      home_state: form.home_state.trim() || null,
      city: form.city.trim() || null,
      photo_url: form.photo_url.trim() || null,
      bio: form.bio.trim() || null,
      notes: form.notes.trim() || null,
    };

    startTransition(async () => {
      const res = editing
        ? await updatePerson(editing.id, payload)
        : await createPerson(payload);
      if (!res.success) {
        setError(res.error);
        return;
      }
      if (editing) {
        setPeople(people.map((x) => (x.id === editing.id ? res.data : x)));
      } else {
        setPeople([res.data, ...people]);
      }
      setCreating(false);
      setEditing(null);
      setFlash("Saved");
      setTimeout(() => setFlash(null), 2000);
    });
  }

  function toggleActive(p: Person) {
    startTransition(async () => {
      const res = p.is_active ? await archivePerson(p.id) : await restorePerson(p.id);
      if (!res.success) {
        setError(res.error);
        return;
      }
      setPeople(
        people.map((x) =>
          x.id === p.id ? { ...x, is_active: !x.is_active } : x
        )
      );
    });
  }

  function doMerge() {
    if (!merging || !mergeTargetId) return;
    startTransition(async () => {
      const res = await mergePeople(mergeTargetId, merging.id);
      if (!res.success) {
        setError(res.error);
        return;
      }
      setFlash(`Merged: moved ${res.data.moved_participants} participations`);
      setMerging(null);
      setMergeTargetId("");
      setTimeout(() => setFlash(null), 3000);
      setPeople(
        people.map((x) =>
          x.id === merging.id ? { ...x, is_active: false } : x
        )
      );
    });
  }

  return (
    <div className="max-w-[1400px] mx-auto px-6 py-8 space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-[#1a1a3e] flex items-center gap-2">
            <Users className="size-7 text-[#FF9933]" /> People Directory
          </h1>
          <p className="text-sm text-[#1a1a3e]/60 mt-1">
            Stable identities that ride across chapter → regional → national rounds ·
            {" "}
            {stats.active} active · {stats.total} total
          </p>
        </div>
        <Button
          onClick={openCreate}
          className="bg-[#FF9933] hover:bg-[#FF9933]/90 text-white"
        >
          <Plus className="size-4 mr-2" /> New Person
        </Button>
      </div>

      {flash && (
        <div className="rounded-lg bg-[#138808]/8 border border-[#138808]/15 px-4 py-2 text-sm text-[#138808]">
          {flash}
        </div>
      )}
      {error && !creating && !editing && !merging && (
        <div className="rounded-lg bg-red-50 border border-red-200 px-3 py-2 text-sm text-red-700">
          {error}
        </div>
      )}

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <StatBox label="Total" value={stats.total} />
        <StatBox label="Active" value={stats.active} />
        <StatBox label="With phone" value={stats.with_phone} />
        <StatBox label="With email" value={stats.with_email} />
      </div>

      <div className="flex items-center gap-3 flex-wrap">
        <div className="relative max-w-md flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-[#1a1a3e]/40" />
          <Input
            placeholder="Search by name, phone, email, school…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="pl-9"
          />
        </div>
        <label className="flex items-center gap-2 text-xs text-[#1a1a3e]/70">
          <input
            type="checkbox"
            checked={showInactive}
            onChange={(e) => setShowInactive(e.target.checked)}
            className="size-4"
          />
          Show archived
        </label>
      </div>

      {(creating || editing) && (
        <Card className="border-[#FF9933]/30">
          <CardHeader>
            <CardTitle className="text-base">
              {editing ? "Edit Person" : "New Person"}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              <div className="md:col-span-2">
                <label className="text-xs font-medium text-[#1a1a3e]/70">Full Name *</label>
                <Input
                  value={form.full_name}
                  onChange={(e) => setForm({ ...form, full_name: e.target.value })}
                />
              </div>
              <div>
                <label className="text-xs font-medium text-[#1a1a3e]/70">Phone (primary ID)</label>
                <Input
                  value={form.phone}
                  onChange={(e) => setForm({ ...form, phone: e.target.value })}
                />
              </div>
              <div>
                <label className="text-xs font-medium text-[#1a1a3e]/70">Email</label>
                <Input
                  type="email"
                  value={form.email}
                  onChange={(e) => setForm({ ...form, email: e.target.value })}
                />
              </div>
              <div>
                <label className="text-xs font-medium text-[#1a1a3e]/70">Parent phone</label>
                <Input
                  value={form.parent_phone}
                  onChange={(e) => setForm({ ...form, parent_phone: e.target.value })}
                />
              </div>
              <div>
                <label className="text-xs font-medium text-[#1a1a3e]/70">Class</label>
                <Input
                  type="number"
                  value={form.class}
                  onChange={(e) => setForm({ ...form, class: e.target.value })}
                />
              </div>
              <div className="md:col-span-2">
                <label className="text-xs font-medium text-[#1a1a3e]/70">School</label>
                <Input
                  value={form.school_name}
                  onChange={(e) => setForm({ ...form, school_name: e.target.value })}
                />
              </div>
              <div>
                <label className="text-xs font-medium text-[#1a1a3e]/70">Section</label>
                <Input
                  value={form.section}
                  onChange={(e) => setForm({ ...form, section: e.target.value })}
                />
              </div>
              <div>
                <label className="text-xs font-medium text-[#1a1a3e]/70">City</label>
                <Input
                  value={form.city}
                  onChange={(e) => setForm({ ...form, city: e.target.value })}
                />
              </div>
              <div>
                <label className="text-xs font-medium text-[#1a1a3e]/70">Home State</label>
                <Input
                  value={form.home_state}
                  onChange={(e) => setForm({ ...form, home_state: e.target.value })}
                />
              </div>
              <div className="md:col-span-3">
                <label className="text-xs font-medium text-[#1a1a3e]/70">Photo URL</label>
                <Input
                  value={form.photo_url}
                  onChange={(e) => setForm({ ...form, photo_url: e.target.value })}
                />
              </div>
              <div className="md:col-span-3">
                <label className="text-xs font-medium text-[#1a1a3e]/70">Bio</label>
                <Textarea
                  value={form.bio}
                  onChange={(e) => setForm({ ...form, bio: e.target.value })}
                  rows={2}
                />
              </div>
              <div className="md:col-span-3">
                <label className="text-xs font-medium text-[#1a1a3e]/70">Admin notes</label>
                <Textarea
                  value={form.notes}
                  onChange={(e) => setForm({ ...form, notes: e.target.value })}
                  rows={2}
                />
              </div>
            </div>
            {error && (
              <div className="rounded-lg bg-red-50 border border-red-200 px-3 py-2 text-sm text-red-700">
                {error}
              </div>
            )}
            <div className="flex justify-end gap-2">
              <Button
                variant="outline"
                onClick={() => {
                  setCreating(false);
                  setEditing(null);
                  setError(null);
                }}
                disabled={pending}
              >
                Cancel
              </Button>
              <Button
                onClick={submit}
                disabled={pending}
                className="bg-[#FF9933] hover:bg-[#FF9933]/90 text-white"
              >
                {pending && <Loader2 className="size-4 mr-2 animate-spin" />}
                {editing ? "Save" : "Create"}
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {merging && (
        <Card className="border-violet-300">
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <Merge className="size-4 text-violet-600" />
              Merge &ldquo;{merging.full_name}&rdquo; INTO another person
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <p className="text-sm text-[#1a1a3e]/70">
              All participations linked to this person will be reassigned to the
              chosen target person. This one will be archived.
            </p>
            <div>
              <label className="text-xs font-medium text-[#1a1a3e]/70">
                Keep this person (target):
              </label>
              <select
                value={mergeTargetId}
                onChange={(e) => setMergeTargetId(e.target.value)}
                className="w-full border border-input rounded-md px-3 py-2 text-sm"
              >
                <option value="">— Select target person —</option>
                {people
                  .filter((p) => p.id !== merging.id && p.is_active)
                  .map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.full_name}
                      {p.phone ? ` · ${p.phone}` : ""}
                      {p.school_name ? ` · ${p.school_name}` : ""}
                    </option>
                  ))}
              </select>
            </div>
            <div className="flex justify-end gap-2">
              <Button
                variant="outline"
                onClick={() => {
                  setMerging(null);
                  setMergeTargetId("");
                }}
                disabled={pending}
              >
                Cancel
              </Button>
              <Button
                onClick={doMerge}
                disabled={pending || !mergeTargetId}
                className="bg-violet-600 hover:bg-violet-700 text-white"
              >
                {pending && <Loader2 className="size-4 mr-2 animate-spin" />}
                Merge
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>School</TableHead>
                <TableHead>Contact</TableHead>
                <TableHead>Location</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="w-32"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.length === 0 && (
                <TableRow>
                  <TableCell colSpan={6} className="text-center py-10 text-sm text-[#1a1a3e]/50">
                    {people.length === 0
                      ? "No people yet. Registrations + mock seeding will populate this."
                      : "No matches."}
                  </TableCell>
                </TableRow>
              )}
              {filtered.map((p) => (
                <TableRow key={p.id} className={p.is_active ? "" : "opacity-60"}>
                  <TableCell>
                    <Link
                      href={`/dashboard/admin/people/${p.id}`}
                      className="font-medium text-[#1a1a3e] hover:text-[#FF9933] inline-flex items-center gap-1"
                    >
                      {p.full_name}
                      <ArrowUpRight className="size-3 opacity-50" />
                    </Link>
                    {p.class && (
                      <div className="text-xs text-[#1a1a3e]/50">
                        Class {p.class}{p.section ? ` · ${p.section}` : ""}
                      </div>
                    )}
                  </TableCell>
                  <TableCell className="text-sm">
                    {p.school_name ?? "—"}
                  </TableCell>
                  <TableCell>
                    {p.phone && (
                      <div className="text-xs font-mono">{p.phone}</div>
                    )}
                    {p.email && (
                      <div className="text-xs text-[#1a1a3e]/60 truncate max-w-[180px]">
                        {p.email}
                      </div>
                    )}
                  </TableCell>
                  <TableCell className="text-xs text-[#1a1a3e]/70">
                    {[p.city, p.home_state].filter(Boolean).join(", ") || "—"}
                  </TableCell>
                  <TableCell>
                    {p.is_active ? (
                      <Badge className="bg-[#138808]/10 text-[#138808] border-[#138808]/20 text-[10px]">
                        Active
                      </Badge>
                    ) : (
                      <Badge variant="secondary" className="text-[10px]">
                        Archived
                      </Badge>
                    )}
                  </TableCell>
                  <TableCell>
                    <div className="flex justify-end gap-1">
                      <Button
                        size="icon"
                        variant="ghost"
                        onClick={() => openEdit(p)}
                        disabled={pending}
                      >
                        <Pencil className="size-4" />
                      </Button>
                      {p.is_active && (
                        <Button
                          size="icon"
                          variant="ghost"
                          onClick={() => setMerging(p)}
                          className="text-violet-600"
                          title="Merge into another"
                        >
                          <Merge className="size-4" />
                        </Button>
                      )}
                      <Button
                        size="icon"
                        variant="ghost"
                        onClick={() => toggleActive(p)}
                        disabled={pending}
                        className={p.is_active ? "text-red-600" : "text-[#138808]"}
                      >
                        {p.is_active ? (
                          <Archive className="size-4" />
                        ) : (
                          <RotateCcw className="size-4" />
                        )}
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

function StatBox({ label, value }: { label: string; value: number }) {
  return (
    <Card>
      <CardContent className="pt-4 pb-4">
        <div className="text-2xl font-bold text-[#1a1a3e] tabular-nums">
          {value}
        </div>
        <div className="text-xs text-[#1a1a3e]/60">{label}</div>
      </CardContent>
    </Card>
  );
}
