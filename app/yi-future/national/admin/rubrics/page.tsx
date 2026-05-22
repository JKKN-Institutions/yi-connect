import Link from "next/link";
import { createServiceClient } from "@/lib/yi-future/supabase/server";
import { setDefaultRubric, deleteRubric } from "@/app/yi-future/actions/rubrics";
import { isCurrentUserPlatformAdmin } from "@/app/yi-future/actions/national-admins";

type Criterion = {
  key: string;
  label: string;
  max: number;
  description?: string;
};

type Rubric = {
  id: string;
  edition_id: string;
  name: string;
  scope: string;
  criteria: Criterion[];
  total_max: number | null;
  threshold_for_national: number | null;
  is_default: boolean | null;
  editions: { slug: string; name: string } | null;
};

async function getRubrics(): Promise<Rubric[]> {
  const svc = await createServiceClient();
  const { data } = await svc
    .schema("future")
    .from("rubrics")
    .select(
      "id, edition_id, name, scope, criteria, total_max, threshold_for_national, is_default, editions(slug, name)"
    )
    .order("edition_id", { ascending: false })
    .order("scope", { ascending: true });
  return (data as unknown as Rubric[]) ?? [];
}

async function makeDefault(formData: FormData) {
  "use server";
  const id = String(formData.get("id") ?? "");
  const editionId = String(formData.get("edition_id") ?? "");
  const scope = String(formData.get("scope") ?? "");
  await setDefaultRubric(id, editionId, scope);
}

async function removeRubric(formData: FormData) {
  "use server";
  await deleteRubric(String(formData.get("id") ?? ""));
}

export default async function RubricsPage() {
  const [rubrics, { isPlatform }] = await Promise.all([
    getRubrics(),
    isCurrentUserPlatformAdmin(),
  ]);

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-navy">Rubrics</h2>
          <p className="mt-1 text-sm text-navy/60">
            Handbook default: 5 criteria × 20 pts = 100. One default per
            (edition, scope).
          </p>
        </div>
        {isPlatform && (
          <Link
            href="/yi-future/national/admin/rubrics/new"
            className="px-4 py-2 rounded-md bg-navy text-ivory text-sm font-semibold hover:bg-navy-dark"
          >
            + New rubric
          </Link>
        )}
      </div>

      {!isPlatform && (
        <div className="rounded-md border border-navy/15 bg-navy/5 px-4 py-3 text-xs text-navy/70">
          View only — only Platform admins can edit structural config.
        </div>
      )}

      {rubrics.length === 0 ? (
        <div className="bg-white border border-navy/10 rounded-lg p-8 text-center text-navy/50 text-sm">
          No rubrics yet.
        </div>
      ) : (
        <div className="space-y-4">
          {rubrics.map((r) => (
            <article
              key={r.id}
              className="bg-white border border-navy/10 rounded-lg p-5"
            >
              <div className="flex items-start justify-between gap-4 mb-3">
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="font-bold text-navy">{r.name}</h3>
                    {r.is_default && (
                      <span className="text-[10px] font-semibold text-yi-gold bg-yi-gold/10 px-1.5 py-0.5 rounded">
                        DEFAULT
                      </span>
                    )}
                  </div>
                  <div className="text-xs text-navy/60 mt-0.5">
                    {r.editions?.name} · scope: <code>{r.scope}</code> · total
                    max: <strong>{r.total_max}</strong>
                    {r.threshold_for_national && (
                      <>
                        {" "}· national threshold:{" "}
                        <strong>{r.threshold_for_national}</strong>
                      </>
                    )}
                  </div>
                </div>
                {isPlatform && (
                  <div className="flex items-center gap-3">
                    {!r.is_default && (
                      <form action={makeDefault}>
                        <input type="hidden" name="id" value={r.id} />
                        <input
                          type="hidden"
                          name="edition_id"
                          value={r.edition_id}
                        />
                        <input type="hidden" name="scope" value={r.scope} />
                        <button
                          type="submit"
                          className="text-xs font-semibold text-navy/60 hover:text-yi-gold"
                        >
                          Set default
                        </button>
                      </form>
                    )}
                    <Link
                      href={`/national/admin/rubrics/${r.id}/edit`}
                      className="text-xs font-semibold text-navy hover:text-yi-gold"
                    >
                      Edit
                    </Link>
                    <form action={removeRubric}>
                      <input type="hidden" name="id" value={r.id} />
                      <button
                        type="submit"
                        className="text-xs text-red-600/70 hover:text-red-600"
                      >
                        Delete
                      </button>
                    </form>
                  </div>
                )}
              </div>

              <table className="w-full text-xs">
                <thead className="bg-navy/5 text-navy/60">
                  <tr>
                    <th className="text-left px-3 py-2 font-semibold">
                      Criterion
                    </th>
                    <th className="text-left px-3 py-2 font-semibold">
                      Description
                    </th>
                    <th className="text-right px-3 py-2 font-semibold">
                      Max
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {r.criteria.map((c) => (
                    <tr key={c.key} className="border-t border-navy/5">
                      <td className="px-3 py-1.5 font-semibold">{c.label}</td>
                      <td className="px-3 py-1.5 text-navy/60">
                        {c.description ?? "—"}
                      </td>
                      <td className="px-3 py-1.5 text-right font-mono">
                        {c.max}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </article>
          ))}
        </div>
      )}
    </div>
  );
}
