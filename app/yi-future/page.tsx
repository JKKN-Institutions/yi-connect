import { redirect } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/yi-future/supabase/server";
import { readSession } from "@/app/yi-future/actions/auth";
import { resolveFutureAccessOrNull } from "@/lib/yi-future/auth/require-access";
import { BrandStrip } from "@/components/yi-future/brand/BrandHeader";
import { BRAND } from "@/lib/yi-future/constants";

export default async function YiFuturePage() {
  // Smart router: if already authenticated, redirect to the right dashboard
  const session = await readSession();
  if (session) {
    switch (session.type) {
      case "delegate":
        redirect("/yi-future/me");
      case "mentor":
        redirect("/yi-future/mentor");
      case "jury":
        redirect("/yi-future/jury");
      case "partner":
        redirect("/yi-future/partner");
    }
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (user) {
    redirect("/yi-future/national/admin");
  }

  // Not authenticated — show landing page
  return (
    <main className="min-h-screen bg-ivory flex flex-col">
      <header className="border-b border-navy/10 bg-white safe-top">
        <div className="max-w-5xl mx-auto px-4">
          <BrandStrip className="py-4" />
        </div>
      </header>

      <section className="flex-1 flex items-center justify-center px-4 py-12">
        <div className="max-w-lg w-full text-center">
          <h1 className="text-4xl md:text-5xl font-extrabold text-navy tracking-tight">
            {BRAND.program}
          </h1>
          <p className="mt-3 text-lg text-navy/60">
            {BRAND.tagline}
          </p>
          <p className="mt-1 text-sm text-navy/40">
            Yi YUVA&apos;s 90-day mentored journey to turn policy ideas into real impact
          </p>

          <div className="mt-10 space-y-3">
            <Link
              href="/yi-future/join"
              className="block w-full py-4 rounded-xl bg-[#F5A623] text-navy font-extrabold text-lg hover:bg-[#F5A623]/90 transition-all shadow-lg hover:shadow-xl"
            >
              Register as a student
            </Link>

            <Link
              href="/yi-future/access"
              className="block w-full py-4 rounded-xl bg-navy text-ivory font-bold text-base hover:bg-navy-dark transition-all"
            >
              Already registered? Log in
            </Link>

            <Link
              href="/yi-future/quiz"
              className="block w-full py-3 rounded-xl border-2 border-[#F5A623]/40 text-navy font-semibold text-sm hover:border-[#F5A623] hover:bg-[#F5A623]/5 transition-all"
            >
              Not sure which track? Take the quiz
            </Link>
          </div>

          <div className="mt-8 grid grid-cols-4 gap-3 max-w-sm mx-auto">
            {["Climate Action", "Healthcare", "Smart Cities", "Rural Dev"].map(
              (track) => (
                <div
                  key={track}
                  className="text-center p-2 rounded-lg bg-white border border-navy/10"
                >
                  <div className="text-[10px] font-semibold text-navy/50 uppercase tracking-wider">
                    {track}
                  </div>
                </div>
              )
            )}
          </div>
        </div>
      </section>

      <footer className="border-t border-navy/10 py-6 px-4 bg-white">
        <div className="max-w-3xl mx-auto text-center">
          <BrandStrip />
          <p className="mt-4 text-[11px] text-navy/40">
            {BRAND.programFull} · {BRAND.tagline}
          </p>
        </div>
      </footer>
    </main>
  );
}
