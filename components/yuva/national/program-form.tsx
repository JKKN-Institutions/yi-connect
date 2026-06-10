"use client";

/**
 * Yi Youth Academy — program template form (Phase 4).
 * Title, category (the 7 national Program Creation Template categories),
 * Program Objective, summary (100–150-word UI hint with live word count)
 * and the takeaways list editor. Create mode redirects to the editor page;
 * edit mode saves in place. Session structure is managed separately by
 * session-structure-builder.tsx on the editor page.
 */

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Loader2, Plus, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import {
  CATEGORY_LABELS,
  PROGRAM_CATEGORIES,
  type ProgramCategory,
} from "@/lib/yuva/constants";
import {
  createProgram,
  updateProgram,
} from "@/app/youth-academy/actions/programs";

const formSchema = z.object({
  title: z.string().trim().min(1, "Title is required").max(200),
  category: z.enum(PROGRAM_CATEGORIES, "Pick one of the 7 categories"),
  objective: z.string().trim().max(2000).optional().default(""),
  summary: z.string().trim().max(4000).optional().default(""),
});

type FormValues = z.input<typeof formSchema>;

function wordCount(text: string): number {
  return text.trim().split(/\s+/).filter(Boolean).length;
}

export function ProgramForm({
  programId,
  initial,
}: {
  /** Present in edit mode; absent in create mode. */
  programId?: string;
  initial?: {
    title: string;
    category: ProgramCategory;
    objective: string;
    summary: string;
    takeaways: string[];
  };
}) {
  const router = useRouter();
  const { toast } = useToast();
  const [isPending, startTransition] = useTransition();

  // Takeaways live in simple local state (string list editor).
  const [takeaways, setTakeaways] = useState<string[]>(
    initial?.takeaways ?? []
  );
  const [takeawayDraft, setTakeawayDraft] = useState("");

  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      title: initial?.title ?? "",
      category: initial?.category,
      objective: initial?.objective ?? "",
      summary: initial?.summary ?? "",
    },
  });

  const summaryWords = wordCount(form.watch("summary") ?? "");

  function addTakeaway() {
    const value = takeawayDraft.trim();
    if (!value) return;
    if (takeaways.length >= 20) {
      toast({ description: "At most 20 takeaways", variant: "destructive" });
      return;
    }
    setTakeaways((prev) => [...prev, value]);
    setTakeawayDraft("");
  }

  function removeTakeaway(index: number) {
    setTakeaways((prev) => prev.filter((_, i) => i !== index));
  }

  function onSubmit(values: FormValues) {
    const payload = {
      title: values.title,
      category: values.category as ProgramCategory,
      objective: values.objective ?? "",
      summary: values.summary ?? "",
      takeaways,
    };

    startTransition(async () => {
      if (programId) {
        const result = await updateProgram(programId, payload);
        if (!result.success) {
          toast({ description: result.error, variant: "destructive" });
          return;
        }
        toast({ description: "Program saved" });
        router.refresh();
      } else {
        const result = await createProgram(payload);
        if (!result.success) {
          toast({ description: result.error, variant: "destructive" });
          return;
        }
        toast({
          description: "Program created — now add the session structure",
        });
        router.push(`/youth-academy/national/programs/${result.data.id}`);
      }
    });
  }

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
        <FormField
          control={form.control}
          name="title"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Program title</FormLabel>
              <FormControl>
                <Input
                  placeholder="e.g. Campus Entrepreneurship Bootcamp"
                  {...field}
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="category"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Category</FormLabel>
              <Select
                onValueChange={field.onChange}
                value={field.value ?? ""}
              >
                <FormControl>
                  <SelectTrigger className="w-full sm:w-72">
                    <SelectValue placeholder="Pick a category" />
                  </SelectTrigger>
                </FormControl>
                <SelectContent>
                  {PROGRAM_CATEGORIES.map((category) => (
                    <SelectItem key={category} value={category}>
                      {CATEGORY_LABELS[category]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <FormDescription>
                The 7 categories from the national Program Creation Template.
              </FormDescription>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="objective"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Program Objective</FormLabel>
              <FormControl>
                <Textarea
                  rows={3}
                  placeholder="What this program sets out to achieve for the cohort"
                  {...field}
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="summary"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Summary</FormLabel>
              <FormControl>
                <Textarea
                  rows={5}
                  placeholder="A short public summary of the program"
                  {...field}
                />
              </FormControl>
              <FormDescription>
                Aim for 100–150 words — currently{" "}
                <span
                  className={
                    summaryWords >= 100 && summaryWords <= 150
                      ? "font-medium text-emerald-600"
                      : "font-medium text-slate-500"
                  }
                >
                  {summaryWords} {summaryWords === 1 ? "word" : "words"}
                </span>
                .
              </FormDescription>
              <FormMessage />
            </FormItem>
          )}
        />

        {/* Takeaways list editor */}
        <div className="space-y-2">
          <p className="text-sm font-medium">Key takeaways</p>
          {takeaways.length > 0 && (
            <ul className="space-y-1.5">
              {takeaways.map((item, index) => (
                <li
                  key={`${index}-${item}`}
                  className="flex items-start justify-between gap-2 rounded-md border border-slate-200 bg-slate-50 px-3 py-1.5 text-sm text-slate-700"
                >
                  <span className="min-w-0 break-words">{item}</span>
                  <button
                    type="button"
                    aria-label={`Remove takeaway: ${item}`}
                    onClick={() => removeTakeaway(index)}
                    className="mt-0.5 shrink-0 text-slate-400 transition-colors hover:text-rose-600"
                  >
                    <X className="size-4" />
                  </button>
                </li>
              ))}
            </ul>
          )}
          <div className="flex gap-2">
            <Input
              value={takeawayDraft}
              onChange={(e) => setTakeawayDraft(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  addTakeaway();
                }
              }}
              placeholder="Add a takeaway and press Enter"
              maxLength={300}
            />
            <Button
              type="button"
              variant="outline"
              onClick={addTakeaway}
              disabled={!takeawayDraft.trim()}
            >
              <Plus className="size-4" />
              Add
            </Button>
          </div>
          <p className="text-[13px] text-slate-500">
            What participants walk away with — shown on the public program
            page.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <Button type="submit" disabled={isPending}>
            {isPending && <Loader2 className="size-4 animate-spin" />}
            {programId ? "Save program" : "Create program"}
          </Button>
          {!programId && (
            <p className="text-sm text-slate-500">
              You can add the session structure after creating the program.
            </p>
          )}
        </div>
      </form>
    </Form>
  );
}
