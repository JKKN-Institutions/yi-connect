"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import type { DeskCell } from "@/lib/take-pride/recognitions-bridge";
import { clearRehearsal, rehearseReveal, revealAward } from "./actions";

function ist(iso: string): string {
  return new Intl.DateTimeFormat("en-IN", { timeZone: "Asia/Kolkata", hour: "numeric", minute: "2-digit", day: "numeric", month: "short" }).format(new Date(iso));
}

export function AwardsDeskClient({
  cycleName,
  cells,
  rehearsalCount,
  review = false,
}: {
  cycleName: string;
  cells: DeskCell[];
  rehearsalCount: number;
  review?: boolean;
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [rehearsalPick, setRehearsal] = useState(false);
  // Review mode is rehearsal only: the real reveal never shows (and the server refuses it).
  const rehearsal = review || rehearsalPick;
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);

  const run = (fn: () => Promise<{ success: true } | { success: false; error: string }>, okText: string) =>
    start(async () => {
      setMsg(null);
      const r = await fn();
      setMsg(r.success ? { ok: true, text: okText } : { ok: false, text: r.error });
      if (r.success) router.refresh();
    });

  const awards = new Map<string, DeskCell[]>();
  for (const c of cells) awards.set(c.awardTitle, [...(awards.get(c.awardTitle) ?? []), c]);
  const approvedCount = cells.filter((c) => c.canReveal).length;

  return (
    <>
      <section className={`tp-card ${rehearsal ? "hi" : ""}`} aria-label="Mode">
        <div className="tp-row">
          <div style={{ minWidth: 0 }}>
            <h2 className="tp-h2">{rehearsal ? "Rehearsal mode" : "Live mode"}</h2>
            <p className="tp-small" style={{ margin: 0 }}>
              {rehearsal
                ? `Practice reveals show “Winner: Chapter to be announced” on the screen. No real chapter is ever shown.${review ? " Review mode can rehearse only." : ""}`
                : `${cycleName} · ${approvedCount} of ${cells.length} ready to reveal.`}
            </p>
          </div>
          <label className="tp-row" style={{ gap: 8, fontWeight: 600, cursor: "pointer" }}>
            <input
              type="checkbox"
              data-testid="rehearsal-toggle"
              checked={rehearsal}
              disabled={review}
              onChange={(e) => {
                setMsg(null);
                setRehearsal(e.target.checked);
              }}
              style={{ width: 22, height: 22 }}
            />
            Rehearsal
          </label>
        </div>
        <div className="tp-row" style={{ justifyContent: "flex-start" }}>
          <span className="tp-small">{rehearsalCount} rehearsal reveal{rehearsalCount === 1 ? "" : "s"} on the screen</span>
          <button
            className="tp-btn ghost sm"
            data-testid="clear-rehearsal"
            disabled={pending || rehearsalCount === 0}
            onClick={() =>
              start(async () => {
                setMsg(null);
                const r = await clearRehearsal();
                setMsg(r.success ? { ok: true, text: `Cleared ${r.data.cleared} rehearsal reveal${r.data.cleared === 1 ? "" : "s"}.` } : { ok: false, text: r.error });
                if (r.success) router.refresh();
              })
            }
          >
            Clear rehearsal
          </button>
        </div>
        {msg && (
          <p className={`tp-alert ${msg.ok ? "ok" : "bad"}`} role="status" data-testid="desk-msg" style={{ margin: 0 }}>
            {msg.text}
          </p>
        )}
      </section>

      {[...awards.entries()].map(([title, row]) => (
        <section key={title} className="tp-card" aria-label={title}>
          <h2 className="tp-h2">{title}</h2>
          <div className="tp-list">
            {row.map((c) => {
              const key = `${c.awardId}:${c.category}`;
              const real = !!c.reveal && !c.reveal.rehearsal;
              // Approved result changed after the reveal: hidden until revealed again.
              const stale = real && !!c.reveal?.stale;
              // A real reveal shows on the screen only while the SAME result is still approved.
              const onScreen = real && c.canReveal && !stale;
              return (
                <div key={key} className="tp-stack" style={{ gap: 6 }} data-testid={`cell-${c.category}`} data-award={c.awardTitle}>
                  <div className="tp-row">
                    <b>{c.categoryLabel}</b>
                    {stale ? (
                      <span className="tp-tag bad">Hidden: result changed since reveal</span>
                    ) : real && !onScreen ? (
                      <span className="tp-tag bad">Hidden: no longer approved</span>
                    ) : onScreen ? (
                      <span className="tp-tag green">On screen · {ist(c.reveal!.at)}</span>
                    ) : c.reveal?.rehearsal ? (
                      <span className="tp-tag saffron">Rehearsal on screen</span>
                    ) : (
                      <span className={`tp-tag ${c.canReveal ? "green" : ""}`} data-testid="approval">{c.status}</span>
                    )}
                  </div>
                  {onScreen && c.revealedWinner && <span className="tp-small">Winner shown: Yi {c.revealedWinner}</span>}
                  {(!real || stale) && !(review && stale) && (
                    <div className="tp-row" style={{ justifyContent: "flex-start" }}>
                      {rehearsal && !stale ? (
                        <button
                          className="tp-btn saffron sm"
                          data-testid="rehearse-btn"
                          disabled={pending || !!c.reveal}
                          onClick={() => run(() => rehearseReveal(c.awardId, c.category), `Rehearsal: ${title} · ${c.categoryLabel} is on the screen.`)}
                        >
                          Rehearse reveal
                        </button>
                      ) : (
                        <button
                          className="tp-btn green sm"
                          data-testid="reveal-btn"
                          disabled={pending || !c.canReveal}
                          onClick={() => {
                            const ask = stale
                              ? `The approved result for ${title} · ${c.categoryLabel} changed after it was revealed. Reveal the new winner on the hall screen now?`
                              : `Reveal the ${title} · ${c.categoryLabel} winner on the hall screen now?`;
                            if (!window.confirm(ask)) return;
                            run(() => revealAward(c.awardId, c.category), `${title} · ${c.categoryLabel} is now on the screen.`);
                          }}
                        >
                          {stale ? "Reveal again" : "Reveal"}
                        </button>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </section>
      ))}
    </>
  );
}
