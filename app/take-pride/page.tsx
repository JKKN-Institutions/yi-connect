import Link from "next/link";
import { TopBar, ShiftMark } from "./_ui";
import { TP_EVENT, inr, withGst } from "@/lib/take-pride/constants";
import { getAudienceStats, getSettings } from "@/lib/take-pride/data";
import { seatsTakenActive } from "@/lib/take-pride/catalyst";

export const dynamic = "force-dynamic";

export default async function TakePrideHome() {
  const [s, stats, taken] = await Promise.all([getSettings(), getAudienceStats(), seatsTakenActive()]);
  const left = Math.max(0, s.catalyst_seats - taken);
  return (
    <main className="tp-main">
      <TopBar right={<Link className="tp-small" href="/take-pride/desk">Organiser desk</Link>} />

      <section className="tp-stack" style={{ paddingTop: 12 }}>
        <div className="tp-eyebrow">Young Indians · CII · {TP_EVENT.dates} · {TP_EVENT.city}</div>
        <h1 className="tp-h1">Take Pride 2026</h1>
        <div className="tp-row" style={{ justifyContent: "flex-start" }}>
          <ShiftMark />
          <span style={{ font: "400 26px/1 var(--tp-display)", letterSpacing: ".03em" }}>
            {TP_EVENT.theme} · <span className="tp-mute">{TP_EVENT.tagline}</span>
          </span>
        </div>
        <p className="tp-lede">
          {TP_EVENT.delegatesExpected} delegates from {TP_EVENT.chapters} chapters, two days, one stage. This app is your
          ticket, your agenda and your way to meet the right people.
        </p>
      </section>

      <section className="tp-card hi">
        <div className="tp-row">
          <span className="tp-eyebrow">For business owners</span>
          <span className="tp-tag saffron">{left} of {s.catalyst_seats} seats left</span>
        </div>
        <h2 className="tp-h2">Become a Catalyst Partner</h2>
        <p style={{ margin: 0 }}>
          Meet the delegates who need what you sell. The app finds them, books the meetings and scans every lead.
          Yi members pay {inr(s.member_fee_inr)} + GST ({inr(withGst(s.member_fee_inr, s.gst_pct))}). Non-members pay{" "}
          {inr(s.standard_fee_inr)} + GST ({inr(withGst(s.standard_fee_inr, s.gst_pct))}).
        </p>
        <p className="tp-small" style={{ margin: 0 }}>
          {stats.total} delegates on the list so far{stats.isSample ? " (sample list for this demo)" : ""}.
        </p>
        <Link href="/take-pride/catalyst" className="tp-btn saffron block">
          See who is coming and join
        </Link>
      </section>

      <section className="tp-card">
        <span className="tp-eyebrow">For delegates</span>
        <h2 className="tp-h2">Your Take Pride pass</h2>
        <p className="tp-mute" style={{ margin: 0 }}>
          Every registered delegate gets a personal link to their pass: the QR you show at the gate, the agenda, and
          meeting requests from Catalyst Partners, which you accept or decline.
        </p>
      </section>
    </main>
  );
}
