import Link from "next/link";

export default function HomePage() {
  return (
    <div className="flex min-h-screen flex-col bg-[#FEFCF6]">
      {/* ─── Tricolor Header Bar ─────────────────────────────────── */}
      <div className="flex h-1.5">
        <div className="flex-1 bg-[#FF9933]" />
        <div className="flex-1 bg-white" />
        <div className="flex-1 bg-[#138808]" />
      </div>

      {/* ─── Nav ─────────────────────────────────────────────────── */}
      <nav className="relative z-10 mx-auto flex w-full max-w-6xl items-center justify-between px-6 py-5">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-[#FF9933] shadow-md shadow-[#FF9933]/20">
            <span className="font-[family-name:var(--font-heading)] text-lg font-bold text-white">Y</span>
          </div>
          <div>
            <span className="text-sm font-semibold tracking-wide text-[#1a1a3e]">Young Indians</span>
            <span className="block text-[10px] uppercase tracking-[0.2em] text-[#FF9933]">Parliament</span>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <Link
            href="/yip/login"
            className="rounded-lg px-4 py-2 text-sm font-medium text-[#1a1a3e]/70 transition-colors hover:text-[#1a1a3e]"
          >
            Organizer Login
          </Link>
          <Link
            href="/yip/join"
            className="rounded-lg bg-[#1a1a3e] px-5 py-2.5 text-sm font-semibold text-white shadow-lg shadow-[#1a1a3e]/20 transition-all hover:shadow-xl hover:shadow-[#1a1a3e]/30"
          >
            Join Event
          </Link>
        </div>
      </nav>

      {/* ─── Hero ─────────────────────────────────────────────────── */}
      <section className="relative overflow-hidden">
        {/* Background decoration */}
        <div className="absolute inset-0 overflow-hidden">
          {/* Subtle radial gradient */}
          <div className="absolute -top-40 right-0 h-[600px] w-[600px] rounded-full bg-[#FF9933]/[0.04] blur-3xl" />
          <div className="absolute -bottom-20 left-0 h-[400px] w-[400px] rounded-full bg-[#138808]/[0.03] blur-3xl" />
          {/* Geometric grid pattern */}
          <div
            className="absolute inset-0 opacity-[0.015]"
            style={{
              backgroundImage: `repeating-linear-gradient(0deg, transparent, transparent 60px, #1a1a3e 60px, #1a1a3e 61px), repeating-linear-gradient(90deg, transparent, transparent 60px, #1a1a3e 60px, #1a1a3e 61px)`,
            }}
          />
          {/* Ashoka Chakra watermark */}
          <svg className="absolute right-[10%] top-1/2 -translate-y-1/2 h-[500px] w-[500px] opacity-[0.02]" viewBox="0 0 200 200">
            <circle cx="100" cy="100" r="90" fill="none" stroke="currentColor" strokeWidth="3" />
            <circle cx="100" cy="100" r="15" fill="currentColor" />
            {Array.from({ length: 24 }).map((_, i) => (
              <line
                key={i}
                x1="100"
                y1="100"
                x2={100 + 85 * Math.cos((i * 15 * Math.PI) / 180)}
                y2={100 + 85 * Math.sin((i * 15 * Math.PI) / 180)}
                stroke="currentColor"
                strokeWidth="1.5"
              />
            ))}
          </svg>
        </div>

        <div className="relative mx-auto max-w-6xl px-6 pb-20 pt-16 sm:pb-28 sm:pt-24 lg:pb-36 lg:pt-32">
          <div className="grid items-center gap-12 lg:grid-cols-[1.2fr_1fr]">
            {/* Left: Text content */}
            <div>
              <div className="mb-6 inline-flex items-center gap-2.5 rounded-full border border-[#FF9933]/15 bg-white/80 px-4 py-2 text-sm shadow-sm backdrop-blur-sm">
                <span className="flex h-2 w-2 rounded-full bg-[#FF9933] shadow-sm shadow-[#FF9933]/50" />
                <span className="font-medium text-[#1a1a3e]/80">A Yi &middot; CII Initiative</span>
              </div>

              <h1 className="font-[family-name:var(--font-heading)] text-4xl font-bold leading-[1.1] tracking-tight text-[#1a1a3e] sm:text-5xl lg:text-6xl">
                Where Young
                <br />
                Voices Shape
                <br />
                <span className="relative">
                  <span className="bg-gradient-to-r from-[#FF9933] via-[#E68A2E] to-[#D4A843] bg-clip-text text-transparent">
                    Tomorrow&apos;s India
                  </span>
                  <span className="absolute -bottom-1 left-0 h-[3px] w-full bg-gradient-to-r from-[#FF9933] via-[#E68A2E] to-[#D4A843] opacity-30" />
                </span>
              </h1>

              <p className="mt-6 max-w-lg text-lg leading-relaxed text-[#1a1a3e]/60 sm:text-xl">
                A mock parliament where school students debate real issues,
                form governments, draft bills, and experience the power of
                democratic engagement.
              </p>

              <div className="mt-10 flex flex-wrap gap-4">
                <Link
                  href="/yip/login"
                  className="group inline-flex items-center gap-2.5 rounded-xl bg-[#FF9933] px-7 py-3.5 text-base font-semibold text-white shadow-lg shadow-[#FF9933]/25 transition-all hover:bg-[#E68A2E] hover:shadow-xl hover:shadow-[#FF9933]/30"
                >
                  <svg className="size-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>
                  Organize an Event
                  <svg className="size-4 transition-transform group-hover:translate-x-0.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M5 12h14"/><path d="m12 5 7 7-7 7"/></svg>
                </Link>
                <Link
                  href="/yip/join"
                  className="group inline-flex items-center gap-2.5 rounded-xl border-2 border-[#1a1a3e]/10 bg-white px-7 py-3.5 text-base font-semibold text-[#1a1a3e] shadow-sm transition-all hover:border-[#138808]/30 hover:shadow-md"
                >
                  <svg className="size-5 text-[#138808]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m15 7-5 5 5 5"/><circle cx="12" cy="12" r="10" strokeWidth="1.5"/></svg>
                  Join with Access Code
                </Link>
              </div>

              {/* Trust badges */}
              <div className="mt-12 flex items-center gap-6 text-xs font-medium uppercase tracking-[0.15em] text-[#1a1a3e]/30">
                <span>Young Indians</span>
                <span className="h-3 w-px bg-[#1a1a3e]/10" />
                <span>CII</span>
                <span className="h-3 w-px bg-[#1a1a3e]/10" />
                <span>Thalir</span>
                <span className="h-3 w-px bg-[#1a1a3e]/10" />
                <span>Bharat Rising</span>
              </div>
            </div>

            {/* Right: Visual element — Parliament illustration */}
            <div className="hidden lg:block">
              <div className="relative">
                {/* Decorative circles */}
                <div className="absolute -right-8 -top-8 h-64 w-64 rounded-full border border-[#FF9933]/10" />
                <div className="absolute -bottom-4 -left-4 h-40 w-40 rounded-full border border-[#138808]/10" />

                {/* Parliament building card */}
                <div className="relative overflow-hidden rounded-2xl border border-[#1a1a3e]/5 bg-white p-8 shadow-xl shadow-[#1a1a3e]/5">
                  <div className="absolute inset-0 bg-gradient-to-br from-[#FF9933]/[0.02] to-[#138808]/[0.02]" />
                  <svg className="relative mx-auto h-48 w-full text-[#1a1a3e]/80" viewBox="0 0 300 200" fill="none">
                    {/* Parliament dome */}
                    <ellipse cx="150" cy="100" rx="120" ry="55" fill="currentColor" opacity="0.05" />
                    <ellipse cx="150" cy="100" rx="120" ry="55" stroke="currentColor" strokeWidth="1.5" opacity="0.2" />
                    {/* Inner dome */}
                    <ellipse cx="150" cy="80" rx="50" ry="35" fill="currentColor" opacity="0.08" />
                    <ellipse cx="150" cy="80" rx="50" ry="35" stroke="currentColor" strokeWidth="1" opacity="0.15" />
                    {/* Flagpole */}
                    <rect x="148" y="40" width="4" height="30" fill="currentColor" opacity="0.3" rx="2" />
                    <rect x="145" y="36" width="10" height="8" fill="#FF9933" rx="1" />
                    {/* Base */}
                    <rect x="30" y="130" width="240" height="50" fill="currentColor" opacity="0.04" rx="4" />
                    <rect x="30" y="130" width="240" height="50" stroke="currentColor" strokeWidth="1" opacity="0.1" rx="4" />
                    {/* Columns */}
                    {[60, 100, 140, 160, 200, 240].map((x, i) => (
                      <rect key={i} x={x} y={90} width="8" height="42" fill="currentColor" opacity="0.12" rx="2" />
                    ))}
                    {/* Steps */}
                    <rect x="50" y="175" width="200" height="6" fill="currentColor" opacity="0.06" rx="1" />
                    <rect x="40" y="180" width="220" height="6" fill="currentColor" opacity="0.04" rx="1" />
                  </svg>

                  {/* Stats row */}
                  <div className="relative mt-6 grid grid-cols-3 gap-4 border-t border-[#1a1a3e]/5 pt-6">
                    {[
                      { label: "Students", value: "Classes 9-12" },
                      { label: "Format", value: "2-Day Event" },
                      { label: "Levels", value: "3 Rounds" },
                    ].map((stat) => (
                      <div key={stat.label} className="text-center">
                        <div className="font-[family-name:var(--font-heading)] text-sm font-bold text-[#1a1a3e]">
                          {stat.value}
                        </div>
                        <div className="mt-0.5 text-[11px] uppercase tracking-wider text-[#1a1a3e]/40">
                          {stat.label}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ─── How It Works ─────────────────────────────────────────── */}
      <section className="relative border-t border-[#1a1a3e]/5 bg-white py-20 sm:py-28">
        <div className="mx-auto max-w-6xl px-6">
          <div className="mb-14 text-center">
            <span className="text-xs font-semibold uppercase tracking-[0.2em] text-[#FF9933]">The Experience</span>
            <h2 className="mt-3 font-[family-name:var(--font-heading)] text-3xl font-bold text-[#1a1a3e] sm:text-4xl">
              How Parliament Comes Alive
            </h2>
          </div>

          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
            {[
              {
                num: "01",
                title: "Form Parties",
                desc: "Students split into ruling and opposition coalitions, each with a manifesto and leadership.",
                accent: "#FF9933",
              },
              {
                num: "02",
                title: "Hold Office",
                desc: "Serve as PM, Speaker, Ministers, or Members of Parliament with real responsibilities.",
                accent: "#1a1a3e",
              },
              {
                num: "03",
                title: "Debate & Draft",
                desc: "Question Hour, Zero Hour, committee discussions, and bill drafting — the full parliamentary experience.",
                accent: "#138808",
              },
              {
                num: "04",
                title: "Rise Through",
                desc: "Top performers advance from Chapter to Regional to the National finale in New Delhi.",
                accent: "#D4A843",
              },
            ].map((step) => (
              <div
                key={step.num}
                className="group relative rounded-xl border border-[#1a1a3e]/5 bg-[#FEFCF6] p-6 transition-all hover:border-[#1a1a3e]/10 hover:shadow-lg hover:shadow-[#1a1a3e]/5"
              >
                <span
                  className="font-[family-name:var(--font-heading)] text-4xl font-bold opacity-10"
                  style={{ color: step.accent }}
                >
                  {step.num}
                </span>
                <h3 className="mt-2 text-lg font-semibold text-[#1a1a3e]">
                  {step.title}
                </h3>
                <p className="mt-2 text-sm leading-relaxed text-[#1a1a3e]/50">
                  {step.desc}
                </p>
                <div
                  className="mt-4 h-0.5 w-8 rounded-full transition-all group-hover:w-12"
                  style={{ backgroundColor: step.accent }}
                />
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ─── Three Levels ─────────────────────────────────────────── */}
      <section className="relative bg-[#1a1a3e] py-20 sm:py-28">
        {/* Subtle texture */}
        <div
          className="absolute inset-0 opacity-[0.03]"
          style={{
            backgroundImage: `radial-gradient(circle at 1px 1px, white 1px, transparent 0)`,
            backgroundSize: "32px 32px",
          }}
        />
        <div className="relative mx-auto max-w-6xl px-6">
          <div className="mb-14 text-center">
            <span className="text-xs font-semibold uppercase tracking-[0.2em] text-[#FF9933]">The Journey</span>
            <h2 className="mt-3 font-[family-name:var(--font-heading)] text-3xl font-bold text-white sm:text-4xl">
              Three Levels, One Dream
            </h2>
          </div>

          <div className="grid gap-6 sm:grid-cols-3">
            {[
              {
                level: "Chapter",
                subtitle: "City Level",
                desc: "Where every young parliamentarian begins. 120-170 students from schools across your city.",
                color: "#FF9933",
                num: "01",
              },
              {
                level: "Regional",
                subtitle: "State Level",
                desc: "The best from chapters compete. Tougher debates, sharper questions, stronger bills.",
                color: "#ffffff",
                num: "02",
              },
              {
                level: "National",
                subtitle: "New Delhi",
                desc: "The grand finale. India's finest young minds. Real MPs. Real Parliament.",
                color: "#138808",
                num: "03",
              },
            ].map((item) => (
              <div
                key={item.level}
                className="group relative overflow-hidden rounded-xl border border-white/10 bg-white/5 p-8 backdrop-blur-sm transition-all hover:bg-white/10"
              >
                <span className="font-[family-name:var(--font-heading)] text-5xl font-bold text-white/5">
                  {item.num}
                </span>
                <h3
                  className="mt-2 font-[family-name:var(--font-heading)] text-2xl font-bold"
                  style={{ color: item.color }}
                >
                  {item.level}
                </h3>
                <span className="mt-1 block text-xs font-medium uppercase tracking-[0.15em] text-white/40">
                  {item.subtitle}
                </span>
                <p className="mt-4 text-sm leading-relaxed text-white/50">
                  {item.desc}
                </p>
                {/* Accent line */}
                <div
                  className="mt-6 h-0.5 w-10 rounded-full opacity-60 transition-all group-hover:w-16 group-hover:opacity-100"
                  style={{ backgroundColor: item.color }}
                />
              </div>
            ))}
          </div>

          {/* Arrow connectors (desktop only) */}
          <div className="mt-8 hidden items-center justify-center gap-2 text-white/20 sm:flex">
            <span className="text-xs uppercase tracking-wider">Chapter</span>
            <svg className="size-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M5 12h14"/><path d="m12 5 7 7-7 7"/></svg>
            <span className="text-xs uppercase tracking-wider">Regional</span>
            <svg className="size-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M5 12h14"/><path d="m12 5 7 7-7 7"/></svg>
            <span className="text-xs uppercase tracking-wider">National</span>
          </div>
        </div>
      </section>

      {/* ─── CTA Section ──────────────────────────────────────────── */}
      <section className="relative bg-[#FEFCF6] py-20 sm:py-28">
        <div className="mx-auto max-w-3xl px-6 text-center">
          <h2 className="font-[family-name:var(--font-heading)] text-3xl font-bold text-[#1a1a3e] sm:text-4xl">
            Ready to shape the future?
          </h2>
          <p className="mx-auto mt-4 max-w-lg text-lg text-[#1a1a3e]/50">
            Whether you&apos;re organizing a chapter event or joining as a participant,
            the Parliament awaits.
          </p>
          <div className="mt-10 flex flex-wrap justify-center gap-4">
            <Link
              href="/yip/login"
              className="inline-flex items-center gap-2 rounded-xl bg-[#FF9933] px-8 py-4 text-base font-semibold text-white shadow-lg shadow-[#FF9933]/25 transition-all hover:shadow-xl"
            >
              Start Organizing
            </Link>
            <Link
              href="/yip/join"
              className="inline-flex items-center gap-2 rounded-xl border-2 border-[#1a1a3e]/10 bg-white px-8 py-4 text-base font-semibold text-[#1a1a3e] transition-all hover:border-[#1a1a3e]/20 hover:shadow-md"
            >
              Enter Access Code
            </Link>
          </div>
        </div>
      </section>

      {/* ─── Footer ───────────────────────────────────────────────── */}
      <footer className="border-t border-[#1a1a3e]/5 bg-white py-10">
        <div className="mx-auto max-w-6xl px-6">
          <div className="flex flex-col items-center gap-6">
            <div className="flex flex-wrap items-center justify-center gap-6 text-xs font-medium uppercase tracking-[0.15em] text-[#1a1a3e]/25">
              <span>Young Indians (Yi)</span>
              <span className="hidden sm:inline h-3 w-px bg-[#1a1a3e]/10" />
              <span>Confederation of Indian Industry</span>
              <span className="hidden sm:inline h-3 w-px bg-[#1a1a3e]/10" />
              <span>Thalir</span>
              <span className="hidden sm:inline h-3 w-px bg-[#1a1a3e]/10" />
              <span>Bharat Rising</span>
            </div>
            {/* Tricolor line */}
            <div className="flex w-20 overflow-hidden rounded-full">
              <div className="h-1 flex-1 bg-[#FF9933]" />
              <div className="h-1 flex-1 bg-white border-y border-[#1a1a3e]/5" />
              <div className="h-1 flex-1 bg-[#138808]" />
            </div>
            <p className="text-[11px] text-[#1a1a3e]/30">
              Young Indians Parliament &mdash; Empowering Youth Through Democratic Engagement
            </p>
          </div>
        </div>
      </footer>
    </div>
  );
}
