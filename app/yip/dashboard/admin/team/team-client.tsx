"use client";

import { useState, useTransition } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  Users,
  Plus,
  Pencil,
  Archive,
  RotateCcw,
  Loader2,
  Crown,
  MapPin,
  Link as LinkIcon,
} from "lucide-react";
import { YI_ZONES, type YiZone, type YiRole } from "@/lib/yip/hierarchy";
import {
  adminCreateMember,
  adminUpdateMember,
  adminArchiveMember,
  adminRestoreMember,
  adminLinkUser,
  adminUnlinkUser,
  type TeamMember,
} from "@/app/actions/admin-team";

type FormState = {
  full_name: string;
  email: string;
  role: YiRole;
  zone: YiZone | "";
  chapter_name: string;
  title: string;
  photo_url: string;
};

const EMPTY: FormState = {
  full_name: "",
  email: "",
  role: "chapter_em",
  zone: "",
  chapter_name: "",
  title: "",
  photo_url: "",
};

export function TeamAdminClient({
  initialMembers,
}: {
  initialMembers: TeamMember[];
}) {
  const [members, setMembers] = useState(initialMembers);
  const [creating, setCreating] = useState(false);
  const [editing, setEditing] = useState<TeamMember | null>(null);
  const [form, setForm] = useState<FormState>(EMPTY);
  const [linkEmail, setLinkEmail] = useState("");
  const [linking, setLinking] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [flash, setFlash] = useState<string | null>(null);
  const [showArchived, setShowArchived] = useState(false);

  const active = members.filter((m) => m.is_active);
  const archived = members.filter((m) => !m.is_active);
  const nationals = active.filter((m) => m.role === "national");
  const rms = active.filter((m) => m.role === "rm");
  const ems = active.filter((m) => m.role === "chapter_em");

  function openCreate() {
    setForm(EMPTY);
    setEditing(null);
    setCreating(true);
    setError(null);
  }
  function openEdit(m: TeamMember) {
    setForm({
      full_name: m.full_name,
      email: m.email ?? "",
      role: m.role,
      zone: (m.zone as YiZone) ?? "",
      chapter_name: m.chapter_name ?? "",
      title: m.title ?? "",
      photo_url: m.photo_url ?? "",
    });
    setEditing(m);
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
      email: form.email.trim() || null,
      role: form.role,
      zone:
        form.role === "national"
          ? null
          : ((form.zone || null) as YiZone | null),
      chapter_name:
        form.role === "chapter_em" ? form.chapter_name.trim() || null : null,
      title: form.title.trim() || null,
      photo_url: form.photo_url.trim() || null,
    };
    startTransition(async () => {
      const res = editing
        ? await adminUpdateMember(editing.id, payload)
        : await adminCreateMember(payload);
      if (!res.success) {
        setError(res.error);
        return;
      }
      if (editing) {
        setMembers(members.map((x) => (x.id === editing.id ? res.data : x)));
      } else {
        setMembers([...members, res.data]);
      }
      setCreating(false);
      setEditing(null);
      setFlash("Saved");
      setTimeout(() => setFlash(null), 2000);
    });
  }

  function archive(m: TeamMember) {
    startTransition(async () => {
      const res = m.is_active
        ? await adminArchiveMember(m.id)
        : await adminRestoreMember(m.id);
      if (!res.success) {
        setError(res.error);
        return;
      }
      setMembers(
        members.map((x) =>
          x.id === m.id ? { ...x, is_active: !x.is_active } : x
        )
      );
    });
  }

  function doLink(memberId: string) {
    if (!linkEmail.trim()) return;
    startTransition(async () => {
      const res = await adminLinkUser(memberId, linkEmail.trim());
      if (!res.success) {
        setError(res.error);
        return;
      }
      setLinking(null);
      setLinkEmail("");
      setFlash("User linked");
      setTimeout(() => setFlash(null), 2000);
      window.location.reload();
    });
  }

  function doUnlink(memberId: string) {
    startTransition(async () => {
      await adminUnlinkUser(memberId);
      setMembers(
        members.map((x) =>
          x.id === memberId ? { ...x, user_id: null, email: x.email } : x
        )
      );
    });
  }

  const zoneMissingRMs = YI_ZONES.filter(
    (z) => !rms.some((r) => r.zone === z.code)
  );

  return (
    <div className="max-w-[1400px] mx-auto px-6 py-8 space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-[#1a1a3e] flex items-center gap-2">
            <Users className="size-7 text-[#FF9933]" /> Yi National Team — Admin
          </h1>
          <p className="text-sm text-[#1a1a3e]/60 mt-1">
            Handbook p.2 · {active.length} active · {archived.length} archived
          </p>
        </div>
        <Button
          onClick={openCreate}
          className="bg-[#FF9933] hover:bg-[#FF9933]/90 text-white"
        >
          <Plus className="size-4 mr-2" /> Add Member
        </Button>
      </div>

      {flash && (
        <div className="rounded-lg bg-[#138808]/8 border border-[#138808]/15 px-4 py-2 text-sm text-[#138808]">
          {flash}
        </div>
      )}
      {error && (
        <div className="rounded-lg bg-red-50 border border-red-200 px-3 py-2 text-sm text-red-700">
          {error}
        </div>
      )}
      {(nationals.length < 1 || zoneMissingRMs.length > 0) && (
        <div className="rounded-lg bg-amber-50 border border-amber-200 px-3 py-2 text-sm text-amber-800">
          ⚠ Compliance:{" "}
          {nationals.length < 1 && "no active National Chair. "}
          {zoneMissingRMs.length > 0 &&
            `no RM in zones: ${zoneMissingRMs.map((z) => z.code).join(", ")}.`}
        </div>
      )}

      {(creating || editing) && (
        <Card className="border-[#FF9933]/30">
          <CardHeader>
            <CardTitle className="text-base">
              {editing ? "Edit Member" : "New Member"}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div>
                <label className="text-xs font-medium text-[#1a1a3e]/70">
                  Full Name *
                </label>
                <Input
                  value={form.full_name}
                  onChange={(e) =>
                    setForm({ ...form, full_name: e.target.value })
                  }
                />
              </div>
              <div>
                <label className="text-xs font-medium text-[#1a1a3e]/70">
                  Title
                </label>
                <Input
                  value={form.title}
                  onChange={(e) => setForm({ ...form, title: e.target.value })}
                  placeholder="National Chair, Thalir"
                />
              </div>
              <div>
                <label className="text-xs font-medium text-[#1a1a3e]/70">
                  Role *
                </label>
                <select
                  value={form.role}
                  onChange={(e) =>
                    setForm({ ...form, role: e.target.value as YiRole })
                  }
                  className="w-full border border-input rounded-md px-3 py-2 text-sm"
                >
                  <option value="national">National Chair / Co-Chair</option>
                  <option value="rm">Regional Manager (RM)</option>
                  <option value="chapter_em">Chapter EM</option>
                </select>
              </div>
              {form.role !== "national" && (
                <div>
                  <label className="text-xs font-medium text-[#1a1a3e]/70">
                    Zone {form.role === "rm" ? "*" : ""}
                  </label>
                  <select
                    value={form.zone}
                    onChange={(e) =>
                      setForm({ ...form, zone: e.target.value as YiZone })
                    }
                    className="w-full border border-input rounded-md px-3 py-2 text-sm"
                  >
                    <option value="">—</option>
                    {YI_ZONES.map((z) => (
                      <option key={z.code} value={z.code}>
                        {z.label}
                      </option>
                    ))}
                  </select>
                </div>
              )}
              {form.role === "chapter_em" && (
                <div>
                  <label className="text-xs font-medium text-[#1a1a3e]/70">
                    Chapter *
                  </label>
                  <Input
                    value={form.chapter_name}
                    onChange={(e) =>
                      setForm({ ...form, chapter_name: e.target.value })
                    }
                  />
                </div>
              )}
              <div>
                <label className="text-xs font-medium text-[#1a1a3e]/70">
                  Email
                </label>
                <Input
                  type="email"
                  value={form.email}
                  onChange={(e) => setForm({ ...form, email: e.target.value })}
                />
              </div>
              <div>
                <label className="text-xs font-medium text-[#1a1a3e]/70">
                  Photo URL
                </label>
                <Input
                  value={form.photo_url}
                  onChange={(e) =>
                    setForm({ ...form, photo_url: e.target.value })
                  }
                />
              </div>
            </div>
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

      {/* National */}
      <Section title="National" count={nationals.length} icon={Crown}>
        {nationals.map((m) => (
          <MemberCard
            key={m.id}
            m={m}
            onEdit={openEdit}
            onArchive={archive}
            onLinkOpen={() => setLinking(m.id)}
            onUnlink={doUnlink}
          />
        ))}
        {nationals.length === 0 && <EmptyHint label="Add a National Chair." />}
      </Section>

      {/* RMs by zone */}
      <Section title="Regional Managers" count={rms.length} icon={MapPin}>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
          {YI_ZONES.map((z) => {
            const rm = rms.find((r) => r.zone === z.code);
            return (
              <div key={z.code}>
                <div className="text-xs font-semibold text-[#1a1a3e]/50 mb-1">
                  {z.code} · {z.label}
                </div>
                {rm ? (
                  <MemberCard
                    m={rm}
                    onEdit={openEdit}
                    onArchive={archive}
                    onLinkOpen={() => setLinking(rm.id)}
                    onUnlink={doUnlink}
                  />
                ) : (
                  <div className="rounded-lg border-2 border-dashed border-amber-300 bg-amber-50/50 p-3 text-xs text-amber-800">
                    No active RM
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </Section>

      {/* Chapter EMs */}
      <Section title="Chapter EMs" count={ems.length} icon={Users}>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
          {ems.map((m) => (
            <MemberCard
              key={m.id}
              m={m}
              onEdit={openEdit}
              onArchive={archive}
              onLinkOpen={() => setLinking(m.id)}
              onUnlink={doUnlink}
            />
          ))}
          {ems.length === 0 && <EmptyHint label="No Chapter EMs yet." />}
        </div>
      </Section>

      {/* Link user modal */}
      {linking && (
        <Card className="border-blue-300">
          <CardContent className="pt-5 space-y-3">
            <p className="text-sm font-semibold text-[#1a1a3e]">
              Link an auth.users account by email
            </p>
            <Input
              type="email"
              placeholder="email@youngindians.net"
              value={linkEmail}
              onChange={(e) => setLinkEmail(e.target.value)}
            />
            <div className="flex justify-end gap-2">
              <Button
                variant="outline"
                onClick={() => {
                  setLinking(null);
                  setLinkEmail("");
                }}
              >
                Cancel
              </Button>
              <Button
                onClick={() => doLink(linking)}
                disabled={pending}
                className="bg-blue-600 hover:bg-blue-700 text-white"
              >
                {pending && <Loader2 className="size-4 mr-2 animate-spin" />}
                Link
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Archived */}
      {archived.length > 0 && (
        <div>
          <button
            onClick={() => setShowArchived(!showArchived)}
            className="text-sm text-[#1a1a3e]/60 hover:text-[#1a1a3e] underline decoration-dotted"
          >
            {showArchived ? "Hide" : "View"} archived ({archived.length})
          </button>
          {showArchived && (
            <div className="mt-3 space-y-2 opacity-60">
              {archived.map((m) => (
                <MemberCard
                  key={m.id}
                  m={m}
                  onEdit={openEdit}
                  onArchive={archive}
                />
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function Section({
  title,
  count,
  icon: Icon,
  children,
}: {
  title: string;
  count: number;
  icon: React.ComponentType<{ className?: string }>;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <Icon className="size-4 text-[#FF9933]" />
        <h2 className="text-lg font-semibold text-[#1a1a3e]">{title}</h2>
        <Badge variant="secondary" className="text-[10px]">
          {count}
        </Badge>
      </div>
      {children}
    </div>
  );
}

function EmptyHint({ label }: { label: string }) {
  return (
    <div className="text-center py-6 text-sm text-[#1a1a3e]/50 border-2 border-dashed border-[#1a1a3e]/10 rounded-lg">
      {label}
    </div>
  );
}

function MemberCard({
  m,
  onEdit,
  onArchive,
  onLinkOpen,
  onUnlink,
}: {
  m: TeamMember;
  onEdit: (m: TeamMember) => void;
  onArchive: (m: TeamMember) => void;
  onLinkOpen?: () => void;
  onUnlink?: (id: string) => void;
}) {
  const initials = m.full_name
    .split(" ")
    .slice(0, 2)
    .map((s) => s[0]?.toUpperCase() ?? "")
    .join("");

  return (
    <Card className={m.is_active ? "" : "opacity-60"}>
      <CardContent className="pt-4 pb-4">
        <div className="flex items-center gap-3">
          {m.photo_url ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={m.photo_url}
              alt={m.full_name}
              className="size-10 rounded-full object-cover bg-gray-100"
            />
          ) : (
            <div className="size-10 rounded-full bg-gradient-to-br from-[#FF9933] to-[#E68A2E] flex items-center justify-center text-white font-bold text-sm">
              {initials}
            </div>
          )}
          <div className="flex-1 min-w-0">
            <div className="font-semibold text-[#1a1a3e] truncate">
              {m.full_name}
            </div>
            <div className="text-xs text-[#1a1a3e]/60 truncate">
              {m.title ?? m.role}
              {m.chapter_name ? ` · ${m.chapter_name}` : ""}
            </div>
            <div className="flex gap-1 mt-1 flex-wrap">
              {m.zone && (
                <Badge variant="secondary" className="text-[9px] font-mono">
                  {m.zone}
                </Badge>
              )}
              {m.yi_year && (
                <Badge
                  variant="secondary"
                  className="text-[9px] font-mono bg-amber-50 text-amber-700 border-amber-200"
                >
                  Yi {m.yi_year}
                </Badge>
              )}
              {m.user_id && (
                <Badge className="bg-blue-50 text-blue-700 border-blue-200 text-[9px]">
                  Linked
                </Badge>
              )}
            </div>
          </div>
        </div>
        <div className="flex justify-end gap-1 mt-3">
          <Button size="sm" variant="ghost" onClick={() => onEdit(m)}>
            <Pencil className="size-4" />
          </Button>
          {onLinkOpen && m.is_active && (
            <Button
              size="sm"
              variant="ghost"
              onClick={() =>
                m.user_id && onUnlink ? onUnlink(m.id) : onLinkOpen()
              }
              className="text-blue-600"
              title={m.user_id ? "Unlink user" : "Link user"}
            >
              <LinkIcon className="size-4" />
            </Button>
          )}
          <Button
            size="sm"
            variant="ghost"
            onClick={() => onArchive(m)}
            className={m.is_active ? "text-red-600" : "text-[#138808]"}
          >
            {m.is_active ? (
              <Archive className="size-4" />
            ) : (
              <RotateCcw className="size-4" />
            )}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
