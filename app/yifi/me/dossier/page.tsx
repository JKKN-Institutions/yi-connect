import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import Link from "next/link";
import { createServiceClient } from "@/lib/yifi/supabase/server";
import { DossierView } from "./dossier-view";
import { READY_STATUSES, type DossierRow } from "./types";

export const metadata = {
  title: "Your YiFi Dossier",
};

async function getRegistrant(id: string) {
  const supabase = await createServiceClient();
  const { data } = await supabase.rpc("yifi_get_registrant_by_id", { p_id: id });
  return data as { id: string; edition_id: string; full_name: string } | null;
}

async function getDossier(
  registrantId: string,
  editionId: string
): Promise<DossierRow | null> {
  const supabase = await createServiceClient();
  const { data } = await supabase.rpc("yifi_get_dossier", {
    p_registrant_id: registrantId,
    p_edition_id: editionId,
  });
  return (data as DossierRow | null) ?? null;
}

async function markViewed(registrantId: string, editionId: string) {
  try {
    const supabase = await createServiceClient();
    await supabase.rpc("yifi_mark_dossier_viewed", {
      p_registrant_id: registrantId,
      p_edition_id: editionId,
    });
  } catch {
    // View tracking is best-effort — never block the read.
  }
}

function NotReady() {
  return (
    <main className="min-h-screen bg-[#000066]">
      <header className="border-b border-white/10 bg-black/30 px-4 py-3 sticky top-0 z-50 backdrop-blur-sm">
        <div className="max-w-2xl mx-auto flex items-center justify-between">
          <Link href="/yifi" className="text-[#FD7215] font-bold text-lg">
            YiFi
          </Link>
          <Link
            href="/yifi/me"
            className="text-xs text-white/70 border border-white/20 hover:border-white/40 px-2.5 py-1 rounded-md transition-colors"
          >
            ← Back
          </Link>
        </div>
      </header>

      <div className="max-w-2xl mx-auto px-4 py-6">
        <div className="bg-white/5 border border-white/10 rounded-xl p-8 text-center">
          <div className="text-4xl mb-3">📋</div>
          <h1 className="text-xl font-semibold text-white mb-2">
            Your dossier isn&apos;t ready yet
          </h1>
          <p className="text-white/50 text-sm mb-6">
            Your personalised dossier is generated after the summit — 11 hours of
            stage content filtered to your sector and your challenges. We&apos;ll
            have it waiting here.
          </p>
          <Link
            href="/yifi/me"
            className="inline-block px-4 py-2 bg-[#FD7215] text-white text-sm font-medium rounded-lg hover:bg-[#e5660f] transition-colors"
          >
            ← Back to My YiFi
          </Link>
        </div>
      </div>
    </main>
  );
}

export default async function DossierPage() {
  const cookieStore = await cookies();
  const raw = cookieStore.get("yifi_session")?.value;
  if (!raw) redirect("/yifi/join");

  let session: { id: string; name: string; editionId: string };
  try {
    session = JSON.parse(raw);
  } catch {
    redirect("/yifi/join");
  }

  if (!session?.id) redirect("/yifi/join");

  const registrant = await getRegistrant(session.id);
  if (!registrant?.edition_id) redirect("/yifi/join");

  const dossier = await getDossier(registrant.id, registrant.edition_id);

  const isReady =
    !!dossier &&
    typeof dossier.status === "string" &&
    (READY_STATUSES as readonly string[]).includes(dossier.status);

  if (!isReady) {
    return <NotReady />;
  }

  // Fire-and-forget view tracking (awaited, errors swallowed).
  await markViewed(registrant.id, registrant.edition_id);

  return (
    <DossierView dossier={dossier!} memberName={registrant.full_name ?? ""} />
  );
}
