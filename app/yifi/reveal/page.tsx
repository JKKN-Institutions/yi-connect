import { createServiceClient } from "@/lib/yifi/supabase/server";

export const revalidate = 5;

export const metadata = {
  title: "YiFi Reveal",
};

async function getStats(editionSlug: string) {
  const supabase = await createServiceClient();

  const { data: edition } = await supabase
    .rpc("yifi_get_edition", { p_slug: editionSlug });

  if (!edition) return null;

  const { data: stats } = await supabase
    .rpc("yifi_get_stats", { p_edition_id: edition.id });

  return { edition, stats };
}

export default async function RevealPage({
  searchParams,
}: {
  searchParams: Promise<{ edition?: string }>;
}) {
  const params = await searchParams;
  const slug = params.edition ?? "madurai-2026";
  const data = await getStats(slug);

  const stats = data?.stats;
  const edition = data?.edition;

  return (
    <main className="min-h-screen bg-black text-white flex flex-col items-center justify-center p-8">
      <div className="max-w-5xl w-full space-y-16 text-center">
        <div>
          <p className="text-white/30 text-sm uppercase tracking-[0.5em] mb-2">
            {edition?.name ?? "YiFi 2026"}
          </p>
          <h1 className="text-2xl md:text-3xl text-white/50 font-light">
            {edition?.tagline ?? "Built for Generations"}
          </h1>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-8">
          <Counter value={stats?.total_registrants ?? 0} label="founders" colour="#FD7215" />
          <Counter value={stats?.total_capacity_cr ? `₹${stats.total_capacity_cr}cr` : "—"} label="capacity" colour="#FD7215" />
          <Counter value={stats?.problem_clusters ?? 0} label="problems" colour="#229434" />
          <Counter value={stats?.sectors ?? 0} label="sectors" colour="#229434" />
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
          <Counter value={stats?.introductions_made?.toLocaleString() ?? "0"} label="introductions made" colour="#FD7215" large />
          <Counter value={stats?.meetings_happened ?? 0} label="meetings happened tonight" colour="#FD7215" large pulse />
        </div>

        <div className="border-t border-white/10 pt-12">
          <p className="text-xl md:text-2xl text-white/60 font-light">
            <span className="text-[#FD7215] font-bold text-3xl md:text-4xl">{stats?.vows_made ?? 0}</span>{" "}
            vows tonight ·{" "}
            <span className="text-[#229434] font-bold text-3xl md:text-4xl">{stats?.witnesses_named ?? 0}</span>{" "}
            named witnesses
          </p>
          <p className="text-white/30 text-lg mt-4">We will measure you in 90 days.</p>
        </div>

        <div className="border-t border-white/10 pt-12 max-w-3xl mx-auto">
          <p className="text-lg md:text-xl text-white/40 font-light italic leading-relaxed">
            &ldquo;Eleven hours of stage. Five hundred different summits.
            <br />
            We did not run one event tonight — we ran five hundred,
            <br />
            and you were the only person in yours.
            <br />
            <span className="text-white/60">Read your dossier. The work begins now.</span>&rdquo;
          </p>
        </div>

        <p className="text-white/10 text-xs">
          Designed by Ommsharravana · Yi Erode · Part of Yi Connect
        </p>
      </div>
    </main>
  );
}

function Counter({ value, label, colour, large, pulse }: {
  value: string | number; label: string; colour: string; large?: boolean; pulse?: boolean;
}) {
  return (
    <div className={pulse ? "animate-pulse" : ""}>
      <p className={`font-bold ${large ? "text-5xl md:text-7xl" : "text-4xl md:text-5xl"}`} style={{ color: colour }}>
        {value}
      </p>
      <p className="text-white/40 text-sm uppercase tracking-wide mt-2">{label}</p>
    </div>
  );
}
