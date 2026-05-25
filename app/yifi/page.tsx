import Link from "next/link";
import { createServiceClient } from "@/lib/yifi/supabase/server";

async function getCurrentEdition() {
  const supabase = await createServiceClient();
  const { data } = await supabase.rpc("yifi_current_edition");
  return data;
}

export default async function YiFiLanding() {
  const edition = await getCurrentEdition();

  return (
    <main className="min-h-screen bg-[#000066] text-white">
      <section className="relative min-h-[80vh] flex flex-col items-center justify-center px-4 text-center">
        <div className="absolute inset-0 bg-gradient-to-b from-[#000066] via-[#000044] to-black opacity-90" />
        <div className="relative z-10 max-w-3xl mx-auto">
          <p className="text-sm uppercase tracking-[0.3em] text-white/60 mb-4">
            Young Indians · CII
          </p>
          <h1 className="text-5xl md:text-7xl font-bold tracking-tight mb-4">
            <span className="text-[#FD7215]">Yi</span>Fi{" "}
            <span className="text-white/80">2026</span>
          </h1>
          <p className="text-xl md:text-2xl text-white/70 font-light mb-2">
            {edition?.tagline ?? "Built for Generations"}
          </p>
          <p className="text-base text-white/50 mb-8">
            {edition?.city ?? "Madurai"} ·{" "}
            {edition?.event_date
              ? new Date(edition.event_date).toLocaleDateString("en-IN", {
                  day: "numeric",
                  month: "long",
                  year: "numeric",
                })
              : "17 July 2026"}
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Link
              href="/yifi/join"
              className="inline-flex items-center justify-center px-8 py-3 bg-[#FD7215] text-white font-semibold rounded-lg hover:bg-[#e5660f] transition-colors text-lg"
            >
              Enter Your Code
            </Link>
          </div>
        </div>
      </section>

      <section className="py-20 px-4 bg-black/40">
        <div className="max-w-4xl mx-auto">
          <h2 className="text-3xl font-bold mb-8 text-center">
            One Room. <span className="text-[#FD7215]">500 Different Summits.</span>
          </h2>
          <div className="grid md:grid-cols-3 gap-8">
            <FeatureCard emoji="🎯" title="Personalised Routing" desc="5 curated matches based on your challenges and what you can offer. Pre-scheduled 12-minute meetings. No cold networking." />
            <FeatureCard emoji="📋" title="Your Dossier" desc="11 hours of stage content filtered to YOUR sector and YOUR problems. 500 unique transcripts from the same event." color="green" />
            <FeatureCard emoji="🪨" title="The Vow Wall" desc="One commitment. One witness. Engraved in stone. The wall grows every year — built for generations." color="white" />
          </div>
        </div>
      </section>

      <section className="py-16 px-4 border-t border-white/10">
        <div className="max-w-4xl mx-auto grid grid-cols-2 md:grid-cols-4 gap-8 text-center">
          <Stat value={edition?.expected_attendance ?? 500} label="Founders" color="#FD7215" />
          <Stat value={8} label="Problem Clusters" color="#229434" />
          <Stat value={47} label="Sectors" color="white" />
          <Stat value="2,500+" label="Introductions" color="#FD7215" />
        </div>
      </section>

      <footer className="py-8 px-4 border-t border-white/10 text-center">
        <p className="text-xs text-white/30">
          Designed by Ommsharravana · Yi Erode · Hosted by Yi Madurai
        </p>
        <p className="text-xs text-white/20 mt-1">
          Part of{" "}
          <Link href="/" className="underline hover:text-white/40">
            Yi Connect
          </Link>
        </p>
      </footer>
    </main>
  );
}

function FeatureCard({ emoji, title, desc, color = "orange" }: { emoji: string; title: string; desc: string; color?: string }) {
  const bg = color === "green" ? "bg-[#229434]/20" : color === "white" ? "bg-white/10" : "bg-[#FD7215]/20";
  return (
    <div className="text-center">
      <div className={`w-16 h-16 mx-auto mb-4 rounded-full ${bg} flex items-center justify-center`}>
        <span className="text-2xl">{emoji}</span>
      </div>
      <h3 className="font-semibold text-lg mb-2">{title}</h3>
      <p className="text-white/60 text-sm">{desc}</p>
    </div>
  );
}

function Stat({ value, label, color }: { value: string | number; label: string; color: string }) {
  return (
    <div>
      <p className="text-3xl font-bold" style={{ color }}>{value}</p>
      <p className="text-xs text-white/50 uppercase tracking-wide mt-1">{label}</p>
    </div>
  );
}
