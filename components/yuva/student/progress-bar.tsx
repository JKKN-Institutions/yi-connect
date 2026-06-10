/**
 * Student progress bar — tiny presentational bar (RSC-safe, no client JS).
 * Values come from lib/yuva/progress.ts (already clamped 0–100).
 */

export function ProgressBar({
  value,
  label,
  className = "",
}: {
  value: number;
  label?: string;
  className?: string;
}) {
  const clamped = Math.min(100, Math.max(0, value));
  return (
    <div className={className}>
      {label && (
        <div className="mb-1 flex items-center justify-between text-xs">
          <span className="font-medium text-slate-600">{label}</span>
          <span className="tabular-nums text-slate-500">{clamped}%</span>
        </div>
      )}
      <div
        className="h-2 w-full overflow-hidden rounded-full bg-slate-100"
        role="progressbar"
        aria-valuenow={clamped}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-label={label ?? "Progress"}
      >
        <div
          className="h-full rounded-full bg-emerald-500 transition-[width]"
          style={{ width: `${clamped}%` }}
        />
      </div>
    </div>
  );
}
