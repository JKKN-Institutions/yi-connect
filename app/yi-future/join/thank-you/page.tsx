import Link from "next/link";
import type { Metadata } from "next";
import { JoinHeader } from "@/components/yi-future/brand/JoinHeader";
import { createServiceClient } from "@/lib/yi-future/supabase/server";

export const metadata: Metadata = {
  title: "You're in — Future 6.0",
};

export default async function ThankYouPage({
  searchParams,
}: {
  searchParams: Promise<{ email?: string; code?: string; returning?: string }>;
}) {
  const { email, code, returning } = await searchParams;
  const cleanEmail = email?.trim();
  const accessCode = code?.trim();
  const isReturning = returning === "1";

  /* ── Look up chapter chair contact from access code ── */
  let chapterName: string | null = null;
  let chairName: string | null = null;
  let chairEmail: string | null = null;
  let chairMobile: string | null = null;

  if (accessCode) {
    try {
      const svc = await createServiceClient();
      const { data: delegate } = await svc
        .schema("future")
        .from("delegates")
        .select("chapter_id")
        .eq("access_code", accessCode)
        .maybeSingle();

      if (delegate) {
        const chapterId = (delegate as unknown as { chapter_id: string }).chapter_id;
        const { data: chapter } = await svc
          .schema("yi")
          .from("chapters")
          .select("name, chair_name, chair_email, chair_mobile")
          .eq("id", chapterId)
          .maybeSingle();

        if (chapter) {
          const ch = chapter as unknown as {
            name: string;
            chair_name: string | null;
            chair_email: string | null;
            chair_mobile: string | null;
          };
          chapterName = ch.name;
          chairName = ch.chair_name;
          chairEmail = ch.chair_email;
          chairMobile = ch.chair_mobile;
        }
      }
    } catch {
      // Silently fail — the contact card will show the generic fallback
    }
  }

  return (
    <main className="min-h-screen bg-ivory flex flex-col">
      <header className="relative border-b border-navy/10 bg-white safe-top">
        <div className="max-w-6xl mx-auto px-4">
          <JoinHeader />
        </div>
      </header>

      <section className="flex-1 px-4 py-10 sm:py-16">
        <div className="max-w-2xl mx-auto space-y-6">
          {/* Hero card */}
          <div className="bg-white border border-navy/10 rounded-lg p-6 sm:p-10 text-center">
            <div className="text-5xl mb-3">{isReturning ? "🌟" : "🎉"}</div>
            {isReturning && (
              <div className="inline-block px-3 py-1 rounded-full bg-yi-gold/15 text-yi-gold text-xs font-bold uppercase tracking-wider mb-3">
                Welcome back — Future alumni
              </div>
            )}
            <h1 className="text-2xl sm:text-3xl font-extrabold text-navy">
              {isReturning ? "Great to see you again!" : "You're in!"}
            </h1>
            <p className="mt-2 text-sm text-navy/70">
              {isReturning
                ? "You participated in a previous edition. Your experience gives your team an edge this time."
                : <>Welcome to{" "}<strong className="text-navy">Yi YUVA Future 6.0</strong>. Your registration is confirmed.</>
              }
            </p>
          </div>

          {/* Access code card */}
          {accessCode && (
            <div className="bg-gradient-to-br from-navy to-navy-dark rounded-lg p-6 sm:p-8 text-center">
              <div className="text-[11px] font-semibold tracking-widest text-yi-gold uppercase mb-3">
                Your access code
              </div>
              <div className="inline-block bg-white/10 border-2 border-yi-gold/50 rounded-xl px-6 sm:px-10 py-4">
                <div className="text-3xl sm:text-5xl font-mono font-extrabold tracking-[0.3em] text-ivory select-all">
                  {accessCode}
                </div>
              </div>
              <div className="mt-4 space-y-1">
                <p className="text-sm font-semibold text-yi-gold">
                  Save this code — you&apos;ll need it to log in
                </p>
                <p className="text-xs text-ivory/60">
                  Screenshot this page or write it down. This is your key to the
                  Future 6.0 platform.
                </p>
              </div>
            </div>
          )}

          {/* What happens next */}
          <div className="bg-white border border-navy/10 rounded-lg p-6 sm:p-8">
            <h2 className="text-xs font-semibold uppercase tracking-widest text-yi-gold mb-4">
              What happens next
            </h2>
            <ol className="space-y-4">
              <Step
                n={1}
                title="Log in with your access code"
                body="Use the 6-character code above to log in at any time. Your chapter admin will assign you to a team."
              />
              <Step
                n={2}
                title="Team formation"
                body="Your team captain will invite you — or you can invite others from your chapter. Teams are 1–5 members."
              />
              <Step
                n={3}
                title="Pick a problem statement"
                body="Once your team is confirmed, you'll choose a problem statement from one of the four tracks and begin the 90-day journey."
              />
            </ol>
          </div>

          {/* Chapter chair contact */}
          <div className="bg-white border border-navy/10 rounded-lg p-6 text-center">
            <p className="text-xs font-semibold uppercase tracking-widest text-navy/50 mb-2">
              Your chapter contact
            </p>
            {chapterName && (
              <p className="font-bold text-navy">{chapterName}</p>
            )}
            {chairName && (
              <p className="text-sm text-navy/70 mt-1">{chairName}</p>
            )}
            {chairEmail && (
              <p className="text-sm text-navy/70">{chairEmail}</p>
            )}
            {chairMobile && (
              <p className="text-sm text-navy/70">{chairMobile}</p>
            )}
            {!chairEmail && !chairMobile && (
              <p className="text-xs text-navy/50 mt-1">
                Reach out to your Yi chapter chair for any questions.
              </p>
            )}
            {cleanEmail && (
              <p className="text-xs text-navy/50 mt-3 pt-3 border-t border-navy/10">
                Confirmation will also be sent to{" "}
                <strong className="text-navy">{cleanEmail}</strong>.
              </p>
            )}
          </div>

          {/* CTA */}
          <div className="text-center">
            <Link
              href="/yi-future/access"
              className="inline-block px-8 py-4 min-h-[44px] rounded-xl bg-[#F5A623] text-navy font-extrabold hover:bg-[#F5A623]/90 transition-all text-base shadow-lg hover:shadow-xl"
            >
              Log in with your code →
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
