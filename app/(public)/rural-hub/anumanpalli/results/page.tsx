import type { Metadata } from "next";
import Link from "next/link";
import { ShieldAlert } from "lucide-react";
import { PANCHAYATS, SURVEY_CHAPTER, SURVEY_KEY } from "@/lib/rural-hub/anumanpalli-survey";
import { getRuralResultsAccess } from "@/lib/rural-hub/access";
import { getFeedback, latestPerPhone, tally } from "@/lib/rural-hub/results";

export const metadata: Metadata = { title: "Rural Hub answers" };
// Answers arrive all day from a shared link; never show a cached count.
export const dynamic = "force-dynamic";

const fmtWhen = (iso: string) =>
  new Date(iso).toLocaleString("en-IN", {
    day: "numeric",
    month: "short",
    hour: "numeric",
    minute: "2-digit",
    timeZone: "Asia/Kolkata",
  });

const panchayatName = (k: string) => PANCHAYATS.find((p) => p.key === k)?.en ?? k;

const card = "rounded border border-[#E0DBCF] bg-white";

/**
 * Village answers to the Anumanpalli road map (Yi Rural Hub).
 *
 * Who sees it: only the Yi Erode Chapter Chair and Co-Chair (Director, 9 Nov
 * 2026), checked by getRuralResultsAccess against yi_directory. It sits beside
 * the public form rather than inside the Varnam Vizha dashboard, whose layout
 * admits the whole festival committee. Deny renders an explicit page, never a
 * silent redirect.
 *
 * Counting: one person per phone. A later send from the same phone replaces the
 * earlier one here; every send stays stored.
 */
export default async function RuralResultsPage() {
  const access = await getRuralResultsAccess(SURVEY_CHAPTER);
  if (!access.canView) {
    return <Denied reason={access.reason} signedIn={access.signedIn} />;
  }

  const sends = await getFeedback(SURVEY_KEY);
  const { people, replaced } = latestPerPhone(sends);
  const tallies = tally(people);
  const byPanchayat = PANCHAYATS.map((p) => ({
    ...p,
    n: people.filter((r) => r.panchayat === p.key).length,
  }));

  return (
    <main className="-mx-4 -my-8 min-h-screen bg-[#F7F5EF] px-4 py-8 text-[#161C24]">
      <div className="mx-auto max-w-5xl">
        <h1 className="text-3xl font-bold">Rural Hub answers</h1>
        <p className="mt-1 text-[#404A57]">
          Attavanai and Mugasi Anumanpalli, answering the road map questions. The
          link to share with the village is{" "}
          <Link href="/rural-hub/anumanpalli" className="font-medium text-[#865600] underline">
            /rural-hub/anumanpalli
          </Link>
          .
        </p>

        <section className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
          <div className={`${card} p-4`}>
            <p className="text-3xl font-bold tabular-nums">{people.length}</p>
            <p className="text-sm text-[#4F5866]">people answered</p>
          </div>
          {byPanchayat.map((p) => (
            <div key={p.key} className={`${card} p-4`}>
              <p className="text-3xl font-bold tabular-nums">{p.n}</p>
              <p className="text-sm text-[#4F5866]">{p.en}</p>
            </div>
          ))}
        </section>
        <p className="mt-2 text-sm text-[#4F5866]">
          One person per phone number.{" "}
          {replaced > 0
            ? `${replaced} earlier ${replaced === 1 ? "send was" : "sends were"} replaced by a newer send from the same phone.`
            : "No one has sent twice yet."}
        </p>

        {people.length === 0 ? (
          <p className="mt-8 rounded border border-dashed border-[#C9C1AE] bg-white p-6 text-[#404A57]">
            No answers yet. Share the link above in the village WhatsApp groups to start.
          </p>
        ) : (
          <>
            <section className="mt-10 space-y-5">
              {tallies.map((t, i) => {
                const top = Math.max(1, ...t.counts.map((c) => c.n));
                return (
                  <div key={t.question.key} className={`${card} p-5`}>
                    <h2 className="font-semibold">
                      {i + 1}. {t.question.en}
                    </h2>
                    <p className="text-sm text-[#4F5866]">
                      {t.answered} of {people.length} answered
                      {t.question.kind === "multi" && t.question.max
                        ? `, each could pick up to ${t.question.max}`
                        : ""}
                    </p>
                    <ul className="mt-3 space-y-2">
                      {t.counts.map((c) => (
                        <li key={c.key} className="grid grid-cols-[minmax(0,1fr)_3rem] items-center gap-3">
                          <div>
                            <p className="text-sm">{c.en}</p>
                            <div className="mt-1 h-2 rounded bg-[#E0DBCF]">
                              <div
                                className="h-2 rounded bg-[#865600]"
                                style={{ width: `${(c.n / top) * 100}%` }}
                              />
                            </div>
                          </div>
                          <p className="text-right font-semibold tabular-nums">{c.n}</p>
                        </li>
                      ))}
                    </ul>
                    {t.texts.length > 0 && (
                      <ul className="mt-4 space-y-1 border-t border-[#E0DBCF] pt-3 text-sm">
                        {t.texts.map((x, j) => (
                          <li key={j}>
                            <span className="font-medium">{x.name}:</span> {x.text}
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                );
              })}
            </section>

            <section className="mt-10">
              <h2 className="font-semibold">Everyone who answered</h2>
              <p className="text-sm text-[#4F5866]">Newest send from each phone.</p>
              <div className={`${card} mt-3 overflow-x-auto`}>
                <table className="w-full text-left text-sm">
                  <thead className="border-b border-[#E0DBCF] text-[#4F5866]">
                    <tr>
                      <th className="px-4 py-2 font-medium">Name</th>
                      <th className="px-4 py-2 font-medium">Panchayat</th>
                      <th className="px-4 py-2 font-medium">Phone</th>
                      <th className="px-4 py-2 font-medium">Sent</th>
                      <th className="px-4 py-2 font-medium">Anything else</th>
                    </tr>
                  </thead>
                  <tbody>
                    {people.map((r) => (
                      <tr key={r.id} className="border-b border-[#E0DBCF]/60 last:border-0">
                        <td className="px-4 py-2">{r.respondent_name}</td>
                        <td className="px-4 py-2">{panchayatName(r.panchayat)}</td>
                        <td className="px-4 py-2 tabular-nums">{r.phone}</td>
                        <td className="px-4 py-2 whitespace-nowrap">{fmtWhen(r.created_at)}</td>
                        <td className="px-4 py-2">{r.comment ?? "—"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>
          </>
        )}
      </div>
    </main>
  );
}

function Denied({ reason, signedIn }: { reason: string; signedIn: boolean }) {
  return (
    <main className="flex min-h-[60vh] items-center justify-center p-4">
      <div className="w-full max-w-md rounded border border-[#E0DBCF] border-l-4 border-l-[#9C2F28] bg-white p-6">
        <div className="mb-4 flex items-center gap-3">
          <ShieldAlert className="size-6 text-[#9C2F28]" aria-hidden />
          <h1 className="text-xl font-semibold">No access</h1>
        </div>
        <p className="text-[#404A57]">{reason}</p>
        <p className="mt-2 text-sm text-[#4F5866]">
          If you think this is a mistake, ask the Yi {SURVEY_CHAPTER} Chapter Chair.
        </p>
        {!signedIn && (
          <Link
            href="/login"
            className="mt-5 inline-flex rounded bg-[#253F6E] px-4 py-2 text-sm font-medium text-white hover:bg-[#1d3258]"
          >
            Sign in, then open this link again
          </Link>
        )}
      </div>
    </main>
  );
}
