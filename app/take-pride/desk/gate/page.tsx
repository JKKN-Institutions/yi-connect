import type { Metadata } from "next";
import Link from "next/link";
import { TopBar, Denied } from "../../_ui";
import { requireTpDesk } from "@/lib/take-pride/auth";
import { ReviewBanner } from "../../review/_banner";
import { GateScanner } from "./_scanner";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Gate check-in" };

export default async function GatePage() {
  const gate = await requireTpDesk();

  if (!gate.ok && gate.reason === "signed_out") {
    return (
      <main className="tp-main">
        <TopBar />
        <div className="tp-card">
          <h1 className="tp-h2">Sign in needed</h1>
          <p className="tp-mute" style={{ margin: 0 }}>
            The gate scanner is for Take Pride organisers. Sign in with your Yi account to open it.
          </p>
          <Link href="/login?redirectTo=/take-pride/desk/gate" className="tp-btn">
            Sign in
          </Link>
        </div>
      </main>
    );
  }
  if (!gate.ok) {
    return (
      <Denied
        title="No access"
        text="The gate scanner is for Take Pride organisers. Ask the national team to add you."
      />
    );
  }

  return (
    <main className="tp-main">
      <TopBar
        right={
          <Link href="/take-pride/desk" className="tp-btn ghost sm">
            ← Desk
          </Link>
        }
      />
      {gate.mode === "review" && <ReviewBanner />}
      <div className="tp-stack" style={{ gap: 4 }}>
        <p className="tp-eyebrow" style={{ margin: 0 }}>Organiser desk</p>
        <h1 className="tp-h1">Gate check-in</h1>
        {gate.mode === "review" && <p className="tp-small" style={{ margin: 0 }}>Review mode checks in sample badges only.</p>}
      </div>
      <GateScanner review={gate.mode === "review"} />
    </main>
  );
}
