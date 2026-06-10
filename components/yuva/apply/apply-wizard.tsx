"use client";

/**
 * Public multi-step application wizard (Phase 8).
 * Donor pattern: app/yi-future/join/steps/register.tsx (sectioned client
 * form + useTransition + server action), simplified to the spec's 3 steps:
 *   1. Personal   — name, email, phone, DOB (optional)
 *   2. Academic   — institution (search + Other), degree/department, year
 *   3. Motivation — why join, Yi YUVA membership claim, declaration
 * Submit → submitApplication → confirmation screen with the tokenized
 * status link ("check your email"); duplicate ⇒ "you've already applied".
 */

import { useState, useTransition } from "react";
import Link from "next/link";
import {
  ArrowLeft,
  ArrowRight,
  CheckCircle2,
  Loader2,
  MailCheck,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  submitApplication,
  type SubmitApplicationData,
} from "@/app/youth-academy/actions/apply";
import {
  InstitutionSearch,
  type InstitutionValue,
} from "./institution-search";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const INDIA_MOBILE_RE = /^[6-9]\d{9}$/;

const YEAR_OPTIONS = [
  "1st year",
  "2nd year",
  "3rd year",
  "4th year",
  "5th year",
  "Postgraduate",
  "Other",
] as const;

const DECLARATION_TEXT =
  "I confirm that the details provided in this application are accurate, and I consent to Yi Youth Academy contacting me about this program and storing my information for cohort administration.";

type Step = 1 | 2 | 3;

type FormState = {
  fullName: string;
  email: string;
  phone: string;
  dob: string;
  institution: InstitutionValue;
  degree: string;
  yearOfStudy: string;
  motivation: string;
  membershipClaim: "member" | "want_to_join" | "";
  declarationAccepted: boolean;
};

const EMPTY: FormState = {
  fullName: "",
  email: "",
  phone: "",
  dob: "",
  institution: {
    institutionId: null,
    institutionName: null,
    institutionOther: null,
  },
  degree: "",
  yearOfStudy: "",
  motivation: "",
  membershipClaim: "",
  declarationAccepted: false,
};

type FieldErrors = Partial<
  Record<
    | "fullName"
    | "email"
    | "phone"
    | "dob"
    | "institution"
    | "degree"
    | "yearOfStudy"
    | "motivation"
    | "membershipClaim"
    | "declarationAccepted",
    string
  >
>;

const STEP_LABELS: Record<Step, string> = {
  1: "Personal details",
  2: "Academic details",
  3: "Motivation & declaration",
};

export function ApplyWizard({
  runId,
  programTitle,
  academyName,
  deadlineLabel,
}: {
  runId: string;
  programTitle: string;
  academyName: string;
  /** Pre-formatted "Apply by …" string from the server page (or null). */
  deadlineLabel: string | null;
}) {
  const [step, setStep] = useState<Step>(1);
  const [form, setForm] = useState<FormState>(EMPTY);
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});
  const [serverError, setServerError] = useState<string | null>(null);
  const [result, setResult] = useState<SubmitApplicationData | null>(null);
  const [pending, startTransition] = useTransition();

  function set<K extends keyof FormState>(key: K, value: FormState[K]) {
    setForm((prev) => ({ ...prev, [key]: value }));
    setFieldErrors((prev) => ({ ...prev, [key]: undefined }));
  }

  function validateStep(target: Step): FieldErrors {
    const errors: FieldErrors = {};
    if (target === 1) {
      if (form.fullName.trim().length < 2) {
        errors.fullName = "Please enter your full name.";
      }
      if (!EMAIL_RE.test(form.email.trim())) {
        errors.email = "Please enter a valid email address.";
      }
      if (form.phone.trim()) {
        const digits = form.phone
          .replace(/[^\d]/g, "")
          .replace(/^91(?=\d{10}$)/, "");
        if (!INDIA_MOBILE_RE.test(digits)) {
          errors.phone = "Mobile must be a 10-digit Indian number.";
        }
      }
      if (form.dob) {
        const d = new Date(`${form.dob}T00:00:00`);
        if (Number.isNaN(d.getTime()) || d > new Date()) {
          errors.dob = "Please enter a valid date of birth.";
        }
      }
    }
    if (target === 2) {
      if (
        !form.institution.institutionId &&
        !form.institution.institutionOther?.trim()
      ) {
        errors.institution =
          "Pick your institution from the list or type its name.";
      }
      if (form.degree.trim().length < 2) {
        errors.degree = "Please enter your degree / department.";
      }
      if (!form.yearOfStudy) {
        errors.yearOfStudy = "Please pick your year of study.";
      }
    }
    if (target === 3) {
      if (form.motivation.trim().length < 20) {
        errors.motivation =
          "Tell us a little more — at least a couple of sentences.";
      }
      if (!form.membershipClaim) {
        errors.membershipClaim =
          "Please answer the Yi YUVA membership question.";
      }
      if (!form.declarationAccepted) {
        errors.declarationAccepted =
          "Please accept the declaration to continue.";
      }
    }
    return errors;
  }

  function next() {
    const errors = validateStep(step);
    if (Object.keys(errors).length > 0) {
      setFieldErrors(errors);
      return;
    }
    setFieldErrors({});
    if (step < 3) setStep((step + 1) as Step);
  }

  function back() {
    setServerError(null);
    if (step > 1) setStep((step - 1) as Step);
  }

  function submit() {
    const errors = validateStep(3);
    if (Object.keys(errors).length > 0) {
      setFieldErrors(errors);
      return;
    }
    setServerError(null);
    startTransition(async () => {
      const res = await submitApplication({
        runId,
        fullName: form.fullName.trim(),
        email: form.email.trim().toLowerCase(),
        phone: form.phone.trim(),
        dob: form.dob,
        institutionId: form.institution.institutionId,
        institutionOther: form.institution.institutionOther,
        degree: form.degree.trim(),
        yearOfStudy: form.yearOfStudy,
        motivation: form.motivation.trim(),
        membershipClaim: form.membershipClaim as "member" | "want_to_join",
        declarationAccepted: form.declarationAccepted,
      });
      if (res.success) {
        setResult(res.data);
      } else {
        setServerError(res.error);
      }
    });
  }

  // ── Confirmation screen ─────────────────────────────────────────────
  if (result) {
    const statusHref = `/youth-academy/applications/${result.statusToken}`;
    return (
      <div className="rounded-2xl border border-slate-200 bg-white p-8 text-center shadow-sm">
        {result.duplicate ? (
          <>
            <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-amber-100">
              <MailCheck className="size-6 text-amber-600" />
            </div>
            <h2 className="mt-4 text-xl font-bold text-slate-900">
              You&apos;ve already applied
            </h2>
            <p className="mt-2 text-sm text-slate-600">
              An application for <strong>{programTitle}</strong> already exists
              for this email address — no new application was created. You can
              check its status any time:
            </p>
          </>
        ) : (
          <>
            <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-emerald-100">
              <CheckCircle2 className="size-6 text-emerald-600" />
            </div>
            <h2 className="mt-4 text-xl font-bold text-slate-900">
              Application received!
            </h2>
            <p className="mt-2 text-sm text-slate-600">
              Thanks for applying to <strong>{programTitle}</strong> at{" "}
              {academyName}. A confirmation email with your status link is on
              its way — check your inbox (and spam folder).
            </p>
          </>
        )}
        <Link
          href={statusHref}
          className="mt-6 inline-flex items-center justify-center rounded-lg bg-slate-900 px-5 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-slate-800"
        >
          Check your application status
        </Link>
        <p className="mt-3 break-all text-xs text-slate-400">
          Bookmark this link: {statusHref}
        </p>
      </div>
    );
  }

  // ── Wizard ──────────────────────────────────────────────────────────
  return (
    <div className="rounded-2xl border border-slate-200 bg-white shadow-sm">
      {/* Step indicator */}
      <div className="border-b border-slate-100 px-6 py-4">
        <div className="flex items-center gap-2">
          {([1, 2, 3] as const).map((s) => (
            <div key={s} className="flex flex-1 items-center gap-2">
              <span
                className={
                  s === step
                    ? "flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-amber-500 text-xs font-bold text-slate-900"
                    : s < step
                      ? "flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-emerald-500 text-xs font-bold text-white"
                      : "flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-slate-100 text-xs font-bold text-slate-400"
                }
              >
                {s < step ? "✓" : s}
              </span>
              {s < 3 && <span className="h-px flex-1 bg-slate-200" />}
            </div>
          ))}
        </div>
        <p className="mt-3 text-sm font-semibold text-slate-900">
          Step {step} of 3 — {STEP_LABELS[step]}
        </p>
        {deadlineLabel && step === 1 && (
          <p className="mt-0.5 text-xs text-slate-500">{deadlineLabel}</p>
        )}
      </div>

      <div className="space-y-5 px-6 py-6">
        {/* ── Step 1: Personal ─────────────────────────────────────── */}
        {step === 1 && (
          <>
            <div className="space-y-1.5">
              <Label htmlFor="apply-name">Full name *</Label>
              <Input
                id="apply-name"
                value={form.fullName}
                onChange={(e) => set("fullName", e.target.value)}
                placeholder="As it should appear on your certificate"
                autoComplete="name"
              />
              {fieldErrors.fullName && (
                <p className="text-xs text-red-600">{fieldErrors.fullName}</p>
              )}
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="apply-email">Email *</Label>
              <Input
                id="apply-email"
                type="email"
                value={form.email}
                onChange={(e) => set("email", e.target.value)}
                placeholder="you@example.com"
                autoComplete="email"
              />
              <p className="text-xs text-slate-400">
                Your status link and (if accepted) login details arrive here.
              </p>
              {fieldErrors.email && (
                <p className="text-xs text-red-600">{fieldErrors.email}</p>
              )}
            </div>
            <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label htmlFor="apply-phone">Mobile</Label>
                <Input
                  id="apply-phone"
                  type="tel"
                  inputMode="numeric"
                  value={form.phone}
                  onChange={(e) => set("phone", e.target.value)}
                  placeholder="10-digit mobile"
                  autoComplete="tel"
                />
                {fieldErrors.phone && (
                  <p className="text-xs text-red-600">{fieldErrors.phone}</p>
                )}
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="apply-dob">Date of birth (optional)</Label>
                <Input
                  id="apply-dob"
                  type="date"
                  value={form.dob}
                  onChange={(e) => set("dob", e.target.value)}
                  max={new Date().toISOString().slice(0, 10)}
                />
                {fieldErrors.dob && (
                  <p className="text-xs text-red-600">{fieldErrors.dob}</p>
                )}
              </div>
            </div>
          </>
        )}

        {/* ── Step 2: Academic ─────────────────────────────────────── */}
        {step === 2 && (
          <>
            <div className="space-y-1.5">
              <Label>Institution *</Label>
              <InstitutionSearch
                value={form.institution}
                onChange={(next) => set("institution", next)}
              />
              {fieldErrors.institution && (
                <p className="text-xs text-red-600">
                  {fieldErrors.institution}
                </p>
              )}
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="apply-degree">Degree / department *</Label>
              <Input
                id="apply-degree"
                value={form.degree}
                onChange={(e) => set("degree", e.target.value)}
                placeholder="e.g. B.E. Computer Science"
              />
              {fieldErrors.degree && (
                <p className="text-xs text-red-600">{fieldErrors.degree}</p>
              )}
            </div>
            <div className="space-y-1.5">
              <Label>Year of study *</Label>
              <div className="flex flex-wrap gap-2">
                {YEAR_OPTIONS.map((year) => (
                  <button
                    key={year}
                    type="button"
                    onClick={() => set("yearOfStudy", year)}
                    className={
                      form.yearOfStudy === year
                        ? "rounded-full bg-slate-900 px-3 py-1.5 text-sm font-medium text-white"
                        : "rounded-full border border-slate-200 px-3 py-1.5 text-sm font-medium text-slate-600 hover:border-slate-300"
                    }
                  >
                    {year}
                  </button>
                ))}
              </div>
              {fieldErrors.yearOfStudy && (
                <p className="text-xs text-red-600">
                  {fieldErrors.yearOfStudy}
                </p>
              )}
            </div>
          </>
        )}

        {/* ── Step 3: Motivation + declaration ─────────────────────── */}
        {step === 3 && (
          <>
            <div className="space-y-1.5">
              <Label htmlFor="apply-motivation">
                Why do you want to join this program? *
              </Label>
              <Textarea
                id="apply-motivation"
                value={form.motivation}
                onChange={(e) => set("motivation", e.target.value)}
                rows={5}
                placeholder="What do you hope to learn, build or become through this cohort?"
              />
              {fieldErrors.motivation && (
                <p className="text-xs text-red-600">
                  {fieldErrors.motivation}
                </p>
              )}
            </div>

            <div className="space-y-1.5">
              <Label>Are you a Yi YUVA member? *</Label>
              <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                <button
                  type="button"
                  onClick={() => set("membershipClaim", "member")}
                  className={
                    form.membershipClaim === "member"
                      ? "rounded-lg border-2 border-amber-500 bg-amber-50 px-4 py-3 text-left text-sm font-medium text-slate-900"
                      : "rounded-lg border border-slate-200 px-4 py-3 text-left text-sm font-medium text-slate-600 hover:border-slate-300"
                  }
                >
                  Yes, I&apos;m a Yi YUVA member
                </button>
                <button
                  type="button"
                  onClick={() => set("membershipClaim", "want_to_join")}
                  className={
                    form.membershipClaim === "want_to_join"
                      ? "rounded-lg border-2 border-amber-500 bg-amber-50 px-4 py-3 text-left text-sm font-medium text-slate-900"
                      : "rounded-lg border border-slate-200 px-4 py-3 text-left text-sm font-medium text-slate-600 hover:border-slate-300"
                  }
                >
                  Not yet — I&apos;d like to join
                </button>
              </div>
              {fieldErrors.membershipClaim && (
                <p className="text-xs text-red-600">
                  {fieldErrors.membershipClaim}
                </p>
              )}
            </div>

            <label className="flex cursor-pointer items-start gap-3 rounded-lg border border-slate-200 p-4">
              <Checkbox
                checked={form.declarationAccepted}
                onCheckedChange={(checked) =>
                  set("declarationAccepted", checked === true)
                }
                className="mt-0.5"
              />
              <span className="text-sm leading-relaxed text-slate-600">
                {DECLARATION_TEXT}
              </span>
            </label>
            {fieldErrors.declarationAccepted && (
              <p className="text-xs text-red-600">
                {fieldErrors.declarationAccepted}
              </p>
            )}
          </>
        )}

        {serverError && (
          <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            {serverError}
          </div>
        )}
      </div>

      {/* Footer nav */}
      <div className="flex items-center justify-between border-t border-slate-100 px-6 py-4">
        {step > 1 ? (
          <Button type="button" variant="ghost" onClick={back} disabled={pending}>
            <ArrowLeft className="size-4" />
            Back
          </Button>
        ) : (
          <span />
        )}
        {step < 3 ? (
          <Button
            type="button"
            onClick={next}
            className="bg-slate-900 hover:bg-slate-800"
          >
            Continue
            <ArrowRight className="size-4" />
          </Button>
        ) : (
          <Button
            type="button"
            onClick={submit}
            disabled={pending}
            className="bg-amber-500 text-slate-900 hover:bg-amber-400"
          >
            {pending ? (
              <>
                <Loader2 className="size-4 animate-spin" />
                Submitting…
              </>
            ) : (
              "Submit application"
            )}
          </Button>
        )}
      </div>
    </div>
  );
}
