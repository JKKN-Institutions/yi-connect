"use client";

import { useState, useTransition } from "react";
import { Badge } from "@/components/yip/ui/badge";
import { Button } from "@/components/yip/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/yip/ui/card";
import { Input } from "@/components/yip/ui/input";
import {
  Plus,
  Loader2,
  Trash2,
  ShieldCheck,
  UserCog,
  Copy,
  CheckCircle2,
  AlertCircle,
} from "lucide-react";
import {
  assignChapterRole,
  revokeChapterRole,
  type ChapterRoleRow,
  type ChapterRoleKind,
} from "@/app/yip/actions/chapter-roles";

const ROLE_LABEL: Record<ChapterRoleKind, string> = {
  chapter_admin: "Chapter Chair (admin)",
  chapter_organizer: "Organiser",
};

export function TeamClient({
  eventId,
  canEditTeam,
  myRole,
  initialRoles,
  suggestedChair,
}: {
  eventId: string;
  canEditTeam: boolean;
  myRole: string;
  initialRoles: ChapterRoleRow[];
  // Inherited from the linked chapter (yi.chapters chair) — offered as a
  // one-click prefill so the organizer doesn't retype the known chair.
  suggestedChair?: { name: string; email: string } | null;
}) {
  const [roles, setRoles] = useState<ChapterRoleRow[]>(initialRoles);
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<ChapterRoleKind>("chapter_organizer");
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [newPassword, setNewPassword] = useState<{ email: string; password: string } | null>(null);
  const [copied, setCopied] = useState(false);

  function refresh(next: ChapterRoleRow[]) {
    setRoles(next);
  }

  function handleAdd() {
    setError(null);
    setNewPassword(null);
    if (!fullName.trim() || !email.trim()) {
      setError("Enter both a name and an email.");
      return;
    }
    startTransition(async () => {
      const res = await assignChapterRole({ eventId, email, fullName, role });
      if (!res.ok) {
        setError(res.error);
        return;
      }
      // Optimistic add to the list (server is source of truth on reload).
      refresh([
        ...roles.filter((r) => r.email?.toLowerCase() !== email.trim().toLowerCase() || r.role !== role),
        {
          assignment_id: `tmp-${Date.now()}`,
          person_id: "",
          full_name: fullName.trim(),
          email: email.trim().toLowerCase(),
          role,
          is_active: true,
        },
      ]);
      if (res.password) {
        setNewPassword({ email: res.email, password: res.password });
      }
      setFullName("");
      setEmail("");
    });
  }

  function handleRevoke(assignmentId: string) {
    setError(null);
    startTransition(async () => {
      const res = await revokeChapterRole({ eventId, assignmentId });
      if (!res.ok) {
        setError(res.error);
        return;
      }
      refresh(roles.filter((r) => r.assignment_id !== assignmentId));
    });
  }

  function copyPassword() {
    if (!newPassword) return;
    navigator.clipboard?.writeText(newPassword.password).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  }

  // The chapter chair from the Yi directory has full admin on this event
  // automatically (recognized by role, not by being added here). Surface them so
  // the real owner is visible — unless they're already an explicit team row.
  const directoryChairEmail = suggestedChair?.email?.trim().toLowerCase() ?? null;
  const chairAlreadyInTeam =
    !!directoryChairEmail &&
    roles.some((r) => r.email?.trim().toLowerCase() === directoryChairEmail);
  const showDirectoryChair = !!suggestedChair?.email && !chairAlreadyInTeam;

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-lg font-semibold text-[#1a1a3e]">Chapter Team</h2>
        <p className="text-sm text-[#1a1a3e]/50">
          The chair (admin) can do everything including deleting data. Organisers
          can run the whole event — import, allocate, go live, score and publish —
          but cannot delete records.
        </p>
      </div>

      {/* Current roles */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <UserCog className="size-4" /> Current team
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          {showDirectoryChair && suggestedChair && (
            <div className="flex items-center justify-between rounded-lg border border-[#138808]/20 bg-[#138808]/5 px-3 py-2">
              <div className="flex items-center gap-2">
                <ShieldCheck className="size-4 text-[#138808]" />
                <div>
                  <div className="text-sm font-medium text-[#1a1a3e]">
                    {suggestedChair.name || "Chapter Chair"}
                  </div>
                  <div className="text-xs text-[#1a1a3e]/50">{suggestedChair.email}</div>
                </div>
              </div>
              <Badge
                variant="default"
                className="bg-[#138808] text-white hover:bg-[#138808]"
              >
                Chair · Yi directory
              </Badge>
            </div>
          )}
          {roles.length === 0 ? (
            showDirectoryChair ? (
              <p className="text-xs text-[#1a1a3e]/45">
                The chapter chair above has full admin automatically (from the Yi
                directory) — no need to add them. Add organisers below to help run
                the event.
              </p>
            ) : (
              <p className="text-sm text-[#1a1a3e]/40">
                No chapter chair or organiser assigned yet
                {canEditTeam ? " — add one below." : "."}
              </p>
            )
          ) : (
            roles.map((r) => (
              <div
                key={r.assignment_id}
                className="flex items-center justify-between rounded-lg border border-[#1a1a3e]/5 px-3 py-2"
              >
                <div className="flex items-center gap-2">
                  {r.role === "chapter_admin" ? (
                    <ShieldCheck className="size-4 text-[#138808]" />
                  ) : (
                    <UserCog className="size-4 text-[#FF9933]" />
                  )}
                  <div>
                    <div className="text-sm font-medium text-[#1a1a3e]">{r.full_name}</div>
                    <div className="text-xs text-[#1a1a3e]/50">{r.email}</div>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Badge variant={r.role === "chapter_admin" ? "default" : "secondary"}>
                    {ROLE_LABEL[r.role]}
                  </Badge>
                  {canEditTeam && (
                    <Button
                      variant="ghost"
                      size="sm"
                      disabled={pending}
                      onClick={() => handleRevoke(r.assignment_id)}
                      aria-label={`Remove ${r.full_name}`}
                    >
                      <Trash2 className="size-3.5 text-red-500" />
                    </Button>
                  )}
                </div>
              </div>
            ))
          )}
        </CardContent>
      </Card>

      {/* One-shot password reveal */}
      {newPassword && (
        <Card className="border-[#138808]/30 bg-[#138808]/5">
          <CardContent className="space-y-2 pt-4">
            <div className="flex items-center gap-2 text-sm font-medium text-[#138808]">
              <CheckCircle2 className="size-4" /> Login created for {newPassword.email}
            </div>
            <p className="text-xs text-[#1a1a3e]/60">
              Share this password with them now — it is shown only once and is not stored.
            </p>
            <div className="flex items-center gap-2">
              <code className="rounded bg-white px-3 py-1.5 font-mono text-sm">
                {newPassword.password}
              </code>
              <Button variant="outline" size="sm" onClick={copyPassword}>
                {copied ? <CheckCircle2 className="size-3.5" /> : <Copy className="size-3.5" />}
                {copied ? "Copied" : "Copy"}
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Add form — only for chair / national / regional */}
      {canEditTeam ? (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Plus className="size-4" /> Add a team member
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {error && (
              <div className="flex items-start gap-2 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">
                <AlertCircle className="mt-0.5 size-4 shrink-0" />
                {error}
              </div>
            )}
            {suggestedChair?.email &&
              email !== suggestedChair.email &&
              roles.length === 0 && (
                <button
                  type="button"
                  onClick={() => {
                    setFullName(suggestedChair.name);
                    setEmail(suggestedChair.email);
                    setRole("chapter_admin");
                  }}
                  className="flex w-full items-center gap-2 rounded-lg border border-[#FF9933]/40 bg-[#FF9933]/10 px-3 py-2 text-left text-sm text-[#994d00] hover:bg-[#FF9933]/20"
                >
                  <Plus className="size-4 shrink-0" />
                  Use chapter chair: <span className="font-semibold">{suggestedChair.name}</span> · {suggestedChair.email}
                </button>
              )}
            <div className="grid gap-3 sm:grid-cols-2">
              <Input
                placeholder="Full name"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                disabled={pending}
              />
              <Input
                type="email"
                placeholder="Email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                disabled={pending}
              />
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <select
                value={role}
                onChange={(e) => setRole(e.target.value as ChapterRoleKind)}
                disabled={pending}
                className="rounded-lg border border-[#1a1a3e]/10 px-3 py-2 text-sm"
              >
                <option value="chapter_organizer">Organiser (cannot delete)</option>
                <option value="chapter_admin">Chapter Chair (full admin)</option>
              </select>
              <Button onClick={handleAdd} disabled={pending}>
                {pending ? (
                  <Loader2 className="size-4 animate-spin" />
                ) : (
                  <Plus className="size-4" />
                )}
                Add
              </Button>
            </div>
            <p className="text-xs text-[#1a1a3e]/40">
              If the email has no login yet, one is created and a password is shown
              once here. Assigning a new chair replaces the previous one.
            </p>
          </CardContent>
        </Card>
      ) : (
        <p className="text-sm text-[#1a1a3e]/40">
          You are signed in as {myRole.replace("_", " ")}. Only the chapter chair or
          national team can change the team.
        </p>
      )}
    </div>
  );
}
