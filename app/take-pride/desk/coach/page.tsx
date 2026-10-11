import Link from "next/link";
import type { Metadata } from "next";
import { Denied, TopBar } from "../../_ui";
import { requireTpDesk } from "@/lib/take-pride/auth";
import { ReviewBanner } from "../../review/_banner";
import { tpService } from "@/lib/take-pride/supabase";
import { COACH_MOODS, COACH_STEPS, MOOD_LABEL, dueLabel, pledgeThemes } from "@/lib/take-pride/coach/schemas";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "1% coach desk" };

/*
 * Is the 1% Shift sticking? Counts only: delegates with a pledge, check-ins
 * sent per step, the mood mix, and pledge THEMES (a fixed keyword list, so
 * no pledge text and no name is ever shown here).
 * Review mode (outside reviewers): sample delegates only.
 */

type DelegateRow = { id: string; pledge: string | null };
type CheckinRow = { delegate_id: string; step: number; mood: string | null; status: string };

async function load(sample: boolean): Promise<{ delegates: DelegateRow[]; checkins: CheckinRow[] | null }> {
  const db = tpService();
  const { data, error } = await db.from("tp_delegates").select("id, pledge").eq("is_sample", sample).limit(5000);
  if (error) throw new Error(error.message);
  const delegates = (data ?? []) as DelegateRow[];
  if (!delegates.length) return { delegates, checkins: [] };
  // Filter by this world's delegate ids (no embedded filter), so a review session never reads a real row.
  const { data: c, error: cErr } = await db
    .from("tp_coach_checkins")
    .select("delegate_id, step, mood, status")
    .in("delegate_id", delegates.map((d) => d.id))
    .neq("status", "open")
    .limit(20000);
  return { delegates, checkins: cErr ? null : ((c ?? []) as CheckinRow[]) };
}

export default async function CoachDeskPage({ searchParams }: { searchParams: Promise<{ world?: string }> }) {
  const g = await requireTpDesk();
  if (!g.ok) {
    if (g.reason === "signed_out") {
      return (
        <main className="tp-main">
          <TopBar />
          <div className="tp-card" data-tp="denied">
            <h1 className="tp-h2">Sign in needed</h1>
            <p className="tp-mute" style={{ margin: 0 }}>The 1% coach desk is for the Take Pride team. Sign in with your Yi account.</p>
            <Link className="tp-btn" href="/login?redirectTo=/take-pride/desk/coach" data-tp="sign-in">Sign in</Link>
          </div>
        </main>
      );
    }
    return <Denied title="No access" text="The 1% coach desk is for the Take Pride team. Ask the national team to add you as a Take Pride admin." />;
  }

  const review = g.mode === "review";
  const sp = await searchParams;
  const sample = review || sp.world === "sample";

  let data: Awaited<ReturnType<typeof load>>;
  try {
    data = await load(sample);
  } catch {
    return <Denied title="Could not load the coach desk" text="The numbers did not load. Reload the page in a minute." />;
  }

  const withPledge = data.delegates.filter((d) => d.pledge?.trim());
  const themes = pledgeThemes(withPledge.map((d) => d.pledge));
  const checkins = data.checkins ?? [];
  const perStep = COACH_STEPS.map((s) => ({ step: s, sent: checkins.filter((c) => c.step === s).length }));
  const moods = COACH_MOODS.map((m) => ({ mood: m, count: checkins.filter((c) => c.mood === m).length }));
  const moodTotal = moods.reduce((a, m) => a + m.count, 0);
  const coached = new Set(checkins.map((c) => c.delegate_id)).size;
  const pct = (n: number, d: number) => (d ? Math.round((n / d) * 100) : 0);
  const MOOD_COLOR: Record<string, string> = { on_track: "var(--tp-green)", slipping: "#e07b1f", done: "#1f5a8a" };

  return (
    <main className="tp-main wide">
      <TopBar right={<Link className="tp-btn ghost sm" href="/take-pride/desk">Back to desk</Link>} />
      {review && <ReviewBanner />}
      <section className="tp-stack">
        <div className="tp-eyebrow">My 1% coach</div>
        <h1 className="tp-h1">Is the 1% Shift sticking?</h1>
        <p className="tp-lede">
          Delegates check in on their pledge 7, 30, 60 and 90 days after Take Pride. Counts only: no names and no
          pledge text are shown here.
        </p>
        {!review && (
          <p className="tp-small" style={{ margin: 0 }}>
            {sample ? (
              <>Showing sample (demo) delegates. <Link href="/take-pride/desk/coach" data-tp="world-real">Show real delegates</Link></>
            ) : (
              <>Showing real delegates. <Link href="/take-pride/desk/coach?world=sample" data-tp="world-sample">Show sample data</Link></>
            )}
          </p>
        )}
        {review && <p className="tp-sample">Review mode shows sample delegates only.</p>}
      </section>

      <section className="tp-grid2" data-tp="coach-kpis">
        <div className="tp-kpi"><b className="tp-num" data-tp="kpi-pledges">{withPledge.length}/{data.delegates.length}</b><span>delegates with a pledge</span></div>
        <div className="tp-kpi"><b className="tp-num" data-tp="kpi-coached">{data.checkins ? coached : "–"}</b><span>delegates who checked in</span></div>
      </section>

      {data.checkins === null && (
        <p className="tp-alert warn" style={{ margin: 0 }} data-tp="coach-desk-no-checkins">
          Check-ins could not be read yet. The pledge counts above are live.
        </p>
      )}

      <section className="tp-card" aria-labelledby="tp-steps" data-tp="coach-per-step">
        <h2 className="tp-h3" id="tp-steps">Check-ins sent per step</h2>
        <div className="tp-bars">
          {perStep.map((s) => (
            <div key={s.step} className="tp-bar">
              <span>Day {s.step} · due {dueLabel(s.step)}</span>
              <b>{s.sent}</b>
              <span className="track"><i style={{ width: `${pct(s.sent, withPledge.length)}%`, background: "var(--tp-ink)" }} /></span>
            </div>
          ))}
        </div>
        <p className="tp-small" style={{ margin: 0 }}>Bars are out of the delegates with a pledge.</p>
      </section>

      <section className="tp-card" aria-labelledby="tp-moods" data-tp="coach-moods">
        <h2 className="tp-h3" id="tp-moods">How it is going</h2>
        {moodTotal === 0 ? (
          <p className="tp-mute" style={{ margin: 0 }}>No check-ins yet.</p>
        ) : (
          <div className="tp-bars">
            {moods.map((m) => (
              <div key={m.mood} className="tp-bar">
                <span>{MOOD_LABEL[m.mood]}</span>
                <b>{m.count}</b>
                <span className="track"><i style={{ width: `${pct(m.count, moodTotal)}%`, background: MOOD_COLOR[m.mood] }} /></span>
              </div>
            ))}
          </div>
        )}
      </section>

      <section className="tp-card" aria-labelledby="tp-themes" data-tp="coach-themes">
        <h2 className="tp-h3" id="tp-themes">Pledge themes</h2>
        {themes.total === 0 ? (
          <p className="tp-mute" style={{ margin: 0 }}>No pledges yet.</p>
        ) : (
          <>
            <div className="tp-bars">
              {themes.themes.map((t) => (
                <div key={t.key} className="tp-bar">
                  <span>{t.label}</span>
                  <b>{t.count}</b>
                  <span className="track"><i style={{ width: `${pct(t.count, themes.total)}%`, background: "var(--tp-green)" }} /></span>
                </div>
              ))}
              {themes.other > 0 && (
                <div className="tp-bar">
                  <span>Other</span>
                  <b>{themes.other}</b>
                  <span className="track"><i style={{ width: `${pct(themes.other, themes.total)}%`, background: "#8f9196" }} /></span>
                </div>
              )}
            </div>
            <p className="tp-small" style={{ margin: 0 }}>A pledge can fall under more than one theme.</p>
          </>
        )}
      </section>
    </main>
  );
}
