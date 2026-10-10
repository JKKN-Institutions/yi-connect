import type { Metadata } from "next";
import Link from "next/link";
import { TopBar, SampleNote, Denied } from "../../../_ui";
import { TP_TAGS } from "@/lib/take-pride/constants";
import { getDelegateMeByToken } from "@/lib/take-pride/delegate-match";
import { ProfileForm } from "./_client";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "My profile" };

export default async function ProfilePage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const me = await getDelegateMeByToken(token);
  if (!me) {
    return <Denied title="Pass not found" text="This pass link is not valid. Ask the Take Pride desk for your link." />;
  }
  return (
    <main className="tp-main">
      <TopBar right={<Link href={`/take-pride/pass/${token}`} className="tp-btn ghost sm">My pass</Link>} />
      {me.is_sample && <SampleNote>This is a sample delegate for the demo.</SampleNote>}
      <header className="tp-stack" style={{ gap: 6 }}>
        <p className="tp-eyebrow" style={{ margin: 0 }}>{me.full_name}</p>
        <h1 className="tp-h2">My profile</h1>
        <p className="tp-mute" style={{ margin: 0 }}>
          What you need and offer decides who we suggest you meet. Delegates from your own zone come first.
        </p>
      </header>
      <ProfileForm
        token={token}
        tags={TP_TAGS}
        initial={{
          // Keep only tags still on the list, so an old value never blocks saving.
          needs: me.needs.filter((t) => (TP_TAGS as readonly string[]).includes(t)),
          offers: me.offers.filter((t) => (TP_TAGS as readonly string[]).includes(t)),
          partner: me.partner_meetings_opt_in,
          delegate: me.delegate_meetings_opt_in,
        }}
      />
      <Link href={`/take-pride/pass/${token}/meet`} className="tp-btn ghost block">
        See people to meet
      </Link>
    </main>
  );
}
