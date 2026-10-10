import Link from "next/link";
import type { Metadata } from "next";
import { TopBar, SampleNote } from "../_ui";
import { TP_EVENT, inr, withGst } from "@/lib/take-pride/constants";
import { getAudienceStats, getSettings } from "@/lib/take-pride/data";
import { seatsTakenActive } from "@/lib/take-pride/catalyst";
import { CatalystForm } from "./catalyst-form";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Become a Catalyst Partner" };

const BAR_COLOURS = ["#e9690f", "#0b6b34", "#1f5a8a", "#b3121c", "#4fb3dc", "#9cc93b"];

export default async function CatalystPage() {
  const [s, stats, taken] = await Promise.all([getSettings(), getAudienceStats(), seatsTakenActive()]);
  const left = Math.max(0, s.catalyst_seats - taken);
  const topNeeds = stats.byNeed.slice(0, 8);
  const max = Math.max(1, ...topNeeds.map((n) => n.count));
  return (
    <main className="tp-main">
      <TopBar right={<Link className="tp-small" href="/take-pride">Back</Link>} />

      <section className="tp-stack">
        <div className="tp-eyebrow">Catalyst Partner · Yi members get the best price</div>
        <h1 className="tp-h1">Power the 1% Shift. Meet your next customers.</h1>
        <p className="tp-lede">
          {TP_EVENT.dates}, {TP_EVENT.city}. A logo on a wall is nice. Meetings with delegates who need what you sell
          are better. This app delivers both.
        </p>
      </section>

      <section className="tp-grid2">
        <div className="tp-kpi" data-tp="price-member"><b className="tp-num">{inr(s.member_fee_inr)}</b><span>+ GST for Yi members</span></div>
        <div className="tp-kpi" data-tp="price-standard"><b className="tp-num">{inr(s.standard_fee_inr)}</b><span>+ GST for non-members</span></div>
        <div className="tp-kpi"><b className="tp-num">{left}</b><span>of {s.catalyst_seats} Catalyst seats left</span></div>
        <div className="tp-kpi"><b className="tp-num">{s.meeting_cap}</b><span>matched meetings you can book</span></div>
        <div className="tp-kpi"><b className="tp-num">{stats.total}</b><span>delegates on the list so far</span></div>
      </section>

      <section className="tp-card">
        <div className="tp-row">
          <h2 className="tp-h2">What delegates are looking for</h2>
        </div>
        {stats.isSample && <SampleNote />}
        <div className="tp-bars">
          {topNeeds.map((n, i) => (
            <div className="tp-bar" key={n.tag}>
              <span>{n.tag}</span>
              <b>{n.count}</b>
              <span className="track"><i style={{ width: `${(n.count / max) * 100}%`, background: BAR_COLOURS[i % BAR_COLOURS.length] }} /></span>
            </div>
          ))}
        </div>
        <p className="tp-small" style={{ margin: 0 }}>
          By zone: {stats.byZone.map((z) => `${z.zone} ${z.count}`).join(" · ")}
        </p>
      </section>

      <section className="tp-card">
        <h2 className="tp-h2">What you get</h2>
        <ul style={{ margin: 0, paddingLeft: 18, display: "grid", gap: 6 }}>
          <li><b>Matched delegates.</b> The app lists the delegates whose needs match what you offer, and why.</li>
          <li><b>Meeting requests.</b> Ask up to {s.meeting_cap} delegates to meet. They accept on their pass.</li>
          <li><b>Lead scanner.</b> Scan any delegate&rsquo;s badge to save them as a lead, with a note.</li>
          <li><b>Your results page.</b> Meetings accepted, leads scanned, who to follow up.</li>
          <li><b>From the deck:</b> logo on the Partner Wall and website, a 30-second brand video, delegate mailer feature, one all-access pass.</li>
          <li><b>Upgrade credit:</b> 100% of your fee counts toward a higher tier within 30 days.</li>
        </ul>
      </section>

      <section className="tp-card hi" id="join">
        <h2 className="tp-h2">Join as a Catalyst Partner</h2>
        <p className="tp-small" style={{ margin: 0 }}>
          Two minutes. We check your email or mobile against the Yi member list. Yi members pay{" "}
          {inr(withGst(s.member_fee_inr, s.gst_pct))} and everyone else pays {inr(withGst(s.standard_fee_inr, s.gst_pct))} (both
          incl. {s.gst_pct}% GST), by UPI or bank transfer. You enter the reference and the Take Pride team confirms it the
          same day. Your seat is held once the reference arrives.
        </p>
        <CatalystForm />
      </section>
    </main>
  );
}
