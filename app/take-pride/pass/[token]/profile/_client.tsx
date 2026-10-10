"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { saveDelegateProfile } from "./actions";

const MAX = 5;

function TagPicker({
  label,
  hint,
  tags,
  value,
  onChange,
  name,
}: {
  label: string;
  hint: string;
  tags: readonly string[];
  value: string[];
  onChange: React.Dispatch<React.SetStateAction<string[]>>;
  name: string;
}) {
  const full = value.length >= MAX;
  return (
    <fieldset className="tp-field" style={{ border: 0, padding: 0, margin: 0 }} data-tp={`pick-${name}`}>
      <legend className="tp-legend">{label}</legend>
      <p className="tp-small" style={{ margin: "0 0 4px" }}>
        {hint} <span className="tp-num">({value.length}/{MAX})</span>
      </p>
      <div className="tp-pick">
        {tags.map((t) => {
          const on = value.includes(t);
          return (
            <button
              key={t}
              type="button"
              aria-pressed={on}
              disabled={!on && full}
              data-tag={t}
              onClick={() =>
                onChange((v) => (v.includes(t) ? v.filter((x) => x !== t) : v.length >= MAX ? v : [...v, t]))
              }
            >
              {t}
            </button>
          );
        })}
      </div>
    </fieldset>
  );
}

function Choice({
  label,
  hint,
  on,
  onChange,
  name,
}: {
  label: string;
  hint: string;
  on: boolean;
  onChange: (v: boolean) => void;
  name: string;
}) {
  return (
    <div className="tp-row" style={{ alignItems: "flex-start", flexWrap: "nowrap" }}>
      <div style={{ minWidth: 0 }}>
        <div className="tp-h3">{label}</div>
        <p className="tp-small" style={{ margin: 0 }}>{hint}</p>
      </div>
      <button
        type="button"
        className={`tp-btn sm ${on ? "green" : "ghost"}`}
        aria-pressed={on}
        data-tp={`opt-${name}`}
        onClick={() => onChange(!on)}
        style={{ flex: "none", minWidth: 64 }}
      >
        {on ? "Yes" : "No"}
      </button>
    </div>
  );
}

export function ProfileForm({
  token,
  tags,
  initial,
}: {
  token: string;
  tags: readonly string[];
  initial: { needs: string[]; offers: string[]; partner: boolean; delegate: boolean };
}) {
  const router = useRouter();
  const [needs, setNeeds] = useState(initial.needs);
  const [offers, setOffers] = useState(initial.offers);
  const [partner, setPartner] = useState(initial.partner);
  const [delegate, setDelegate] = useState(initial.delegate);
  const [pending, start] = useTransition();
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);

  function save() {
    setMsg(null);
    start(async () => {
      const r = await saveDelegateProfile(token, {
        needs,
        offers,
        partner_meetings_opt_in: partner,
        delegate_meetings_opt_in: delegate,
      });
      if (r.success) {
        setMsg({ ok: true, text: "Saved. Your suggestions now use these choices." });
        router.refresh();
      } else {
        setMsg({ ok: false, text: r.error });
      }
    });
  }

  return (
    <div className="tp-stack" style={{ gap: 16 }}>
      <section className="tp-card">
        <TagPicker
          name="needs"
          label="What you need"
          hint="Pick up to 5 things you are looking for."
          tags={tags}
          value={needs}
          onChange={setNeeds}
        />
      </section>
      <section className="tp-card">
        <TagPicker
          name="offers"
          label="What you offer"
          hint="Pick up to 5 things your business can help others with."
          tags={tags}
          value={offers}
          onChange={setOffers}
        />
      </section>
      <section className="tp-card">
        <Choice
          name="delegate"
          label="Open to delegate meetings"
          hint="Other delegates can find you and ask to meet. They see your business and chapter only after you accept."
          on={delegate}
          onChange={setDelegate}
        />
        <Choice
          name="partner"
          label="Open to Catalyst Partner meetings"
          hint="Confirmed Catalyst Partners can ask to meet you. You accept or decline each one."
          on={partner}
          onChange={setPartner}
        />
      </section>
      <button type="button" className="tp-btn saffron block" data-tp="save" disabled={pending} onClick={save}>
        {pending ? "Saving…" : "Save my profile"}
      </button>
      {msg && (
        <p className={`tp-alert ${msg.ok ? "ok" : "bad"}`} data-tp="save-msg" style={{ margin: 0 }}>
          {msg.text}
        </p>
      )}
    </div>
  );
}
