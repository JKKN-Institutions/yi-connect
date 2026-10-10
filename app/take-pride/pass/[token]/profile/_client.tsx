"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { saveDelegateProfile } from "./actions";
import {
  PROFILE_CHAPTER_MAX,
  PROFILE_TAG_MAX,
  PROFILE_TEXT_MAX,
  YI_VERTICALS,
} from "@/lib/take-pride/profile";

function TagPicker({
  label,
  hint,
  tags,
  value,
  onChange,
  name,
  max = PROFILE_TAG_MAX,
}: {
  label: string;
  hint: string;
  tags: readonly string[];
  value: string[];
  onChange: React.Dispatch<React.SetStateAction<string[]>>;
  name: string;
  max?: number;
}) {
  const MAX = max;
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

function ShortText({
  name,
  label,
  hint,
  placeholder,
  value,
  onChange,
}: {
  name: string;
  label: string;
  hint: string;
  placeholder: string;
  value: string;
  onChange: (v: string) => void;
}) {
  const id = `tp-${name}`;
  return (
    <div className="tp-field">
      <label htmlFor={id}>{label}</label>
      <p className="tp-small" style={{ margin: 0 }}>{hint}</p>
      <input
        id={id}
        className="tp-input"
        data-tp={`text-${name}`}
        value={value}
        maxLength={PROFILE_TEXT_MAX}
        placeholder={placeholder}
        onChange={(e) => onChange(e.target.value)}
        aria-describedby={`${id}-count`}
      />
      <span id={`${id}-count`} className="tp-small tp-num" style={{ textAlign: "right" }}>
        {value.length}/{PROFILE_TEXT_MAX}
      </span>
    </div>
  );
}

export type ProfileInitial = {
  needs: string[];
  offers: string[];
  partner: boolean;
  delegate: boolean;
  workingOn: string;
  askMeAbout: string;
  pledge: string;
  vertical: string;
  strengths: string[];
  wants: string[];
  directory: boolean;
};

export function ProfileForm({
  token,
  tags,
  initial,
}: {
  token: string;
  tags: readonly string[];
  initial: ProfileInitial;
}) {
  const router = useRouter();
  const [needs, setNeeds] = useState(initial.needs);
  const [offers, setOffers] = useState(initial.offers);
  const [partner, setPartner] = useState(initial.partner);
  const [delegate, setDelegate] = useState(initial.delegate);
  const [workingOn, setWorkingOn] = useState(initial.workingOn);
  const [askMeAbout, setAskMeAbout] = useState(initial.askMeAbout);
  const [pledge, setPledge] = useState(initial.pledge);
  const [vertical, setVertical] = useState(initial.vertical);
  const [strengths, setStrengths] = useState(initial.strengths);
  const [wants, setWants] = useState(initial.wants);
  const [directory, setDirectory] = useState(initial.directory);
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
        working_on: workingOn,
        ask_me_about: askMeAbout,
        pledge,
        yi_vertical: vertical || null,
        chapter_strengths: strengths,
        chapter_wants: wants,
        directory_visible: directory,
      });
      if (r.success) {
        setMsg({ ok: true, text: "Saved. Your suggestions and directory card now use these choices." });
        router.refresh();
      } else {
        setMsg({ ok: false, text: r.error });
      }
    });
  }

  return (
    <div className="tp-stack" style={{ gap: 16 }}>
      <section className="tp-card" aria-label="About you">
        <ShortText
          name="working_on"
          label="What I am working on"
          hint="One line other delegates will see."
          placeholder="e.g. Opening our second plant in Hosur"
          value={workingOn}
          onChange={setWorkingOn}
        />
        <ShortText
          name="ask_me_about"
          label="Ask me about"
          hint="Something you are happy to help with."
          placeholder="e.g. Exporting to the Middle East"
          value={askMeAbout}
          onChange={setAskMeAbout}
        />
        <div className="tp-field">
          <label htmlFor="tp-vertical">My Yi vertical</label>
          <select
            id="tp-vertical"
            className="tp-select"
            data-tp="select-vertical"
            value={vertical}
            onChange={(e) => setVertical(e.target.value)}
          >
            <option value="">Not chosen</option>
            {YI_VERTICALS.map((v) => (
              <option key={v} value={v}>
                {v}
              </option>
            ))}
          </select>
        </div>
        <ShortText
          name="pledge"
          label="My 1% pledge"
          hint="The 1% Shift: one small change you commit to after Take Pride."
          placeholder="e.g. Pay every small supplier within 15 days"
          value={pledge}
          onChange={setPledge}
        />
      </section>
      <section className="tp-card">
        <TagPicker
          name="needs"
          label="What you need"
          hint={`Pick up to ${PROFILE_TAG_MAX} things you are looking for.`}
          tags={tags}
          value={needs}
          onChange={setNeeds}
        />
      </section>
      <section className="tp-card">
        <TagPicker
          name="offers"
          label="What you offer"
          hint={`Pick up to ${PROFILE_TAG_MAX} things your business can help others with.`}
          tags={tags}
          value={offers}
          onChange={setOffers}
        />
      </section>
      <section className="tp-card" aria-label="Your chapter">
        <TagPicker
          name="strengths"
          label="What my chapter does well"
          hint={`Pick up to ${PROFILE_CHAPTER_MAX} Yi verticals.`}
          tags={YI_VERTICALS}
          value={strengths}
          onChange={setStrengths}
          max={PROFILE_CHAPTER_MAX}
        />
        <TagPicker
          name="wants"
          label="What my chapter wants help with"
          hint={`Pick up to ${PROFILE_CHAPTER_MAX}. We show you chapters that do these well.`}
          tags={YI_VERTICALS}
          value={wants}
          onChange={setWants}
          max={PROFILE_CHAPTER_MAX}
        />
      </section>
      <section className="tp-card">
        <Choice
          name="directory"
          label="List me in the delegate directory"
          hint="Every delegate is listed by default. Other delegates can find you and see your name, role, business, chapter, Yi vertical and what you wrote above. Never your phone or email. Turn this off and save to hide yourself."
          on={directory}
          onChange={setDirectory}
        />
        <Choice
          name="delegate"
          label="Open to delegate meetings"
          hint="Other delegates can ask to meet you. Unless you are listed in the directory, they see your business and chapter only after you accept."
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
        <p className={`tp-alert ${msg.ok ? "ok" : "bad"}`} data-tp="save-msg" role="status" style={{ margin: 0 }}>
          {msg.text}
        </p>
      )}
    </div>
  );
}
