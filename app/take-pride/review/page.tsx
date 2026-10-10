import Link from "next/link";
import type { Metadata } from "next";
import { TopBar } from "../_ui";
import { hasReviewSession } from "@/lib/take-pride/auth";
import { ReviewBanner } from "./_banner";
import { ReviewForm } from "./review-form";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Review the app" };

const LOGINS = [
  { name: "admin", what: "The organiser desk: payments, gate check-in, delegate list and Awards Night rehearsal. Sample data only." },
  { name: "delegate", what: "A sample delegate's pass: badge, agenda, meetings and profile." },
  { name: "catalyst", what: "A sample Catalyst Partner's page: matched delegates, meeting requests and lead scanning." },
];

export default async function ReviewPage() {
  const signedIn = await hasReviewSession();
  return (
    <main className="tp-main">
      <TopBar />
      {signedIn && <ReviewBanner />}
      <section className="tp-stack">
        <div className="tp-eyebrow">For reviewers</div>
        <h1 className="tp-h1">Review the Take Pride app</h1>
        <p className="tp-lede">Sign in with the review login you were given. Everything you see and change here is sample data.</p>
      </section>

      {signedIn ? (
        <div className="tp-card ok">
          <h2 className="tp-h2">You are signed in</h2>
          <p className="tp-mute" style={{ margin: 0 }}>Your review session for the organiser desk is open.</p>
          <Link className="tp-btn" href="/take-pride/desk">Open the organiser desk</Link>
        </div>
      ) : (
        <section className="tp-card">
          <ReviewForm />
        </section>
      )}

      <section className="tp-card">
        <h2 className="tp-h2">Three review logins</h2>
        <div className="tp-list">
          {LOGINS.map((l) => (
            <div key={l.name} className="tp-stack" style={{ gap: 4 }}>
              <b>{l.name}</b>
              <span className="tp-small">{l.what}</span>
            </div>
          ))}
        </div>
        <p className="tp-small" style={{ margin: 0 }}>Usernames are not case-sensitive. Ask the Take Pride team for the passwords.</p>
      </section>
    </main>
  );
}
