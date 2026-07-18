import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import Link from "next/link";
import { createServiceClient } from "@/lib/yifi/supabase/server";
import { NewPostForm } from "./new-post-form";

export const metadata = {
  title: "New post · YiFi Community",
};

async function getRegistrantSector(id: string): Promise<string | null> {
  const supabase = await createServiceClient();
  const { data } = await supabase.rpc("yifi_get_registrant_by_id", { p_id: id });
  return data?.sector ?? null;
}

export default async function NewPostPage() {
  const cookieStore = await cookies();
  const raw = cookieStore.get("yifi_session")?.value;
  if (!raw) redirect("/yifi/join");

  let session: { id: string; name: string; editionId: string };
  try {
    session = JSON.parse(raw);
  } catch {
    redirect("/yifi/join");
  }
  if (!session.editionId) redirect("/yifi/join");

  const defaultSector = await getRegistrantSector(session.id);

  return (
    <main className="min-h-screen bg-[#000066]">
      <header className="border-b border-white/10 bg-black/30 px-4 py-3 sticky top-0 z-50 backdrop-blur-sm">
        <div className="max-w-2xl mx-auto flex items-center justify-between">
          <Link href="/yifi/community" className="text-[#FD7215] font-bold text-lg">
            YiFi
          </Link>
          <span className="text-white/70 text-sm">{session.name}</span>
        </div>
      </header>

      <div className="max-w-2xl mx-auto px-4 py-6 space-y-6">
        <div>
          <Link
            href="/yifi/community"
            className="text-white/40 text-sm hover:text-white/70 transition-colors"
          >
            ← Back to board
          </Link>
          <h1 className="text-2xl font-bold text-white mt-2">Start a post</h1>
          <p className="text-white/50 text-sm mt-1">
            Ask a question, share what worked, or flag an industry shift.
          </p>
        </div>

        <NewPostForm defaultSector={defaultSector} />
      </div>
    </main>
  );
}
