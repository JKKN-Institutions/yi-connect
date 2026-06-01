/**
 * Directory Admin — New Person Client (2026-06-01)
 *
 * Creates a bare people record (no login). Mirrors the edit form. To attach a
 * sign-in later, use Invite (binds auth.users by email).
 */
"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft, UserPlus } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

import { createPerson } from "../actions/directory-mutations";

export function NewPersonClient() {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [photoUrl, setPhotoUrl] = useState("");
  const [needsReview, setNeedsReview] = useState(false);

  function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!fullName.trim()) {
      toast.error("Full name is required");
      return;
    }
    startTransition(async () => {
      const res = await createPerson({
        full_name: fullName.trim(),
        email: email.trim() || null,
        phone: phone.trim() || null,
        photo_url: photoUrl.trim() || null,
        needs_identity_review: needsReview,
      });
      if (res.success) {
        toast.success(res.message ?? "Created");
        router.push(`/admin/directory/${res.data.id}`);
        router.refresh();
      } else {
        toast.error(res.error);
      }
    });
  }

  return (
    <div className="max-w-2xl mx-auto p-6 space-y-6">
      <div>
        <Link
          href="/admin/directory"
          className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="h-3 w-3" /> Back to directory
        </Link>
        <h1 className="mt-2 text-2xl font-semibold">New Person</h1>
        <p className="text-sm text-muted-foreground">
          Creates a directory record with no sign-in attached. To give this
          person a login, use{" "}
          <Link href="/admin/directory/invite" className="underline">
            Invite
          </Link>{" "}
          instead — it provisions an auth account and binds it by email.
        </p>
      </div>

      <form onSubmit={submit} className="space-y-4 rounded-lg border bg-card p-6">
        <div className="space-y-1">
          <Label htmlFor="full_name">Full name *</Label>
          <Input
            id="full_name"
            value={fullName}
            onChange={(e) => setFullName(e.target.value)}
            disabled={pending}
            required
          />
        </div>

        <div className="space-y-1">
          <Label htmlFor="email">Email</Label>
          <Input
            id="email"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            disabled={pending}
            placeholder="name@example.org"
          />
          <p className="text-xs text-muted-foreground">
            Optional. Must be unique. No sign-in is created here.
          </p>
        </div>

        <div className="space-y-1">
          <Label htmlFor="phone">Phone</Label>
          <Input
            id="phone"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            disabled={pending}
            placeholder="+91 ..."
          />
        </div>

        <div className="space-y-1">
          <Label htmlFor="photo_url">Photo URL</Label>
          <Input
            id="photo_url"
            value={photoUrl}
            onChange={(e) => setPhotoUrl(e.target.value)}
            disabled={pending}
            placeholder="https://.../photo.jpg"
          />
        </div>

        <div className="flex items-start gap-2 pt-1">
          <input
            id="needs_identity_review"
            type="checkbox"
            checked={needsReview}
            onChange={(e) => setNeedsReview(e.target.checked)}
            disabled={pending}
            className="mt-1 h-4 w-4 rounded border-input"
          />
          <div className="space-y-0.5">
            <Label htmlFor="needs_identity_review">Needs identity review</Label>
            <p className="text-xs text-muted-foreground">
              Flag for unverified identities awaiting a manual check.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 pt-2">
          <Button
            type="submit"
            disabled={pending || !fullName.trim()}
            className="bg-emerald-600 hover:bg-emerald-700 text-white"
          >
            <UserPlus className="mr-2 h-4 w-4" />
            {pending ? "Creating..." : "Create person"}
          </Button>
          <Link
            href="/admin/directory"
            className="text-sm text-muted-foreground hover:text-foreground"
          >
            Cancel
          </Link>
        </div>
      </form>
    </div>
  );
}
