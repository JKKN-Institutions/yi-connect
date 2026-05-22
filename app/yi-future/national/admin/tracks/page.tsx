import Link from "next/link";
import { createServiceClient } from "@/lib/yi-future/supabase/server";
import { deleteTrack } from "@/app/yi-future/actions/tracks";
import { isCurrentUserPlatformAdmin } from "@/app/yi-future/actions/national-admins";

type Edition = {
  id: string;
  slug: string;
  name: string;
  is_active: boolean | null;
};

type Track = {
  id: string;
  edition_id: string;
  slug: string;
  name: string;
  description: string | null;
  color_hex: string | null;
  icon: string | null;
  display_order: number | null;
};

async function getEditions(): Promise<Edition[]> {
  const svc = await createServiceClient();
  const { data } = await svc
    .schema("future")
    .from("editions")
    .select("id, slug, name, is_active")
    .order("kickoff_date", { ascending: false });
  return (data as unknown as Edition[]) ?? [];
}

async function getTracks(editionId: string): Promise<Track[]> {
  const svc = await createServiceClient();
  const { data } = await svc
    .schema("future")
    .from("tracks")
    .select("id, edition_id, slug, name, description, color_hex, icon, display_order")
    .eq("edition_id", editionId)
    .order("display_order", { ascending: true });
  return (data as unknown as Track[]) ?? [];
}

async function removeTrack(formData: FormData) {
  "use server";
  const id = String(formData.get("id") ?? "");
  const editionId = String(formData.get("edition") ?? "");
  await deleteTrack(id, editionId);
}

export default async function TracksPage({
  searchParams,
}: {
  searchParams: Promise<{ edition?: string }>;
}) {
  const { edition: editionParam } = await searchParams;
  const [editions, { isPlatform }] = await Promise.all([
    getEditions(),
    isCurrentUserPlatformAdmin(),
  ]);
  const selected =
    editions.find((e) => e.id === editionParam) ??
    editions.find((e) => e.is_active) ??
    editions[0];
  const tracks = selected ? await getTracks(selected.id) : [];

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-navy">Tracks</h2>
          <p className="mt-1 text-sm text-navy/60">
            Each edition has four thematic tracks.
          </p>
        </div>
        {selected && isPlatform && (
          <Link
            href={`/national/admin/tracks/new?edition=${selected.id}`}
            className="px-4 py-2 rounded-md bg-navy text-ivory text-sm font-semibold hover:bg-navy-dark"
          >
            + New track
          </Link>
        )}
      </div>

      {!isPlatform && (
        <div className="rounded-md border border-navy/15 bg-navy/5 px-4 py-3 text-xs text-navy/70">
          View only — only Platform admins can edit structural config.
        </div>
      )}

      {/* Edition switcher */}
      <div className="flex flex-wrap gap-2">
        {editions.map((e) => (
          <Link
            key={e.id}
            href={`/national/admin/tracks?edition=${e.id}`}
            className={`px-3 py-1.5 rounded-md text-xs font-semibold transition-colors ${
              selected?.id === e.id
                ? "bg-navy text-ivory"
                : "bg-white text-navy/70 border border-navy/20 hover:border-navy/40"
            }`}
          >
            {e.name}
            {e.is_active && (
              <span className="ml-1.5 text-yi-gold">●</span>
            )}
          </Link>
        ))}
      </div>

      {!selected ? (
        <div className="bg-white border border-navy/10 rounded-lg p-8 text-center text-navy/50">
          No edition selected. Create an edition first.
        </div>
      ) : tracks.length === 0 ? (
        <div className="bg-white border border-navy/10 rounded-lg p-8 text-center text-navy/50">
          No tracks on this edition yet.
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {tracks.map((t) => (
            <div
              key={t.id}
              className="bg-white rounded-lg p-5 border-2"
              style={{ borderColor: t.color_hex ?? "#1a1a3e" }}
            >
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-center gap-3">
                  <span className="text-3xl">{t.icon ?? "•"}</span>
                  <div>
                    <div
                      className="font-bold"
                      style={{ color: t.color_hex ?? "#1a1a3e" }}
                    >
                      {t.name}
                    </div>
                    <div className="text-[10px] font-mono text-navy/40 tracking-wider">
                      {t.slug} · order {t.display_order ?? "—"}
                    </div>
                  </div>
                </div>
              </div>

              {t.description && (
                <p className="mt-3 text-sm text-navy/70 leading-relaxed">
                  {t.description}
                </p>
              )}

              <div className="mt-4 pt-3 border-t border-navy/10 flex items-center justify-between">
                {isPlatform ? (
                  <Link
                    href={`/national/admin/tracks/${t.id}/edit?edition=${t.edition_id}`}
                    className="text-xs font-semibold text-navy hover:text-yi-gold"
                  >
                    Edit
                  </Link>
                ) : (
                  <span className="text-xs text-navy/30">—</span>
                )}
                <Link
                  href={`/national/admin/problems?track=${t.id}`}
                  className="text-xs font-semibold text-navy/60 hover:text-yi-gold"
                >
                  Problems →
                </Link>
                {isPlatform ? (
                  <form action={removeTrack}>
                    <input type="hidden" name="id" value={t.id} />
                    <input type="hidden" name="edition" value={t.edition_id} />
                    <button
                      type="submit"
                      className="text-xs text-red-600/70 hover:text-red-600"
                    >
                      Delete
                    </button>
                  </form>
                ) : (
                  <span className="text-xs text-navy/30">—</span>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
