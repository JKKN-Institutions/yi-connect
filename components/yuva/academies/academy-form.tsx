"use client";

/**
 * NATIONAL academy create / edit form (spec "National — academies").
 *
 * - chapter picked from the Yi chapter list (yi.chapters) with a free-text
 *   fallback for chapters not in the master yet
 * - optional institution (canonical picker + "Other" free text + ask-to-add)
 * - display name: blank ⇒ server computes the default
 *   ("Yi {Chapter} Youth Academy" / "Yi – {Institution} Youth Academy")
 * - duplicate-institution conflicts come back as friendly server errors
 */

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Loader2 } from "lucide-react";
import toast from "react-hot-toast";
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
  createAcademy,
  updateAcademy,
} from "@/app/youth-academy/actions/academies";
import {
  InstitutionPicker,
  type InstitutionSelection,
} from "./institution-picker";

const OTHER_CHAPTER = "__other__";

const formSchema = z.object({
  chapterChoice: z.string().min(1, "Pick a chapter"),
  chapterOther: z.string().trim().max(120).optional(),
  display_name: z.string().trim().max(200).optional(),
  capacity_norm: z
    .number({ message: "Enter the seat capacity" })
    .int()
    .min(1)
    .max(500),
});

type FormValues = z.infer<typeof formSchema>;

export type AcademyFormInitial = {
  id: string;
  chapter: string;
  display_name: string;
  capacity_norm: number;
  institution_id: string | null;
  institution_name: string | null;
  institution_other: string | null;
};

export function AcademyForm({
  chapters,
  initial,
}: {
  /** Active Yi chapter names from yi.chapters (national-only read). */
  chapters: { name: string; region: string | null }[];
  /** Present in edit mode. */
  initial?: AcademyFormInitial;
}) {
  const router = useRouter();
  const isEdit = Boolean(initial);
  const chapterInList = useMemo(
    () => Boolean(initial && chapters.some((c) => c.name === initial.chapter)),
    [chapters, initial]
  );

  const [institution, setInstitution] = useState<InstitutionSelection>({
    institution_id: initial?.institution_id ?? null,
    institution_name: initial?.institution_name ?? null,
    institution_other: initial?.institution_other ?? null,
  });
  const [submitting, setSubmitting] = useState(false);

  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      chapterChoice: initial
        ? chapterInList
          ? initial.chapter
          : OTHER_CHAPTER
        : "",
      chapterOther: initial && !chapterInList ? initial.chapter : "",
      display_name: initial?.display_name ?? "",
      capacity_norm: initial?.capacity_norm ?? 50,
    },
  });

  const chapterChoice = form.watch("chapterChoice");
  const chapterOther = form.watch("chapterOther");
  const effectiveChapter =
    chapterChoice === OTHER_CHAPTER ? (chapterOther ?? "").trim() : chapterChoice;
  const institutionLabel =
    institution.institution_name ?? institution.institution_other ?? null;
  const defaultName = effectiveChapter
    ? institutionLabel
      ? `Yi – ${institutionLabel} Youth Academy`
      : `Yi ${effectiveChapter} Youth Academy`
    : "";

  async function onSubmit(values: FormValues) {
    const chapter =
      values.chapterChoice === OTHER_CHAPTER
        ? (values.chapterOther ?? "").trim()
        : values.chapterChoice;
    if (chapter.length < 2) {
      form.setError("chapterOther", { message: "Type the chapter name" });
      return;
    }

    setSubmitting(true);
    const payload = {
      chapter,
      institution_id: institution.institution_id,
      institution_other: institution.institution_other,
      display_name: values.display_name ?? "",
      capacity_norm: values.capacity_norm,
    };
    const result = initial
      ? await updateAcademy({ academyId: initial.id, ...payload })
      : await createAcademy(payload);
    setSubmitting(false);

    if (!result.success) {
      toast.error(result.error);
      return;
    }
    toast.success(
      isEdit
        ? "Academy updated"
        : `"${result.data.display_name}" created — creation is the approval.`
    );
    router.push(`/youth-academy/national/academies/${result.data.id}`);
    router.refresh();
  }

  return (
    <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-5">
      <div className="space-y-1.5">
        <Label>Yi chapter</Label>
        <Select
          value={chapterChoice}
          onValueChange={(v) =>
            form.setValue("chapterChoice", v, { shouldValidate: true })
          }
        >
          <SelectTrigger className="w-full">
            <SelectValue placeholder="Pick the chapter" />
          </SelectTrigger>
          <SelectContent>
            {chapters.map((c) => (
              <SelectItem key={c.name} value={c.name}>
                {c.name}
                {c.region ? ` · ${c.region}` : ""}
              </SelectItem>
            ))}
            <SelectItem value={OTHER_CHAPTER}>
              Other (type the name)
            </SelectItem>
          </SelectContent>
        </Select>
        {form.formState.errors.chapterChoice ? (
          <p className="text-xs text-red-600">
            {form.formState.errors.chapterChoice.message}
          </p>
        ) : null}
        {chapterChoice === OTHER_CHAPTER ? (
          <Input
            {...form.register("chapterOther")}
            placeholder="Chapter name, e.g. Madurai"
            className="mt-1"
          />
        ) : null}
        {form.formState.errors.chapterOther ? (
          <p className="text-xs text-red-600">
            {form.formState.errors.chapterOther.message}
          </p>
        ) : null}
      </div>

      <div className="space-y-1.5">
        <Label>Partner institution (optional)</Label>
        <InstitutionPicker value={institution} onChange={setInstitution} />
        <p className="text-xs text-slate-400">
          An institution can be attached to only one academy. Launch academies
          may start without one.
        </p>
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="display_name">Display name</Label>
        <Input
          id="display_name"
          {...form.register("display_name")}
          placeholder={defaultName || "Leave blank for the default"}
        />
        <p className="text-xs text-slate-400">
          Leave blank to use the default
          {defaultName ? `: “${defaultName}”` : ""}.
        </p>
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="capacity_norm">Capacity norm (seats)</Label>
        <Input
          id="capacity_norm"
          type="number"
          min={1}
          max={500}
          {...form.register("capacity_norm", { valueAsNumber: true })}
          className="max-w-32"
        />
        <p className="text-xs text-slate-400">
          Space norm is 30–50 seats — a soft cap, never a block.
        </p>
        {form.formState.errors.capacity_norm ? (
          <p className="text-xs text-red-600">
            {form.formState.errors.capacity_norm.message}
          </p>
        ) : null}
      </div>

      <div className="flex gap-2 pt-2">
        <Button type="submit" disabled={submitting}>
          {submitting ? <Loader2 className="size-4 animate-spin" /> : null}
          {isEdit ? "Save changes" : "Create academy"}
        </Button>
        <Button
          type="button"
          variant="ghost"
          onClick={() => router.back()}
          disabled={submitting}
        >
          Cancel
        </Button>
      </div>
    </form>
  );
}
