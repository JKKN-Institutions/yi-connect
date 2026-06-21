export function SignupFunnel({
  enrolled,
  allocated,
  checkedIn,
}: {
  enrolled: number;
  allocated: number;
  checkedIn: number;
}) {
  const base = Math.max(enrolled, 1);
  const stages = [
    { label: "Signed up", count: enrolled, color: "#FF9933" },
    { label: "Assigned a party", count: allocated, color: "#1a1a3e" },
    { label: "Checked in", count: checkedIn, color: "#138808" },
  ];

  return (
    <section className="rounded-2xl border border-[#1a1a3e]/8 bg-white p-6">
      <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[#1a1a3e]/55">
        Sign-up funnel
      </p>

      <div className="mt-5 space-y-5">
        {stages.map((stage) => {
          const widthPct = (stage.count / base) * 100;
          const sharePct = Math.round((stage.count / base) * 100);
          return (
            <div key={stage.label}>
              <div className="flex items-baseline justify-between gap-3">
                <span className="text-sm font-medium text-[#1a1a3e]">
                  {stage.label}
                </span>
                <span className="text-2xl font-semibold tabular-nums text-[#1a1a3e]">
                  {stage.count.toLocaleString("en-IN")}
                </span>
              </div>
              <div className="mt-2 h-2.5 w-full overflow-hidden rounded-full bg-[#1a1a3e]/6">
                <div
                  className="h-full rounded-full transition-all"
                  style={{
                    width: `${widthPct}%`,
                    backgroundColor: stage.color,
                  }}
                />
              </div>
              <p className="mt-1.5 text-xs tabular-nums text-[#1a1a3e]/45">
                {sharePct}% of signed-up
              </p>
            </div>
          );
        })}
      </div>

      <p className="mt-5 text-xs text-[#1a1a3e]/45">
        Check-in fills up as events run.
      </p>
    </section>
  );
}
