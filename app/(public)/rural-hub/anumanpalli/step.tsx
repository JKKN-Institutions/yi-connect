/** Numbered section heading: Tamil first, English under it. The numbers are a
 *  real sequence (the road map's steps), matching the projected page. */
export function Step({ n, ta, en }: { n: number; ta: string; en: string }) {
  return (
    <div className="mb-5 flex items-start gap-3">
      <span className="mt-1 inline-flex size-9 shrink-0 items-center justify-center rounded-full bg-[#253F6E] text-sm font-semibold text-white">
        {n}
      </span>
      <div>
        <h2 className="font-[family-name:var(--font-rh-display)] text-2xl leading-snug font-bold sm:text-3xl">
          {ta}
        </h2>
        <p className="text-sm text-[#4F5866]">{en}</p>
      </div>
    </div>
  );
}
