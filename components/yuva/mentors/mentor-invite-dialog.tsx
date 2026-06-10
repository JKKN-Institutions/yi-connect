"use client";

/**
 * Invite-a-mentor dialog (Phase 6) — chapter's Mentor YUVA Network screen.
 * Mentors can be ANYONE: name + email (+ optional phone) is all it takes —
 * no Yi membership, no national vetting. National callers (chapter == null)
 * must additionally name the chapter the mentor joins.
 */

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Loader2, UserPlus } from "lucide-react";
import toast from "react-hot-toast";
import { inviteMentor } from "@/app/youth-academy/actions/mentors";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

type MentorInviteDialogProps = {
  /** The caller's chapter; null for national accounts (shows a chapter field). */
  chapter: string | null;
};

export function MentorInviteDialog({ chapter }: MentorInviteDialogProps) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [chapterInput, setChapterInput] = useState("");

  const reset = () => {
    setFullName("");
    setEmail("");
    setPhone("");
    setChapterInput("");
    setError(null);
  };

  const handleSubmit = () => {
    setError(null);
    startTransition(async () => {
      const result = await inviteMentor({
        fullName,
        email,
        phone: phone.trim() || undefined,
        chapter: chapter ?? (chapterInput.trim() || undefined),
      });
      if (!result.success) {
        setError(result.error);
        return;
      }
      if (result.warning) {
        toast(result.warning, { icon: "ℹ️" });
      } else {
        toast.success(`Invite sent to ${email.trim()}`);
      }
      reset();
      setOpen(false);
      router.refresh();
    });
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (!next) reset();
      }}
    >
      <DialogTrigger asChild>
        <Button className="bg-slate-900 hover:bg-slate-800">
          <UserPlus className="size-4" />
          Invite mentor
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Invite a mentor</DialogTitle>
          <DialogDescription>
            Mentors can be anyone — no Yi membership needed. They&apos;ll get an
            email invite and can sign in with Google to set up their profile.
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-4 py-2">
          <div className="grid gap-2">
            <Label htmlFor="mentor-name">Full name</Label>
            <Input
              id="mentor-name"
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              placeholder="e.g. Priya Raman"
              disabled={isPending}
            />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="mentor-email">Email</Label>
            <Input
              id="mentor-email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="mentor@example.com"
              disabled={isPending}
            />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="mentor-phone">
              Phone <span className="text-slate-400">(optional)</span>
            </Label>
            <Input
              id="mentor-phone"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="+91 …"
              disabled={isPending}
            />
          </div>
          {chapter === null && (
            <div className="grid gap-2">
              <Label htmlFor="mentor-chapter">Chapter</Label>
              <Input
                id="mentor-chapter"
                value={chapterInput}
                onChange={(e) => setChapterInput(e.target.value)}
                placeholder="e.g. Erode"
                disabled={isPending}
              />
              <p className="text-xs text-slate-500">
                National accounts must name the chapter whose network this
                mentor joins.
              </p>
            </div>
          )}

          {error && (
            <p className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">
              {error}
            </p>
          )}
        </div>

        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => setOpen(false)}
            disabled={isPending}
          >
            Cancel
          </Button>
          <Button
            onClick={handleSubmit}
            disabled={isPending || !fullName.trim() || !email.trim()}
            className="bg-slate-900 hover:bg-slate-800"
          >
            {isPending && <Loader2 className="size-4 animate-spin" />}
            Send invite
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
