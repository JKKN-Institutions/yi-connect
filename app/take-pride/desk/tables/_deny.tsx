import Link from "next/link";
import { Denied, TopBar } from "../../_ui";

/** Explicit deny for the topic tables desk. Never a redirect. */
export function TablesDeskDenied({ reason, back }: { reason: "signed_out" | "forbidden"; back: string }) {
  if (reason === "signed_out") {
    return (
      <main className="tp-main">
        <TopBar />
        <div className="tp-card" data-tp="denied">
          <h1 className="tp-h2">Sign in needed</h1>
          <p className="tp-mute" style={{ margin: 0 }}>
            The topic tables desk is for the Take Pride team. Sign in with your Yi account.
          </p>
          <Link className="tp-btn" href={`/login?redirectTo=${back}`} data-tp="sign-in">
            Sign in
          </Link>
        </div>
      </main>
    );
  }
  return (
    <Denied
      title="No access"
      text="The topic tables desk is for the Take Pride team. Ask the national team to add you as a Take Pride admin."
    />
  );
}
