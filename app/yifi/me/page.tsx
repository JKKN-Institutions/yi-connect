import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import Link from "next/link";
import { createServiceClient } from "@/lib/yifi/supabase/server";
import { CensusPrompt } from "./census-prompt";
import { RoutingCard } from "./routing-card";
import { VowSection } from "./vow-section";
import { PaymentBanner } from "./payment-banner";
import { GUIDES } from "@/lib/yifi/guide/content";
import { logGuideEvent } from "@/lib/yifi/guide/actions";
import { OnboardingLauncher } from "@/app/yifi/_components/OnboardingLauncher";
import { ModuleWelcome } from "@/app/yifi/_components/ModuleWelcome";

export const metadata = {
  title: "My YiFi",
};

async function getRegistrant(id: string) {
  const supabase = await createServiceClient();
  const { data } = await supabase.rpc("yifi_get_registrant_by_id", { p_id: id });
  return data;
}

async function getMatches(registrantId: string, editionId: string) {
  const supabase = await createServiceClient();
  const { data } = await supabase.rpc("yifi_get_matches", {
    p_registrant_id: registrantId,
    p_edition_id: editionId,
  });
  return data ?? [];
}

async function getVows(registrantId: string, editionId: string) {
  const supabase = await createServiceClient();
  const { data } = await supabase.rpc("yifi_get_vows", {
    p_registrant_id: registrantId,
    p_edition_id: editionId,
  });
  return data ?? [];
}

async function getDossier(registrantId: string, editionId: string) {
  const supabase = await createServiceClient();
  const { data } = await supabase.rpc("yifi_get_dossier", {
    p_registrant_id: registrantId,
    p_edition_id: editionId,
  });
  return data;
}

async function isOrganiser(email: string | null, editionId: string) {
  if (!email) return false;
  const supabase = await createServiceClient();
  const { data } = await supabase.rpc("yifi_check_organiser", {
    p_email: email,
    p_edition_id: editionId,
  });
  return Array.isArray(data) && data.length > 0;
}

export default async function MyYiFiPage() {
  const cookieStore = await cookies();
  const raw = cookieStore.get("yifi_session")?.value;
  if (!raw) redirect("/yifi/join");

  let session: { id: string; name: string; editionId: string };
  try {
    session = JSON.parse(raw);
  } catch {
    redirect("/yifi/join");
  }

  const registrant = await getRegistrant(session.id);
  if (!registrant) redirect("/yifi/join");

  const [matches, vows, dossier, organiser] = await Promise.all([
    getMatches(session.id, registrant.edition_id),
    getVows(session.id, registrant.edition_id),
    getDossier(session.id, registrant.edition_id),
    isOrganiser(registrant.email, registrant.edition_id),
  ]);

  const scheduledSlots = (Array.isArray(matches) ? matches : [])
    .filter((m: any) => m.slot_time && !m.is_walkup)
    .map((m: any) => ({
      time: m.slot_time,
      person_name: m.matched_person?.full_name ?? "TBA",
      table: m.table_number,
    }));

  return (
    <main className="min-h-screen bg-[#000066]">
      <header className="border-b border-white/10 bg-black/30 px-4 py-3 sticky top-0 z-50 backdrop-blur-sm">
        <div className="max-w-2xl mx-auto flex items-center justify-between">
          <Link href="/yifi" className="text-[#FD7215] font-bold text-lg">YiFi</Link>
          <div className="flex items-center gap-3">
            {organiser && (
              <Link
                href="/yifi/admin"
                className="text-xs text-[#FD7215] border border-[#FD7215]/30 hover:border-[#FD7215]/60 px-2.5 py-1 rounded-md transition-colors"
              >
                Event Admin
              </Link>
            )}
            <span className="text-white/70 text-sm">{registrant.full_name}</span>
            {registrant.cluster_colour && (
              <span className="w-3 h-3 rounded-full" style={{ backgroundColor: registrant.cluster_colour }} />
            )}
          </div>
        </div>
      </header>

      <div className="max-w-2xl mx-auto px-4 py-6 space-y-8">
        <PaymentBanner status={registrant.payment_status} />
        <ModuleWelcome
          moduleKey="participant-home"
          lane="participant"
          title="Welcome to YiFi"
          body="This is your home for the event — your routing card, your vows and your dossier all live here. Start with your census so we can match you."
          cta={{ label: "Show me how", href: "/yifi/guide?lane=participant" }}
          onEvent={logGuideEvent}
        />
        <div className="flex flex-wrap items-center justify-between gap-2">
          <p className="text-white/40 text-sm">First time here? Take the quick tour.</p>
          <OnboardingLauncher
            content={GUIDES.participant}
            lane="participant"
            onEvent={logGuideEvent}
          />
        </div>

        {!registrant.census_complete && <CensusPrompt registrant={registrant} />}

        <section>
          <h2 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
            <span className="text-[#FD7215]">🎯</span> Your Routing Card
          </h2>
          {Array.isArray(matches) && matches.length > 0 ? (
            <RoutingCard matches={matches} scheduledSlots={scheduledSlots} />
          ) : (
            <div className="bg-white/5 border border-white/10 rounded-xl p-6 text-center">
              <p className="text-white/50">
                {registrant.census_complete
                  ? "Matches are being curated. Check back soon."
                  : "Complete your census above to get matched."}
              </p>
            </div>
          )}
        </section>

        <section>
          <h2 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
            <span className="text-[#FD7215]">🪨</span> Your Vows
          </h2>
          <VowSection
            registrantId={registrant.id}
            editionId={registrant.edition_id}
            vows={Array.isArray(vows) ? vows : []}
          />
        </section>

        <section>
          <h2 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
            <span className="text-[#FD7215]">📋</span> Your Dossier
          </h2>
          {dossier && ["ready", "delivered", "viewed"].includes(dossier.status) ? (
            <Link
              href="/yifi/me/dossier"
              className="block bg-gradient-to-r from-[#FD7215]/20 to-[#229434]/20 border border-[#FD7215]/30 rounded-xl p-6 hover:border-[#FD7215]/60 transition-colors"
            >
              <p className="text-white font-medium mb-1">Your personalised dossier is ready</p>
              <p className="text-white/50 text-sm">
                11 hours of stage content filtered to your sector and your challenges. Tap to read.
              </p>
            </Link>
          ) : (
            <div className="bg-white/5 border border-white/10 rounded-xl p-6 text-center">
              <p className="text-white/50 text-sm">
                {dossier?.status === "generating"
                  ? "Your personalised dossier is being generated..."
                  : "Your dossier will be ready after the event."}
              </p>
            </div>
          )}
        </section>

        <section>
          <h2 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
            <span className="text-[#FD7215]">💬</span> YIBE Corner
          </h2>
          <div className="space-y-3">
            <Link
              href="/yifi/community"
              className="block bg-white/5 border border-white/10 rounded-xl p-6 hover:border-[#FD7215]/40 transition-colors"
            >
              <p className="text-white font-medium mb-1">Post a challenge, share a best practice, help a peer</p>
              <p className="text-white/50 text-sm">
                The member board — ask the room your toughest business question, or answer someone else&apos;s.
              </p>
            </Link>
            <Link href="/yifi/me/community" className="inline-block text-[#FD7215] text-sm hover:underline">
              Your starter challenges &amp; notifications →
            </Link>
          </div>
        </section>

        <section className="border-t border-white/10 pt-8">
          <div className="bg-gradient-to-r from-[#000066] to-[#000044] border border-white/10 rounded-xl p-6 text-center">
            <p className="text-white/70 text-sm mb-2">
              YiFi is part of Yi Connect — your chapter&apos;s platform for events, members, and more.
            </p>
            <Link href="/" className="text-[#FD7215] text-sm font-medium hover:underline">
              Explore Yi Connect →
            </Link>
          </div>
        </section>
      </div>
    </main>
  );
}
