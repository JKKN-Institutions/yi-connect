import type { Metadata } from "next";
import Link from "next/link";
import { TopBar, SampleNote, Denied } from "../../../_ui";
import { getConnectMe, getMyPeople, iHaveContact } from "@/lib/take-pride/connections";
import { listCardContacts } from "@/lib/take-pride/cards/queue";
import { PeopleList, ShareToggle } from "./_client";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "My people" };

export default async function MyPeoplePage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const me = await getConnectMe(token);
  if (!me) {
    return <Denied title="Pass not found" text="This pass link is not valid. Ask the Take Pride desk for your link." />;
  }
  const [people, hasContact, cards] = await Promise.all([getMyPeople(me), iHaveContact(me.id), listCardContacts(me.id, 5)]);
  const saveable = people.filter((p) => p.they_share === true).length;

  return (
    <main className="tp-main">
      <TopBar right={<Link href={`/take-pride/pass/${token}`} className="tp-btn ghost sm">My pass</Link>} />
      {me.is_sample && <SampleNote>This is a sample delegate for the demo.</SampleNote>}

      <header className="tp-stack" style={{ gap: 6 }}>
        <p className="tp-eyebrow" style={{ margin: 0 }}>Take Pride 2026</p>
        <h1 className="tp-h2">My people</h1>
        <p className="tp-mute" style={{ margin: 0 }}>
          Everyone you connected with by scanning badges, and delegates whose meeting is on. Your notes and follow-up
          dates are private: only you see them.
        </p>
        <div className="tp-row" style={{ justifyContent: "flex-start" }}>
          <Link href={`/take-pride/pass/${token}/connect`} className="tp-btn green sm" data-tp="go-connect" style={{ color: "#fff" }}>
            Scan to connect
          </Link>
        </div>
      </header>

      <section className="tp-card" aria-labelledby="tp-share">
        <h2 className="tp-h2" id="tp-share">Swap contact details</h2>
        <ShareToggle token={token} share={me.share_contact} hasContact={hasContact} />
      </section>

      <section className="tp-card hi" aria-labelledby="tp-people" data-tp="people">
        <div className="tp-row">
          <h2 className="tp-h2" id="tp-people">People</h2>
          <span className="tp-small tp-num" data-tp="people-count">{people.length} saved</span>
        </div>
        {people.length === 0 ? (
          <p className="tp-mute" style={{ margin: 0 }}>
            No one yet. Meet someone and{" "}
            <Link href={`/take-pride/pass/${token}/connect`}>scan their badge</Link>.
          </p>
        ) : (
          <PeopleList token={token} people={people} iShare={me.share_contact} />
        )}
      </section>

      <section className="tp-card" aria-labelledby="tp-cards" data-tp="cards-scanned">
        <div className="tp-row">
          <h2 className="tp-h2" id="tp-cards">Cards I scanned</h2>
          <Link href={`/take-pride/pass/${token}/cards`} className="tp-btn ghost sm" data-tp="go-cards">
            {cards.length ? "See all" : "Scan a card"}
          </Link>
        </div>
        {cards.length === 0 ? (
          <p className="tp-small" style={{ margin: 0 }}>
            Got a business card? Take a photo of it and the name, company, phone and email are saved here, only for you.
          </p>
        ) : (
          <div className="tp-list">
            {cards.map((c) => (
              <div key={c.id} data-tp="card-contact-row">
                <b>{c.full_name || c.company || "Business card"}</b>
                {c.full_name && c.company && <span className="tp-small"> · {c.company}</span>}
                {c.phone && (
                  <div>
                    <a href={`tel:${c.phone.replace(/[^\d+]/g, "")}`} className="tp-num tp-small">{c.phone}</a>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </section>

      <section className="tp-card" aria-labelledby="tp-save">
        <h2 className="tp-h2" id="tp-save">Save to my phone</h2>
        {saveable > 0 ? (
          <>
            <p className="tp-small" style={{ margin: 0 }}>
              Adds the {saveable} {saveable === 1 ? "person" : "people"} who swapped details with you to your phone&rsquo;s
              contacts, with your notes.
            </p>
            <a href={`/take-pride/pass/${token}/contacts.vcf`} className="tp-btn saffron block" data-tp="save-vcf" style={{ color: "#fff" }} download>
              Save all to phone
            </a>
          </>
        ) : (
          <p className="tp-small" style={{ margin: 0 }} data-tp="vcf-none">
            {me.share_contact
              ? "Nobody in your list shares contact details yet. When they do, you can save them here."
              : "Turn on sharing above. People who share too can then be saved to your phone in one tap."}
          </p>
        )}
      </section>
    </main>
  );
}
