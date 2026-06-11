"use client";

/**
 * Yi Youth Academy — program template form (Phase 4).
 * Title, category (the 7 national Program Creation Template categories),
 * Program Objective, summary (100–150-word UI hint with live word count)
 * and the takeaways list editor. Create mode redirects to the editor page;
 * edit mode saves in place. Session structure is managed separately by
 * session-structure-builder.tsx on the editor page.
 */

import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { FileText, Loader2, Plus, Upload, X } from "lucide-react";
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
  removeProgramSyllabus,
  updateProgram,
  uploadProgramSyllabus,
} from "@/app/youth-academy/actions/programs";

const formSchema = z.object({
  title: z.string().trim().min(1, "Title is required").max(200),
  category: z.enum(PROGRAM_CATEGORIES, "Pick one of the 7 categories"),
  objective: z.string().trim().max(2000).optional().default(""),
  summary: z.string().trim().max(4000).optional().default(""),
});

type FormValues = z.input<typeof formSchema>;

// 6 MB cap, mirrored from uploadProgramSyllabus (server is authoritative).
const MAX_SYLLABUS_BYTES = 6 * 1024 * 1024;
const SYLLABUS_ACCEPT =
  ".pdf,.doc,.docx,.ppt,.pptx,.png,.jpg,.jpeg";

function wordCount(text: string): number {
  return text.trim().split(/\s+/).filter(Boolean).length;
}

function syllabusFileName(path: string): string {
  return path.split("/").pop() ?? path;
}

function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result as string;
      const comma = result.indexOf(",");
      resolve(comma >= 0 ? result.slice(comma + 1) : result);
    };
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(file);
  });
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
    /** Current syllabus storage path, if one is attached. */
    syllabusStoragePath?: string | null;
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

  // Program syllabus (one file per program; edit mode only).
  const [syllabusPath, setSyllabusPath] = useState<string | null>(
    initial?.syllabusStoragePath ?? null
  );
  const [syllabusBusy, setSyllabusBusy] = useState(false);
  const syllabusInputRef = useRef<HTMLInputElement | null>(null);

  async function handleSyllabusPicked(file: File) {
    if (!programId) return;
    if (file.size > MAX_SYLLABUS_BYTES) {
      toast({
        description: "Syllabus must be 6 MB or smaller",
        variant: "destructive",
      });
      return;
    }
    setSyllabusBusy(true);
    try {
      const base64 = await fileToBase64(file);
      const result = await uploadProgramSyllabus(
        programId,
        base64,
        file.type || "application/pdf"
      );
      if (!result.success) {
        toast({ description: result.error, variant: "destructive" });
        return;
      }
      setSyllabusPath(result.data.path);
      toast({ description: "Syllabus uploaded" });
      router.refresh();
    } catch {
      toast({
        description: "Could not read the selected file",
        variant: "destructive",
      });
    } finally {
      setSyllabusBusy(false);
      if (syllabusInputRef.current) syllabusInputRef.current.value = "";
    }
  }

  function handleSyllabusRemove() {
    if (!programId) return;
    setSyllabusBusy(true);
    startTransition(async () => {
      const result = await removeProgramSyllabus(programId);
      setSyllabusBusy(false);
      if (!result.success) {
        toast({ description: result.error, variant: "destructive" });
        return;
      }
      setSyllabusPath(null);
      toast({ description: "Syllabus removed" });
      router.refresh();
    });
  }

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

        {/* Program syllabus (edit mode only — upload needs a saved program) */}
        {programId && (
          <div className="space-y-2">
            <p className="text-sm font-medium">Program syllabus</p>
            <input
              ref={syllabusInputRef}
              type="file"
              accept={SYLLABUS_ACCEPT}
              className="hidden"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) void handleSyllabusPicked(file);
              }}
            />
            {syllabusPath ? (
              <div className="flex items-center justify-between gap-2 rounded-md border border-slate-200 bg-slate-50 px-3 py-2 text-sm">
                <span className="flex min-w-0 items-center gap-2 text-slate-700">
                  <FileText className="size-4 shrink-0 text-slate-400" />
                  <span className="truncate">
                    {syllabusFileName(syllabusPath)}
                  </span>
                </span>
                <span className="flex shrink-0 items-center gap-1.5">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    disabled={syllabusBusy}
                    onClick={() => syllabusInputRef.current?.click()}
                  >
                    {syllabusBusy ? (
                      <Loader2 className="size-4 animate-spin" />
                    ) : (
                      <Upload className="size-4" />
                    )}
                    Replace
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    disabled={syllabusBusy}
                    onClick={handleSyllabusRemove}
                    className="text-rose-600 hover:text-rose-700"
                  >
                    <X className="size-4" />
                    Remove
                  </Button>
                </span>
              </div>
            ) : (
              <Button
                type="button"
                variant="outline"
                disabled={syllabusBusy}
                onClick={() => syllabusInputRef.current?.click()}
              >
                {syllabusBusy ? (
                  <Loader2 className="size-4 animate-spin" />
                ) : (
                  <Upload className="size-4" />
                )}
                Upload syllabus
              </Button>
            )}
            <p className="text-[13px] text-slate-500">
              One PDF, Word, PowerPoint or image (max 6 MB). Enrolled students
              can download it from their program page.
            </p>
          </div>
        )}

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
