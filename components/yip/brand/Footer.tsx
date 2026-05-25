import Image from "next/image";

/**
 * YIP Brand Footer — Part of yi-connect platform attribution.
 */
export function YipBrandFooter(): React.JSX.Element {
  return (
    <footer
      aria-label="YIP footer"
      className="mt-auto w-full border-t border-orange-100 bg-white"
    >
      <div className="mx-auto flex max-w-7xl flex-col items-center gap-3 px-4 py-6 text-center sm:flex-row sm:justify-between sm:text-left">
        <div className="flex items-center gap-3">
          <Image
            src="/yip/logos/yi-logo.png"
            alt="Young Indians"
            width={32}
            height={32}
            className="h-8 w-auto"
          />
          <div className="text-xs leading-tight text-slate-600">
            <div className="font-semibold text-slate-900">YIP — Young Indians Parliament</div>
            <div>A Yi · CII initiative · Part of the yi-connect platform</div>
          </div>
        </div>
        <div className="text-[10px] uppercase tracking-wider text-slate-500">
          Bharat Rising · Thalir
        </div>
      </div>
    </footer>
  );
}
