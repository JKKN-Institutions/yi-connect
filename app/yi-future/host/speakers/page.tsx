import Link from "next/link";
import { redirect } from "next/navigation";
import { createServiceClient } from "@/lib/yi-future/supabase/server";
import { getChapterContext } from "@/lib/yi-future/chapter-context";
import { deleteHostSpeaker } from "@/app/yi-future/actions/host-speakers";

type Speaker = {
  id: string;
  full_name: string;
  title: string | null;
  organization: string | null;
  email: string | null;
  phone: string | null;
  bio: string | null;
  photo_url: string | null;
  expertise_areas: string[] | null;
};

async function getSpeakers(editionId: string): Promise<Speaker[]> {
  const svc = await createServiceClient();
  const { data } = await svc
    .schema("future")
    .from("experts")
    .select(
      "id, full_name, title, organization, email, phone, bio, photo_url, expertise_areas"
    )
    .eq("edition_id", editionId)
    .order("full_name", { ascending: true });
  return (data as unknown as Speaker[]) ?? [];
}

async function removeSpeaker(formData: FormData) {
  "use server";
  await deleteHostSpeaker(String(formData.get("id") ?? ""));
}

function truncate(text: string | null, max = 160): string {
  if (!text) return "";
  return text.length > max ? `${text.substring(0, max)}…` : text;
}

export default async function HostSpeakersPage() {
  const ctx = await getChapterContext();
  if (!ctx) redirect("/yi-future/login");

  const speakers = await getSpeakers(ctx.editionId);

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-navy">Speakers</h2>
          <p className="mt-1 text-sm text-navy/60">
            {speakers.length} speaker{speakers.length === 1 ? "" : "s"} for the
            National Track Final — Day 1 learning sessions and Day 2 keynotes.
          </p>
        </div>
        <Link
          href="/yi-future/host/speakers/new"
          className="px-4 py-2 rounded-md bg-navy text-ivory text-sm font-semibold hover:bg-navy-dark"
        >
          + Add speaker
        </Link>
      </div>

      {speakers.length === 0 ? (
        <div className="bg-white border border-navy/10 rounded-lg p-8 text-center text-navy/50 text-sm">
          No speakers added yet.{" "}
          <Link
            href="/yi-future/host/speakers/new"
            className="text-yi-gold font-semibold"
          >
            Add one
          </Link>
          .
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {speakers.map((s) => (
            <div
              key={s.id}
              className="bg-white border border-navy/10 rounded-lg p-5"
            >
              <div className="flex items-start gap-4">
                {s.photo_url ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={s.photo_url}
                    alt={s.full_name}
                    className="w-16 h-16 rounded-full object-cover border border-navy/10 flex-shrink-0"
                  />
                ) : (
                  <div className="w-16 h-16 rounded-full bg-yi-gold/10 text-yi-gold font-bold flex items-center justify-center flex-shrink-0 text-lg">
                    {s.full_name
                      .split(" ")
                      .map((w) => w[0])
                      .slice(0, 2)
                      .join("")
                      .toUpperCase()}
                  </div>
                )}
                <div className="flex-1 min-w-0">
                  <div className="font-bold text-navy">{s.full_name}</div>
                  {(s.title || s.organization) && (
                    <div className="text-xs text-navy/60 mt-0.5">
                      {s.title}
                      {s.title && s.organization && " · "}
                      {s.organization}
                    </div>
                  )}
                  {(s.email || s.phone) && (
                    <div className="text-xs text-navy/50 mt-1">
                      {s.email}
                      {s.email && s.phone && " · "}
                      {s.phone}
                    </div>
                  )}
                </div>
              </div>

              {s.expertise_areas && s.expertise_areas.length > 0 && (
                <div className="mt-3 flex flex-wrap gap-1">
                  {s.expertise_areas.map((area) => (
                    <span
                      key={area}
                      className="px-2 py-0.5 text-[10px] font-semibold bg-yi-gold/10 text-yi-gold rounded-full"
                    >
                      {area}
                    </span>
                  ))}
                </div>
              )}

              {s.bio && (
                <p className="mt-3 text-xs text-navy/70 leading-relaxed">
                  {truncate(s.bio)}
                </p>
              )}

              <div className="mt-4 pt-3 border-t border-navy/10 flex items-center justify-between">
                <Link
                  href={`/host/speakers/${s.id}/edit`}
                  className="text-xs font-semibold text-navy hover:text-yi-gold"
                >
                  Edit
                </Link>
                <form action={removeSpeaker}>
                  <input type="hidden" name="id" value={s.id} />
                  <button
                    type="submit"
                    className="text-xs text-red-600/70 hover:text-red-600"
                  >
                    Delete
                  </button>
                </form>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
