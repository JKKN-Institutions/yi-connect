import Link from "next/link";
import { JoinHeader } from "@/components/yi-future/brand/JoinHeader";

export const metadata = {
  title: "Registration received — Future 6.0",
};

export default async function ThankYouPage({
  searchParams,
}: {
  searchParams: Promise<{ email?: string }>;
}) {
  const { email } = await searchParams;
  const cleanEmail = email?.trim();

  return (
    <main className="min-h-screen bg-ivory flex flex-col">
      <header className="relative border-b border-navy/10 bg-white safe-top">
        <div className="max-w-6xl mx-auto px-4">
          <JoinHeader />
        </div>
      </header>

      <section className="flex-1 px-4 py-10 sm:py-16">
        <div className="max-w-2xl mx-auto bg-white border border-navy/10 rounded-lg p-6 sm:p-10 text-center">
          <div className="inline-flex items-center justify-center h-16 w-16 rounded-full bg-yi-green/10 text-yi-green text-3xl">
            ✓
          </div>
          <h1 className="mt-5 text-2xl sm:text-3xl font-bold text-navy">
            Thank you for registering
          </h1>
          <p className="mt-3 text-sm text-navy/70">
            Your details for{" "}
            <strong className="text-navy">Yi YUVA Future 6.0 — 2026</strong> have
            been received.
          </p>
          {cleanEmail && (
            <p className="mt-2 text-sm text-navy/70">
              You'll receive details of the event at{" "}
              <strong className="text-navy">{cleanEmail}</strong> at a later date.
            </p>
          )}

          <div className="mt-8 text-left">
            <h2 className="text-xs font-semibold uppercase tracking-widest text-yi-gold">
              What happens next
            </h2>
            <ol className="mt-3 space-y-3">
              <Step
                n={1}
                title="Chapter admin reviews your registration"
                body="Your Yi chapter team will review your details and get in touch if anything is missing."
              />
              <Step
                n={2}
                title="You'll get your access code by email"
                body="When the program is ready to begin, your chapter admin will email you a 6-character access code that unlocks the platform."
              />
              <Step
                n={3}
                title="Team formation begins"
                body="Once you're in, you'll join (or form) a team of 3–5, pick a problem statement from one of the four tracks, and begin the 90-day mentored journey."
              />
            </ol>
          </div>

          <div className="mt-8 pt-6 border-t border-navy/10">
            <p className="text-xs text-navy/50">
              Questions? Reach out to your Yi chapter directly.
            </p>
            <Link
              href="/"
              className="mt-3 inline-block text-sm font-semibold text-navy hover:text-yi-gold"
            >
              ← Back to home
            </Link>
          </div>
        </div>
      </section>

      <footer className="border-t border-navy/10 py-6 px-4 bg-white">
        <p className="text-center text-[11px] text-navy/40">
          Yi YUVA Future 6.0 · From Opinions to Impact
        </p>
      </footer>
    </main>
  );
}

function Step({
  n,
  title,
  body,
}: {
  n: number;
  title: string;
  body: string;
}) {
  return (
    <li className="flex items-start gap-3">
      <span className="inline-flex items-center justify-center h-7 w-7 rounded-full bg-navy/5 text-xs font-bold text-navy shrink-0">
        {n}
      </span>
      <div>
        <p className="text-sm font-semibold text-navy">{title}</p>
        <p className="mt-0.5 text-xs text-navy/60">{body}</p>
      </div>
    </li>
  );
}
