import Link from "next/link";
import { getOpenChapters } from "../actions/register";
import { RegisterForm } from "./register-form";

export const dynamic = "force-dynamic";

export const metadata = { title: "Register your team" };

export default async function RegisterPage() {
  const chapters = await getOpenChapters();

  return (
    <main id="yiq-main" style={{ background: "#f7f4ed", minHeight: "100vh" }}>
      <header style={{ background: "#0a1633" }}>
        <div className="mx-auto flex max-w-3xl items-center justify-between gap-4 px-5 py-4 sm:px-8">
          <Link href="/yiq" className="yiq-display text-[1.375rem]" style={{ color: "#f7f4ed" }}>
            YIQ
          </Link>
          <span className="yiq-eyebrow" style={{ color: "#9fb0d4" }}>
            Team registration
          </span>
        </div>
      </header>

      <div className="mx-auto max-w-3xl px-5 py-9 sm:px-8 sm:py-12">
        <h1 className="yiq-display text-[2.25rem] sm:text-[2.75rem]" style={{ color: "#0a1633" }}>
          Register your school team
        </h1>
        <p className="mt-3 max-w-xl text-[0.9375rem] leading-relaxed" style={{ color: "#5a6480" }}>
          A team is 2 or 3 students from the same school, all in the same
          category. Every member sits the online round on their own device, and
          the team&apos;s score is the total of its members. You&apos;ll get an
          access code for each student at the end — keep them safe.
        </p>

        {chapters.length === 0 ? (
          <div
            className="mt-8 rounded-2xl border p-6"
            style={{ borderColor: "rgba(10,22,51,0.14)", background: "#fff" }}
          >
            <h2 className="text-[1.0625rem] font-bold" style={{ color: "#0a1633" }}>
              Registration isn&apos;t open yet
            </h2>
            <p className="mt-2 text-[0.9375rem]" style={{ color: "#5a6480" }}>
              No chapter is accepting YIQ registrations right now. Your Yi
              chapter opens registration for its own schools — check back, or
              contact your chapter organiser.
            </p>
            <Link
              href="/yiq"
              className="mt-5 inline-block rounded-full px-5 py-2.5 text-[0.875rem] font-bold"
              style={{ background: "#0a1633", color: "#f7f4ed" }}
            >
              Back to YIQ
            </Link>
          </div>
        ) : (
          <RegisterForm chapters={chapters} />
        )}
      </div>
    </main>
  );
}
