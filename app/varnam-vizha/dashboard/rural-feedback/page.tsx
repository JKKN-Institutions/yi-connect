import type { Metadata } from "next";
import Link from "next/link";
import { getVarnamAccess } from "@/lib/varnam/auth/access";
import { Forbidden403 } from "@/app/varnam-vizha/_components/Forbidden403";
import { PANCHAYATS, SURVEY_KEY } from "@/lib/rural-hub/anumanpalli-survey";
import { getFeedback, tally } from "@/lib/rural-hub/results";

export const metadata: Metadata = { title: "Rural Hub feedback" };
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

/**
 * Village feedback on the Anumanpalli road map (Yi Rural Hub), for the Yi
 * Erode committee. Gated on getVarnamAccess (yi_directory roles, app='varnam')
 * because the Varnam Vizha committee is the Yi Erode team that will run the
 * feedback round; deny renders Forbidden403, never a silent redirect.
 */
export default async function RuralFeedbackPage() {
  const access = await getVarnamAccess();
  if (!access.canView) return <Forbidden403 reason={access.reason} />;

  const rows = await getFeedback(SURVEY_KEY);
  const tallies = tally(rows);
  const byPanchayat = PANCHAYATS.map((p) => ({
    ...p,
    n: rows.filter((r) => r.panchayat === p.key).length,
  }));

  return (
    <main className="mx-auto max-w-5xl px-4 py-8">
      <h1 className="font-[family-name:var(--font-vv-display)] text-3xl font-bold text-[#3B0A45]">
        Rural Hub feedback
      </h1>
      <p className="mt-1 text-[#2B0A33]/70">
        Answers from Attavanai and Mugasi Anumanpalli to the road map questions.
        Share this link with the village:{" "}
        <Link href="/rural-hub/anumanpalli" className="font-medium text-[#b02a59] underline">
          /rural-hub/anumanpalli
        </Link>
      </p>

      <section className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <div className="rounded-2xl border border-[#3B0A45]/10 bg-white p-4">
          <p className="text-3xl font-bold text-[#3B0A45]">{rows.length}</p>
          <p className="text-sm text-[#2B0A33]/60">people answered</p>
        </div>
        {byPanchayat.map((p) => (
          <div key={p.key} className="rounded-2xl border border-[#3B0A45]/10 bg-white p-4">
            <p className="text-3xl font-bold text-[#3B0A45]">{p.n}</p>
            <p className="text-sm text-[#2B0A33]/60">{p.en}</p>
          </div>
        ))}
      </section>

      {rows.length === 0 ? (
        <p className="mt-8 rounded-2xl border border-dashed border-[#3B0A45]/20 bg-white p-6 text-[#2B0A33]/70">
          No answers yet. Share the link above in the village WhatsApp groups to start.
        </p>
      ) : (
        <>
          <section className="mt-10 space-y-5">
            {tallies.map((t, i) => {
              const top = Math.max(1, ...t.counts.map((c) => c.n));
              return (
                <div key={t.question.key} className="rounded-2xl border border-[#3B0A45]/10 bg-white p-5">
                  <h2 className="font-semibold text-[#3B0A45]">
                    {i + 1}. {t.question.en}
                  </h2>
                  <p className="text-sm text-[#2B0A33]/60">
                    {t.answered} of {rows.length} answered
                    {t.question.kind === "multi" && t.question.max
                      ? `, each could pick up to ${t.question.max}`
                      : ""}
                  </p>
                  <ul className="mt-3 space-y-2">
                    {t.counts.map((c) => (
                      <li key={c.key} className="grid grid-cols-[minmax(0,1fr)_3rem] items-center gap-3">
                        <div>
                          <p className="text-sm text-[#2B0A33]">{c.en}</p>
                          <div className="mt-1 h-2 rounded bg-[#3B0A45]/8">
                            <div
                              className="h-2 rounded bg-[#D6336C]"
                              style={{ width: `${(c.n / top) * 100}%` }}
                            />
                          </div>
                        </div>
                        <p className="text-right font-semibold tabular-nums text-[#3B0A45]">{c.n}</p>
                      </li>
                    ))}
                  </ul>
                  {t.texts.length > 0 && (
                    <ul className="mt-4 space-y-1 border-t border-[#3B0A45]/10 pt-3 text-sm">
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
            <h2 className="font-semibold text-[#3B0A45]">Everyone who answered</h2>
            <div className="mt-3 overflow-x-auto rounded-2xl border border-[#3B0A45]/10 bg-white">
              <table className="w-full text-left text-sm">
                <thead className="border-b border-[#3B0A45]/10 text-[#2B0A33]/60">
                  <tr>
                    <th className="px-4 py-2 font-medium">Name</th>
                    <th className="px-4 py-2 font-medium">Panchayat</th>
                    <th className="px-4 py-2 font-medium">Phone</th>
                    <th className="px-4 py-2 font-medium">Sent</th>
                    <th className="px-4 py-2 font-medium">Anything else</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((r) => (
                    <tr key={r.id} className="border-b border-[#3B0A45]/5 last:border-0">
                      <td className="px-4 py-2">{r.respondent_name}</td>
                      <td className="px-4 py-2">{panchayatName(r.panchayat)}</td>
                      <td className="px-4 py-2 tabular-nums">{r.phone ?? "—"}</td>
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
    </main>
  );
}
