import Link from "next/link";
import { BrandStrip } from "@/components/yi-future/brand/BrandHeader";
import { JoinHeader } from "@/components/yi-future/brand/JoinHeader";
import { createServiceClient } from "@/lib/yi-future/supabase/server";
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

export default async function JoinPage() {
  const chapters = await getActiveChapters();

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
