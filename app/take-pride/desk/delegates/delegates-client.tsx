"use client";

import { useMemo, useState, useSyncExternalStore, useTransition } from "react";
import { useRouter } from "next/navigation";
import { TP_EVENT, TP_INDUSTRIES, TP_ZONES } from "@/lib/take-pride/constants";
import { TP_IMPORT_MAX_BYTES, type TpImportPreviewData } from "@/lib/take-pride/import";
import type { TpDeskDelegate } from "./_core";
import { addWalkIn, confirmDelegateImport, previewDelegateImport, removeSampleDelegates } from "./actions";

const STEP = 50;
const noop = () => () => {};

function useOrigin(): string {
  return useSyncExternalStore(noop, () => window.location.origin, () => "");
}

type Filter = "all" | "real" | "sample";

export function DelegateList({ delegates }: { delegates: TpDeskDelegate[] }) {
  const [q, setQ] = useState("");
  const [filter, setFilter] = useState<Filter>("all");
  const [shown, setShown] = useState(STEP);
  const origin = useOrigin();

  const matches = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return delegates.filter((d) => {
      if (filter === "real" && d.is_sample) return false;
      if (filter === "sample" && !d.is_sample) return false;
      if (!needle) return true;
      return [d.full_name, d.chapter, d.badge_code, d.business_name ?? "", d.zone].some((v) => v.toLowerCase().includes(needle));
    });
  }, [delegates, q, filter]);

  return (
    <section className="tp-card">
      <h2 className="tp-h2">Delegate list</h2>
      <input
        className="tp-input"
        type="search"
        value={q}
        onChange={(e) => {
          setQ(e.target.value);
          setShown(STEP);
        }}
        placeholder="Search name, chapter, company or badge"
        aria-label="Search delegates"
        data-testid="tp-search"
      />
      <div className="tp-pick" role="group" aria-label="Show">
        {(["all", "real", "sample"] as const).map((f) => (
          <button
            key={f}
            type="button"
            aria-pressed={filter === f}
            data-testid={`tp-filter-${f}`}
            onClick={() => {
              setFilter(f);
              setShown(STEP);
            }}
          >
            {f === "all" ? "All" : f === "real" ? "Real" : "Sample"}
          </button>
        ))}
      </div>
      <p className="tp-small" style={{ margin: 0 }} data-testid="tp-count">
        {matches.length === 0
          ? "No delegates match."
          : `Showing ${Math.min(shown, matches.length)} of ${matches.length}`}
      </p>
      <div className="tp-list">
        {matches.slice(0, shown).map((d) => (
          <DelegateRow key={d.id} d={d} origin={origin} />
        ))}
      </div>
      {matches.length > shown && (
        <button type="button" className="tp-btn ghost sm" onClick={() => setShown((n) => n + STEP)}>
          Show {Math.min(STEP, matches.length - shown)} more
        </button>
      )}
    </section>
  );
}

function DelegateRow({ d, origin }: { d: TpDeskDelegate; origin: string }) {
  const [copied, setCopied] = useState<"yes" | "manual" | null>(null);
  const link = `${origin}/take-pride/pass/${d.token}`;
  const message = `Hi ${d.full_name}, here is your ${TP_EVENT.name} pass (${TP_EVENT.dates}, ${TP_EVENT.city}). Keep it handy: the QR on it is your entry badge. ${link}`;

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(link);
      setCopied("yes");
    } catch {
      setCopied("manual");
    }
  };

  return (
    <div className="tp-stack" style={{ gap: 6 }} data-testid="tp-delegate">
      <div className="tp-row">
        <b>{d.full_name}</b>
        <span className="tp-chips">
          {d.is_sample && <span className="tp-tag saffron">Sample</span>}
          {d.checked_in_at ? <span className="tp-tag green">Checked in</span> : <span className="tp-tag">Not in yet</span>}
          <span className={`tp-tag ${d.partner_meetings_opt_in ? "green" : ""}`}>{d.partner_meetings_opt_in ? "Meetings on" : "Meetings off"}</span>
        </span>
      </div>
      <span className="tp-small">
        {d.chapter} · {d.zone}
        {d.business_name ? ` · ${d.business_name}` : ""}
        {d.role_title ? ` · ${d.role_title}` : ""}
      </span>
      <span className="tp-small tp-num">Badge {d.badge_code} · {d.industry}</span>
      <div className="tp-row" style={{ justifyContent: "flex-start", gap: 8 }}>
        <button type="button" className="tp-btn ghost sm" onClick={copy} disabled={!origin} data-testid="tp-copy">
          {copied === "yes" ? "Link copied" : "Copy pass link"}
        </button>
        <a
          className="tp-btn green sm"
          href={origin ? `https://wa.me/?text=${encodeURIComponent(message)}` : undefined}
          target="_blank"
          rel="noopener noreferrer"
          data-testid="tp-wa"
        >
          Share on WhatsApp
        </a>
      </div>
      {copied === "manual" && (
        <input className="tp-input" readOnly value={link} onFocus={(e) => e.currentTarget.select()} aria-label="Pass link" data-testid="tp-link-manual" />
      )}
    </div>
  );
}

const FIELD_LABEL: Record<string, string> = {
  full_name: "Name",
  first_name: "First name",
  last_name: "Last name",
  chapter: "Chapter",
  zone: "Zone",
  business_name: "Company",
  role_title: "Designation",
  industry: "Industry",
  email: "Email",
  phone: "Phone",
};

/** wa.me wants country code + number, digits only. 10 digits = an Indian mobile. Unusable -> null. */
function waNumber(phone: string): string | null {
  const d = phone.replace(/\D/g, "");
  if (d.length === 10) return `91${d}`;
  if (d.length === 11 && d.startsWith("0")) return `91${d.slice(1)}`;
  if (d.length >= 11 && d.length <= 15) return d;
  return null;
}

const EMPTY_WALKIN = {
  full_name: "",
  chapter: "",
  zone: "",
  business_name: "",
  role_title: "",
  industry: "",
  phone: "",
  email: "",
};

type WalkInDone = { existing: boolean; token: string; badge_code: string; full_name: string; chapter: string; phone: string };

/** Help desk: add one walk-in (real organisers only; the server re-checks). */
export function WalkInForm() {
  const router = useRouter();
  const origin = useOrigin();
  const [f, setF] = useState(EMPTY_WALKIN);
  const [paid, setPaid] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [done, setDone] = useState<WalkInDone | null>(null);
  const [copied, setCopied] = useState<"yes" | "manual" | null>(null);
  const [pending, start] = useTransition();

  const set = (k: keyof typeof EMPTY_WALKIN) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
    setF((s) => ({ ...s, [k]: e.target.value }));

  const submit = () =>
    start(async () => {
      setErr(null);
      const r = await addWalkIn({ ...f, payment_checked: paid });
      if (!r.success) {
        setErr(r.error);
        return;
      }
      setDone({ ...r.data, phone: f.phone });
      setCopied(null);
      if (!r.data.existing) {
        setF(EMPTY_WALKIN);
        setPaid(false);
        router.refresh();
      }
    });

  if (done) {
    const link = `${origin}/take-pride/pass/${done.token}`;
    const message = `Hi ${done.full_name}, here is your ${TP_EVENT.name} pass (${TP_EVENT.dates}, ${TP_EVENT.city}). Keep it handy: the QR on it is your entry badge. ${link}`;
    const to = waNumber(done.phone);
    const copy = async () => {
      try {
        await navigator.clipboard.writeText(link);
        setCopied("yes");
      } catch {
        setCopied("manual");
      }
    };
    return (
      <div className="tp-stack" data-testid="walkin-done">
        <p className={`tp-alert ${done.existing ? "warn" : "ok"}`} style={{ margin: 0 }} data-testid="walkin-result">
          {done.existing
            ? `${done.full_name}, ${done.chapter} is already a delegate (badge ${done.badge_code}). Nothing new was added: share their existing pass.`
            : `Added ${done.full_name}, ${done.chapter}. Badge ${done.badge_code}.`}
        </p>
        <input className="tp-input" readOnly value={link} onFocus={(e) => e.currentTarget.select()} aria-label="Pass link" data-testid="walkin-link" />
        <div className="tp-row" style={{ justifyContent: "flex-start", gap: 8 }}>
          <button type="button" className="tp-btn ghost sm" onClick={copy} disabled={!origin} data-testid="walkin-copy">
            {copied === "yes" ? "Link copied" : copied === "manual" ? "Copy the link above" : "Copy pass link"}
          </button>
          <a
            className="tp-btn green sm"
            href={origin ? `https://wa.me/${to ?? ""}?text=${encodeURIComponent(message)}` : undefined}
            target="_blank"
            rel="noopener noreferrer"
            data-testid="walkin-wa"
          >
            {to ? "Send on WhatsApp" : "Share on WhatsApp"}
          </a>
        </div>
        <button
          type="button"
          className="tp-btn ghost sm"
          onClick={() => {
            setDone(null);
            setErr(null);
          }}
          data-testid="walkin-another"
        >
          {done.existing ? "Back to the form" : "Add another walk-in"}
        </button>
      </div>
    );
  }

  return (
    <form
      className="tp-stack"
      onSubmit={(e) => {
        e.preventDefault();
        submit();
      }}
      data-testid="walkin-form"
    >
      <div className="tp-field">
        <label htmlFor="wi-name">Full name</label>
        <input id="wi-name" className="tp-input" value={f.full_name} onChange={set("full_name")} required minLength={2} maxLength={120} autoComplete="off" />
      </div>
      <div className="tp-field">
        <label htmlFor="wi-chapter">Yi chapter</label>
        <input id="wi-chapter" className="tp-input" value={f.chapter} onChange={set("chapter")} required minLength={2} maxLength={80} placeholder="Yi Coimbatore" autoComplete="off" />
      </div>
      <div className="tp-field">
        <label htmlFor="wi-zone">Zone</label>
        <select id="wi-zone" className="tp-select" value={f.zone} onChange={set("zone")} required>
          <option value="" disabled>Pick a zone</option>
          {TP_ZONES.map((z) => (
            <option key={z} value={z}>{z}</option>
          ))}
        </select>
      </div>
      <div className="tp-field">
        <label htmlFor="wi-business">Business name</label>
        <input id="wi-business" className="tp-input" value={f.business_name} onChange={set("business_name")} maxLength={120} autoComplete="off" />
      </div>
      <div className="tp-field">
        <label htmlFor="wi-role">Role</label>
        <input id="wi-role" className="tp-input" value={f.role_title} onChange={set("role_title")} maxLength={80} placeholder="Director" autoComplete="off" />
      </div>
      <div className="tp-field">
        <label htmlFor="wi-industry">Industry</label>
        <select id="wi-industry" className="tp-select" value={f.industry} onChange={set("industry")}>
          <option value="">Other / not sure</option>
          {TP_INDUSTRIES.map((i) => (
            <option key={i} value={i}>{i}</option>
          ))}
        </select>
      </div>
      <div className="tp-field">
        <label htmlFor="wi-phone">Mobile (for the WhatsApp link)</label>
        <input id="wi-phone" className="tp-input" type="tel" inputMode="tel" value={f.phone} onChange={set("phone")} maxLength={20} autoComplete="off" />
      </div>
      <div className="tp-field">
        <label htmlFor="wi-email">Email</label>
        <input id="wi-email" className="tp-input" type="email" value={f.email} onChange={set("email")} maxLength={160} autoComplete="off" />
      </div>
      <label className="tp-row" style={{ justifyContent: "flex-start", flexWrap: "nowrap", gap: 10, fontWeight: 600 }}>
        <input type="checkbox" checked={paid} onChange={(e) => setPaid(e.target.checked)} style={{ width: 22, height: 22, flexShrink: 0 }} data-testid="walkin-paid" />
        <span>I have checked their payment proof</span>
      </label>
      {err && <p className="tp-alert bad" style={{ margin: 0 }} role="alert" data-testid="walkin-err">{err}</p>}
      <button type="submit" className="tp-btn green" disabled={pending || !paid} data-testid="walkin-submit">
        {pending ? "Adding…" : "Add walk-in and get pass link"}
      </button>
    </form>
  );
}

export function ImportPanel() {
  const router = useRouter();
  const [text, setText] = useState("");
  const [fileNote, setFileNote] = useState<string | null>(null);
  const [preview, setPreview] = useState<TpImportPreviewData | null>(null);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [pending, start] = useTransition();

  const changeText = (t: string) => {
    setText(t);
    setPreview(null);
    setMsg(null);
  };

  const pickFile = async (file: File | undefined) => {
    setFileNote(null);
    if (!file) return;
    if (file.size > TP_IMPORT_MAX_BYTES) {
      setMsg({ ok: false, text: "That file is bigger than 2 MB. Split it into smaller files." });
      return;
    }
    changeText(await file.text());
    setFileNote(`${file.name} loaded`);
  };

  const runPreview = () =>
    start(async () => {
      setMsg(null);
      const r = await previewDelegateImport(text);
      if (!r.success) {
        setPreview(null);
        setMsg({ ok: false, text: r.error });
      } else setPreview(r.data);
    });

  const runImport = () =>
    start(async () => {
      const r = await confirmDelegateImport(text);
      if (!r.success) {
        setMsg({ ok: false, text: r.error });
        return;
      }
      setPreview(null);
      setText("");
      setFileNote(null);
      const base = `Imported ${r.data.inserted} delegate${r.data.inserted === 1 ? "" : "s"}. ${r.data.skipped} row${r.data.skipped === 1 ? "" : "s"} skipped.`;
      setMsg({ ok: !r.data.warning, text: r.data.warning ? `${base} ${r.data.warning}` : `${base} They are in the list above.` });
      router.refresh();
    });

  return (
    <div className="tp-stack">
      <div className="tp-field">
        <label htmlFor="tp-csv-file">CSV file</label>
        <input id="tp-csv-file" type="file" accept=".csv,text/csv,text/plain" onChange={(e) => pickFile(e.target.files?.[0])} data-testid="tp-file" />
        {fileNote && <span className="tp-small">{fileNote}</span>}
      </div>
      <div className="tp-field">
        <label htmlFor="tp-csv-text">Or paste the rows (first line = column names)</label>
        <textarea
          id="tp-csv-text"
          className="tp-textarea"
          style={{ minHeight: 120, fontSize: 14 }}
          value={text}
          onChange={(e) => changeText(e.target.value)}
          placeholder={"Name,Chapter,Zone,Company,Designation,Industry\nPriya Raman,Coimbatore,South,Raman Mills,Director,Textiles"}
          data-testid="tp-csv"
        />
      </div>
      <button type="button" className="tp-btn sm" disabled={pending || !text.trim()} onClick={runPreview} data-testid="tp-preview">
        {pending && !preview ? "Checking…" : "Preview import"}
      </button>

      {msg && <p className={`tp-alert ${msg.ok ? "ok" : "bad"}`} style={{ margin: 0 }} data-testid="tp-import-msg">{msg.text}</p>}

      {preview && (
        <div className="tp-stack" data-testid="tp-preview-box">
          <p className="tp-alert warn" style={{ margin: 0 }}>
            {preview.ready} of {preview.dataRows} rows are ready to import · {preview.skipped.length} will be skipped.
          </p>
          <p className="tp-small" style={{ margin: 0 }}>
            Columns used:{" "}
            {Object.entries(preview.columns)
              .map(([f, h]) => `${FIELD_LABEL[f] ?? f} ← "${h}"`)
              .join(" · ")}
          </p>
          {preview.sample.length > 0 && (
            <div className="tp-scroll">
              <table className="tp-table">
                <thead>
                  <tr>
                    <th>Row</th>
                    <th>Name</th>
                    <th>Chapter</th>
                    <th>Zone</th>
                    <th>Company</th>
                    <th>Industry</th>
                  </tr>
                </thead>
                <tbody>
                  {preview.sample.map((r) => (
                    <tr key={r.line}>
                      <td className="tp-num">{r.line}</td>
                      <td>{r.full_name}{r.role_title ? <span className="tp-small"> · {r.role_title}</span> : null}</td>
                      <td>{r.chapter}</td>
                      <td>{r.zone}</td>
                      <td>{r.business_name ?? "—"}</td>
                      <td>
                        {r.industry}
                        {r.industry_source === "own" && <span className="tp-small"> (as written)</span>}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          {preview.ready > preview.sample.length && <span className="tp-small">First {preview.sample.length} shown.</span>}
          {preview.skipped.length > 0 && (
            <div className="tp-stack" style={{ gap: 4 }} data-testid="tp-skipped">
              <b className="tp-h3">Skipped rows</b>
              {preview.skipped.slice(0, 50).map((s) => (
                <span key={`${s.line}-${s.name}`} className="tp-small">
                  Row {s.line} · {s.name}: {s.reason}
                </span>
              ))}
              {preview.skipped.length > 50 && <span className="tp-small">…and {preview.skipped.length - 50} more.</span>}
            </div>
          )}
          {preview.ready > 0 ? (
            <button type="button" className="tp-btn green" disabled={pending} onClick={runImport} data-testid="tp-confirm">
              {pending ? "Importing…" : `Import ${preview.ready} delegate${preview.ready === 1 ? "" : "s"}`}
            </button>
          ) : (
            <p className="tp-small" style={{ margin: 0 }}>Nothing new to import.</p>
          )}
        </div>
      )}
    </div>
  );
}

export function RemoveSamples({ count }: { count: number }) {
  const router = useRouter();
  const [step, setStep] = useState<1 | 2>(1);
  const [word, setWord] = useState("");
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [pending, start] = useTransition();

  if (count === 0) return <p className="tp-small" style={{ margin: 0 }}>Every sample delegate left has been checked in, so none can be removed.</p>;

  return (
    <div className="tp-stack">
      {step === 1 ? (
        <button type="button" className="tp-btn ghost sm" onClick={() => setStep(2)} data-testid="tp-remove-1">
          Remove sample delegates
        </button>
      ) : (
        <form
          className="tp-stack"
          onSubmit={(e) => {
            e.preventDefault();
            start(async () => {
              const r = await removeSampleDelegates(word);
              if (!r.success) setMsg({ ok: false, text: r.error });
              else {
                setMsg({ ok: true, text: `Removed ${r.data.removed} sample delegates.` });
                setStep(1);
                setWord("");
                router.refresh();
              }
            });
          }}
        >
          <p className="tp-alert bad" style={{ margin: 0 }}>
            This removes {count} sample delegates for good. Type REMOVE to confirm.
          </p>
          <input className="tp-input" value={word} onChange={(e) => setWord(e.target.value)} placeholder="REMOVE" aria-label="Type REMOVE to confirm" autoComplete="off" />
          <div className="tp-row" style={{ justifyContent: "flex-start" }}>
            <button className="tp-btn sm" style={{ background: "var(--tp-bad)" }} disabled={pending || word.trim().toUpperCase() !== "REMOVE"}>
              {pending ? "Removing…" : `Yes, remove ${count}`}
            </button>
            <button type="button" className="tp-btn ghost sm" onClick={() => { setStep(1); setWord(""); }}>
              Cancel
            </button>
          </div>
        </form>
      )}
      {msg && <p className={`tp-alert ${msg.ok ? "ok" : "bad"}`} style={{ margin: 0 }}>{msg.text}</p>}
    </div>
  );
}
