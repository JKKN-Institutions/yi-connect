/**
 * Directory Admin — Edit Person Client (Phase B, 2026-05-28)
 */
"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft, Save } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

import { updatePerson } from "../../actions/directory-mutations";

type Props = {
  personId: string;
  initial: {
    full_name: string;
    email: string;
    phone: string;
  };
};

export function PersonEditClient({ personId, initial }: Props) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [fullName, setFullName] = useState(initial.full_name);
  const [email, setEmail] = useState(initial.email);
  const [phone, setPhone] = useState(initial.phone);

  function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!fullName.trim()) {
      toast.error("Full name is required");
      return;
    }
    startTransition(async () => {
      const res = await updatePerson(personId, {
        full_name: fullName.trim(),
        email: email.trim() || null,
        phone: phone.trim() || null,
      });
      if (res.success) {
        toast.success(res.message ?? "Saved");
        router.push(`/admin/directory/${personId}`);
        router.refresh();
      } else {
        toast.error(res.error);
      }
    });
  }

  const dirty =
    fullName.trim() !== initial.full_name ||
    email.trim() !== initial.email ||
    phone.trim() !== initial.phone;

  return (
    <div className="max-w-2xl mx-auto p-6 space-y-6">
      <div>
        <Link
          href={`/admin/directory/${personId}`}
          className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="h-3 w-3" /> Back to person
        </Link>
        <h1 className="mt-2 text-2xl font-semibold">Edit Person</h1>
        <p className="text-sm text-muted-foreground">
          Updates yi_directory.people. Role assignments are managed separately.
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
            Used for sign-in. Changing this does NOT update the linked
            auth.users record.
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

        <div className="flex items-center gap-2 pt-2">
          <Button
            type="submit"
            disabled={pending || !dirty}
            className="bg-emerald-600 hover:bg-emerald-700 text-white"
          >
            <Save className="mr-2 h-4 w-4" />
            {pending ? "Saving..." : "Save changes"}
          </Button>
          <Link
            href={`/admin/directory/${personId}`}
            className="text-sm text-muted-foreground hover:text-foreground"
          >
            Cancel
          </Link>
        </div>
      </form>
    </div>
  );
}
