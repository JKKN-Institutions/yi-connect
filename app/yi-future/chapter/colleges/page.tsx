import Link from "next/link";
import { redirect } from "next/navigation";
import { createServiceClient } from "@/lib/yi-future/supabase/server";
import { getChapterContext } from "@/lib/yi-future/chapter-context";
import {
  deleteCollege,
  approvePendingCollege,
  mergePendingCollege,
} from "@/app/yi-future/actions/colleges";

type CollegeRow = {
  id: string;
  name: string;
  city: string | null;
  state: string | null;
  website_url: string | null;
  primary_contact_name: string | null;
  primary_contact_email: string | null;
  primary_contact_phone: string | null;
  is_yuva: boolean | null;
  is_approved: boolean;
};

type PendingRow = CollegeRow & { delegate_count: number; suggestion?: { id: string; name: string; city: string | null; distance: number } };

async function getColleges(chapterId: string): Promise<CollegeRow[]> {
  const svc = await createServiceClient();
  const { data } = await svc
    .schema("future")
    .from("colleges")
    .select(
      "id, name, city, state, website_url, primary_contact_name, primary_contact_email, primary_contact_phone, is_yuva, is_approved"
    )
    .eq("chapter_id", chapterId)
    .is("merged_into", null)
    .order("name", { ascending: true });
  return (data as unknown as CollegeRow[]) ?? [];
}

async function getPendingDelegateCounts(
  collegeIds: string[]
): Promise<Map<string, number>> {
  if (collegeIds.length === 0) return new Map();
  const svc = await createServiceClient();
  const { data } = await svc
    .schema("future")
    .from("delegates")
    .select("college_id")
    .in("college_id", collegeIds);
  const rows = (data as { college_id: string | null }[] | null) ?? [];
  const counts = new Map<string, number>();
  for (const r of rows) {
    if (!r.college_id) continue;
    counts.set(r.college_id, (counts.get(r.college_id) ?? 0) + 1);
  }
  return counts;
}

// Tiny Levenshtein for "looks like…" suggestions. Used only on the
// pending list which is small. Threshold ≤ 3 picks up "Anna University"
// vs "Anna Univ" (dist 7 — too far) but catches typos like "Anna Universty"
// (dist 1). We also normalize to lowercase + trim trailing common words.
function lev(a: string, b: string): number {
  if (a === b) return 0;
  const m = a.length;
  const n = b.length;
  if (m === 0) return n;
  if (n === 0) return m;
  const dp: number[] = Array(n + 1).fill(0);
  for (let j = 0; j <= n; j++) dp[j] = j;
  for (let i = 1; i <= m; i++) {
    let prev = dp[0];
    dp[0] = i;
    for (let j = 1; j <= n; j++) {
      const tmp = dp[j];
      dp[j] =
        a[i - 1] === b[j - 1]
          ? prev
          : Math.min(prev + 1, dp[j] + 1, dp[j - 1] + 1);
      prev = tmp;
    }
  }
  return dp[n];
}

function suggestMerge(
  pending: CollegeRow,
  approved: CollegeRow[]
): PendingRow["suggestion"] | undefined {
  const target = pending.name.toLowerCase().trim();
  let best: { id: string; name: string; city: string | null; distance: number } | undefined;
  for (const a of approved) {
    const d = lev(target, a.name.toLowerCase().trim());
    if (d <= 3 && (!best || d < best.distance)) {
      best = { id: a.id, name: a.name, city: a.city, distance: d };
    }
  }
  return best;
}

async function removeCollege(formData: FormData) {
  "use server";
  await deleteCollege(String(formData.get("id") ?? ""));
}

async function approveAction(formData: FormData) {
  "use server";
  await approvePendingCollege(String(formData.get("id") ?? ""));
}

async function mergeAction(formData: FormData) {
  "use server";
  await mergePendingCollege(
    String(formData.get("source_id") ?? ""),
    String(formData.get("target_id") ?? "")
  );
}

export default async function CollegesPage({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string }>;
}) {
  const ctx = await getChapterContext();
  if (!ctx) redirect("/yi-future/chapter");

  const tab = (await searchParams).tab === "pending" ? "pending" : "approved";

  const all = await getColleges(ctx.chapterId);
  const approved = all.filter((c) => c.is_approved);
  const pendingRaw = all.filter((c) => !c.is_approved);
  const pendingCounts = await getPendingDelegateCounts(
    pendingRaw.map((c) => c.id)
  );
  const pending: PendingRow[] = pendingRaw.map((p) => ({
    ...p,
    delegate_count: pendingCounts.get(p.id) ?? 0,
    suggestion: suggestMerge(p, approved),
  }));

  const yuvaCount = approved.filter((c) => c.is_yuva).length;

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-navy">Colleges</h2>
          <p className="mt-1 text-sm text-navy/60">
            {approved.length} approved · {yuvaCount} Yi YUVA partner
            {pending.length > 0 && (
              <span className="ml-2 text-yi-saffron">
                · {pending.length} pending review
              </span>
            )}
          </p>
        </div>
        <Link
          href="/yi-future/chapter/colleges/new"
          className="px-4 py-2 rounded-md bg-navy text-ivory text-sm font-semibold hover:bg-navy-dark"
        >
          + Add college
        </Link>
      </div>

      <div className="flex gap-1 border-b border-navy/10">
        <Link
          href="/yi-future/chapter/colleges"
          className={`min-h-[44px] inline-flex items-center px-4 text-sm font-semibold border-b-2 -mb-px ${
            tab === "approved"
              ? "border-navy text-navy"
              : "border-transparent text-navy/50 hover:text-navy"
          }`}
        >
          Approved ({approved.length})
        </Link>
        <Link
          href="/yi-future/chapter/colleges?tab=pending"
          className={`min-h-[44px] inline-flex items-center px-4 text-sm font-semibold border-b-2 -mb-px ${
            tab === "pending"
              ? "border-navy text-navy"
              : "border-transparent text-navy/50 hover:text-navy"
          }`}
        >
          Pending review
          {pending.length > 0 && (
            <span className="ml-2 inline-flex items-center justify-center min-w-[20px] h-5 px-1.5 rounded-full bg-yi-saffron text-white text-[10px] font-bold">
              {pending.length}
            </span>
          )}
        </Link>
      </div>

      {tab === "approved" ? (
        <ApprovedList rows={approved} removeAction={removeCollege} />
      ) : (
        <PendingList
          rows={pending}
          approved={approved}
          approveAction={approveAction}
          mergeAction={mergeAction}
        />
      )}
    </div>
  );
}

function ApprovedList({
  rows,
  removeAction,
}: {
  rows: CollegeRow[];
  removeAction: (formData: FormData) => Promise<void>;
}) {
  return (
    <div className="bg-white border border-navy/10 rounded-lg overflow-hidden">
      <table className="w-full text-sm">
        <thead className="bg-navy/5 text-navy/70">
          <tr>
            <th className="text-left px-4 py-3 font-semibold">College</th>
            <th className="text-left px-4 py-3 font-semibold">Location</th>
            <th className="text-left px-4 py-3 font-semibold">Contact</th>
            <th className="text-left px-4 py-3 font-semibold">YUVA</th>
            <th className="text-right px-4 py-3 font-semibold">Action</th>
          </tr>
        </thead>
        <tbody>
          {rows.length === 0 ? (
            <tr>
              <td colSpan={5} className="px-4 py-6 text-center text-navy/40">
                No approved colleges yet.{" "}
                <Link
                  href="/yi-future/chapter/colleges/new"
                  className="text-yi-gold font-semibold"
                >
                  Add one
                </Link>
                .
              </td>
            </tr>
          ) : (
            rows.map((c) => (
              <tr key={c.id} className="border-t border-navy/5">
                <td className="px-4 py-3">
                  <div className="font-semibold">{c.name}</div>
                  {c.website_url && (
                    <a
                      href={c.website_url}
                      target="_blank"
                      rel="noopener"
                      className="text-xs text-yi-gold hover:underline"
                    >
                      {c.website_url.replace(/^https?:\/\//, "")}
                    </a>
                  )}
                </td>
                <td className="px-4 py-3 text-navy/70 text-xs">
                  {[c.city, c.state].filter(Boolean).join(", ") || "—"}
                </td>
                <td className="px-4 py-3 text-xs">
                  {c.primary_contact_name ? (
                    <div>
                      <div className="font-semibold">
                        {c.primary_contact_name}
                      </div>
                      <div className="text-navy/60">
                        {c.primary_contact_email}
                      </div>
                      <div className="text-navy/60">
                        {c.primary_contact_phone}
                      </div>
                    </div>
                  ) : (
                    <span className="text-navy/40">—</span>
                  )}
                </td>
                <td className="px-4 py-3">
                  {c.is_yuva ? (
                    <span className="inline-block px-2 py-0.5 rounded-full bg-yi-saffron/10 text-yi-saffron text-xs font-semibold">
                      YUVA
                    </span>
                  ) : (
                    <span className="text-xs text-navy/40">—</span>
                  )}
                </td>
                <td className="px-4 py-3 text-right space-x-3">
                  <Link
                    href={`/yi-future/chapter/colleges/${c.id}/edit`}
                    className="text-xs font-semibold text-navy hover:text-yi-gold"
                  >
                    Edit
                  </Link>
                  <form action={removeAction} className="inline-block">
                    <input type="hidden" name="id" value={c.id} />
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
  );
}

function PendingList({
  rows,
  approved,
  approveAction,
  mergeAction,
}: {
  rows: PendingRow[];
  approved: CollegeRow[];
  approveAction: (formData: FormData) => Promise<void>;
  mergeAction: (formData: FormData) => Promise<void>;
}) {
  if (rows.length === 0) {
    return (
      <div className="bg-white border border-navy/10 rounded-lg p-8 text-center text-sm text-navy/50">
        Nothing to review. New colleges typed by registering students appear here.
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <p className="text-xs text-navy/60">
        These names were typed by students during registration. Approve as new,
        merge into an existing approved college, or edit before approving.
      </p>
      {rows.map((p) => (
        <div
          key={p.id}
          className="bg-white border border-navy/10 rounded-lg p-4"
        >
          <div className="flex items-start justify-between gap-4 flex-wrap">
            <div className="flex-1 min-w-[180px]">
              <div className="font-semibold text-navy">{p.name}</div>
              <div className="text-xs text-navy/60 mt-0.5">
                {p.city ?? "no city"} · used by{" "}
                <strong>
                  {p.delegate_count} delegate
                  {p.delegate_count === 1 ? "" : "s"}
                </strong>
              </div>
              {p.suggestion && (
                <div className="mt-2 text-xs bg-yi-gold/10 border border-yi-gold/30 rounded px-2 py-1.5 inline-flex items-center gap-2">
                  <span className="text-navy/70">Looks like:</span>
                  <strong className="text-navy">{p.suggestion.name}</strong>
                  {p.suggestion.city && (
                    <span className="text-navy/50">
                      ({p.suggestion.city})
                    </span>
                  )}
                  <span className="text-yi-gold/60 text-[10px]">
                    {p.suggestion.distance === 0
                      ? "exact"
                      : `dist ${p.suggestion.distance}`}
                  </span>
                </div>
              )}
            </div>

            <div className="flex flex-wrap gap-2 items-center">
              <form action={approveAction}>
                <input type="hidden" name="id" value={p.id} />
                <button
                  type="submit"
                  className="px-3 py-2 rounded-md bg-yi-green text-white text-xs font-semibold hover:bg-yi-green/90"
                >
                  Approve as new
                </button>
              </form>

              {approved.length > 0 && (
                <form action={mergeAction} className="flex items-center gap-2">
                  <input type="hidden" name="source_id" value={p.id} />
                  <select
                    name="target_id"
                    defaultValue={p.suggestion?.id ?? ""}
                    className="text-xs border border-navy/20 rounded px-2 py-2 bg-white max-w-[200px]"
                    required
                  >
                    <option value="" disabled>
                      Merge into…
                    </option>
                    {approved.map((a) => (
                      <option key={a.id} value={a.id}>
                        {a.name}
                        {a.city ? ` (${a.city})` : ""}
                      </option>
                    ))}
                  </select>
                  <button
                    type="submit"
                    className="px-3 py-2 rounded-md bg-navy text-ivory text-xs font-semibold hover:bg-navy-dark"
                  >
                    Merge
                  </button>
                </form>
              )}

              <Link
                href={`/yi-future/chapter/colleges/${p.id}/edit`}
                className="px-3 py-2 rounded-md border border-navy/20 text-xs font-semibold text-navy hover:bg-navy/5"
              >
                Edit & approve
              </Link>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}
