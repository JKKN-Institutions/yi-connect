import type { Metadata } from "next";
import Link from "next/link";
import { TopBar, SampleNote, Denied } from "../../../_ui";
import { getConnectMe, myFullBadge } from "@/lib/take-pride/connections";
import { BadgeQr } from "../_client";
import { ConnectScanner } from "./_client";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Scan to connect" };

export default async function ConnectPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const me = await getConnectMe(token);
  if (!me) {
    return <Denied title="Pass not found" text="This pass link is not valid. Ask the Take Pride desk for your link." />;
  }
  const full = myFullBadge(me);

  return (
    <main className="tp-main">
      <TopBar right={<Link href={`/take-pride/pass/${token}`} className="tp-btn ghost sm">My pass</Link>} />
      {me.is_sample && <SampleNote>This is a sample delegate for the demo.</SampleNote>}

      <header className="tp-stack" style={{ gap: 6 }}>
        <p className="tp-eyebrow" style={{ margin: 0 }}>Scan to connect</p>
        <h1 className="tp-h2">Swap badges, not cards</h1>
        <p className="tp-mute" style={{ margin: 0 }}>
          When you meet someone, one of you scans the other&rsquo;s badge. You both appear in each other&rsquo;s{" "}
          <Link href={`/take-pride/pass/${token}/people-saved`}>My people</Link>. Phone and email are swapped only if
          you both choose to share them.
        </p>
      </header>

      <section className="tp-card ok tp-ticket" aria-labelledby="tp-mine" data-tp="my-qr">
        <h2 className="tp-h2" id="tp-mine">Let others scan this</h2>
        <BadgeQr code={me.badge_code} full={full} size={240} nav={false} />
        <p className="tp-small" style={{ margin: 0 }}>{me.full_name} · {me.chapter}</p>
      </section>

      <section className="tp-card hi" aria-labelledby="tp-scan">
        <h2 className="tp-h2" id="tp-scan">Scan someone&rsquo;s badge</h2>
        <ConnectScanner token={token} />
      </section>
    </main>
  );
}
