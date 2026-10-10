import Link from "next/link";
import type { Metadata } from "next";
import { Denied, TopBar } from "../../_ui";
import { requireTpDesk } from "@/lib/take-pride/auth";
import { NotInReview, ReviewBanner } from "../../review/_banner";
import { getAwardsDesk } from "@/lib/take-pride/recognitions-bridge";
import { AwardsDeskClient } from "./awards-client";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Awards Night desk" };

export default async function AwardsDeskPage() {
  const g = await requireTpDesk();
  if (!g.ok) {
    if (g.reason === "signed_out") {
      return (
        <main className="tp-main">
          <TopBar />
          <div className="tp-card">
            <h1 className="tp-h2">Sign in needed</h1>
            <p className="tp-mute" style={{ margin: 0 }}>The Awards Night desk is for the Take Pride team. Sign in with your Yi account.</p>
            <Link className="tp-btn" href="/login?redirectTo=/take-pride/desk/awards">Sign in</Link>
          </div>
        </main>
      );
    }
    return <Denied title="No access" text="The Awards Night desk is for the Take Pride team. Ask the national team to add you as a Take Pride admin." />;
  }

  // Review mode (outside reviewers): no Awards Night data or actions. The desk
  // shows real Recognitions approval state, and reveals (even rehearsals)
  // land on the public hall screen.
  if (g.mode === "review") {
    return (
      <main className="tp-main wide">
        <TopBar right={<Link className="tp-btn sm ghost" href="/take-pride/desk">Organiser desk</Link>} />
        <ReviewBanner />
        <section className="tp-stack">
          <div className="tp-eyebrow">Awards Night</div>
          <h1 className="tp-h1">Reveal the winners</h1>
          <p className="tp-lede">
            On the night, the Take Pride team reveals each approved winner from here, and it appears on the hall screen.
          </p>
        </section>
        <div className="tp-card">
          <NotInReview what="Awards Night" />
          <p className="tp-small" style={{ margin: 0 }}>
            It works with the real award results, and anything revealed here shows on the public hall screen, so it is closed in review mode.
          </p>
        </div>
      </main>
    );
  }

  const desk = await getAwardsDesk();

  return (
    <main className="tp-main wide">
      <TopBar right={<Link className="tp-btn sm ghost" href="/take-pride/desk">Organiser desk</Link>} />
      <section className="tp-stack">
        <div className="tp-eyebrow">Awards Night</div>
        <h1 className="tp-h1">Reveal the winners</h1>
        <p className="tp-lede">
          Each reveal goes straight to the hall screen at{" "}
          <Link href="/take-pride/awards" target="_blank">/take-pride/awards</Link>. A winner can be revealed only after
          National Leadership approves that award in Recognitions.
        </p>
      </section>

      {desk.cycleName === null ? (
        <div className="tp-card">
          <h2 className="tp-h2">No awards cycle</h2>
          <p className="tp-mute" style={{ margin: 0 }}>Recognitions has no current cycle, so there is nothing to reveal.</p>
        </div>
      ) : (
        <AwardsDeskClient cycleName={desk.cycleName} cells={desk.cells} rehearsalCount={desk.rehearsalCount} />
      )}
    </main>
  );
}
