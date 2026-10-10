import type { Metadata } from "next";
import Link from "next/link";
import { TopBar, SampleNote, Denied } from "../../../_ui";
import { TP_TAGS } from "@/lib/take-pride/constants";
import { getDelegateProfileByToken } from "@/lib/take-pride/directory";
import { PROFILE_CHAPTER_MAX, YI_VERTICALS, onList } from "@/lib/take-pride/profile";
import { ProfileForm } from "./_client";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "My profile" };

export default async function ProfilePage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const me = await getDelegateProfileByToken(token);
  if (!me) {
    return <Denied title="Pass not found" text="This pass link is not valid. Ask the Take Pride desk for your link." />;
  }
  const vertical = onList(me.yi_vertical ? [me.yi_vertical] : [], YI_VERTICALS)[0] ?? "";
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
          // Keep only values still on the lists, so an old value never blocks saving.
          needs: onList(me.needs, TP_TAGS),
          offers: onList(me.offers, TP_TAGS),
          partner: me.partner_meetings_opt_in,
          delegate: me.delegate_meetings_opt_in,
          workingOn: me.working_on ?? "",
          askMeAbout: me.ask_me_about ?? "",
          pledge: me.pledge ?? "",
          vertical,
          strengths: onList(me.chapter_strengths, YI_VERTICALS).slice(0, PROFILE_CHAPTER_MAX),
          wants: onList(me.chapter_wants, YI_VERTICALS).slice(0, PROFILE_CHAPTER_MAX),
          directory: me.directory_visible,
        }}
      />
      <div className="tp-row" style={{ justifyContent: "flex-start" }}>
        <Link href={`/take-pride/pass/${token}/meet`} className="tp-btn ghost sm">
          See people to meet
        </Link>
        <Link href={`/take-pride/pass/${token}/people`} className="tp-btn ghost sm" data-tp="go-people">
          Delegate directory
        </Link>
      </div>
    </main>
  );
}
