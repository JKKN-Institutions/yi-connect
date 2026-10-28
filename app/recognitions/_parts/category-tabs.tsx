"use client";

import { createContext, useContext, useRef, useState, type KeyboardEvent, type ReactNode } from "react";
import { CATEGORIES, CATEGORY_LABEL, type Category } from "@/lib/recognitions/constants";

/**
 * Pioneers, Trailblazers and Sparks as tabs on the evaluation screens
 * (Piyush, 28 Oct 2026). One CategoryTabs wraps the screen; every per-category
 * block inside it sits in a CategoryPanel and shows only on its tab. Outside a
 * CategoryTabs a panel renders as plain content, so the same parts still work
 * on pages without tabs. Hiding (not unmounting) keeps form input on the
 * other tabs.
 */

const Active = createContext<Category | null>(null);

export function CategoryTabs({
  counts,
  children,
}: {
  /** Nominations per category, shown on each tab. */
  counts: Partial<Record<Category, number>>;
  children: ReactNode;
}) {
  const [active, setActive] = useState<Category>(
    () => CATEGORIES.find((c) => (counts[c] ?? 0) > 0) ?? CATEGORIES[0]
  );
  const refs = useRef<Partial<Record<Category, HTMLButtonElement | null>>>({});

  function onKey(e: KeyboardEvent<HTMLButtonElement>, i: number) {
    const step = e.key === "ArrowRight" ? 1 : e.key === "ArrowLeft" ? -1 : 0;
    if (step === 0) return;
    e.preventDefault();
    const next = CATEGORIES[(i + step + CATEGORIES.length) % CATEGORIES.length];
    setActive(next);
    refs.current[next]?.focus();
  }

  return (
    <div className="rx-stack-lg">
      <div className="rx-cat-tabs" role="tablist" aria-label="Chapter categories">
        {CATEGORIES.map((c, i) => (
          <button
            key={c}
            ref={(el) => {
              refs.current[c] = el;
            }}
            type="button"
            role="tab"
            id={`rx-cat-tab-${c}`}
            aria-selected={active === c}
            tabIndex={active === c ? 0 : -1}
            className="rx-cat-tab"
            onClick={() => setActive(c)}
            onKeyDown={(e) => onKey(e, i)}
          >
            {CATEGORY_LABEL[c]}
            <span className="rx-cat-tab-n rx-num">{counts[c] ?? 0}</span>
          </button>
        ))}
      </div>
      <Active.Provider value={active}>{children}</Active.Provider>
    </div>
  );
}

/**
 * One category's block. `tabsOnly` content (an "empty" message) shows only
 * inside tabs, where a blank tab would otherwise look broken.
 */
export function CategoryPanel({
  category,
  tabsOnly = false,
  children,
}: {
  category: Category;
  tabsOnly?: boolean;
  children: ReactNode;
}) {
  const active = useContext(Active);
  if (active === null) return tabsOnly ? null : <>{children}</>;
  return (
    <div role="tabpanel" aria-labelledby={`rx-cat-tab-${category}`} hidden={active !== category}>
      {children}
    </div>
  );
}
