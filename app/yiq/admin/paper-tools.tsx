"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { generatePaper, setPaperPublished } from "../actions/admin";

const PAPER = "#f7f4ed";
const SAFFRON = "#e8a33d";
const GREEN = "#14795a";
const DIM = "#9fb0d4";
const RULE = "rgba(247,244,237,0.14)";

type Row = {
  id: string;
  name: string;
  paper_kind: string;
  category: string;
  duration_minutes: number;
  total_questions: number;
  is_published: boolean;
};

const inputStyle: React.CSSProperties = {
  width: "100%",
  padding: "0.625rem 0.75rem",
  borderRadius: "0.5rem",
  border: `1.5px solid ${RULE}`,
  background: "rgba(247,244,237,0.06)",
  color: PAPER,
  fontSize: "0.875rem",
};

export function PaperTools({ papers }: { papers: Row[] }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [open, setOpen] = useState(false);

  function create(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    start(async () => {
      const res = await generatePaper({
        name: String(fd.get("name") ?? ""),
        category: String(fd.get("category") ?? "junior") as "junior" | "senior",
        kind: String(fd.get("kind") ?? "mock") as "mock" | "online_round",
        questionCount: Number(fd.get("questionCount") ?? 25),
        durationMinutes: Number(fd.get("durationMinutes") ?? 30),
        negativeMarks: Number(fd.get("negativeMarks") ?? 0),
        publish: fd.get("publish") === "on",
      });
      if (!res.success) {
        toast.error(res.error);
        return;
      }
      toast.success(`Paper built with ${res.questionCount} questions`);
      setOpen(false);
      router.refresh();
    });
  }

  function togglePublish(id: string, next: boolean) {
    start(async () => {
      const res = await setPaperPublished(id, next);
      if (!res.success) {
        toast.error(res.error);
        return;
      }
      toast.success(next ? "Paper published" : "Paper unpublished");
      router.refresh();
    });
  }

  return (
    <section className="mt-10">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="yiq-display text-[1.5rem]">Papers</h2>
        <button
          onClick={() => setOpen((o) => !o)}
          className="rounded-full px-5 py-2.5 text-[0.875rem] font-bold"
          style={{ background: SAFFRON, color: "#0a1633" }}
        >
          {open ? "Cancel" : "Build a paper"}
        </button>
      </div>

      {open ? (
        <form
          onSubmit={create}
          className="mt-4 grid gap-3 rounded-2xl border p-5 sm:grid-cols-2"
          style={{ borderColor: RULE }}
        >
          <label className="sm:col-span-2">
            <span className="yiq-eyebrow" style={{ color: DIM }}>
              Paper name
            </span>
            <input name="name" required style={inputStyle} className="mt-1.5" />
          </label>
          <label>
            <span className="yiq-eyebrow" style={{ color: DIM }}>
              Category
            </span>
            <select name="category" style={inputStyle} className="mt-1.5">
              <option value="junior">Junior · Cl 9–10</option>
              <option value="senior">Senior · Cl 11–12</option>
            </select>
          </label>
          <label>
            <span className="yiq-eyebrow" style={{ color: DIM }}>
              Kind
            </span>
            <select name="kind" style={inputStyle} className="mt-1.5">
              <option value="mock">Practice</option>
              <option value="online_round">Final online round</option>
            </select>
          </label>
          <label>
            <span className="yiq-eyebrow" style={{ color: DIM }}>
              Questions
            </span>
            <input
              name="questionCount"
              type="number"
              min={1}
              max={200}
              defaultValue={25}
              style={inputStyle}
              className="mt-1.5"
            />
          </label>
          <label>
            <span className="yiq-eyebrow" style={{ color: DIM }}>
              Minutes
            </span>
            <input
              name="durationMinutes"
              type="number"
              min={1}
              max={240}
              defaultValue={30}
              style={inputStyle}
              className="mt-1.5"
            />
          </label>
          <label>
            <span className="yiq-eyebrow" style={{ color: DIM }}>
              Negative marks per wrong answer
            </span>
            <input
              name="negativeMarks"
              type="number"
              min={0}
              max={5}
              step={0.25}
              defaultValue={0}
              style={inputStyle}
              className="mt-1.5"
            />
          </label>
          <label className="flex items-end gap-2 pb-2">
            <input type="checkbox" name="publish" />
            <span className="text-[0.875rem]">Publish immediately</span>
          </label>
          <button
            type="submit"
            disabled={pending}
            className="mt-1 justify-self-start rounded-full px-5 py-2.5 text-[0.875rem] font-bold disabled:opacity-60 sm:col-span-2"
            style={{ background: SAFFRON, color: "#0a1633" }}
          >
            {pending ? "Building…" : "Build paper"}
          </button>
        </form>
      ) : null}

      <ul className="mt-4 grid gap-2">
        {papers.map((p) => (
          <li
            key={p.id}
            className="flex flex-wrap items-center justify-between gap-3 rounded-xl border px-4 py-3"
            style={{ borderColor: RULE }}
          >
            <div className="min-w-0">
              <p className="text-[0.9375rem] font-semibold">{p.name}</p>
              <p className="yiq-eyebrow mt-0.5" style={{ color: DIM }}>
                {p.paper_kind.replace("_", " ")} · {p.category} · {p.total_questions}q ·{" "}
                {p.duration_minutes}min
              </p>
            </div>
            <button
              onClick={() => togglePublish(p.id, !p.is_published)}
              disabled={pending}
              className="rounded-full px-4 py-2 text-[0.8125rem] font-bold disabled:opacity-60"
              style={
                p.is_published
                  ? { background: `${GREEN}33`, color: "#7fd4b0" }
                  : { background: "rgba(247,244,237,0.08)", color: DIM }
              }
            >
              {p.is_published ? "Published" : "Draft"}
            </button>
          </li>
        ))}
      </ul>
    </section>
  );
}
