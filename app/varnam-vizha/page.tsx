import Link from "next/link";

// P0 landing — branded bilingual hero proving the vertical loads with its own
// identity. Data-driven event/sponsor sections arrive in P1. Figures below are
// vault-sourced (2025 edition: 11 days, 2,000+ participants, culminates Sept 16).
export default function VarnamHome() {
  return (
    <div>
      {/* Hero */}
      <section className="relative overflow-hidden">
        <div
          aria-hidden
          className="absolute inset-0 bg-gradient-to-br from-[#F4A300] via-[#D6336C] to-[#3B0A45]"
        />
        <div className="relative mx-auto max-w-5xl px-4 py-24 text-center text-white sm:py-32">
          <p className="mb-3 text-xs font-semibold uppercase tracking-[0.25em] text-white/80">
            Yi Erode · Since 2021
          </p>
          <h1
            lang="ta"
            className="font-[family-name:var(--font-vv-display)] text-5xl font-extrabold leading-tight sm:text-7xl"
          >
            வர்ணம் விழா
          </h1>
          <p className="mt-2 font-[family-name:var(--font-vv-display)] text-2xl font-semibold text-white/90 sm:text-3xl">
            Varnam Vizha
          </p>
          <p className="mx-auto mt-6 max-w-2xl text-lg text-white/90">
            Erode&apos;s festival of colour — eleven days of art, culture, sport
            and community, every September, culminating on Erode Day (Sept 16).
          </p>
          <div className="mt-9 flex flex-wrap items-center justify-center gap-3">
            <Link
              href="/varnam-vizha/dashboard"
              className="rounded-full bg-white px-6 py-3 text-sm font-semibold text-[#3B0A45] shadow-lg transition hover:bg-white/90"
            >
              Committee sign in
            </Link>
            <a
              href="https://www.instagram.com/erodevarnamvizha/"
              target="_blank"
              rel="noopener noreferrer"
              className="rounded-full border border-white/40 px-6 py-3 text-sm font-semibold text-white transition hover:bg-white/10"
            >
              @erodevarnamvizha
            </a>
          </div>
        </div>
      </section>

      {/* Stat strip */}
      <section className="mx-auto max-w-5xl px-4 py-16">
        <div className="grid gap-6 sm:grid-cols-3">
          {[
            { k: "11 days", v: "Two weekends of events across Erode city" },
            { k: "2,000+", v: "Participants across art, sport & culture" },
            { k: "Sept 16", v: "Culminates on Erode Day" },
          ].map((s) => (
            <div
              key={s.k}
              className="rounded-2xl border border-[#3B0A45]/10 bg-white p-6 text-center shadow-sm"
            >
              <p className="font-[family-name:var(--font-vv-display)] text-3xl font-bold text-[#D6336C]">
                {s.k}
              </p>
              <p className="mt-1 text-sm text-[#2B0A33]/70">{s.v}</p>
            </div>
          ))}
        </div>
        <p className="mt-10 text-center text-sm text-[#2B0A33]/50">
          The 2026 edition platform is being built. Committee members can sign in
          to manage events, registrations, sponsors and budget.
        </p>
      </section>
    </div>
  );
}
