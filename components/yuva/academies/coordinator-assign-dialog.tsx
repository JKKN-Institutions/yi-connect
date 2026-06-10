"use client";

/**
 * Assign / replace / remove the institution coordinator (CHAPTER surface).
 *
 * assignCoordinator (server): find-or-create the yi_directory person,
 * provision a login when none exists (generated password returned ONCE —
 * shown here for out-of-band sharing), grant app='yuva'
 * role='institution_coordinator', bind academies.coordinator_person_id and
 * enqueue the invite email. Coordinators are OPTIONAL — an academy can run
 * with none (Director 2026-06-10).
 */

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { KeyRound, Loader2, UserMinus, UserPlus } from "lucide-react";
import toast from "react-hot-toast";
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
import {
  assignCoordinator,
  removeCoordinator,
} from "@/app/youth-academy/actions/academies";

const schema = z.object({
  fullName: z.string().trim().min(2, "Enter the coordinator's full name"),
  email: z.string().trim().email("Enter a valid email address"),
});

type FormValues = z.infer<typeof schema>;

export function CoordinatorAssignDialog({
  academyId,
  academyName,
  current,
}: {
  academyId: string;
  academyName: string;
  current: { name: string; email: string | null } | null;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [removing, setRemoving] = useState(false);
  const [oneTimePassword, setOneTimePassword] = useState<string | null>(null);

  const form = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: { fullName: "", email: "" },
  });

  async function onSubmit(values: FormValues) {
    setSubmitting(true);
    const result = await assignCoordinator({
      academyId,
      fullName: values.fullName,
      email: values.email,
    });
    setSubmitting(false);

    if (!result.success) {
      toast.error(result.error);
      return;
    }
    toast.success(
      result.data.created
        ? `${values.fullName} assigned — a new login was created.`
        : `${values.fullName} assigned as coordinator.`
    );
    router.refresh();
    if (result.data.password) {
      // Keep the dialog open to show the one-time password.
      setOneTimePassword(result.data.password);
      form.reset();
    } else {
      setOpen(false);
      form.reset();
    }
  }

  async function onRemove() {
    if (
      !window.confirm(
        `Remove ${current?.name ?? "the coordinator"} from ${academyName}? The chapter keeps running the academy through its own logins.`
      )
    ) {
      return;
    }
    setRemoving(true);
    const result = await removeCoordinator({ academyId });
    setRemoving(false);
    if (!result.success) {
      toast.error(result.error);
      return;
    }
    toast.success("Coordinator removed");
    router.refresh();
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      <Dialog
        open={open}
        onOpenChange={(next) => {
          setOpen(next);
          if (!next) setOneTimePassword(null);
        }}
      >
        <DialogTrigger asChild>
          <Button type="button" variant="outline" size="sm">
            <UserPlus className="size-4" />
            {current ? "Replace coordinator" : "Assign coordinator"}
          </Button>
        </DialogTrigger>
        <DialogContent className="sm:max-w-md">
          {oneTimePassword ? (
            <>
              <DialogHeader>
                <DialogTitle>Login created — share this once</DialogTitle>
                <DialogDescription>
                  A login was created for the coordinator. This password is
                  shown ONCE — share it with them directly (they can also use
                  the invite email to get started).
                </DialogDescription>
              </DialogHeader>
              <div className="flex items-center gap-2 rounded-lg border border-amber-200 bg-amber-50 p-3">
                <KeyRound className="size-4 shrink-0 text-amber-600" />
                <code className="text-base font-semibold tracking-wider text-slate-900">
                  {oneTimePassword}
                </code>
              </div>
              <DialogFooter>
                <Button
                  type="button"
                  onClick={() => {
                    void navigator.clipboard
                      .writeText(oneTimePassword)
                      .then(() => toast.success("Password copied"));
                  }}
                >
                  Copy password
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  onClick={() => {
                    setOpen(false);
                    setOneTimePassword(null);
                  }}
                >
                  Done
                </Button>
              </DialogFooter>
            </>
          ) : (
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
              <DialogHeader>
                <DialogTitle>
                  {current ? "Replace coordinator" : "Assign coordinator"}
                </DialogTitle>
                <DialogDescription>
                  {academyName} — the coordinator gets a login and co-manages
                  this academy&apos;s program runs. Optional: the chapter can
                  run everything without one.
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-1.5">
                <Label htmlFor="coordinator-name">Full name</Label>
                <Input
                  id="coordinator-name"
                  {...form.register("fullName")}
                  placeholder="e.g. Priya Raman"
                />
                {form.formState.errors.fullName ? (
                  <p className="text-xs text-red-600">
                    {form.formState.errors.fullName.message}
                  </p>
                ) : null}
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="coordinator-email">Email</Label>
                <Input
                  id="coordinator-email"
                  type="email"
                  {...form.register("email")}
                  placeholder="name@institution.edu"
                />
                {form.formState.errors.email ? (
                  <p className="text-xs text-red-600">
                    {form.formState.errors.email.message}
                  </p>
                ) : null}
                <p className="text-xs text-slate-400">
                  If this email is already in the Yi directory, the existing
                  person is linked — no duplicate is created.
                </p>
              </div>
              <DialogFooter>
                <Button type="submit" disabled={submitting}>
                  {submitting ? (
                    <Loader2 className="size-4 animate-spin" />
                  ) : null}
                  {current ? "Replace" : "Assign"}
                </Button>
              </DialogFooter>
            </form>
          )}
        </DialogContent>
      </Dialog>

      {current ? (
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={onRemove}
          disabled={removing}
          className="text-red-600 hover:bg-red-50 hover:text-red-700"
        >
          {removing ? (
            <Loader2 className="size-4 animate-spin" />
          ) : (
            <UserMinus className="size-4" />
          )}
          Remove
        </Button>
      ) : null}
    </div>
  );
}
