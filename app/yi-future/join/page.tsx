import Link from "next/link";
import { BrandStrip } from "@/components/yi-future/brand/BrandHeader";
import { JoinHeader } from "@/components/yi-future/brand/JoinHeader";
import { createServiceClient } from "@/lib/yi-future/supabase/server";
import {
  getRegistrationWindow,
  isChapterOpenForRegistration,
} from "@/lib/yi-future/registration-window";
import { JoinForm } from "./join-form";

type ChapterRow = {
  id: string;
  name: string;
  city: string;
  state: string | null;
};

async function getActiveChapters(): Promise<ChapterRow[]> {
  const svc = await createServiceClient();
  const { data } = await svc
    .schema("yi")
    .from("chapters")
    .select("id, name, city, state")
    .eq("is_active", true)
    .order("name", { ascending: true });
  return (data as unknown as ChapterRow[]) ?? [];
}

// The chapter list now depends on the live registration window (a national
// admin can close/reopen chapters at any moment), so this page must render
// per request. As a static prerender it served a build-time snapshot — CFT
// 2026-07-30 found the closed state never reaching students.
export const dynamic = "force-dynamic";

export default async function JoinPage() {
  const allChapters = await getActiveChapters();

  // Registration window: when the national team closes registrations, only
  // exception chapters remain pickable (registerDelegate enforces the same
  // rule server-side).
  const svc = await createServiceClient();
  const { data: edition } = await svc
    .schema("future")
    .from("editions")
    .select("id")
    .eq("slug", "2026")
    .maybeSingle();
  const regWindow = edition
    ? await getRegistrationWindow((edition as { id: string }).id)
    : null;
  const chapters = regWindow
    ? allChapters.filter((c) => isChapterOpenForRegistration(regWindow, c.id))
    : allChapters;
  const someClosed = regWindow?.closedGlobally === true && chapters.length > 0;
  const allClosed = regWindow?.closedGlobally === true && chapters.length === 0;

  if (allClosed) {
    return (
      <main className="min-h-screen bg-ivory flex flex-col">
        <header className="relative border-b border-navy/10 bg-white safe-top">
          <div className="max-w-6xl mx-auto px-4">
            <JoinHeader />
          </div>
          <Link
            href="/yi-future/access"
            className="absolute top-3 right-4 text-xs text-navy/60 hover:text-navy font-medium"
          >
            Already registered? Sign in
          </Link>
        </header>
        <section className="flex-1 flex items-center justify-center px-4">
          <div className="max-w-md text-center bg-white border border-navy/10 rounded-lg p-8">
            <div className="text-4xl mb-3">🔒</div>
            <h1 className="text-2xl font-bold text-navy">
              Registrations are closed
            </h1>
            <p className="mt-2 text-sm text-navy/60">
              New registrations for Future 6.0 have closed. If you&apos;re
              already registered, you can still sign in as usual.
            </p>
            <Link
              href="/yi-future/access"
              className="mt-5 inline-block px-5 py-2.5 rounded-md bg-navy text-ivory text-sm font-semibold hover:bg-navy-dark"
            >
              Sign in →
            </Link>
          </div>
        </section>
        <footer className="border-t border-navy/10 py-6 px-4 bg-white">
          <div className="max-w-3xl mx-auto text-center">
            <BrandStrip />
            <p className="mt-4 text-[11px] text-navy/40">
              Yi YUVA Future 6.0 · From Opinions to Impact
            </p>
          </div>
        </footer>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-ivory flex flex-col">
      <header className="relative border-b border-navy/10 bg-white safe-top">
        <div className="max-w-6xl mx-auto px-4">
          <JoinHeader />
        </div>
        <Link
          href="/yi-future/access"
          className="absolute top-3 right-4 text-xs text-navy/60 hover:text-navy font-medium"
        >
          Already registered? Sign in
        </Link>
      </header>

      <section className="flex-1">
        {someClosed && (
          <div className="max-w-2xl mx-auto px-4 pt-6">
            <div className="p-3 rounded-md bg-[#F5A623]/10 border border-[#F5A623]/40 text-sm text-navy">
              Registrations are currently open only for:{" "}
              <strong>{chapters.map((c) => c.name).join(", ")}</strong>. Other
              chapters have closed.
            </div>
          </div>
        )}
        <JoinForm chapters={chapters} />
      </section>

      <footer className="border-t border-navy/10 py-6 px-4 bg-white">
        <div className="max-w-3xl mx-auto text-center">
          <BrandStrip />
          <p className="mt-4 text-[11px] text-navy/40">
            Yi YUVA Future 6.0 · From Opinions to Impact
          </p>
        </div>
      </footer>
    </main>
  );
}
