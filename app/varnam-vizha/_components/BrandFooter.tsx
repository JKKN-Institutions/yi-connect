/** Varnam Vizha brand footer. */
export function VarnamFooter() {
  return (
    <footer className="border-t border-[#3B0A45]/10 bg-[#3B0A45] text-[#FFF9F0]">
      <div className="mx-auto max-w-6xl px-4 py-8 text-sm">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <p className="font-[family-name:var(--font-vv-display)] text-base font-semibold">
            Varnam Vizha · <span lang="ta">வர்ணம் விழா</span>
          </p>
          <p className="text-[#FFF9F0]/70">
            Yi Erode · Erode&apos;s Festival of Colour · every September
          </p>
        </div>
        <p className="mt-3 text-xs text-[#FFF9F0]/50">
          @erodevarnamvizha · erodevarnamvizha@gmail.com
        </p>
      </div>
    </footer>
  );
}
