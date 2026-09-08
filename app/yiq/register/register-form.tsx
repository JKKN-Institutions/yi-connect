"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { registerTeam } from "../actions/register";
import type { RegisteredMember, RegisterMemberInput } from "@/lib/yiq/registration";
import { SCHOOL_TYPES, TEAM_MAX_MEMBERS, TEAM_MIN_MEMBERS } from "@/lib/yiq/constants";

const INK = "#0a1633";
const DIM = "#5a6480";
const RULE = "rgba(10,22,51,0.14)";

type Chapter = { id: string; chapterName: string; zone: string | null };

type Done = {
  teamCode: string;
  teamName?: string;
  schoolName?: string;
  chapterName?: string;
  category?: string;
  members: RegisteredMember[];
};

const emptyMember = (): RegisterMemberInput => ({ fullName: "", classLevel: 9 });

function Field({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <label className="block">
      <span className="text-[0.8125rem] font-semibold" style={{ color: INK }}>
        {label}
      </span>
      {hint ? (
        <span className="mt-0.5 block text-[0.75rem]" style={{ color: DIM }}>
          {hint}
        </span>
      ) : null}
      <div className="mt-1.5">{children}</div>
    </label>
  );
}

const inputStyle: React.CSSProperties = {
  width: "100%",
  padding: "0.6875rem 0.875rem",
  borderRadius: "0.625rem",
  border: `1.5px solid ${RULE}`,
  background: "#fff",
  color: INK,
  fontSize: "0.9375rem",
};

export function RegisterForm({ chapters }: { chapters: Chapter[] }) {
  const [pending, start] = useTransition();
  const [done, setDone] = useState<Done | null>(null);
  const [members, setMembers] = useState<RegisterMemberInput[]>([
    emptyMember(),
    emptyMember(),
  ]);
  const [error, setError] = useState<string | null>(null);

  function setMember(i: number, patch: Partial<RegisterMemberInput>) {
    setMembers((prev) =>
      prev.map((m, idx) => (idx === i ? { ...m, ...patch } : m))
    );
  }

  function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    const fd = new FormData(e.currentTarget);

    start(async () => {
      const res = await registerTeam({
        chapterEventId: String(fd.get("chapterEventId") ?? ""),
        schoolName: String(fd.get("schoolName") ?? ""),
        schoolType: String(fd.get("schoolType") ?? "private") as never,
        board: String(fd.get("board") ?? ""),
        city: String(fd.get("city") ?? ""),
        state: String(fd.get("state") ?? ""),
        principalName: String(fd.get("principalName") ?? ""),
        contactPerson: String(fd.get("contactPerson") ?? ""),
        contactEmail: String(fd.get("contactEmail") ?? ""),
        contactPhone: String(fd.get("contactPhone") ?? ""),
        teamName: String(fd.get("teamName") ?? ""),
        website: String(fd.get("website") ?? ""),
        members,
      });

      if (!res.success) {
        setError(res.error);
        toast.error(res.error);
        return;
      }
      setDone(res as Done);
      toast.success("Team registered");
      window.scrollTo({ top: 0, behavior: "smooth" });
    });
  }

  // ------------------------------------------------------------------ done
  if (done) {
    return (
      <div className="mt-8">
        <div
          className="rounded-2xl p-6 sm:p-7"
          style={{ background: INK, color: "#f7f4ed" }}
        >
          <p className="yiq-eyebrow" style={{ color: "#e8a33d" }}>
            Registered
          </p>
          <h2 className="yiq-display mt-2 text-[1.875rem]">{done.teamName}</h2>
          <p className="mt-1 text-[0.9375rem]" style={{ color: "#9fb0d4" }}>
            {done.schoolName} · {done.chapterName} ·{" "}
            {done.category === "junior" ? "Junior (Cl 9–10)" : "Senior (Cl 11–12)"}
          </p>
          <div
            className="mt-5 rounded-xl px-4 py-3"
            style={{ background: "rgba(247,244,237,0.08)" }}
          >
            <p className="yiq-eyebrow" style={{ color: "#9fb0d4" }}>
              Team code
            </p>
            <p className="yiq-data mt-1 text-[1.5rem] font-bold">
              {done.teamCode}
            </p>
          </div>
        </div>

        <div
          className="mt-4 rounded-2xl border p-6"
          style={{ borderColor: RULE, background: "#fff" }}
        >
          <h3 className="text-[1.0625rem] font-bold" style={{ color: INK }}>
            Each student&apos;s access code
          </h3>
          <p className="mt-1.5 text-[0.875rem]" style={{ color: DIM }}>
            Write these down or screenshot this screen now. A student signs in
            with their own code to take the online round — they are not shown
            again.
          </p>
          <ul className="mt-4 grid gap-2">
            {done.members.map((m) => (
              <li
                key={m.accessCode}
                className="flex items-center justify-between gap-4 rounded-xl px-4 py-3"
                style={{ background: "#f7f4ed" }}
              >
                <span className="text-[0.9375rem] font-semibold" style={{ color: INK }}>
                  {m.name}
                  <span className="ml-2 font-normal" style={{ color: DIM }}>
                    Class {m.classLevel}
                  </span>
                </span>
                <span className="yiq-data text-[1.125rem] font-bold" style={{ color: INK }}>
                  {m.accessCode}
                </span>
              </li>
            ))}
          </ul>
          <a
            href="/yiq/login"
            className="mt-5 inline-block rounded-full px-5 py-2.5 text-[0.875rem] font-bold"
            style={{ background: "#e8a33d", color: INK }}
          >
            Go to student sign-in
          </a>
        </div>
      </div>
    );
  }

  // ------------------------------------------------------------------ form
  return (
    <form onSubmit={onSubmit} className="mt-8 grid gap-7">
      {/* Honeypot — visually hidden, never focusable by a person. */}
      <input
        type="text"
        name="website"
        tabIndex={-1}
        autoComplete="off"
        aria-hidden="true"
        style={{ position: "absolute", left: "-9999px", width: 1, height: 1 }}
      />

      <fieldset className="grid gap-4">
        <legend className="yiq-eyebrow mb-2" style={{ color: DIM }}>
          Your school
        </legend>
        <Field label="Yi chapter" hint="The chapter running YIQ for your city">
          <select name="chapterEventId" required style={inputStyle} defaultValue="">
            <option value="" disabled>
              Choose a chapter
            </option>
            {chapters.map((c) => (
              <option key={c.id} value={c.id}>
                {c.chapterName}
                {c.zone ? ` — ${c.zone}` : ""}
              </option>
            ))}
          </select>
        </Field>
        <Field label="School name">
          <input name="schoolName" required maxLength={160} style={inputStyle} />
        </Field>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="School type">
            <select name="schoolType" style={inputStyle} defaultValue="private">
              {SCHOOL_TYPES.map((t) => (
                <option key={t.value} value={t.value}>
                  {t.label}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Board" hint="CBSE, ICSE, State — optional">
            <input name="board" maxLength={40} style={inputStyle} />
          </Field>
          <Field label="City">
            <input name="city" maxLength={80} style={inputStyle} />
          </Field>
          <Field label="State">
            <input name="state" maxLength={80} style={inputStyle} />
          </Field>
        </div>
      </fieldset>

      <fieldset className="grid gap-4">
        <legend className="yiq-eyebrow mb-2" style={{ color: DIM }}>
          Teacher in charge
        </legend>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Name">
            <input name="contactPerson" required maxLength={120} style={inputStyle} />
          </Field>
          <Field label="Principal's name" hint="Optional">
            <input name="principalName" maxLength={120} style={inputStyle} />
          </Field>
          <Field label="Email">
            <input name="contactEmail" type="email" required style={inputStyle} />
          </Field>
          <Field label="Mobile" hint="10 digits">
            <input
              name="contactPhone"
              type="tel"
              inputMode="numeric"
              required
              style={inputStyle}
            />
          </Field>
        </div>
      </fieldset>

      <fieldset className="grid gap-4">
        <legend className="yiq-eyebrow mb-2" style={{ color: DIM }}>
          The team
        </legend>
        <Field label="Team name" hint="How it appears on the scoreboard">
          <input name="teamName" required maxLength={80} style={inputStyle} />
        </Field>

        <div className="grid gap-3">
          {members.map((m, i) => (
            <div
              key={i}
              className="rounded-xl border p-4"
              style={{ borderColor: RULE, background: "#fff" }}
            >
              <div className="flex items-center justify-between">
                <span className="yiq-eyebrow" style={{ color: DIM }}>
                  {i === 0 ? "Captain" : `Member ${i + 1}`}
                </span>
                {members.length > TEAM_MIN_MEMBERS ? (
                  <button
                    type="button"
                    onClick={() =>
                      setMembers((p) => p.filter((_, idx) => idx !== i))
                    }
                    className="text-[0.8125rem] font-semibold underline"
                    style={{ color: "#c8452f" }}
                  >
                    Remove
                  </button>
                ) : null}
              </div>
              <div className="mt-3 grid gap-3 sm:grid-cols-[1fr_auto]">
                <input
                  placeholder="Full name"
                  value={m.fullName}
                  onChange={(e) => setMember(i, { fullName: e.target.value })}
                  required
                  maxLength={120}
                  style={inputStyle}
                />
                <select
                  value={m.classLevel}
                  onChange={(e) =>
                    setMember(i, { classLevel: Number(e.target.value) })
                  }
                  style={{ ...inputStyle, width: "auto", minWidth: "8.5rem" }}
                  aria-label={`Class for member ${i + 1}`}
                >
                  {[9, 10, 11, 12].map((c) => (
                    <option key={c} value={c}>
                      Class {c}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          ))}
        </div>

        {members.length < TEAM_MAX_MEMBERS ? (
          <button
            type="button"
            onClick={() => setMembers((p) => [...p, emptyMember()])}
            className="justify-self-start rounded-full border px-4 py-2 text-[0.8125rem] font-semibold"
            style={{ borderColor: RULE, color: INK }}
          >
            Add a third member
          </button>
        ) : null}

        <p className="text-[0.8125rem]" style={{ color: DIM }}>
          All members must be in the same category — Junior is Classes 9–10,
          Senior is Classes 11–12. Register a second team for the other
          category.
        </p>
      </fieldset>

      {error ? (
        <p
          role="alert"
          className="rounded-xl px-4 py-3 text-[0.875rem] font-medium"
          style={{ background: "#fdeceb", color: "#c8452f" }}
        >
          {error}
        </p>
      ) : null}

      <button
        type="submit"
        disabled={pending}
        className="justify-self-start rounded-full px-7 py-3.5 text-[0.9375rem] font-bold disabled:opacity-60"
        style={{ background: "#e8a33d", color: INK }}
      >
        {pending ? "Registering…" : "Register team"}
      </button>
    </form>
  );
}
