"use client";

import { useEffect, useState } from "react";
import { ShiftMark } from "../_ui";
import type { FeedItem } from "@/lib/take-pride/recognitions-bridge";

type Feed = { eventName: string | null; items: FeedItem[] };

const POLL_MS = 5000;

export function AwardsScreen({ initial }: { initial: Feed }) {
  const [feed, setFeed] = useState<Feed>(initial);
  const [offline, setOffline] = useState(false);

  useEffect(() => {
    let alive = true;
    const tick = async () => {
      try {
        const res = await fetch("/take-pride/awards/feed", { cache: "no-store" });
        if (!res.ok) throw new Error(String(res.status));
        const next = (await res.json()) as Feed;
        if (alive && Array.isArray(next.items)) {
          setFeed(next);
          setOffline(false);
        }
      } catch {
        if (alive) setOffline(true);
      }
    };
    const id = window.setInterval(tick, POLL_MS);
    return () => {
      alive = false;
      window.clearInterval(id);
    };
  }, []);

  const [latest, ...earlier] = feed.items;

  return (
    <main className="tp-aw" aria-live="polite">
      <header className="tp-aw-top">
        <span className="tp-aw-brand">
          <ShiftMark />
          <b>
            TAKE<span>PRIDE</span>&rsquo;26
          </b>
        </span>
        <span className="tp-aw-eyebrow">Awards Night</span>
      </header>

      {!latest ? (
        <section className="tp-aw-hero tp-aw-wait" data-testid="aw-empty">
          <p className="tp-aw-eyebrow">The 1% Shift</p>
          <h1 className="tp-aw-winner">Winners will appear here</h1>
          <p className="tp-aw-cite">Stay tuned. Each award is revealed live on stage.</p>
        </section>
      ) : (
        <section key={latest.id} className={`tp-aw-hero${latest.rehearsal ? " rehearsal" : ""}`} data-testid="aw-latest">
          {latest.rehearsal && <p className="tp-aw-flag">Rehearsal</p>}
          <p className="tp-aw-eyebrow">
            {latest.award} · {latest.category}
          </p>
          <h1 className="tp-aw-winner">
            {latest.rehearsal ? <>Winner: {latest.winner}</> : <>Yi {latest.winner}</>}
          </h1>
          {latest.citation && <p className="tp-aw-cite">{latest.citation}</p>}
        </section>
      )}

      {earlier.length > 0 && (
        <section className="tp-aw-list" aria-label="Revealed earlier">
          <h2 className="tp-aw-eyebrow">Revealed tonight</h2>
          <ul>
            {earlier.map((it) => (
              <li key={it.id} data-testid="aw-earlier">
                <span className="tp-aw-what">
                  {it.award} · {it.category}
                  {it.rehearsal ? " · rehearsal" : ""}
                </span>
                <b>{it.rehearsal ? it.winner : `Yi ${it.winner}`}</b>
              </li>
            ))}
          </ul>
        </section>
      )}

      {offline && <p className="tp-aw-offline">Reconnecting…</p>}
    </main>
  );
}
