"use client";

import { useActionState, useState } from "react";
import { CheckCircle2 } from "lucide-react";
import {
  CLOSING,
  LABELS,
  PANCHAYATS,
  QUESTION_BY_KEY,
  SECTIONS,
  type SurveyQuestion,
} from "@/lib/rural-hub/anumanpalli-survey";
import type { FeedbackState } from "@/lib/rural-hub/types";
import { sendRuralFeedback } from "./actions";
import { Step } from "./step";

const INITIAL: FeedbackState = { ok: false, message: "" };

/**
 * Every answer is held in React state, not left to the browser: React 19
 * resets a form after a server action runs, which would wipe a villager's
 * ticks whenever the server refused the send. Hidden inputs carry the state.
 */
type Answers = Record<string, string[]>;

const chip =
  "flex min-h-12 w-full cursor-pointer items-start gap-3 rounded border px-4 py-3 text-left transition-colors focus-within:outline focus-within:outline-3 focus-within:outline-offset-2 focus-within:outline-[#865600]";
const chipOff = "border-[#C9C1AE] bg-white hover:border-[#865600]/60";
const chipOn = "border-[#865600] bg-[#FBEFD3]";
const fieldCls =
  "mt-1 w-full rounded border border-[#C9C1AE] bg-white px-3 py-3 text-base outline-none focus:border-[#865600] focus:ring-2 focus:ring-[#865600]/25";

export function FeedbackForm() {
  const [state, action, pending] = useActionState(sendRuralFeedbackSafe, INITIAL);
  const [answers, setAnswers] = useState<Answers>({});
  const [texts, setTexts] = useState<Record<string, string>>({});
  const [name, setName] = useState("");
  const [panchayat, setPanchayat] = useState("");
  const [phone, setPhone] = useState("");
  const [comment, setComment] = useState("");

  if (state.ok) {
    return (
      <section
        role="status"
        className="mt-12 rounded border-2 border-[#1B6446] bg-[#E0F0E8] px-6 py-8 text-center"
      >
        <CheckCircle2 className="mx-auto size-10 text-[#1B6446]" aria-hidden />
        <p className="mt-3 font-[family-name:var(--font-rh-display)] text-2xl font-bold">
          {LABELS.thanks.ta}
        </p>
        <p className="text-[#404A57]">{LABELS.thanks.en}</p>
        <p className="mt-6 text-lg">{CLOSING.ta}</p>
        <p className="text-sm text-[#4F5866]">{CLOSING.en}</p>
      </section>
    );
  }

  function toggle(q: SurveyQuestion, key: string) {
    setAnswers((prev) => {
      const cur = prev[q.key] ?? [];
      if (q.kind === "single") {
        return { ...prev, [q.key]: cur[0] === key ? [] : [key] };
      }
      if (cur.includes(key)) {
        return { ...prev, [q.key]: cur.filter((k) => k !== key) };
      }
      if (q.max !== null && cur.length >= q.max) return prev;
      return { ...prev, [q.key]: [...cur, key] };
    });
  }

  return (
    <form action={action} className="mt-12" noValidate>
      {/* Honeypot: hidden from people, filled by bots that fill every field. */}
      <div aria-hidden className="absolute -left-[9999px] h-px w-px overflow-hidden">
        <label>
          Website
          <input type="text" name="website" tabIndex={-1} autoComplete="off" defaultValue="" />
        </label>
      </div>

      {SECTIONS.map((sec) => (
        <section key={sec.n} className="mb-12">
          <Step n={sec.n} ta={sec.ta} en={sec.en} />
          {sec.banner && (
            <div className="mb-4 rounded border-2 border-dashed border-[#865600] bg-[#FBEFD3] px-4 py-3">
              <p>{sec.banner.ta}</p>
              <p className="text-sm text-[#4F5866]">{sec.banner.en}</p>
            </div>
          )}
          <div className="space-y-5">
            {sec.questions.map((k) => {
              const q = QUESTION_BY_KEY.get(k);
              if (!q) return null;
              const picked = answers[q.key] ?? [];
              const full = q.kind === "multi" && q.max !== null && picked.length >= q.max;
              return (
                <fieldset
                  key={q.key}
                  className="rounded border border-[#E0DBCF] border-l-[5px] border-l-[#865600] bg-white px-4 py-5 sm:px-5"
                >
                  <legend className="sr-only">{q.en}</legend>
                  <h3 className="font-[family-name:var(--font-rh-display)] text-xl leading-snug font-bold">
                    {q.ta}
                  </h3>
                  <p className="text-sm text-[#4F5866]">{q.en}</p>
                  {q.kind === "multi" && q.max !== null && (
                    <p className="mt-2 text-sm font-semibold text-[#865600]">
                      {q.max} {LABELS.pickUpTo.ta} · {LABELS.pickUpTo.en} {q.max} ·{" "}
                      {picked.length}/{q.max}
                    </p>
                  )}
                  <div className="mt-4 grid grid-cols-1 gap-2 sm:grid-cols-2">
                    {q.options.map((o) => {
                      const on = picked.includes(o.key);
                      const disabled = !on && full;
                      return (
                        <label
                          key={o.key}
                          className={`${chip} ${on ? chipOn : chipOff} ${disabled ? "cursor-not-allowed opacity-45" : ""}`}
                        >
                          <input
                            type={q.kind === "multi" ? "checkbox" : "radio"}
                            className="mt-1 size-5 shrink-0 accent-[#865600]"
                            checked={on}
                            disabled={disabled}
                            onChange={() => toggle(q, o.key)}
                            onClick={(e) => {
                              // A second tap on a chosen radio clears it.
                              if (q.kind === "single" && on) {
                                e.preventDefault();
                                toggle(q, o.key);
                              }
                            }}
                          />
                          <span>
                            <span className="block">{o.ta}</span>
                            <span className="block text-sm text-[#4F5866]">{o.en}</span>
                          </span>
                        </label>
                      );
                    })}
                  </div>
                  {picked.map((v) => (
                    <input key={v} type="hidden" name={q.key} value={v} />
                  ))}
                  {q.text && (
                    <label className="mt-4 block">
                      <span className="text-sm">
                        {q.text.ta} <span className="text-[#4F5866]">{q.text.en}</span>
                      </span>
                      <input
                        name={`${q.key}__text`}
                        maxLength={500}
                        value={texts[q.key] ?? ""}
                        onChange={(e) => setTexts((p) => ({ ...p, [q.key]: e.target.value }))}
                        className={fieldCls}
                      />
                    </label>
                  )}
                </fieldset>
              );
            })}
          </div>
        </section>
      ))}

      <section className="mb-8 rounded border-2 border-[#253F6E] bg-white px-4 py-5 sm:px-5">
        <h2 className="font-[family-name:var(--font-rh-display)] text-2xl font-bold">
          {LABELS.aboutYou.ta}
        </h2>
        <p className="text-sm text-[#4F5866]">{LABELS.aboutYou.en}</p>

        <label className="mt-4 block">
          <span>
            {LABELS.name.ta} <span className="text-sm text-[#4F5866]">{LABELS.name.en}</span>
            <span className="text-[#9C2F28]"> *</span>
          </span>
          <input
            name="respondent_name"
            required
            maxLength={120}
            autoComplete="name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            className={fieldCls}
          />
        </label>

        <fieldset className="mt-4">
          <legend>
            {LABELS.panchayat.ta}{" "}
            <span className="text-sm text-[#4F5866]">{LABELS.panchayat.en}</span>
            <span className="text-[#9C2F28]"> *</span>
          </legend>
          <div className="mt-2 grid grid-cols-1 gap-2 sm:grid-cols-3">
            {PANCHAYATS.map((p) => (
              <label key={p.key} className={`${chip} ${panchayat === p.key ? chipOn : chipOff}`}>
                <input
                  type="radio"
                  value={p.key}
                  checked={panchayat === p.key}
                  onChange={() => setPanchayat(p.key)}
                  className="mt-1 size-5 shrink-0 accent-[#865600]"
                />
                <span>
                  <span className="block">{p.ta}</span>
                  <span className="block text-sm text-[#4F5866]">{p.en}</span>
                </span>
              </label>
            ))}
          </div>
          {/* Sent from state: React resets native radios after a refused send. */}
          <input type="hidden" name="panchayat" value={panchayat} />
        </fieldset>

        <label className="mt-4 block">
          <span>
            {LABELS.phone.ta} <span className="text-sm text-[#4F5866]">{LABELS.phone.en}</span>
          </span>
          <input
            name="phone"
            type="tel"
            inputMode="tel"
            maxLength={20}
            autoComplete="tel"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            className={fieldCls}
          />
        </label>

        <label className="mt-4 block">
          <span>
            {LABELS.anyElse.ta} <span className="text-sm text-[#4F5866]">{LABELS.anyElse.en}</span>
          </span>
          <textarea
            name="comment"
            rows={3}
            maxLength={1000}
            value={comment}
            onChange={(e) => setComment(e.target.value)}
            className={fieldCls}
          />
        </label>
      </section>

      {state.message && (
        <p role="alert" className="mb-4 rounded border border-[#9C2F28]/40 bg-[#F9E8E6] px-4 py-3 text-[#9C2F28]">
          {state.message}
        </p>
      )}

      <button
        type="submit"
        disabled={pending}
        className="min-h-14 w-full rounded bg-[#253F6E] px-6 py-3 text-lg font-semibold text-white transition-opacity hover:bg-[#1d3258] focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-[#865600] disabled:opacity-60"
      >
        {pending ? "…" : `${LABELS.submit.ta} · ${LABELS.submit.en}`}
      </button>
    </form>
  );
}

/** A dropped connection makes the action throw rather than return, and the
 *  form would then sit with no message at all. Turn that into a visible one. */
async function sendRuralFeedbackSafe(
  prev: FeedbackState,
  fd: FormData
): Promise<FeedbackState> {
  try {
    return await sendRuralFeedback(prev, fd);
  } catch {
    return {
      ok: false,
      message: "No connection. Your answers are still here. Please press Send again.",
    };
  }
}
