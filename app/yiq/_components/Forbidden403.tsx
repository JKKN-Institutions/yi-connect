import Link from "next/link";

/**
 * Explicit denial. NEVER redirect a denied user to a landing page — a silent
 * bounce is undiagnosable ("I click it and end up back at the start"). Say
 * what happened, say who to ask.
 */
export function Forbidden403({
  reason,
  what = "this page",
}: {
  reason?: string;
  what?: string;
}) {
  return (
    <main
      id="yiq-main"
      className="mx-auto flex min-h-screen max-w-md flex-col justify-center px-6"
      style={{ background: "#0a1633", color: "#f7f4ed" }}
    >
      <p className="yiq-eyebrow" style={{ color: "#e8a33d" }}>
        403 · Not your chapter
      </p>
      <h1 className="yiq-display mt-3 text-[2.25rem]">
        You don&apos;t have access to {what}
      </h1>
      <p className="mt-4 text-[0.9375rem] leading-relaxed" style={{ color: "#9fb0d4" }}>
        YIQ organiser access is granted per chapter. If you should be able to
        see this, ask your Yi chapter chair or a YIQ national admin to add you
        as an organiser for this chapter.
      </p>
      {reason ? (
        <p
          className="yiq-data mt-5 rounded-lg px-3 py-2 text-[0.75rem]"
          style={{ background: "rgba(247,244,237,0.07)", color: "#9fb0d4" }}
        >
          reason: {reason}
        </p>
      ) : null}
      <Link
        href="/yiq"
        className="mt-7 self-start rounded-full px-5 py-3 text-[0.875rem] font-bold"
        style={{ background: "#e8a33d", color: "#0a1633" }}
      >
        Back to YIQ
      </Link>
    </main>
  );
}
