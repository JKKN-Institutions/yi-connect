"use client";

// Shared loading + error UI for both placement routes (Next.js needs a
// loading.tsx / error.tsx per route segment, so those files are thin wrappers
// around these).
//
// Why these exist at all: a chapter with 1,900 delegates pages through several
// PostgREST requests before the plan is ready. Without a labelled skeleton the
// reviewer stares at a blank panel; without an error panel a failed roster read
// looks identical to "still loading, forever". Both are bugs.

export function PlacementLoading() {
  return (
    <div className="space-y-6" aria-busy="true">
      <div>
        <h2 className="text-2xl font-bold text-navy">Place students in teams</h2>
        <p className="mt-1 text-sm text-navy/60">
          Reading the chapter roster and every team’s free seats…
        </p>
      </div>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {[0, 1, 2, 3].map((i) => (
          <div
            key={i}
            className="h-24 bg-white border border-navy/10 rounded-lg animate-pulse"
          />
        ))}
      </div>
      <div className="h-64 bg-white border border-navy/10 rounded-lg animate-pulse" />
    </div>
  );
}

export function PlacementErrorPanel({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <div className="space-y-4">
      <h2 className="text-2xl font-bold text-navy">
        Could not load placement suggestions
      </h2>
      <div className="bg-red-50 border-2 border-red-300 rounded-lg p-5">
        <p className="text-sm font-semibold text-red-700">
          {error.message || "The chapter roster could not be read."}
        </p>
        <p className="mt-2 text-xs text-red-700/80">
          No student was moved and no invitation was sent — this failed while
          reading, before anything could change.
        </p>
        {error.digest && (
          <p className="mt-1 text-[11px] text-red-700/60">
            Reference: {error.digest}
          </p>
        )}
        <button
          type="button"
          onClick={reset}
          className="mt-3 px-4 py-2 rounded-md bg-navy text-ivory text-sm font-semibold hover:bg-navy-dark"
        >
          Try again
        </button>
      </div>
    </div>
  );
}
