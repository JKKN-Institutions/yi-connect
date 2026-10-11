import Link from "next/link";
import type { Metadata } from "next";
import { Denied, TopBar } from "../../_ui";
import { requireTpDesk } from "@/lib/take-pride/auth";
import { TP_PARTNER_STATUS_LABEL, inr } from "@/lib/take-pride/constants";
import { tpService } from "@/lib/take-pride/supabase";
import { audienceFor, isChaseable, CHASE_AFTER_HOURS } from "@/lib/take-pride/ai-partners/grounding";
import { latestChasers } from "@/lib/take-pride/ai-partners/queue";
import { waLink, type SalesChaserOutput } from "@/lib/take-pride/ai-partners/schemas";
import { NotInReview, ReviewBanner } from "../../review/_banner";
import { AutoRefresh } from "../../pass/[token]/plan/_client";
import { MessageDraft } from "../../catalyst/p/[token]/ai-client";
import { DraftChaserButton } from "./sales-client";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Sales follow-ups" };

/*
 * Catalyst sales follow-ups: applicants who signed up (or sent a payment
 * reference) more than 48 hours ago and are still not confirmed. A real
 * organiser sees REAL applicants; review mode sees SAMPLE applicants only.
 * "Draft chaser" queues a sales_chaser job; the out-of-band routine writes
 * it from the applicant's own sign-up and AGGREGATE audience counts, never
 * a delegate's name.
 */

type Applicant = {
  id: string;
  token: string;
  member_name: string;
  phone: string;
  chapter: string;
  business_name: string;
  industry: string;
  offers: string[] | null;
  wants_industries: string[] | null;
  tier: string;
  amount_due_inr: number;
  status: string;
  created_at: string;
  payment_submitted_at: string | null;
  cancelled_at: string | null;
  is_sample: boolean;
};

const daysAgo = (iso: string) => Math.max(0, Math.floor((Date.now() - new Date(iso).getTime()) / 86_400_000));

export default async function SalesPage() {
  const g = await requireTpDesk();
  if (!g.ok) {
    if (g.reason === "signed_out") {
      return (
        <main className="tp-main">
          <TopBar />
          <div className="tp-card" data-tp="signin-needed">
            <h1 className="tp-h2">Sign in needed</h1>
            <p className="tp-mute" style={{ margin: 0 }}>Sales follow-ups are for the Take Pride team. Sign in with your Yi account.</p>
            <Link className="tp-btn" href="/login?redirectTo=/take-pride/desk/sales">Sign in</Link>
          </div>
        </main>
      );
    }
    return <Denied title="No access" text="Sales follow-ups are for the Take Pride team. Ask the national team to add you as a Take Pride admin." />;
  }

  const review = g.mode === "review";
  const db = tpService();
  const [pRes, dRes] = await Promise.all([
    db
      .from("tp_partners")
      .select(
        "id, token, member_name, phone, chapter, business_name, industry, offers, wants_industries, tier, amount_due_inr, status, created_at, payment_submitted_at, cancelled_at, is_sample"
      )
      .eq("is_sample", review)
      .in("status", ["applied", "payment_submitted"])
      .is("cancelled_at", null)
      .order("created_at")
      .limit(500),
    db
      .from("tp_delegates")
      .select("needs, zone, industry, chapter, role_title, partner_meetings_opt_in, directory_visible, is_sample")
      .eq("is_sample", review)
      .limit(5000),
  ]);
  if (pRes.error || dRes.error) {
    return <Denied title="Could not load" text="The applicant list could not be read. Refresh the page in a minute." />;
  }
  const all = (pRes.data ?? []) as Applicant[];
  // Belt and braces: review mode must never carry a real applicant.
  const applicants = all.filter((p) => p.is_sample === review && isChaseable(p));
  const delegates = (dRes.data ?? []) as Parameters<typeof audienceFor>[1];
  const chasers = await latestChasers(applicants.map((p) => p.id));
  const waitingSince =
    chasers &&
    [...chasers.values()]
      .filter((j) => j.status === "pending" || j.status === "generating")
      .map((j) => j.created_at)
      .sort()
      .pop();

  return (
    <main className="tp-main wide">
      <TopBar right={<Link className="tp-btn ghost sm" href="/take-pride/desk">Desk</Link>} />
      {review && <ReviewBanner />}
      <section className="tp-stack">
        <div className="tp-eyebrow">Organiser desk</div>
        <h1 className="tp-h1">Sales follow-ups</h1>
        <p className="tp-mute" style={{ margin: 0 }}>
          Catalyst sign-ups still not confirmed {CHASE_AFTER_HOURS} hours after they signed up or sent a payment reference. Draft a
          personal follow-up, check it, then send it from your own WhatsApp.
        </p>
      </section>

      {waitingSince && <AutoRefresh key={waitingSince} since={waitingSince} label="Chasers are being written, usually within a few minutes." />}

      {chasers === null && (
        <p className="tp-alert warn" style={{ margin: 0 }} data-tp="ai-off">
          AI drafting is not switched on yet. The list below is still correct.
        </p>
      )}

      <section className="tp-card">
        <div className="tp-row">
          <h2 className="tp-h2">{applicants.length} to follow up</h2>
          {review && <span className="tp-tag saffron">Sample applicants</span>}
        </div>
        {applicants.length === 0 && (
          <p className="tp-mute" style={{ margin: 0 }} data-tp="sales-empty">
            Nobody to chase right now. Every sign-up older than {CHASE_AFTER_HOURS} hours has paid and been confirmed, or was cancelled.
          </p>
        )}
        <div className="tp-list">
          {applicants.map((p) => {
            const { audience } = audienceFor(p, delegates);
            const job = chasers?.get(p.id);
            const waiting = job && (job.status === "pending" || job.status === "generating");
            const ready = job?.status === "ready" && job.output ? (job.output as SalesChaserOutput).message : null;
            const since = p.status === "payment_submitted" ? p.payment_submitted_at ?? p.created_at : p.created_at;
            return (
              <div key={p.id} className="tp-stack" style={{ gap: 6 }} data-tp="sales-applicant">
                <div className="tp-row">
                  <b>{p.business_name}</b>
                  <span className="tp-tag saffron">{TP_PARTNER_STATUS_LABEL[p.status]}</span>
                </div>
                <span className="tp-small">
                  {p.member_name} · {p.chapter} · {p.phone}
                </span>
                <span className="tp-small tp-num">
                  {inr(p.amount_due_inr)} incl. GST · {p.tier === "member" ? "Yi member price" : "standard price"} · waiting {daysAgo(since)} days
                </span>
                <span className="tp-small" data-tp="sales-audience">
                  {audience.matching_delegates} of {audience.total_delegates} {review ? "sample " : ""}delegates need what they offer
                  {audience.by_offer.length ? ` (most asked: ${audience.by_offer.slice(0, 2).map((x) => x.tag.toLowerCase()).join(", ")})` : ""}
                </span>
                {chasers !== null && (
                  <>
                    {waiting && (
                      <p className="tp-small" style={{ margin: 0 }} data-tp="chaser-waiting">
                        Chaser being written.
                      </p>
                    )}
                    {job?.status === "failed" && (
                      <p className="tp-small" style={{ margin: 0 }} data-tp="chaser-failed">
                        The last chaser could not be written. Try again.
                      </p>
                    )}
                    {ready && <MessageDraft message={ready} href={waLink(ready, p.phone)} label={`WhatsApp ${p.member_name.split(" ")[0]}`} />}
                    {!waiting && <DraftChaserButton partnerId={p.id} label={ready ? "Draft a new chaser" : "Draft chaser"} />}
                  </>
                )}
                <Link className="tp-small" href={`/take-pride/catalyst/p/${p.token}`}>Open their page</Link>
              </div>
            );
          })}
        </div>
      </section>

      {review && <NotInReview what="Real applicants" />}
    </main>
  );
}
