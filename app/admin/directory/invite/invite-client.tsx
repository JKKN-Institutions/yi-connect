/**
 * Directory Admin — Invite Client (Phase B, 2026-05-28)
 */
"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft, Check, Copy, Mail, UserPlus } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

import {
  invitePersonAndAssignRole,
  type InviteResult,
} from "../actions/directory-mutations";

const KNOWN_APPS = ["yip", "future", "yuva", "thalir", "masoom", "yi"] as const;
const YEARS = [2025, 2026, 2027, 2028, 2029, 2030];

export function InviteClient() {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [result, setResult] = useState<InviteResult | null>(null);
  const [copied, setCopied] = useState(false);

  const [form, setForm] = useState({
    full_name: "",
    email: "",
    phone: "",
    app: "yip",
    role: "",
    yi_year: 2026,
    yi_chapter: "",
    title: "",
  });

  function update<K extends keyof typeof form>(k: K, v: (typeof form)[K]) {
    setForm((f) => ({ ...f, [k]: v }));
  }

  function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.full_name.trim()) {
      toast.error("Full name is required");
      return;
    }
    if (!form.email.trim()) {
      toast.error("Email is required");
      return;
    }
    if (!form.role.trim()) {
      toast.error("Role is required");
      return;
    }
    startTransition(async () => {
      const res = await invitePersonAndAssignRole({
        full_name: form.full_name.trim(),
        email: form.email.trim(),
        phone: form.phone.trim() || null,
        app: form.app,
        role: form.role.trim(),
        yi_year: form.yi_year,
        yi_chapter: form.yi_chapter.trim() || null,
        title: form.title.trim() || null,
      });
      if (res.success) {
        toast.success(res.message ?? "Invited");
        setResult(res.data);
        // If email was sent, redirect after a moment so admin can see the
        // success state; otherwise stay on page so they can copy the URL.
        if (res.data.invite_email_sent) {
          setTimeout(() => {
            router.push(`/admin/directory/${res.data.person_id}`);
            router.refresh();
          }, 1500);
        }
      } else {
        toast.error(res.error);
      }
    });
  }

  function copyUrl() {
    if (!result?.manual_invite_url) return;
    navigator.clipboard.writeText(result.manual_invite_url);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <div className="max-w-3xl mx-auto p-6 space-y-6">
      <div>
        <Link
          href="/admin/directory"
          className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="h-3 w-3" /> Back to directory
        </Link>
        <h1 className="mt-2 text-2xl font-semibold flex items-center gap-2">
          <UserPlus className="h-6 w-6" /> Invite a person
        </h1>
        <p className="text-sm text-muted-foreground">
          Creates an auth user, a yi_directory.people entry, and an initial
          role assignment — all in one shot.
        </p>
      </div>

      {result ? (
        <div className="rounded-lg border bg-emerald-50 p-6 space-y-4">
          <div className="flex items-center gap-2 text-emerald-900">
            <Check className="h-5 w-5" />
            <h2 className="font-semibold">Invite created</h2>
          </div>

          <dl className="text-sm space-y-1">
            <div className="flex gap-2">
              <dt className="font-medium w-32">Person id</dt>
              <dd className="font-mono text-xs">{result.person_id}</dd>
            </div>
            <div className="flex gap-2">
              <dt className="font-medium w-32">Auth user id</dt>
              <dd className="font-mono text-xs">{result.user_id}</dd>
            </div>
            <div className="flex gap-2">
              <dt className="font-medium w-32">Role assignment</dt>
              <dd className="font-mono text-xs">{result.role_assignment_id}</dd>
            </div>
            <div className="flex gap-2">
              <dt className="font-medium w-32">Email sent</dt>
              <dd>
                {result.invite_email_sent ? (
                  <span className="inline-flex items-center gap-1 text-emerald-700">
                    <Mail className="h-3 w-3" /> Yes — magic link delivered
                  </span>
                ) : (
                  <span className="text-amber-700">
                    No — SMTP not configured or already-registered user
                  </span>
                )}
              </dd>
            </div>
          </dl>

          {!result.invite_email_sent && result.manual_invite_url && (
            <div className="space-y-2 rounded border border-amber-200 bg-amber-50 p-3">
              <p className="text-xs font-semibold text-amber-900">
                Copy this link and send it to the invitee manually:
              </p>
              <div className="flex items-center gap-2">
                <Input
                  readOnly
                  value={result.manual_invite_url}
                  className="font-mono text-xs"
                />
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={copyUrl}
                >
                  {copied ? (
                    <Check className="h-4 w-4" />
                  ) : (
                    <Copy className="h-4 w-4" />
                  )}
                </Button>
              </div>
            </div>
          )}

          <div className="flex gap-2 pt-2">
            <Link href={`/admin/directory/${result.person_id}`}>
              <Button>View person</Button>
            </Link>
            <Button
              variant="outline"
              onClick={() => {
                setResult(null);
                setForm({
                  full_name: "",
                  email: "",
                  phone: "",
                  app: "yip",
                  role: "",
                  yi_year: 2026,
                  yi_chapter: "",
                  title: "",
                });
              }}
            >
              Invite another
            </Button>
          </div>
        </div>
      ) : (
        <form
          onSubmit={submit}
          className="space-y-6 rounded-lg border bg-card p-6"
        >
          <section className="space-y-4">
            <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
              Person
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-1 md:col-span-2">
                <Label htmlFor="full_name">Full name *</Label>
                <Input
                  id="full_name"
                  value={form.full_name}
                  onChange={(e) => update("full_name", e.target.value)}
                  disabled={pending}
                  required
                />
              </div>
              <div className="space-y-1">
                <Label htmlFor="email">Email *</Label>
                <Input
                  id="email"
                  type="email"
                  value={form.email}
                  onChange={(e) => update("email", e.target.value)}
                  disabled={pending}
                  required
                />
              </div>
              <div className="space-y-1">
                <Label htmlFor="phone">Phone</Label>
                <Input
                  id="phone"
                  value={form.phone}
                  onChange={(e) => update("phone", e.target.value)}
                  disabled={pending}
                />
              </div>
            </div>
          </section>

          <section className="space-y-4 border-t pt-6">
            <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
              Initial role assignment
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-1">
                <Label>App</Label>
                <Select
                  value={form.app}
                  onValueChange={(v) => update("app", v)}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {KNOWN_APPS.map((a) => (
                      <SelectItem key={a} value={a}>
                        {a}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <Label>Year</Label>
                <Select
                  value={String(form.yi_year)}
                  onValueChange={(v) =>
                    update("yi_year", Number.parseInt(v, 10))
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {YEARS.map((y) => (
                      <SelectItem key={y} value={String(y)}>
                        {y}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <Label htmlFor="role">Role *</Label>
                <Input
                  id="role"
                  value={form.role}
                  onChange={(e) => update("role", e.target.value)}
                  disabled={pending}
                  placeholder="e.g. national, rm, chapter_chair"
                  required
                />
              </div>
              <div className="space-y-1">
                <Label htmlFor="title">Title</Label>
                <Input
                  id="title"
                  value={form.title}
                  onChange={(e) => update("title", e.target.value)}
                  disabled={pending}
                  placeholder="e.g. National Chair"
                />
              </div>
              <div className="space-y-1 md:col-span-2">
                <Label htmlFor="yi_chapter">Chapter</Label>
                <Input
                  id="yi_chapter"
                  value={form.yi_chapter}
                  onChange={(e) => update("yi_chapter", e.target.value)}
                  disabled={pending}
                  placeholder="e.g. Chennai"
                />
              </div>
            </div>
          </section>

          <div className="flex items-center gap-2 pt-2 border-t">
            <Button
              type="submit"
              disabled={pending}
              className="bg-emerald-600 hover:bg-emerald-700 text-white"
            >
              <UserPlus className="mr-2 h-4 w-4" />
              {pending ? "Inviting..." : "Send invite"}
            </Button>
            <Link
              href="/admin/directory"
              className="text-sm text-muted-foreground hover:text-foreground"
            >
              Cancel
            </Link>
          </div>
        </form>
      )}
    </div>
  );
}
