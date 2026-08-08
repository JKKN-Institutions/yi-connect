import Link from "next/link";
import { redirect } from "next/navigation";
import { createServiceClient } from "@/lib/yi-future/supabase/server";
import { getChapterContext } from "@/lib/yi-future/chapter-context";
import {
  deleteCollege,
  approvePendingCollege,
  mergePendingCollege,
} from "@/app/yi-future/actions/colleges";
import { mergeCollegeCluster } from "@/app/yi-future/actions/college-dedupe";
import {
  groupDuplicateColleges,
  type DuplicateGroup,
} from "@/lib/yi-future/college-dedupe";
import { WhatsAppIconButton } from "@/components/whatsapp";

// Normalize an Indian mobile number to a country-code-prefixed digit string.
function waPhone(raw: string): string {
  const digits = raw.replace(/\D/g, "").replace(/^0+/, "");
  return digits.startsWith("91") ? digits : "91" + digits;
}

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

// Counts delegates per college, PAGED.
//
// The unpaged version of this silently undercounts: PostgREST caps a select
// at 1,000 rows, so a chapter with more than 1,000 delegates loses every row
// past the cap and its colleges look emptier than they are. That was harmless
// while this only ran over the short pending list; the Duplicates tab runs it
// over every college in the chapter, where the cap is reachable.
async function getPendingDelegateCounts(
  collegeIds: string[]
): Promise<Map<string, number>> {
  if (collegeIds.length === 0) return new Map();
  const svc = await createServiceClient();
  const counts = new Map<string, number>();
  const PAGE = 1000;

  for (let from = 0; ; from += PAGE) {
    const { data, error } = await svc
      .schema("future")
      .from("delegates")
      .select("college_id")
      .in("college_id", collegeIds)
      .range(from, from + PAGE - 1);
    if (error) break;
    const rows = (data as { college_id: string | null }[] | null) ?? [];
    for (const r of rows) {
      if (!r.college_id) continue;
      counts.set(r.college_id, (counts.get(r.college_id) ?? 0) + 1);
    }
    if (rows.length < PAGE) break; // short page → that was the last one
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

// Folds one cluster of duplicate spellings into its target. The chapter id
// rides on the form and is re-checked server-side against the caller's own
// chapters — the posted value is never trusted on its own.
async function mergeClusterAction(formData: FormData) {
  "use server";
  const res = await mergeCollegeCluster({
    chapterId: String(formData.get("chapter_id") ?? ""),
    targetId: String(formData.get("target_id") ?? ""),
    sourceIds: String(formData.get("source_ids") ?? "")
      .split(",")
      .filter(Boolean),
  });

  const back = "/yi-future/chapter/colleges?tab=duplicates";
  if (!res.ok) {
    redirect(`${back}&error=${encodeURIComponent(res.error)}`);
  }
  const plural = (n: number, one: string) => `${n} ${one}${n === 1 ? "" : "s"}`;
  const parts = [
    `Merged ${plural(res.merged, "spelling")}`,
    `${plural(res.delegatesMoved, "student")} moved`,
  ];
  if (res.failures.length > 0) {
    parts.push(`${plural(res.failures.length, "problem")}: ${res.failures[0]}`);
  }
  redirect(`${back}&msg=${encodeURIComponent(parts.join(" · "))}`);
}

export default async function CollegesPage({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string; msg?: string; error?: string }>;
}) {
  const ctx = await getChapterContext();
  if (!ctx) redirect("/yi-future/chapter");

  const sp = await searchParams;
  const rawTab = sp.tab;
  const tab =
    rawTab === "pending"
      ? "pending"
      : rawTab === "duplicates"
        ? "duplicates"
        : "approved";

  const all = await getColleges(ctx.chapterId);
  const approved = all.filter((c) => c.is_approved);
  const pendingRaw = all.filter((c) => !c.is_approved);

  // Counted over EVERY college, not just the pending ones: the Duplicates tab
  // ranks variants by how many students each holds, and the biggest offenders
  // are usually long-approved rows.
  const counts = await getPendingDelegateCounts(all.map((c) => c.id));

  const pending: PendingRow[] = pendingRaw.map((p) => ({
    ...p,
    delegate_count: counts.get(p.id) ?? 0,
    suggestion: suggestMerge(p, approved),
  }));

  const duplicates = groupDuplicateColleges(
    all.map((c) => ({
      id: c.id,
      name: c.name,
      city: c.city,
      is_approved: c.is_approved,
      delegate_count: counts.get(c.id) ?? 0,
    }))
  );

  const yuvaCount = approved.filter((c) => c.is_yuva).length;

  return (
    <div className="space-y-6">
      {sp.error && (
        <div className="p-3 rounded-md bg-red-50 border border-red-200 text-sm text-red-700">
          {sp.error}
        </div>
      )}
      {sp.msg && (
        <div className="p-3 rounded-md bg-yi-green/10 border border-yi-green/30 text-sm text-yi-green">
          {sp.msg}
        </div>
      )}
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
        <Link
          href="/yi-future/chapter/colleges?tab=duplicates"
          className={`min-h-[44px] inline-flex items-center px-4 text-sm font-semibold border-b-2 -mb-px ${
            tab === "duplicates"
              ? "border-navy text-navy"
              : "border-transparent text-navy/50 hover:text-navy"
          }`}
        >
          Duplicates
          {duplicates.length > 0 && (
            <span className="ml-2 inline-flex items-center justify-center min-w-[20px] h-5 px-1.5 rounded-full bg-yi-saffron text-white text-[10px] font-bold">
              {duplicates.length}
            </span>
          )}
        </Link>
      </div>

      {tab === "approved" ? (
        <ApprovedList rows={approved} removeAction={removeCollege} />
      ) : tab === "pending" ? (
        <PendingList
          rows={pending}
          approved={approved}
          approveAction={approveAction}
          mergeAction={mergeAction}
        />
      ) : (
        <DuplicatesList
          groups={duplicates}
          chapterId={ctx.chapterId}
          mergeClusterAction={mergeClusterAction}
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
                      <div className="flex items-center gap-1.5 text-navy/60">
                        {c.primary_contact_phone}
                        {c.primary_contact_phone && (
                          <WhatsAppIconButton
                            contact={{
                              phone: waPhone(c.primary_contact_phone),
                              name: c.primary_contact_name,
                            }}
                            defaultMessage={`Hi ${c.primary_contact_name.split(" ")[0]},\n\nThis is from Yi YUVA Future 6.0 regarding ${c.name}.\n\n`}
                          />
                        )}
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

// ─── DUPLICATES ─────────────────────────────────────────────────────
// Every spelling of the same college, grouped, with the consequence of
// merging spelled out before the chair commits to it. Nothing merges until
// this button is pressed — the grouping is a suggestion, not an action.
function DuplicatesList({
  groups,
  chapterId,
  mergeClusterAction,
}: {
  groups: DuplicateGroup[];
  chapterId: string;
  mergeClusterAction: (formData: FormData) => Promise<void>;
}) {
  if (groups.length === 0) {
    return (
      <div className="bg-white border border-navy/10 rounded-lg p-8 text-center">
        <p className="text-sm text-navy/60">
          No duplicate college names found in your chapter.
        </p>
        <p className="mt-1 text-xs text-navy/40">
          Names are compared ignoring capitals, spaces and punctuation — so
          “K.S.Rangasamy” and “K S Rangasamy” count as the same college, but a
          different spelling of the name itself does not.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="p-4 rounded-lg bg-navy/5 border border-navy/10">
        <p className="text-sm text-navy/80">
          These colleges are stored under more than one spelling. Merging keeps
          one name and moves every student onto it — nothing is deleted, and
          the old spellings stay on record.
        </p>
        <p className="mt-1 text-xs text-navy/50">
          Worth doing before you place students into teams: students under two
          spellings of one college look like they are from different colleges.
        </p>
      </div>

      {groups.map((g) => (
        <div
          key={g.key}
          className="bg-white border border-navy/10 rounded-lg overflow-hidden"
        >
          <div className="px-4 py-3 border-b border-navy/10 flex items-start justify-between gap-4">
            <div>
              <div className="font-semibold text-navy">{g.target.name}</div>
              <div className="text-xs text-navy/50 mt-0.5">
                {g.sources.length + 1} spellings · {g.totalDelegates} student
                {g.totalDelegates === 1 ? "" : "s"} in total
              </div>
            </div>
            <form action={mergeClusterAction}>
              <input type="hidden" name="chapter_id" value={chapterId} />
              <input type="hidden" name="target_id" value={g.target.id} />
              <input
                type="hidden"
                name="source_ids"
                value={g.sources.map((s) => s.id).join(",")}
              />
              <button
                type="submit"
                className="px-4 py-2 rounded-md bg-navy text-ivory text-xs font-semibold hover:bg-navy-dark whitespace-nowrap"
              >
                Merge into “{g.target.name.slice(0, 28)}
                {g.target.name.length > 28 ? "…" : ""}”
              </button>
            </form>
          </div>

          <table className="w-full text-sm">
            <tbody>
              <tr className="border-b border-navy/5 bg-yi-green/5">
                <td className="px-4 py-2.5">
                  <span className="inline-flex items-center gap-2">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-yi-green">
                      Keep
                    </span>
                    <span className="font-medium text-navy">
                      {g.target.name}
                    </span>
                  </span>
                  {g.target.city && (
                    <span className="ml-2 text-xs text-navy/40">
                      {g.target.city}
                    </span>
                  )}
                  {!g.target.is_approved && (
                    <span className="ml-2 text-xs text-yi-saffron">
                      (will be approved)
                    </span>
                  )}
                </td>
                <td className="px-4 py-2.5 text-right text-xs text-navy/60 whitespace-nowrap">
                  {g.target.delegate_count} student
                  {g.target.delegate_count === 1 ? "" : "s"}
                </td>
              </tr>
              {g.sources.map((s) => (
                <tr key={s.id} className="border-b border-navy/5 last:border-0">
                  <td className="px-4 py-2.5">
                    <span className="inline-flex items-center gap-2">
                      <span className="text-[10px] font-bold uppercase tracking-wider text-navy/30">
                        Merge
                      </span>
                      <span className="text-navy/70">{s.name}</span>
                    </span>
                    {s.city && (
                      <span className="ml-2 text-xs text-navy/40">{s.city}</span>
                    )}
                  </td>
                  <td className="px-4 py-2.5 text-right text-xs text-navy/60 whitespace-nowrap">
                    {s.delegate_count > 0 ? (
                      <>
                        {s.delegate_count} student
                        {s.delegate_count === 1 ? "" : "s"} move
                      </>
                    ) : (
                      <span className="text-navy/30">no students</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ))}
    </div>
  );
}
