import Link from "next/link";
import { redirect } from "next/navigation";
import { createServiceClient } from "@/lib/yi-future/supabase/server";
import { getChapterContext } from "@/lib/yi-future/chapter-context";
import { deleteExpert } from "@/app/yi-future/actions/experts";

type Expert = {
  id: string;
  full_name: string;
  title: string | null;
  organization: string | null;
  email: string | null;
  phone: string | null;
  bio: string | null;
  expertise_areas: string[] | null;
};

async function getExperts(editionId: string): Promise<Expert[]> {
  const svc = await createServiceClient();
  const { data } = await svc
    .schema("future")
    .from("experts")
    .select(
      "id, full_name, title, organization, email, phone, bio, expertise_areas"
    )
    .eq("edition_id", editionId)
    .order("full_name", { ascending: true });
  return (data as unknown as Expert[]) ?? [];
}

async function removeExpert(formData: FormData) {
  "use server";
  await deleteExpert(String(formData.get("id") ?? ""));
}

function truncate(text: string | null, max = 120): string {
  if (!text) return "";
  return text.length > max ? `${text.substring(0, max)}…` : text;
}

export default async function ExpertsPage() {
  const ctx = await getChapterContext();
  if (!ctx) redirect("/yi-future/chapter");

  const experts = await getExperts(ctx.editionId);

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-navy">Experts</h2>
          <p className="mt-1 text-sm text-navy/60">
            {experts.length} expert{experts.length === 1 ? "" : "s"} registered
            for {ctx.editionName}.
          </p>
        </div>
        <Link
          href="/yi-future/chapter/experts/new"
          className="px-4 py-2 rounded-md bg-navy text-ivory text-sm font-semibold hover:bg-navy-dark"
        >
          + Add expert
        </Link>
      </div>

      <div className="bg-white border border-navy/10 rounded-lg overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-navy/5 text-navy/70">
            <tr>
              <th className="text-left px-4 py-3 font-semibold">Name</th>
              <th className="text-left px-4 py-3 font-semibold">Contact</th>
              <th className="text-left px-4 py-3 font-semibold">Expertise</th>
              <th className="text-left px-4 py-3 font-semibold">Bio</th>
              <th className="text-right px-4 py-3 font-semibold">Actions</th>
            </tr>
          </thead>
          <tbody>
            {experts.length === 0 ? (
              <tr>
                <td colSpan={5} className="px-4 py-6 text-center text-navy/40">
                  No experts yet.{" "}
                  <Link
                    href="/yi-future/chapter/experts/new"
                    className="text-yi-gold font-semibold"
                  >
                    Add one
                  </Link>
                  .
                </td>
              </tr>
            ) : (
              experts.map((e) => (
                <tr key={e.id} className="border-t border-navy/5 align-top">
                  <td className="px-4 py-3">
                    <div className="font-semibold text-navy">{e.full_name}</div>
                    {(e.title || e.organization) && (
                      <div className="text-xs text-navy/60 mt-0.5">
                        {e.title}
                        {e.title && e.organization && " · "}
                        {e.organization}
                      </div>
                    )}
                  </td>
                  <td className="px-4 py-3 text-xs text-navy/70">
                    {e.email && <div>{e.email}</div>}
                    {e.phone && <div>{e.phone}</div>}
                    {!e.email && !e.phone && (
                      <span className="text-navy/30">—</span>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    {e.expertise_areas && e.expertise_areas.length > 0 ? (
                      <div className="flex flex-wrap gap-1">
                        {e.expertise_areas.map((area) => (
                          <span
                            key={area}
                            className="px-2 py-0.5 text-[10px] font-semibold bg-yi-gold/10 text-yi-gold rounded-full"
                          >
                            {area}
                          </span>
                        ))}
                      </div>
                    ) : (
                      <span className="text-navy/30 text-xs">—</span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-xs text-navy/70 max-w-sm">
                    {e.bio ? (
                      truncate(e.bio)
                    ) : (
                      <span className="text-navy/30">—</span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-right space-x-3 whitespace-nowrap">
                    <Link
                      href={`/yi-future/chapter/experts/${e.id}/edit`}
                      className="text-xs font-semibold text-navy hover:text-yi-gold"
                    >
                      Edit
                    </Link>
                    <form action={removeExpert} className="inline-block">
                      <input type="hidden" name="id" value={e.id} />
                      <button
                        type="submit"
                        className="text-xs text-red-600/70 hover:text-red-600"
                      >
                        Delete
                      </button>
                    </form>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
