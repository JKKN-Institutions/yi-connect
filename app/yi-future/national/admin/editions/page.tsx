import Link from "next/link";
import { createServiceClient } from "@/lib/yi-future/supabase/server";
import { setActiveEdition } from "@/app/yi-future/actions/editions";
import { isCurrentUserPlatformAdmin } from "@/app/yi-future/actions/national-admins";

type EditionRow = {
  id: string;
  slug: string;
  name: string;
  is_active: boolean | null;
  current_stage: string | null;
  kickoff_date: string | null;
  tagline: string | null;
};

async function getEditions(): Promise<EditionRow[]> {
  const svc = await createServiceClient();
  const { data } = await svc
    .schema("future")
    .from("editions")
    .select("id, slug, name, is_active, current_stage, kickoff_date, tagline")
    .order("kickoff_date", { ascending: false });
  return (data as unknown as EditionRow[]) ?? [];
}

async function activate(formData: FormData) {
  "use server";
  const id = String(formData.get("id") ?? "");
  await setActiveEdition(id);
}

export default async function EditionsPage() {
  const [editions, { isPlatform }] = await Promise.all([
    getEditions(),
    isCurrentUserPlatformAdmin(),
  ]);

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-navy">Editions</h2>
          <p className="mt-1 text-sm text-navy/60">
            Each edition is a yearly cycle of Future. Only one is active.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Link
            href="/api/csv/editions"
            className="text-xs font-semibold text-navy hover:text-yi-gold border border-navy/20 rounded px-3 py-1.5 inline-flex items-center gap-1.5"
          >
            <span>↓</span> CSV
          </Link>
          {isPlatform && (
            <Link
              href="/yi-future/national/admin/editions/new"
              className="px-4 py-2 rounded-md bg-navy text-ivory text-sm font-semibold hover:bg-navy-dark"
            >
              + New edition
            </Link>
          )}
        </div>
      </div>

      {!isPlatform && (
        <div className="rounded-md border border-navy/15 bg-navy/5 px-4 py-3 text-xs text-navy/70">
          View only — only Platform admins can edit structural config.
        </div>
      )}

      <div className="bg-white border border-navy/10 rounded-lg overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-navy/5 text-navy/70">
            <tr>
              <th className="text-left px-4 py-3 font-semibold">Slug</th>
              <th className="text-left px-4 py-3 font-semibold">Name</th>
              <th className="text-left px-4 py-3 font-semibold">Kickoff</th>
              <th className="text-left px-4 py-3 font-semibold">Stage</th>
              <th className="text-left px-4 py-3 font-semibold">Active</th>
              <th className="text-right px-4 py-3 font-semibold">Actions</th>
            </tr>
          </thead>
          <tbody>
            {editions.length === 0 ? (
              <tr>
                <td
                  colSpan={6}
                  className="px-4 py-6 text-center text-navy/40"
                >
                  No editions yet.
                  {isPlatform && (
                    <>
                      {" "}
                      <Link
                        href="/yi-future/national/admin/editions/new"
                        className="text-yi-gold font-semibold"
                      >
                        Create one
                      </Link>
                      .
                    </>
                  )}
                </td>
              </tr>
            ) : (
              editions.map((e) => (
                <tr key={e.id} className="border-t border-navy/5">
                  <td className="px-4 py-3 font-mono text-xs">{e.slug}</td>
                  <td className="px-4 py-3">
                    <div className="font-semibold">{e.name}</div>
                    {e.tagline && (
                      <div className="text-xs text-navy/50">{e.tagline}</div>
                    )}
                  </td>
                  <td className="px-4 py-3 text-navy/60">
                    {e.kickoff_date ?? "—"}
                  </td>
                  <td className="px-4 py-3">
                    <span className="inline-block px-2 py-0.5 rounded-full bg-yi-gold/10 text-yi-gold text-xs font-semibold">
                      {e.current_stage ?? "—"}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    {e.is_active ? (
                      <span className="inline-flex items-center gap-1.5 text-yi-green font-semibold">
                        <span className="h-1.5 w-1.5 rounded-full bg-yi-green" />
                        Active
                      </span>
                    ) : isPlatform ? (
                      <form action={activate}>
                        <input type="hidden" name="id" value={e.id} />
                        <button
                          type="submit"
                          className="text-xs text-navy/60 hover:text-yi-gold font-semibold"
                        >
                          Set active
                        </button>
                      </form>
                    ) : (
                      <span className="text-xs text-navy/30">—</span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-right">
                    {isPlatform ? (
                      <Link
                        href={`/national/admin/editions/${e.id}/edit`}
                        className="text-sm text-navy hover:text-yi-gold font-semibold"
                      >
                        Edit
                      </Link>
                    ) : (
                      <span className="text-xs text-navy/30">—</span>
                    )}
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
