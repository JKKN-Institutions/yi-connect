import Link from "next/link";
import { redirect } from "next/navigation";
import { createServiceClient } from "@/lib/yi-future/supabase/server";
import { getChapterContext } from "@/lib/yi-future/chapter-context";
import {
  deleteDelegate,
  regenerateAccessCode,
} from "@/app/yi-future/actions/delegates";

type Delegate = {
  id: string;
  full_name: string;
  email: string | null;
  phone: string | null;
  access_code: string;
  course: string | null;
  year_of_study: number | null;
  college_id: string | null;
  is_active: boolean | null;
  colleges: { name: string } | null;
  team_members: { team_id: string; teams: { team_name: string } }[];
};

async function getDelegates(
  chapterId: string,
  editionId: string
): Promise<Delegate[]> {
  const svc = await createServiceClient();
  const { data } = await svc
    .schema("future")
    .from("delegates")
    .select(
      "id, full_name, email, phone, access_code, course, year_of_study, college_id, is_active, colleges(name), team_members(team_id, teams(team_name))"
    )
    .eq("chapter_id", chapterId)
    .eq("edition_id", editionId)
    .order("full_name", { ascending: true });
  return (data as unknown as Delegate[]) ?? [];
}

async function removeDelegate(formData: FormData) {
  "use server";
  const id = String(formData.get("id") ?? "");
  await deleteDelegate(id);
}

async function regenCode(formData: FormData) {
  "use server";
  const id = String(formData.get("id") ?? "");
  await regenerateAccessCode(id);
}

export default async function DelegatesPage() {
  const ctx = await getChapterContext();
  if (!ctx) redirect("/yi-future/chapter");

  const delegates = await getDelegates(ctx.chapterId, ctx.editionId);
  const onTeam = delegates.filter((d) => d.team_members.length > 0).length;

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-navy">Delegates</h2>
          <p className="mt-1 text-sm text-navy/60">
            {delegates.length} registered · {onTeam} on teams
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Link
            href={`/api/csv/delegates?chapter_id=${ctx.chapterId}`}
            className="text-xs font-semibold text-navy hover:text-yi-gold border border-navy/20 rounded px-3 py-1.5 inline-flex items-center gap-1.5"
          >
            <span>↓</span> CSV
          </Link>
          <Link
            href="/yi-future/chapter/delegates/new"
            className="px-4 py-2 rounded-md bg-navy text-ivory text-sm font-semibold hover:bg-navy-dark"
          >
            + Register delegate
          </Link>
        </div>
      </div>

      <div className="bg-white border border-navy/10 rounded-lg overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-navy/5 text-navy/70">
            <tr>
              <th className="text-left px-4 py-3 font-semibold">Delegate</th>
              <th className="text-left px-4 py-3 font-semibold">College</th>
              <th className="text-left px-4 py-3 font-semibold">Team</th>
              <th className="text-left px-4 py-3 font-semibold">Code</th>
              <th className="text-right px-4 py-3 font-semibold">Actions</th>
            </tr>
          </thead>
          <tbody>
            {delegates.length === 0 ? (
              <tr>
                <td colSpan={5} className="px-4 py-6 text-center text-navy/40">
                  No delegates yet.{" "}
                  <Link
                    href="/yi-future/chapter/delegates/new"
                    className="text-yi-gold font-semibold"
                  >
                    Register one
                  </Link>
                  .
                </td>
              </tr>
            ) : (
              delegates.map((d) => {
                const tm = d.team_members[0];
                return (
                  <tr key={d.id} className="border-t border-navy/5">
                    <td className="px-4 py-3">
                      <div className="font-semibold">{d.full_name}</div>
                      <div className="text-xs text-navy/60">
                        {d.email && <span>{d.email}</span>}
                        {d.email && d.phone && <span> · </span>}
                        {d.phone && <span>{d.phone}</span>}
                      </div>
                      {(d.course || d.year_of_study) && (
                        <div className="text-xs text-navy/50">
                          {d.course}
                          {d.course && d.year_of_study && " · "}
                          {d.year_of_study && `Year ${d.year_of_study}`}
                        </div>
                      )}
                    </td>
                    <td className="px-4 py-3 text-xs text-navy/70">
                      {d.colleges?.name ?? "—"}
                    </td>
                    <td className="px-4 py-3 text-xs">
                      {tm ? (
                        <Link
                          href={`/chapter/teams/${tm.team_id}`}
                          className="text-navy font-semibold hover:text-yi-gold"
                        >
                          {tm.teams?.team_name ?? "(unnamed)"}
                        </Link>
                      ) : (
                        <span className="text-navy/40">—</span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <code className="text-xs font-mono font-bold tracking-wider bg-yi-gold/10 text-yi-gold px-2 py-0.5 rounded">
                        {d.access_code}
                      </code>
                    </td>
                    <td className="px-4 py-3 text-right space-x-3">
                      <Link
                        href={`/chapter/delegates/${d.id}/edit`}
                        className="text-xs font-semibold text-navy hover:text-yi-gold"
                      >
                        Edit
                      </Link>
                      <form action={regenCode} className="inline-block">
                        <input type="hidden" name="id" value={d.id} />
                        <button
                          type="submit"
                          className="text-xs text-navy/60 hover:text-navy"
                        >
                          Regen code
                        </button>
                      </form>
                      <form action={removeDelegate} className="inline-block">
                        <input type="hidden" name="id" value={d.id} />
                        <button
                          type="submit"
                          className="text-xs text-red-600/70 hover:text-red-600"
                        >
                          Delete
                        </button>
                      </form>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
