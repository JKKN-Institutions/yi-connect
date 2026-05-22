"use client";

export function RetryButton(): React.JSX.Element {
  return (
    <button
      type="button"
      onClick={() => {
        if (typeof window !== "undefined") window.location.reload();
      }}
      className="inline-flex items-center justify-center rounded-md bg-navy px-6 py-3 text-sm font-semibold text-ivory shadow-sm transition-colors hover:bg-navy-light focus:outline-none focus:ring-2 focus:ring-yi-gold focus:ring-offset-2"
    >
      Try again
    </button>
  );
}
