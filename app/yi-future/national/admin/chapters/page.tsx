import Link from "next/link";
import { createServiceClient } from "@/lib/yi-future/supabase/server";
import { setChapterActive } from "@/app/yi-future/actions/chapters";

type ChapterRow = {
  id: string;
  name: string;
  city: string;
  state: string | null;
  region: string | null;
  is_active: boolean | null;
  created_at: string | null;
};

async function getChapters(): Promise<ChapterRow[]> {
  const svc = await createServiceClient();
  const { data } = await svc
    .schema("yi")
    .from("chapters")
    .select("id, name, city, state, region, is_active, created_at")
    .order("name", { ascending: true });
  return (data as unknown as ChapterRow[]) ?? [];
}

async function toggleActive(formData: FormData) {
  "use server";
  const id = String(formData.get("id") ?? "");
  const next = formData.get("next") === "true";
  await setChapterActive(id, next);
}

export default async function ChaptersPage() {
  const chapters = await getChapters();
  const activeCount = chapters.filter((c) => c.is_active).length;

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-navy">Chapters</h2>
          <p className="mt-1 text-sm text-navy/60">
            {activeCount} active · {chapters.length} total
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Link
            href="/api/csv/chapters"
            className="text-xs font-semibold text-navy hover:text-yi-gold border border-navy/20 rounded px-3 py-1.5 inline-flex items-center gap-1.5"
          >
            <span>↓</span> CSV
          </Link>
          <Link
            href="/yi-future/national/admin/chapters/new"
            className="px-4 py-2 rounded-md bg-navy text-ivory text-sm font-semibold hover:bg-navy-dark"
          >
            + New chapter
          </Link>
        </div>
      </div>

      <div className="bg-white border border-navy/10 rounded-lg overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-navy/5 text-navy/70">
            <tr>
              <th className="text-left px-4 py-3 font-semibold">Name</th>
              <th className="text-left px-4 py-3 font-semibold">City</th>
              <th className="text-left px-4 py-3 font-semibold">State</th>
              <th className="text-left px-4 py-3 font-semibold">Region</th>
              <th className="text-left px-4 py-3 font-semibold">Active</th>
              <th className="text-right px-4 py-3 font-semibold">Action</th>
            </tr>
          </thead>
          <tbody>
            {chapters.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-4 py-6 text-center text-navy/40">
                  No chapters yet.{" "}
                  <Link
                    href="/yi-future/national/admin/chapters/new"
                    className="text-yi-gold font-semibold"
                  >
                    Create one
                  </Link>
                  .
                </td>
              </tr>
            ) : (
              chapters.map((c) => (
                <tr key={c.id} className="border-t border-navy/5">
                  <td className="px-4 py-3 font-semibold">{c.name}</td>
                  <td className="px-4 py-3 text-navy/70">{c.city}</td>
                  <td className="px-4 py-3 text-navy/70">{c.state ?? "—"}</td>
                  <td className="px-4 py-3 text-navy/70">{c.region ?? "—"}</td>
                  <td className="px-4 py-3">
                    <form action={toggleActive}>
                      <input type="hidden" name="id" value={c.id} />
                      <input
                        type="hidden"
                        name="next"
                        value={String(!c.is_active)}
                      />
                      <button
                        type="submit"
                        className={`text-xs font-semibold ${
                          c.is_active
                            ? "text-yi-green hover:text-yi-green/70"
                            : "text-navy/40 hover:text-navy"
                        }`}
                      >
                        {c.is_active ? "● Active" : "○ Inactive"}
                      </button>
                    </form>
                  </td>
                  <td className="px-4 py-3 text-right">
                    <Link
                      href={`/national/admin/chapters/${c.id}/edit`}
                      className="text-sm text-navy hover:text-yi-gold font-semibold"
                    >
                      Edit
                    </Link>
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
