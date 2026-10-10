import Link from "next/link";
import type { Metadata } from "next";
import { Denied, TopBar } from "../../_ui";
import { requireTpDesk } from "@/lib/take-pride/auth";
import { NotInReview, ReviewBanner } from "../../review/_banner";
import { tpService } from "@/lib/take-pride/supabase";
import { listAllDelegates, type TpDeskDelegate } from "./_core";
import { DelegateList, ImportPanel, RemoveSamples, WalkInForm } from "./delegates-client";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Delegates" };

/** Review mode: the is_sample filter is in the query, so no real row is ever read. */
async function listSampleDelegates(): Promise<TpDeskDelegate[]> {
  const { data, error } = await tpService()
    .from("tp_delegates")
    .select("id, token, badge_code, full_name, chapter, zone, business_name, industry, role_title, partner_meetings_opt_in, checked_in_at, is_sample")
    .eq("is_sample", true)
    .order("full_name")
    .order("id")
    .limit(1000);
  if (error) throw new Error(error.message);
  return (data ?? []) as TpDeskDelegate[];
}

export default async function DelegatesPage() {
  const g = await requireTpDesk();
  if (!g.ok) {
    if (g.reason === "signed_out") {
      return (
        <main className="tp-main">
          <TopBar />
          <div className="tp-card">
            <h1 className="tp-h2">Sign in needed</h1>
            <p className="tp-mute" style={{ margin: 0 }}>The delegate list is for the Take Pride team. Sign in with your Yi account.</p>
            <Link className="tp-btn" href="/login?redirectTo=/take-pride/desk/delegates">Sign in</Link>
          </div>
        </main>
      );
    }
    return <Denied title="No access" text="The delegate list is for the Take Pride team. Ask the national team to add you as a Take Pride admin." />;
  }

  // Review mode (outside reviewers): sample delegates only, and no writes.
  const review = g.mode === "review";
  let delegates: TpDeskDelegate[];
  try {
    delegates = review ? await listSampleDelegates() : await listAllDelegates(tpService());
  } catch {
    return <Denied title="Could not load delegates" text="The delegate list did not load. Reload the page in a minute." />;
  }

  const sample = delegates.filter((d) => d.is_sample).length;
  const real = delegates.length - sample;
  const checkedIn = delegates.filter((d) => d.checked_in_at).length;
  const sampleRemovable = delegates.filter((d) => d.is_sample && !d.checked_in_at).length;

  return (
    <main className="tp-main wide">
      <TopBar right={<Link className="tp-btn ghost sm" href="/take-pride/desk">Back to desk</Link>} />
      {review && <ReviewBanner />}
      <section className="tp-stack">
        <div className="tp-eyebrow">Organiser desk</div>
        <h1 className="tp-h1">Delegates</h1>
      </section>

      <section className="tp-grid2">
        <div className="tp-kpi"><b className="tp-num">{delegates.length}</b><span>delegates in total</span></div>
        {!review && <div className="tp-kpi"><b className="tp-num">{real}</b><span>real, from myCII</span></div>}
        <div className="tp-kpi"><b className="tp-num">{sample}</b><span>sample (demo) delegates</span></div>
        <div className="tp-kpi"><b className="tp-num">{checkedIn}</b><span>checked in at the gate</span></div>
      </section>

      <section className="tp-card" data-testid="walkin-card">
        <h2 className="tp-h2">Add a walk-in</h2>
        <p className="tp-small" style={{ margin: 0 }}>
          For a delegate who is not on the myCII list and has paid. Check their payment proof first. They get a badge code and a pass link straight away.
          Someone already listed under the same name and chapter is shown instead of being added twice.
        </p>
        {review ? <NotInReview what="Adding a walk-in" /> : <WalkInForm />}
      </section>

      <DelegateList delegates={delegates} />

      <section className="tp-card">
        <h2 className="tp-h2">Import from myCII</h2>
        <p className="tp-small" style={{ margin: 0 }}>
          Download the registration list from myCII as a CSV file, then choose it here or paste its text. You will see a preview before anything is saved.
          Each imported delegate gets a new badge code and pass link. They start with partner meetings OFF and are listed in the delegate directory; they can change both on their pass.
        </p>
        {review ? <NotInReview what="Importing delegates" /> : <ImportPanel />}
      </section>

      {sample > 0 && (
        <section className="tp-card">
          <h2 className="tp-h2">Remove sample delegates</h2>
          <p className="tp-small" style={{ margin: 0 }}>
            Do this once the real list is in. It removes the {sampleRemovable} sample delegates nobody has checked in, with their sample meetings and leads.
            Real delegates are never touched.
          </p>
          {review ? <NotInReview what="Removing sample delegates" /> : <RemoveSamples count={sampleRemovable} />}
        </section>
      )}
    </main>
  );
}
