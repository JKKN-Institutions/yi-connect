"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { applyCatalyst } from "../actions";
import { TP_INDUSTRIES, TP_TAGS, TP_ZONES } from "@/lib/take-pride/constants";

function Pick({ options, value, onChange, max, label }: { options: readonly string[]; value: string[]; onChange: (v: string[]) => void; max: number; label: string }) {
  return (
    <div className="tp-pick" role="group" aria-label={label}>
      {options.map((o) => {
        const on = value.includes(o);
        return (
          <button
            key={o}
            type="button"
            aria-pressed={on}
            onClick={() => onChange(on ? value.filter((x) => x !== o) : value.length >= max ? value : [...value, o])}
          >
            {o}
          </button>
        );
      })}
    </div>
  );
}

export function CatalystForm() {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [offers, setOffers] = useState<string[]>([]);
  const [wants, setWants] = useState<string[]>([]);

  function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    setError(null);
    start(async () => {
      const r = await applyCatalyst({
        member_name: f.get("member_name"),
        email: f.get("email"),
        phone: f.get("phone"),
        chapter: f.get("chapter"),
        zone: f.get("zone"),
        business_name: f.get("business_name"),
        industry: f.get("industry"),
        offers,
        wants_industries: wants,
        pitch: f.get("pitch") ?? "",
      });
      if (!r.success) {
        setError(r.error);
        return;
      }
      router.push(`/take-pride/catalyst/p/${r.data.token}?new=1`);
    });
  }

  return (
    <form onSubmit={submit} className="tp-stack" noValidate>
      <p className="tp-small" style={{ margin: 0 }} data-tp="member-hint">
        Yi member? Use the email or mobile number Yi has for you. That is how we find you in the member list and give you the member price.
      </p>
      <div className="tp-field"><label htmlFor="member_name">Your name</label><input className="tp-input" id="member_name" name="member_name" autoComplete="name" required /></div>
      <div className="tp-field"><label htmlFor="email">Email</label><input className="tp-input" id="email" name="email" type="email" autoComplete="email" required /></div>
      <div className="tp-field"><label htmlFor="phone">Mobile (WhatsApp)</label><input className="tp-input" id="phone" name="phone" type="tel" inputMode="tel" autoComplete="tel" required /></div>
      <div className="tp-field"><label htmlFor="chapter">Your Yi chapter (or your city, if you are not a member)</label><input className="tp-input" id="chapter" name="chapter" placeholder="e.g. Yi Erode" required /></div>
      <div className="tp-field"><label htmlFor="zone">Zone</label>
        <select className="tp-select" id="zone" name="zone" defaultValue="South">{TP_ZONES.map((z) => <option key={z}>{z}</option>)}</select></div>
      <div className="tp-field"><label htmlFor="business_name">Business name</label><input className="tp-input" id="business_name" name="business_name" autoComplete="organization" required /></div>
      <div className="tp-field"><label htmlFor="industry">Your industry</label>
        <select className="tp-select" id="industry" name="industry" defaultValue="">
          <option value="" disabled>Choose one</option>
          {TP_INDUSTRIES.map((i) => <option key={i}>{i}</option>)}
        </select></div>
      <div className="tp-field"><span className="tp-legend">What do you offer? <span className="tp-small">Pick up to 5. We match these to what delegates need.</span></span>
        <Pick options={TP_TAGS} value={offers} onChange={setOffers} max={5} label="What you offer" /></div>
      <div className="tp-field"><span className="tp-legend">Industries you want to reach <span className="tp-small">Optional, up to 6</span></span>
        <Pick options={TP_INDUSTRIES} value={wants} onChange={setWants} max={6} label="Industries you want to reach" /></div>
      <div className="tp-field"><label htmlFor="pitch">One line delegates will see</label>
        <textarea className="tp-textarea" id="pitch" name="pitch" maxLength={280} placeholder="e.g. We supply custom corporate gift hampers, 500 to 5,000 units, in 10 days." /></div>
      {error && <p className="tp-alert bad" role="alert">{error}</p>}
      <button className="tp-btn saffron block" disabled={pending}>{pending ? "Saving…" : "Continue to payment"}</button>
    </form>
  );
}
