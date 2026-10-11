import type { Metadata } from "next";
import Link from "next/link";
import { TopBar, SampleNote, Denied } from "../../../_ui";
import { getConnectMe } from "@/lib/take-pride/connections";
import { listCardContacts, listOpenScans, scansUsedToday } from "@/lib/take-pride/cards/queue";
import { CARD_DAILY_LIMIT } from "@/lib/take-pride/cards/schemas";
import { AutoRefresh } from "../plan/_client";
import { ContactCard, ScanCard, type ContactView } from "./_client";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Business cards" };

function istTime(iso: string): string {
  return new Intl.DateTimeFormat("en-IN", {
    timeZone: "Asia/Kolkata",
    day: "numeric",
    month: "short",
    hour: "numeric",
    minute: "2-digit",
  }).format(new Date(iso));
}

export default async function CardsPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const me = await getConnectMe(token);
  if (!me) {
    return <Denied title="Pass not found" text="This pass link is not valid. Ask the Take Pride desk for your link." />;
  }

  const [scans, contacts, used] = await Promise.all([listOpenScans(me.id), listCardContacts(me.id), scansUsedToday(me.id)]);
  // Fail closed: when today's count cannot be read, scanning is closed.
  const left = used === null ? null : Math.max(0, CARD_DAILY_LIMIT - used);
  const waiting = scans.filter((s) => s.status === "pending" || s.status === "generating");
  const failed = scans.filter((s) => s.status === "failed");
  const newestWaiting = waiting.length ? waiting[0].created_at : null;
  const base = `/take-pride/pass/${token}`;
  const views: ContactView[] = contacts.map((c) => ({
    id: c.id,
    created_at: c.created_at,
    full_name: c.full_name,
    title: c.title,
    company: c.company,
    phone: c.phone,
    email: c.email,
    website: c.website,
    city: c.city,
    note: c.note,
  }));

  return (
    <main className="tp-main">
      <TopBar right={<Link href={base} className="tp-btn ghost sm">My pass</Link>} />
      {me.is_sample && <SampleNote>This is a sample delegate for the demo.</SampleNote>}

      <header className="tp-stack" style={{ gap: 6 }}>
        <p className="tp-eyebrow" style={{ margin: 0 }}>{me.full_name}</p>
        <h1 className="tp-h2">Business cards</h1>
        <p className="tp-mute" style={{ margin: 0 }}>
          Take a photo of a business card someone gives you. An AI helper reads the name, company, phone and email
          off it, and the photo is deleted as soon as it has been read. These contacts are private: only you see them.
        </p>
      </header>

      <section className="tp-card hi" aria-label="Scan a business card">
        <ScanCard
          token={token}
          left={left}
          off={
            me.is_sample
              ? "Scanning is turned off on this sample pass. The demo login is shared, so anyone using it would see the cards. Each real delegate scans on their own pass, where only they see them."
              : null
          }
        />
      </section>

      {newestWaiting && (
        <AutoRefresh key={newestWaiting} since={newestWaiting} label="Your cards are being read, about 1–2 minutes." />
      )}

      {(waiting.length > 0 || failed.length > 0) && (
        <section className="tp-card" aria-labelledby="tp-card-waiting" data-tp="card-scans">
          <h2 className="tp-h2" id="tp-card-waiting">Cards sent</h2>
          <div className="tp-list">
            {waiting.map((s) => (
              <div key={s.id} className="tp-row" data-tp="card-scan" data-status={s.status}>
                <span className="tp-small tp-num">Sent {istTime(s.created_at)}</span>
                <span className="tp-tag saffron">Being read, about 1–2 minutes</span>
              </div>
            ))}
            {failed.map((s) => (
              <div key={s.id} className="tp-row" data-tp="card-scan" data-status="failed">
                <span className="tp-small tp-num">Sent {istTime(s.created_at)}</span>
                <span className="tp-tag bad">Could not be read. Take a clearer photo.</span>
              </div>
            ))}
          </div>
        </section>
      )}

      <section className="tp-card" aria-labelledby="tp-card-contacts" data-tp="card-contacts">
        <div className="tp-row">
          <h2 className="tp-h2" id="tp-card-contacts">Cards I scanned</h2>
          <span className="tp-small tp-num" data-tp="card-count">{contacts.length} saved</span>
        </div>
        {views.length === 0 ? (
          <p className="tp-mute" style={{ margin: 0 }} data-tp="card-empty">
            No cards yet. When someone hands you a card, scan it above.
          </p>
        ) : (
          <div className="tp-list">
            {views.map((c) => (
              <ContactCard key={c.id} token={token} contact={c} />
            ))}
          </div>
        )}
      </section>

      <nav className="tp-row" style={{ justifyContent: "flex-start" }} aria-label="More">
        <Link href={`${base}/people-saved`} className="tp-btn ghost sm">My people</Link>
        <Link href={`${base}/connect`} className="tp-btn ghost sm">Scan a badge</Link>
      </nav>
    </main>
  );
}
