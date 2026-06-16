/**
 * YIP Brand Footer.
 *
 * LOGO + brand taglines REMOVED 2026-06-16 (Yi logo, "Bharat Rising · Thalir",
 * "A Yi · CII initiative") — to be re-added later. Neutral platform attribution
 * kept so the footer isn't empty; previous version is in git history.
 */
export function YipBrandFooter(): React.JSX.Element {
  return (
    <footer
      aria-label="YIP footer"
      className="mt-auto w-full border-t border-orange-100 bg-white"
    >
      <div className="mx-auto flex max-w-7xl items-center justify-center px-4 py-6 text-center">
        <div className="text-xs leading-tight text-slate-600">
          <span className="font-semibold text-slate-900">
            Young Indians Parliament
          </span>
          <span className="text-slate-400">
            {" "}
            · Part of the yi-connect platform
          </span>
        </div>
      </div>
    </footer>
  );
}
