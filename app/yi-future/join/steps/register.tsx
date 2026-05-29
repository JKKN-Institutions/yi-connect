"use client";

import { useState, useTransition, useEffect, useRef, useMemo } from "react";
import { useSearchParams } from "next/navigation";
import {
  registerDelegate,
  searchApprovedColleges,
  lookupReturningDelegate,
  type CollegeSuggestion,
  type PreviousProfile,
} from "@/app/yi-future/actions/delegate-register";

type ChapterMini = {
  id: string;
  name: string;
  city: string;
  state: string | null;
};

type FormState = {
  full_name: string;
  email: string;
  mobile: string;
  whatsapp_same: boolean;
  whatsapp: string;
  gender: "male" | "female" | "";
  is_yi_yuva_member: "yes" | "no" | "";
  chapter_id: string;
  college_name: string;
  college_id: string | null;
  college_city: string;
  course: string;
  specialization: string;
  year_of_study: 1 | 2 | 3 | 4 | 5 | 0;
  age: string;
  interest_internships: boolean;
  interest_jobs: boolean;
  interest_workshops: boolean;
  travel_commitment: "yes" | "no" | "";
  declaration_accepted: boolean;
  password: string;
};

type FieldErrors = Partial<Record<keyof FormState, string>>;

const EMPTY: FormState = {
  full_name: "",
  email: "",
  mobile: "",
  whatsapp_same: true,
  whatsapp: "",
  gender: "",
  is_yi_yuva_member: "",
  chapter_id: "",
  college_name: "",
  college_id: null,
  college_city: "",
  course: "",
  specialization: "",
  year_of_study: 0,
  age: "",
  interest_internships: false,
  interest_jobs: false,
  interest_workshops: false,
  travel_commitment: "",
  declaration_accepted: false,
  password: "",
};

const STORAGE_KEY = "yifuture_register_draft_2026";
const DECLARATION_TEXT =
  "I confirm that all details provided in this registration form are accurate & I understand the structure of Future 6.0 and agree to participate in all required stages.";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const INDIA_MOBILE_RE = /^[6-9]\d{9}$/;

function digitsOnly(s: string): string {
  return s.replace(/[^\d]/g, "").slice(0, 10);
}

export function RegisterStep({
  chapters,
  onSuccess,
}: {
  chapters: ChapterMini[];
  onSuccess?: (redirect: string) => void;
}) {
  const searchParams = useSearchParams();
  const [section, setSection] = useState<1 | 2 | 3 | 4>(1);
  const [form, setForm] = useState<FormState>(EMPTY);
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});
  const [pending, startTransition] = useTransition();
  const hydrated = useRef(false);
  const [returningProfile, setReturningProfile] = useState<PreviousProfile | null>(null);
  const [lookupDone, setLookupDone] = useState(false);
  const lookupRef = useRef(false);

  const preferredTrack = useMemo(() => {
    const fromUrl = searchParams.get("track");
    if (fromUrl) return fromUrl;
    try { return localStorage.getItem("yifuture_quiz_track"); } catch { return null; }
  }, [searchParams]);

  function applyReturningProfile(p: PreviousProfile) {
    setForm((prev) => ({
      ...prev,
      full_name: p.full_name || prev.full_name,
      email: p.email || prev.email,
      mobile: p.phone?.replace(/^91/, "") || prev.mobile,
      whatsapp: p.whatsapp?.replace(/^91/, "") || prev.mobile,
      whatsapp_same: p.phone === p.whatsapp || !p.whatsapp,
      gender: (p.gender as "male" | "female" | "") || prev.gender,
      is_yi_yuva_member: p.is_yi_yuva_member === true ? "yes" : p.is_yi_yuva_member === false ? "no" : prev.is_yi_yuva_member,
      chapter_id: prev.chapter_id,
      college_name: p.college_name || prev.college_name,
      college_city: p.college_city || prev.college_city,
      course: p.course || prev.course,
      specialization: p.specialization || prev.specialization,
      year_of_study: (p.year_of_study as 1 | 2 | 3 | 4 | 5) || prev.year_of_study,
      age: p.age ? String(p.age) : prev.age,
    }));
    setReturningProfile(null);
  }

  useEffect(() => {
    if (hydrated.current) return;
    hydrated.current = true;
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw) as Partial<FormState>;
        setForm((prev) => ({ ...prev, ...parsed }));
      }
    } catch {
      /* ignore */
    }
  }, []);

  useEffect(() => {
    if (!hydrated.current) return;
    try {
      const { password: _pw, ...safeForm } = form;
      localStorage.setItem(STORAGE_KEY, JSON.stringify(safeForm));
    } catch {
      /* ignore */
    }
  }, [form]);

  function update<K extends keyof FormState>(key: K, value: FormState[K]) {
    setForm((prev) => ({ ...prev, [key]: value }));
    setError(null);
    setFieldErrors((prev) => {
      if (!prev[key] && !prev.whatsapp) return prev;
      const next = { ...prev };
      delete next[key];
      // also clear whatsapp error when user toggles whatsapp_same on
      if (key === "whatsapp_same" && value === true) delete next.whatsapp;
      if (key === "mobile" && prev.whatsapp_same) delete next.whatsapp;
      return next;
    });
  }

  function validateSection(
    n: 1 | 2 | 3 | 4
  ): { ok: true } | { ok: false; banner: string; fields: FieldErrors } {
    if (n === 1) {
      const fields: FieldErrors = {};
      if (!form.full_name.trim()) fields.full_name = "Please enter your full name.";
      if (!EMAIL_RE.test(form.email.trim()))
        fields.email = "Please enter a valid email address.";
      if (!INDIA_MOBILE_RE.test(form.mobile))
        fields.mobile = "10 digits, starting with 6, 7, 8 or 9.";
      const wa = form.whatsapp_same ? form.mobile : form.whatsapp;
      if (!INDIA_MOBILE_RE.test(wa)) {
        if (form.whatsapp_same) {
          // Already flagged on mobile; don't double-flag.
          if (!fields.mobile)
            fields.mobile = "10 digits, starting with 6, 7, 8 or 9.";
        } else {
          fields.whatsapp = "10 digits, starting with 6, 7, 8 or 9.";
        }
      }
      if (!form.gender) fields.gender = "Please pick your gender.";
      if (!form.is_yi_yuva_member)
        fields.is_yi_yuva_member = "Please answer this question.";
      if (!form.chapter_id) fields.chapter_id = "Please pick your Yi chapter.";
      if (Object.keys(fields).length > 0) {
        return {
          ok: false,
          banner:
            "Please fix the highlighted fields before continuing.",
          fields,
        };
      }
      return { ok: true };
    }
    if (n === 2) {
      const fields: FieldErrors = {};
      if (!form.college_name.trim())
        fields.college_name = "Please enter your college.";
      if (!form.college_city.trim())
        fields.college_city = "Please enter the college city.";
      if (!form.course.trim()) fields.course = "Please enter your course.";
      if (![1, 2, 3, 4, 5].includes(form.year_of_study))
        fields.year_of_study = "Please pick your year of study.";
      const ageNum = Number(form.age);
      if (!Number.isFinite(ageNum) || ageNum < 18 || ageNum > 25)
        fields.age = "Age must be between 18 and 25.";
      if (Object.keys(fields).length > 0) {
        return {
          ok: false,
          banner: "Please fix the highlighted fields before continuing.",
          fields,
        };
      }
      return { ok: true };
    }
    if (n === 3) {
      if (!form.travel_commitment)
        return {
          ok: false,
          banner: "Please answer the National Finals travel question.",
          fields: {
            travel_commitment:
              "Please answer the National Finals travel question.",
          },
        };
      if (form.travel_commitment === "no")
        return {
          ok: false,
          banner:
            "Sorry — National Finals require willingness to travel.",
          fields: {
            travel_commitment:
              "National Finals require willingness to travel.",
          },
        };
      return { ok: true };
    }
    if (n === 4) {
      const fields: FieldErrors = {};
      if (!form.password || form.password.length < 6)
        fields.password = "At least 6 characters.";
      if (!form.declaration_accepted)
        fields.declaration_accepted = "Please accept the declaration.";
      if (Object.keys(fields).length > 0) {
        return {
          ok: false,
          banner: "Please fix the highlighted fields before continuing.",
          fields,
        };
      }
      return { ok: true };
    }
    return { ok: true };
  }

  function next() {
    const result = validateSection(section);
    if (!result.ok) {
      setError(result.banner);
      setFieldErrors(result.fields);
      // Scroll to top of section so the banner is visible
      if (typeof window !== "undefined") {
        window.scrollTo({ top: 0, behavior: "smooth" });
      }
      return;
    }
    setError(null);
    setFieldErrors({});
    if (section === 1 && !lookupDone && !lookupRef.current) {
      lookupRef.current = true;
      const email = form.email.trim();
      const phone = form.mobile;
      lookupReturningDelegate(email, phone).then((p) => {
        setLookupDone(true);
        if (p) setReturningProfile(p);
      }).catch(() => setLookupDone(true));
    }
    if (section < 4) setSection((section + 1) as 1 | 2 | 3 | 4);
  }
  function back() {
    setError(null);
    setFieldErrors({});
    if (section > 1) setSection((section - 1) as 1 | 2 | 3 | 4);
  }

  function submit() {
    const result = validateSection(4);
    if (!result.ok) {
      setError(result.banner);
      setFieldErrors(result.fields);
      return;
    }
    startTransition(async () => {
      const res = await registerDelegate({
        full_name: form.full_name.trim(),
        email: form.email.trim(),
        mobile: form.mobile,
        whatsapp: form.whatsapp_same ? form.mobile : form.whatsapp,
        gender: form.gender as "male" | "female",
        is_yi_yuva_member: form.is_yi_yuva_member === "yes",
        chapter_id: form.chapter_id,
        college_name: form.college_name.trim(),
        college_city: form.college_city.trim(),
        course: form.course.trim(),
        specialization: form.specialization.trim() || undefined,
        year_of_study: form.year_of_study as 1 | 2 | 3 | 4 | 5,
        age: Number(form.age),
        interest_internships: form.interest_internships,
        interest_jobs: form.interest_jobs,
        interest_workshops: form.interest_workshops,
        travel_commitment: form.travel_commitment === "yes",
        declaration_accepted: form.declaration_accepted,
        password: form.password,
        preferred_track_slug: preferredTrack || undefined,
      });
      if (res.ok) {
        try {
          localStorage.removeItem(STORAGE_KEY);
          localStorage.removeItem("yifuture_quiz_track");
        } catch {
          /* ignore */
        }
        if (onSuccess) onSuccess(res.redirect);
        else window.location.href = res.redirect;
      } else {
        setError(res.error);
      }
    });
  }

  return (
    <div className="max-w-2xl mx-auto py-6 px-4">
      <ProgressDots current={section} />

      <div className="mt-5 bg-white border border-navy/10 rounded-lg p-5 sm:p-6">
        {error && (
          <div
            role="alert"
            aria-live="polite"
            className="mb-4 text-sm text-red-700 bg-red-50 border-2 border-red-300 rounded-md p-3 font-semibold"
          >
            {error}
          </div>
        )}

        {section === 1 && (
          <Section1
            form={form}
            update={update}
            chapters={chapters}
            errors={fieldErrors}
          />
        )}
        {returningProfile && section === 2 && (
          <div className="mb-4 p-4 rounded-lg bg-[#F5A623]/10 border-2 border-[#F5A623]/30">
            <div className="flex items-start justify-between gap-3">
              <div>
                <div className="text-xs font-bold uppercase tracking-widest text-[#F5A623] mb-1">
                  Welcome back — Future alumni
                </div>
                <p className="text-sm text-navy">
                  We found your <strong>Future {returningProfile.edition_slug}</strong> profile
                  {returningProfile.chapter_name && <> from <strong>{returningProfile.chapter_name}</strong></>}.
                  Want to use your previous details?
                </p>
              </div>
              <div className="flex gap-2 shrink-0">
                <button
                  type="button"
                  onClick={() => applyReturningProfile(returningProfile)}
                  className="px-3 py-1.5 rounded-md bg-[#F5A623] text-navy text-xs font-bold hover:bg-[#F5A623]/90"
                >
                  Use previous details
                </button>
                <button
                  type="button"
                  onClick={() => setReturningProfile(null)}
                  className="px-3 py-1.5 rounded-md border border-navy/20 text-navy text-xs font-semibold hover:bg-navy/5"
                >
                  Start fresh
                </button>
              </div>
            </div>
          </div>
        )}
        {section === 2 && (
          <Section2 form={form} update={update} chapterId={form.chapter_id} />
        )}
        {section === 3 && <Section3 form={form} update={update} />}
        {section === 4 && <Section4 form={form} update={update} />}

        <div className="mt-6 flex items-center justify-between">
          {section > 1 ? (
            <button
              type="button"
              onClick={back}
              className="min-h-[44px] px-4 py-2 rounded-md border border-navy/20 text-sm font-semibold text-navy hover:bg-navy/5"
            >
              ← Back
            </button>
          ) : (
            <span />
          )}
          {section < 4 ? (
            <button
              type="button"
              onClick={next}
              className="min-h-[44px] px-5 py-2 rounded-md bg-navy text-ivory text-sm font-semibold hover:bg-navy-dark"
            >
              Next →
            </button>
          ) : (
            <button
              type="button"
              onClick={submit}
              disabled={pending}
              className="min-h-[44px] px-5 py-2 rounded-md bg-[#F5A623] text-navy text-sm font-bold hover:bg-[#F5A623]/90 disabled:opacity-50"
            >
              {pending ? "Submitting…" : "Submit registration"}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

function ProgressDots({ current }: { current: 1 | 2 | 3 | 4 }) {
  const labels = ["Details", "Academic", "Opportunities", "Declaration"] as const;
  return (
    <div className="flex items-center gap-2 sm:gap-3">
      {labels.map((label, i) => {
        const n = (i + 1) as 1 | 2 | 3 | 4;
        const active = n === current;
        const done = n < current;
        return (
          <div key={label} className="flex-1 flex items-center gap-2">
            <div
              className={`flex items-center justify-center h-7 w-7 rounded-full text-xs font-bold shrink-0 ${
                done
                  ? "bg-yi-green text-white"
                  : active
                  ? "bg-navy text-ivory"
                  : "bg-navy/10 text-navy/40"
              }`}
            >
              {done ? "✓" : n}
            </div>
            <span
              className={`text-[10px] sm:text-xs font-semibold uppercase tracking-wider truncate ${
                active ? "text-navy" : "text-navy/40"
              }`}
            >
              {label}
            </span>
          </div>
        );
      })}
    </div>
  );
}

function Section1({
  form,
  update,
  chapters,
  errors,
}: {
  form: FormState;
  update: <K extends keyof FormState>(key: K, value: FormState[K]) => void;
  chapters: ChapterMini[];
  errors: FieldErrors;
}) {
  return (
    <div className="space-y-4">
      <SectionHeader n={1} title="Details" />

      <Field
        label="Full Name (as per college ID)"
        required
        error={errors.full_name}
      >
        <input
          type="text"
          value={form.full_name}
          onChange={(e) => update("full_name", e.target.value)}
          autoComplete="name"
          aria-invalid={!!errors.full_name}
          className={errorInputClass(!!errors.full_name)}
        />
      </Field>

      <Field
        label="Email Address"
        hint="For all official communication"
        required
        error={errors.email}
      >
        <input
          type="email"
          value={form.email}
          onChange={(e) => update("email", e.target.value)}
          autoComplete="email"
          aria-invalid={!!errors.email}
          className={errorInputClass(!!errors.email)}
        />
      </Field>

      <Field
        label="Mobile Number (primary)"
        hint="10-digit Indian mobile, +91 assumed"
        required
        error={errors.mobile}
      >
        <div className="flex">
          <span className="inline-flex items-center px-3 text-sm text-navy/60 bg-navy/5 border border-navy/20 border-r-0 rounded-l-md">
            +91
          </span>
          <input
            type="tel"
            value={form.mobile}
            onChange={(e) => update("mobile", digitsOnly(e.target.value))}
            inputMode="numeric"
            autoComplete="tel-national"
            placeholder="9876543210"
            aria-invalid={!!errors.mobile}
            className={`${errorInputClass(!!errors.mobile)} rounded-l-none`}
          />
        </div>
      </Field>

      <Field label="WhatsApp Number" required error={errors.whatsapp}>
        <label className="flex items-center gap-2 text-sm text-navy/70 mb-2">
          <input
            type="checkbox"
            checked={form.whatsapp_same}
            onChange={(e) => update("whatsapp_same", e.target.checked)}
            className="accent-[#F5A623]"
          />
          Same as mobile number
        </label>
        {!form.whatsapp_same && (
          <div className="flex">
            <span className="inline-flex items-center px-3 text-sm text-navy/60 bg-navy/5 border border-navy/20 border-r-0 rounded-l-md">
              +91
            </span>
            <input
              type="tel"
              value={form.whatsapp}
              onChange={(e) => update("whatsapp", digitsOnly(e.target.value))}
              inputMode="numeric"
              placeholder="9876543210"
              aria-invalid={!!errors.whatsapp}
              className={`${errorInputClass(!!errors.whatsapp)} rounded-l-none`}
            />
          </div>
        )}
      </Field>

      <Field label="Gender" required error={errors.gender}>
        <div
          className={`flex gap-3 ${
            errors.gender ? "rounded-md ring-2 ring-red-300 p-1 -m-1" : ""
          }`}
        >
          {(["male", "female"] as const).map((g) => (
            <label
              key={g}
              className={`flex-1 cursor-pointer min-h-[44px] inline-flex items-center justify-center px-4 rounded-md border text-sm font-semibold transition-colors ${
                form.gender === g
                  ? "bg-[#F5A623] text-navy border-[#F5A623]"
                  : errors.gender
                  ? "border-red-400 text-navy/80 hover:border-[#F5A623]/60"
                  : "border-navy/20 text-navy/70 hover:border-[#F5A623]/60"
              }`}
            >
              <input
                type="radio"
                name="gender"
                value={g}
                checked={form.gender === g}
                onChange={() => update("gender", g)}
                className="sr-only"
              />
              {g === "male" ? "Male" : "Female"}
            </label>
          ))}
        </div>
      </Field>

      <Field
        label="Are you a member of Yi YUVA?"
        required
        error={errors.is_yi_yuva_member}
      >
        <div
          className={`flex gap-3 ${
            errors.is_yi_yuva_member
              ? "rounded-md ring-2 ring-red-300 p-1 -m-1"
              : ""
          }`}
        >
          {(["yes", "no"] as const).map((v) => (
            <label
              key={v}
              className={`flex-1 cursor-pointer min-h-[44px] inline-flex items-center justify-center px-4 rounded-md border text-sm font-semibold transition-colors ${
                form.is_yi_yuva_member === v
                  ? "bg-[#F5A623] text-navy border-[#F5A623]"
                  : errors.is_yi_yuva_member
                  ? "border-red-400 text-navy/80 hover:border-[#F5A623]/60"
                  : "border-navy/20 text-navy/70 hover:border-[#F5A623]/60"
              }`}
            >
              <input
                type="radio"
                name="yiyuva"
                value={v}
                checked={form.is_yi_yuva_member === v}
                onChange={() => update("is_yi_yuva_member", v)}
                className="sr-only"
              />
              {v === "yes" ? "Yes" : "No"}
            </label>
          ))}
        </div>
      </Field>

      <Field
        label="Yi Chapter you'll participate under"
        required
        error={errors.chapter_id}
      >
        <select
          value={form.chapter_id}
          onChange={(e) => update("chapter_id", e.target.value)}
          aria-invalid={!!errors.chapter_id}
          className={errorInputClass(!!errors.chapter_id)}
        >
          <option value="">Pick your chapter…</option>
          {chapters.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </select>
      </Field>
    </div>
  );
}

function Section2({
  form,
  update,
  chapterId,
}: {
  form: FormState;
  update: <K extends keyof FormState>(key: K, value: FormState[K]) => void;
  chapterId: string;
}) {
  return (
    <div className="space-y-4">
      <SectionHeader n={2} title="Academic Information" />

      <CollegeField
        chapterId={chapterId}
        value={form.college_name}
        onChange={(name, id) => {
          update("college_name", name);
          update("college_id", id);
        }}
      />

      <Field label="City (of College)" required>
        <input
          type="text"
          value={form.college_city}
          onChange={(e) => update("college_city", e.target.value)}
          className={inputClass}
        />
      </Field>

      <Field label="Course / Degree" hint="e.g. BBA, B.Tech, BA" required>
        <input
          type="text"
          value={form.course}
          onChange={(e) => update("course", e.target.value)}
          className={inputClass}
        />
      </Field>

      <Field label="Specialization / Major" hint="optional">
        <input
          type="text"
          value={form.specialization}
          onChange={(e) => update("specialization", e.target.value)}
          className={inputClass}
        />
      </Field>

      <Field label="Year of Study" required>
        <div className="grid grid-cols-5 gap-2">
          {[
            { v: 1, label: "1st" },
            { v: 2, label: "2nd" },
            { v: 3, label: "3rd" },
            { v: 4, label: "4th" },
            { v: 5, label: "PG" },
          ].map((y) => (
            <label
              key={y.v}
              className={`cursor-pointer min-h-[44px] inline-flex items-center justify-center rounded-md border text-sm font-semibold transition-colors ${
                form.year_of_study === y.v
                  ? "bg-[#F5A623] text-navy border-[#F5A623]"
                  : "border-navy/20 text-navy/70 hover:border-[#F5A623]/60"
              }`}
            >
              <input
                type="radio"
                name="year"
                value={y.v}
                checked={form.year_of_study === y.v}
                onChange={() =>
                  update("year_of_study", y.v as 1 | 2 | 3 | 4 | 5)
                }
                className="sr-only"
              />
              {y.label}
            </label>
          ))}
        </div>
      </Field>

      <Field label="Age" hint="must be between 18 and 25" required>
        <input
          type="number"
          min={18}
          max={25}
          value={form.age}
          onChange={(e) => update("age", e.target.value)}
          className={inputClass}
          inputMode="numeric"
        />
      </Field>
    </div>
  );
}

function CollegeField({
  chapterId,
  value,
  onChange,
}: {
  chapterId: string;
  value: string;
  onChange: (name: string, id: string | null) => void;
}) {
  const [suggestions, setSuggestions] = useState<CollegeSuggestion[]>([]);
  const [showList, setShowList] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  function handleInput(v: string) {
    onChange(v, null);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (!chapterId || v.trim().length < 2) {
      setSuggestions([]);
      return;
    }
    debounceRef.current = setTimeout(async () => {
      const list = await searchApprovedColleges(chapterId, v);
      setSuggestions(list);
      setShowList(true);
    }, 200);
  }

  function pick(s: CollegeSuggestion) {
    onChange(s.name, s.id);
    setShowList(false);
  }

  const help = useMemo(() => {
    if (!chapterId) return "Pick your chapter first to see suggestions.";
    if (value.trim().length >= 2 && suggestions.length === 0)
      return "No match — your college will be added to the chapter admin's review queue.";
    return "Start typing — pick from the dropdown if your college is listed, otherwise type the full name.";
  }, [chapterId, value, suggestions.length]);

  return (
    <Field label="College / University Name" hint={help} required>
      <div className="relative">
        <input
          type="text"
          value={value}
          onChange={(e) => handleInput(e.target.value)}
          onFocus={() => suggestions.length > 0 && setShowList(true)}
          onBlur={() => setTimeout(() => setShowList(false), 200)}
          className={inputClass}
          autoComplete="off"
          disabled={!chapterId}
        />
        {showList && suggestions.length > 0 && (
          <ul className="absolute z-10 mt-1 left-0 right-0 bg-white border border-navy/20 rounded-md shadow max-h-60 overflow-auto">
            {suggestions.map((s) => (
              <li key={s.id}>
                <button
                  type="button"
                  onClick={() => pick(s)}
                  className="block w-full text-left px-3 py-2 text-sm hover:bg-[#F5A623]/10"
                >
                  <span className="font-semibold text-navy">{s.name}</span>
                  {s.city && (
                    <span className="text-navy/50 ml-2">({s.city})</span>
                  )}
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </Field>
  );
}

function Section3({
  form,
  update,
}: {
  form: FormState;
  update: <K extends keyof FormState>(key: K, value: FormState[K]) => void;
}) {
  return (
    <div className="space-y-5">
      <SectionHeader n={3} title="Opportunities & Preferences" />

      <div>
        <p className="text-sm font-semibold text-navy/80 mb-2">
          Are you open to the following through the Yi network?
        </p>
        <div className="space-y-2">
          {[
            { key: "interest_internships", label: "Internships" },
            { key: "interest_jobs", label: "Job opportunities" },
            { key: "interest_workshops", label: "Workshops" },
          ].map((opt) => (
            <label
              key={opt.key}
              className={`flex items-center gap-3 p-3 border rounded-md cursor-pointer transition-colors ${
                form[opt.key as keyof FormState]
                  ? "bg-[#F5A623]/10 border-[#F5A623]"
                  : "border-navy/20 hover:border-[#F5A623]/60"
              }`}
            >
              <input
                type="checkbox"
                checked={form[opt.key as keyof FormState] as boolean}
                onChange={(e) =>
                  update(opt.key as keyof FormState, e.target.checked as never)
                }
                className="accent-[#F5A623] h-5 w-5"
              />
              <span className="text-sm text-navy">{opt.label}</span>
            </label>
          ))}
        </div>
      </div>

      <div>
        <p className="text-sm font-semibold text-navy/80 mb-2">
          If selected for National Finals, are you willing to travel and attend?
        </p>
        <div className="flex gap-3">
          {(["yes", "no"] as const).map((v) => (
            <label
              key={v}
              className={`flex-1 cursor-pointer min-h-[44px] inline-flex items-center justify-center px-4 rounded-md border text-sm font-semibold transition-colors ${
                form.travel_commitment === v
                  ? "bg-[#F5A623] text-navy border-[#F5A623]"
                  : "border-navy/20 text-navy/70 hover:border-[#F5A623]/60"
              }`}
            >
              <input
                type="radio"
                name="travel"
                value={v}
                checked={form.travel_commitment === v}
                onChange={() => update("travel_commitment", v)}
                className="sr-only"
              />
              {v === "yes" ? "Yes" : "No"}
            </label>
          ))}
        </div>
      </div>
    </div>
  );
}

function Section4({
  form,
  update,
}: {
  form: FormState;
  update: <K extends keyof FormState>(key: K, value: FormState[K]) => void;
}) {
  return (
    <div className="space-y-5">
      <SectionHeader n={4} title="Declaration" />

      <Field label="Create a password" hint="At least 6 characters. You'll use this to log in with your email." required>
        <input
          type="password"
          value={form.password}
          onChange={(e) => update("password", e.target.value)}
          autoComplete="new-password"
          minLength={6}
          placeholder="••••••••"
          className={inputClass}
        />
      </Field>

      <div className="bg-[#F5A623]/10 border border-[#F5A623]/30 rounded-md p-4 text-sm text-navy">
        Please review your details before submitting. Once submitted, only your
        chapter admin can edit your registration.
      </div>

      <label className={`flex items-start gap-3 p-4 border-2 rounded-md cursor-pointer transition-colors ${
        form.declaration_accepted
          ? "bg-[#F5A623]/10 border-[#F5A623]"
          : "border-navy/20 hover:border-[#F5A623]/60"
      }`}>
        <input
          type="checkbox"
          checked={form.declaration_accepted}
          onChange={(e) => update("declaration_accepted", e.target.checked)}
          className="accent-[#F5A623] h-5 w-5 mt-0.5 shrink-0"
        />
        <span className="text-sm text-navy">{DECLARATION_TEXT}</span>
      </label>
    </div>
  );
}

const inputClass =
  "block w-full min-h-[44px] px-3 py-2 border border-navy/20 rounded-md text-sm text-navy bg-white placeholder:text-navy/30 focus:outline-none focus:border-[#F5A623] focus:ring-1 focus:ring-[#F5A623]/40";

const inputClassError =
  "block w-full min-h-[44px] px-3 py-2 border-2 border-red-400 rounded-md text-sm text-navy bg-red-50/30 placeholder:text-navy/30 focus:outline-none focus:border-red-500 focus:ring-1 focus:ring-red-300";

function errorInputClass(hasError: boolean): string {
  return hasError ? inputClassError : inputClass;
}

function Field({
  label,
  hint,
  required,
  error,
  children,
}: {
  label: string;
  hint?: string;
  required?: boolean;
  error?: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <label className="block text-xs font-semibold uppercase tracking-widest text-navy/70 mb-1.5">
        {label}
        {required && <span className="ml-1 text-yi-saffron">*</span>}
      </label>
      {children}
      {error ? (
        <p
          className="mt-1 text-xs font-semibold text-red-600"
          role="alert"
        >
          {error}
        </p>
      ) : (
        hint && <p className="mt-1 text-[11px] text-navy/50">{hint}</p>
      )}
    </div>
  );
}

function SectionHeader({ n, title }: { n: number; title: string }) {
  return (
    <div className="border-b border-navy/10 pb-3">
      <p className="text-[10px] font-semibold uppercase tracking-widest text-[#F5A623]">
        Section {n}
      </p>
      <h2 className="mt-1 text-xl font-bold text-navy">{title}</h2>
    </div>
  );
}
