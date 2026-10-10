import Link from "next/link";
import type { Metadata } from "next";
import { Denied, TopBar } from "../../_ui";
import { requireTpOrganiser } from "@/lib/take-pride/auth";
import { tpService } from "@/lib/take-pride/supabase";
import { listAllDelegates } from "./_core";
import { DelegateList, ImportPanel, RemoveSamples } from "./delegates-client";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Delegates" };

export default async function DelegatesPage() {
  const g = await requireTpOrganiser();
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

  let delegates: Awaited<ReturnType<typeof listAllDelegates>>;
  try {
    delegates = await listAllDelegates(tpService());
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
      <section className="tp-stack">
        <div className="tp-eyebrow">Organiser desk</div>
        <h1 className="tp-h1">Delegates</h1>
      </section>

      <section className="tp-grid2">
        <div className="tp-kpi"><b className="tp-num">{delegates.length}</b><span>delegates in total</span></div>
        <div className="tp-kpi"><b className="tp-num">{real}</b><span>real, from myCII</span></div>
        <div className="tp-kpi"><b className="tp-num">{sample}</b><span>sample (demo) delegates</span></div>
        <div className="tp-kpi"><b className="tp-num">{checkedIn}</b><span>checked in at the gate</span></div>
      </section>

      <DelegateList delegates={delegates} />

      <section className="tp-card">
        <h2 className="tp-h2">Import from myCII</h2>
        <p className="tp-small" style={{ margin: 0 }}>
          Download the registration list from myCII as a CSV file, then choose it here or paste its text. You will see a preview before anything is saved.
          Each imported delegate gets a new badge code and pass link. They start with partner meetings OFF and choose for themselves on their pass.
        </p>
        <ImportPanel />
      </section>

      {sample > 0 && (
        <section className="tp-card">
          <h2 className="tp-h2">Remove sample delegates</h2>
          <p className="tp-small" style={{ margin: 0 }}>
            Do this once the real list is in. It removes the {sampleRemovable} sample delegates nobody has checked in, with their sample meetings and leads.
            Real delegates are never touched.
          </p>
          <RemoveSamples count={sampleRemovable} />
        </section>
      )}
    </main>
  );
}
