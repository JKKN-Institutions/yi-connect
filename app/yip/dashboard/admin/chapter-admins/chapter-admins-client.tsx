"use client";

import { useState, useTransition } from "react";
import {
  createChapterAdmin,
  type ChapterRow,
} from "@/app/yip/actions/admin-chapter-admins";
import { Button } from "@/components/yip/ui/button";
import { Input } from "@/components/yip/ui/input";
import { Card, CardContent } from "@/components/yip/ui/card";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/yip/ui/dialog";
import { Badge } from "@/components/yip/ui/badge";
import { UserPlus, Copy, Check, KeyRound, AlertTriangle } from "lucide-react";

type Reveal = {
  chapterName: string;
  email: string;
  password: string;
  loginSlug: string;
};

export function ChapterAdminsClient({ chapters }: { chapters: ChapterRow[] }) {
  const [activeChapter, setActiveChapter] = useState<ChapterRow | null>(null);
  const [reveal, setReveal] = useState<Reveal | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [pending, startTransition] = useTransition();

  const [formEmail, setFormEmail] = useState("");
  const [formName, setFormName] = useState("");

  function openDialog(chapter: ChapterRow) {
    setActiveChapter(chapter);
    setFormEmail("");
    setFormName("");
    setError(null);
  }

  function submit() {
    if (!activeChapter) return;
    setError(null);
    startTransition(async () => {
      const res = await createChapterAdmin({
        chapterId: activeChapter.chapter_id,
        email: formEmail,
        fullName: formName,
      });
      if (res.ok) {
        setReveal({
          chapterName: activeChapter.chapter_name,
          email: res.email,
          password: res.password,
          loginSlug: res.loginSlug,
        });
        setActiveChapter(null);
      } else {
        setError(res.error);
      }
    });
  }

  function copyCreds() {
    if (!reveal) return;
    const text = `YIP Login\nChapter: ${reveal.chapterName}\nEmail: ${reveal.email}\nPassword: ${reveal.password}\nSlug: ${reveal.loginSlug}\nLogin URL: https://yi-connect-app.vercel.app/yip/login`;
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <div className="max-w-6xl mx-auto px-6 py-8 space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between gap-6">
        <div>
          <h1 className="text-2xl font-semibold text-[#1a1a3e]">
            Chapter Admins
          </h1>
          <p className="text-sm text-[#1a1a3e]/60 mt-1">
            Provision one or two admin logins per chapter. Each chapter gets a
            unique slug like{" "}
            <code className="font-mono text-xs bg-gray-100 px-1 py-0.5 rounded">
              mizoram-1
            </code>
            . Password is shown once at creation — share it out-of-band.
          </p>
        </div>
        <Badge variant="outline" className="text-xs">
          {chapters.length} chapters
        </Badge>
      </div>

      {/* Chapters grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
        {chapters.map((c) => (
          <Card key={c.chapter_id}>
            <CardContent className="p-4">
              <div className="flex items-start justify-between gap-2">
                <div className="flex-1">
                  <h2 className="font-semibold text-[#1a1a3e]">
                    {c.chapter_name}
                  </h2>
                  <p className="text-xs text-[#1a1a3e]/60 mt-0.5">
                    {[c.city, c.state, c.region].filter(Boolean).join(" · ")}
                  </p>
                </div>
                <Badge
                  variant={c.existing_admin_count > 0 ? "default" : "outline"}
                  className="text-[10px]"
                >
                  {c.existing_admin_count} admin
                  {c.existing_admin_count === 1 ? "" : "s"}
                </Badge>
              </div>
              <Button
                size="sm"
                variant="outline"
                onClick={() => openDialog(c)}
                className="w-full mt-3 gap-1.5"
                disabled={c.existing_admin_count >= 2}
              >
                <UserPlus className="size-3.5" />
                {c.existing_admin_count >= 2
                  ? "Limit reached (2 max)"
                  : "Add admin"}
              </Button>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Create dialog */}
      <Dialog
        open={activeChapter !== null}
        onOpenChange={(open) => !open && setActiveChapter(null)}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              Add admin for{" "}
              <span className="text-[#FF9933]">
                {activeChapter?.chapter_name}
              </span>
            </DialogTitle>
            <DialogDescription>
              Creates a Supabase auth user and assigns chapter_em role. A
              password is generated and displayed once — share it with the admin
              directly.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3 pt-2">
            <div>
              <label className="text-xs font-medium text-[#1a1a3e]/70 mb-1 block">
                Admin email
              </label>
              <Input
                type="email"
                value={formEmail}
                onChange={(e) => setFormEmail(e.target.value)}
                placeholder="chapter.admin@example.com"
                disabled={pending}
              />
            </div>
            <div>
              <label className="text-xs font-medium text-[#1a1a3e]/70 mb-1 block">
                Full name
              </label>
              <Input
                type="text"
                value={formName}
                onChange={(e) => setFormName(e.target.value)}
                placeholder="Anika Patel"
                disabled={pending}
              />
            </div>
            {error && (
              <div className="text-xs text-red-700 bg-red-50 border border-red-200 rounded p-2 flex items-start gap-2">
                <AlertTriangle className="size-3.5 mt-0.5 shrink-0" />
                <span>{error}</span>
              </div>
            )}
            <Button
              onClick={submit}
              disabled={
                pending ||
                !formEmail.includes("@") ||
                formName.trim().length < 2
              }
              className="w-full bg-[#FF9933] text-white hover:bg-[#FF9933]/90 disabled:bg-gray-300"
            >
              {pending ? "Creating…" : "Create admin login"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Reveal dialog (one-shot password) */}
      <Dialog
        open={reveal !== null}
        onOpenChange={(open) => !open && setReveal(null)}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <KeyRound className="size-5 text-[#FF9933]" />
              Login created — copy these now
            </DialogTitle>
            <DialogDescription>
              This password is shown <strong>once</strong>. It is not stored
              anywhere recoverable. Share it via your preferred secure channel.
            </DialogDescription>
          </DialogHeader>
          {reveal && (
            <div className="space-y-3">
              <div className="rounded border border-amber-300 bg-amber-50 p-3 text-xs font-mono space-y-1">
                <div>
                  <span className="text-amber-900/70">Chapter:</span>{" "}
                  {reveal.chapterName}
                </div>
                <div>
                  <span className="text-amber-900/70">Email:</span> {reveal.email}
                </div>
                <div>
                  <span className="text-amber-900/70">Password:</span>{" "}
                  <span className="font-bold text-amber-900">{reveal.password}</span>
                </div>
                <div>
                  <span className="text-amber-900/70">Slug:</span> {reveal.loginSlug}
                </div>
                <div className="text-[11px] text-amber-900/70 pt-1">
                  Login URL:{" "}
                  <span className="font-mono">/yip/login</span>
                </div>
              </div>
              <Button
                onClick={copyCreds}
                className="w-full gap-1.5"
                variant={copied ? "default" : "outline"}
              >
                {copied ? (
                  <>
                    <Check className="size-4" /> Copied to clipboard
                  </>
                ) : (
                  <>
                    <Copy className="size-4" /> Copy credentials
                  </>
                )}
              </Button>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
